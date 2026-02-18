import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { ChatMessage } from '../models/ChatMessage';
import { retrieveAdaptiveContext, estimateChatRequestTokens } from '../services/rag/retriever';
import { invokeMedGemmaWithLangChain } from '../services/rag/langchainMedGemma';
import { indexChatMessageChunk } from '../services/rag/indexer';

const DEFAULT_HISTORY_LIMIT = 40;

function buildSystemPrompt(contextString: string): string {
  return [
    'You are Euexia Doctor Assistant, a precise and supportive medical follow-up assistant.',
    'Use only the patient context provided below plus the user message.',
    'Rules:',
    '1) Do not invent medications, doses, or diagnoses.',
    '2) If data is missing, say what is missing and suggest next safe step.',
    '3) Prioritize active checklist tasks and near-term due items.',
    '4) Keep response concise, actionable, and personalized.',
    '',
    'PATIENT_CONTEXT_START',
    contextString,
    'PATIENT_CONTEXT_END',
  ].join('\n');
}

export const getChatHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const consultationId = req.query.consultationId as string | undefined;
    const limit = Math.min(Number(req.query.limit || DEFAULT_HISTORY_LIMIT), 100);
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

export const sendChatMessage = async (req: AuthRequest, res: Response): Promise<void> => {
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

    const savedUserMsg = await ChatMessage.create({
      userId,
      consultationId: consultationId || null,
      role: 'user',
      content: userMessage,
    });
    // Fire-and-forget indexing for user chat message
    indexChatMessageChunk(String(savedUserMsg._id)).catch((err) =>
      console.warn('[RAG] index user chat message failed:', err)
    );

    const adaptive = await retrieveAdaptiveContext(userId, userMessage, consultationId);
    const estimatedTokens = estimateChatRequestTokens(userMessage, adaptive.contextString);

    const history = await ChatMessage.find({
      userId,
      ...(consultationId ? { consultationId } : {}),
    })
      .sort({ createdAt: -1 })
      .limit(12)
      .lean();

    const ai = await invokeMedGemmaWithLangChain({
      systemPrompt: buildSystemPrompt(adaptive.contextString),
      history: history
        .reverse()
        .map((h) => ({
          role: h.role === 'assistant' ? 'assistant' : h.role === 'system' ? 'system' : 'user',
          content: h.content,
        })),
      userMessage,
    });

    const savedAssistantMsg = await ChatMessage.create({
      userId,
      consultationId: consultationId || null,
      role: 'assistant',
      content: ai.text,
      retrievalMode: adaptive.mode,
      metadata: {
        contextTokenEstimate: estimatedTokens,
        vectorTopK: adaptive.topChunkIds?.length || 0,
        sourceChunkIds: adaptive.topChunkIds || [],
      },
    });
    indexChatMessageChunk(String(savedAssistantMsg._id)).catch((err) =>
      console.warn('[RAG] index assistant chat message failed:', err)
    );

    res.json({
      message: savedAssistantMsg,
      retrieval: {
        mode: adaptive.mode,
        contextTokenEstimate: estimatedTokens,
        vectorTopK: adaptive.topChunkIds?.length || 0,
      },
    });
  } catch (error) {
    console.error('sendChatMessage error:', error);
    res.status(500).json({ error: 'Failed to send chat message' });
  }
};

