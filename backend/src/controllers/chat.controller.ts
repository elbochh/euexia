import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { ChatMessage } from '../models/ChatMessage';
import { retrieveContext, estimateChatRequestTokens } from '../services/rag/retriever';
import { generateChatResponse } from '../services/rag/langchainMedGemma';
import { condenseQuestion } from '../services/rag/questionCondenser';
import { indexChatMessageChunk } from '../services/rag/indexer';

// ---------------------------------------------------------------------------
// System prompt — keep it SHORT so more token budget goes to context + answer
// ---------------------------------------------------------------------------
function buildSystemPrompt(contextString: string): string {
    return [
      'You are Euexia Doctor Assistant — a helpful, knowledgeable medical follow-up chatbot.',
      '',
      'RULES (follow strictly):',
      '1. You MUST ALWAYS provide a helpful answer. NEVER refuse or say "I cannot help" or "no information available".',
      '2. For patient-specific questions (medications, diagnoses, appointments): use the patient context below. Never invent patient-specific medications, doses, or diagnoses.',
      '3. For general health questions (nutrition, exercise, wellness, meals, recipes): provide evidence-based general advice. Prioritize patient context if relevant, but ALWAYS answer even without it.',
      '4. Give concrete, specific advice — include food names, exercise types, exact actions, quantities.',
      '5. Use bullet points for lists. Keep answers complete but focused (no filler).',
      '6. Never repeat the same sentence or point twice.',
      '7. If patient-specific info is missing for a specific question, provide helpful general guidance and briefly note they should consult their doctor for personalized details.',
      '8. CONVERSATION CONTINUITY: When the patient refers to something from the recent conversation (e.g., "these meals", "that medication", "those exercises"), refer back to what was specifically discussed. Do NOT change topic or ignore the reference.',
      '9. Answer ONLY the question asked. Do not add unrelated information about medications when asked about food, or vice versa.',
      '',
      contextString,
    ].join('\n');
  }
// ---------------------------------------------------------------------------
// GET /api/chat — chat history
// ---------------------------------------------------------------------------
export const getChatHistory = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const consultationId = req.query.consultationId as string | undefined;
    const limit = Math.min(Number(req.query.limit || 40), 100);

    const messages = await ChatMessage.find({
      userId: req.userId!,
      ...(consultationId ? { consultationId } : {}),
    })
      .sort({ createdAt: 1 })
      .limit(limit)
      .lean();

    res.json({ messages });
  } catch (error) {
    console.error('getChatHistory error:', error);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
};

// ---------------------------------------------------------------------------
// POST /api/chat — send message (full RAG pipeline)
// ---------------------------------------------------------------------------
export const sendChatMessage = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.userId!;
    const { message, consultationId } = req.body as {
      message: string;
      consultationId?: string;
    };

    const userMessage = (message || '').trim();
    if (!userMessage) {
      res.status(400).json({ error: 'message is required' });
      return;
    }

    // ---- Save user message ----
    const savedUserMsg = await ChatMessage.create({
      userId,
      consultationId: consultationId || null,
      role: 'user',
      content: userMessage,
    });
    // Fire-and-forget indexing for user message only
    indexChatMessageChunk(String(savedUserMsg._id)).catch(() => {});

    // ================================================================
    // STEP 1 — Condense question using recent chat history
    // ================================================================
    const recentHistory = await ChatMessage.find({
      userId,
      ...(consultationId ? { consultationId } : {}),
    })
      .sort({ createdAt: -1 })
      .limit(6)
      .lean();

    const historyTurns = recentHistory.reverse().map((h) => ({
      role: h.role as string,
      content: h.content,
    }));

    const standaloneQuestion = await condenseQuestion(historyTurns, userMessage);
    console.log('[RAG] Condensed question:', standaloneQuestion);

    // ================================================================
    // STEP 2 — Retrieve focused context (vector + MMR + always-include)
    // ================================================================
    const context = await retrieveContext(
      userId,
      standaloneQuestion,
      consultationId
    );
    console.log(
      `[RAG] Retrieved context: ~${context.tokenEstimate} tokens, ${context.topChunkIds.length} chunks`
    );
    // Log first 200 chars of context for debugging
    console.log(`[RAG] Context preview: ${context.contextString.substring(0, 200)}...`);

    // ================================================================
    // STEP 3 — Generate answer via MedGemma (with conversation history)
    // ================================================================
    // Build compact conversation history for the generation prompt.
    // Exclude the current user message (it's the userMessage param).
    // Include both user and assistant messages for continuity.
    const conversationHistory = historyTurns
      .slice(0, -1) // exclude the current message (already in standaloneQuestion)
      .slice(-4);    // last 2 exchanges (4 messages: user+assistant+user+assistant)

    let ai;
    try {
      ai = await generateChatResponse({
        systemPrompt: buildSystemPrompt(context.contextString),
        userMessage: standaloneQuestion,
        conversationHistory,
      });
    } catch (err: any) {
      const msg = String(err?.message || '');
      const isTokenError =
        msg.includes('4096 tokens') || msg.includes('Input validation error');
      if (!isTokenError) throw err;

      // Retry with minimal context and no history (save tokens)
      console.warn('[RAG] Token limit hit, retrying with minimal context');
      const minimalContext = context.contextString.slice(0, 2000);
      ai = await generateChatResponse({
        systemPrompt: buildSystemPrompt(minimalContext),
        userMessage: userMessage.slice(0, 200),
      });
    }

    // ================================================================
    // STEP 4 — Save assistant response (already post-processed in generateChatResponse)
    // ================================================================
    const savedAssistantMsg = await ChatMessage.create({
      userId,
      consultationId: consultationId || null,
      role: 'assistant',
      content: ai.text || 'I could not generate a response. Please try again.',
      retrievalMode: context.mode,
      metadata: {
        contextTokenEstimate: context.tokenEstimate,
        vectorTopK: context.topChunkIds.length,
        sourceChunkIds: context.topChunkIds,
        condensedQuestion: standaloneQuestion,
      },
    });
    // Do NOT index assistant messages — prevents recursive context pollution

    res.json({
      message: savedAssistantMsg,
      retrieval: {
        mode: context.mode,
        contextTokenEstimate: context.tokenEstimate,
        vectorTopK: context.topChunkIds.length,
      },
    });
  } catch (error) {
    console.error('sendChatMessage error:', error);
    res.status(500).json({ error: 'Failed to send chat message' });
  }
};
