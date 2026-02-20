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
      'You are Euexia Doctor Assistant — a concise, supportive medical follow-up chatbot.',
      '',
      'RULES:',
      '• For patient-specific questions (medications, diagnoses, appointments): Use ONLY the patient context below. Never invent patient-specific medications, doses, or diagnoses.',
      '• For general health questions (nutrition, exercise, wellness): You may provide evidence-based general advice, but prioritize any relevant information from the patient context if available.',
      '• Give concrete, specific advice (food names, exercise types, exact actions).',
      '• Max 5 bullet points OR 1 short paragraph. Max ~100 words.',
      '• Never repeat a sentence you already wrote.',
      '• If patient-specific info is missing, provide general guidance and suggest consulting their doctor for personalized advice.',
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

    // ================================================================
    // STEP 3 — Generate answer via MedGemma
    // ================================================================
    let ai;
    try {
      ai = await generateChatResponse({
        systemPrompt: buildSystemPrompt(context.contextString),
        userMessage: standaloneQuestion,
      });
    } catch (err: any) {
      const msg = String(err?.message || '');
      const isTokenError =
        msg.includes('4096 tokens') || msg.includes('Input validation error');
      if (!isTokenError) throw err;

      // Retry with minimal context
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
