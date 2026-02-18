import mongoose from 'mongoose';
import { Consultation } from '../../models/Consultation';
import { ChecklistItem } from '../../models/ChecklistItem';
import { GameProgress } from '../../models/GameProgress';
import { ChatMessage } from '../../models/ChatMessage';
import { ContextChunk } from '../../models/ContextChunk';
import {
  decideContextPolicy,
  estimateTokensFromText,
  estimateTokensFromTexts,
  type RetrievalMode,
} from './contextPolicy';
import { embedText } from './embeddingService';
import { invokeTextModel } from '../sagemaker';

export interface RetrievedContext {
  mode: RetrievalMode;
  tokenEstimate: number;
  contextString: string;
  topChunkIds?: string[];
}

function formatChecklistItem(item: any): string {
  const status = item.isFullyDone
    ? 'completed'
    : item.isCompleted
      ? 'done_this_cycle'
      : item.unlockAt && new Date() < new Date(item.unlockAt)
        ? 'locked'
        : item.nextDueAt && new Date() < new Date(item.nextDueAt)
          ? 'cooldown'
          : 'available';
  return `- ${item.title} (${status}) | ${item.description} | frequency=${item.frequency} | progress=${item.completionCount}/${item.totalRequired || 'ongoing'}`;
}

async function summarizeForSmallContextIfNeeded(
  rawContext: string,
  shouldSummarize: boolean
): Promise<string> {
  if (!shouldSummarize) return rawContext;
  const prompt = [
    'Summarize this patient context while preserving exact medication names/doses/schedules, pending checklist tasks, and near-term deadlines.',
    'Keep the summary factual, concise, and structured for clinical assistant use.',
    '',
    rawContext,
  ].join('\n');
  const out = await invokeTextModel(prompt);
  return out.text?.trim() || rawContext;
}

async function buildSmallContext(userId: string, consultationId?: string): Promise<{ context: string; tokenEstimate: number }> {
  const latestConsultation = consultationId
    ? await Consultation.findOne({ _id: consultationId, userId }).lean()
    : await Consultation.findOne({ userId }).sort({ createdAt: -1 }).lean();

  const activeChecklist = consultationId
    ? await ChecklistItem.find({ userId, consultationId }).sort({ order: 1 }).lean()
    : await ChecklistItem.find({ userId }).sort({ updatedAt: -1 }).limit(20).lean();

  const progress = await GameProgress.findOne({ userId }).lean();
  const recentMessages = await ChatMessage.find({
    userId,
    ...(consultationId ? { consultationId } : {}),
  })
    .sort({ createdAt: -1 })
    .limit(12)
    .lean();

  const recentConsultations = await Consultation.find({ userId })
    .sort({ createdAt: -1 })
    .limit(3)
    .lean();

  const uploadsSection = (latestConsultation?.uploads || [])
    .map((u, i) => `- upload#${i + 1} type=${u.type} summary=${(u.summary || '').slice(0, 700)}`)
    .join('\n');
  const checklistSection = activeChecklist.map(formatChecklistItem).join('\n');
  const chatSection = recentMessages
    .reverse()
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n');
  const consultSection = recentConsultations
    .map((c) => `- ${c.title} (${new Date(c.createdAt).toISOString()}): ${(c.aggregatedSummary || c.checklistParagraph || '').slice(0, 500)}`)
    .join('\n');

  const raw = [
    'PATIENT_CONTEXT',
    `consultation_title: ${latestConsultation?.title || 'N/A'}`,
    `consultation_summary: ${latestConsultation?.aggregatedSummary || latestConsultation?.checklistParagraph || 'N/A'}`,
    '',
    'UPLOAD_SUMMARIES',
    uploadsSection || 'N/A',
    '',
    'CHECKLIST',
    checklistSection || 'N/A',
    '',
    'PROGRESSION',
    `level=${progress?.level || 1} xp=${progress?.xp || 0} streak=${progress?.streak || 0} totalCompleted=${progress?.totalCompleted || 0}`,
    '',
    'RECENT_CHAT',
    chatSection || 'N/A',
    '',
    'RECENT_CONSULTATIONS',
    consultSection || 'N/A',
  ].join('\n');

  return { context: raw, tokenEstimate: estimateTokensFromText(raw) };
}

async function buildVectorContext(
  userId: string,
  query: string,
  consultationId?: string
): Promise<{ context: string; tokenEstimate: number; chunkIds: string[] }> {
  const embedding = await embedText(query);
  const vectorIndexName = process.env.MONGODB_VECTOR_INDEX || 'context_embedding_index';
  const limit = Number(process.env.RAG_VECTOR_TOP_K || 8);

  const filter: Record<string, any> = {
    userId: new mongoose.Types.ObjectId(userId),
  };
  if (consultationId) filter.consultationId = new mongoose.Types.ObjectId(consultationId);

  const pipeline: any[] = [
    {
      $vectorSearch: {
        index: vectorIndexName,
        path: 'embedding',
        queryVector: embedding,
        numCandidates: Math.max(limit * 8, 40),
        limit,
        filter,
      },
    },
    {
      $project: {
        content: 1,
        sourceType: 1,
        sourceId: 1,
      },
    },
  ];

  const hits = await ContextChunk.aggregate(pipeline);
  const chunkIds = hits.map((h: any) => String(h._id));
  const hitText = hits
    .map((h: any, idx: number) => `- chunk#${idx + 1} source=${h.sourceType}:${h.sourceId}\n${h.content}`)
    .join('\n\n');

  const activeChecklist = await ChecklistItem.find({
    userId,
    ...(consultationId ? { consultationId } : {}),
    isFullyDone: false,
  })
    .sort({ order: 1 })
    .limit(12)
    .lean();
  const progress = await GameProgress.findOne({ userId }).lean();
  const recentMessages = await ChatMessage.find({
    userId,
    ...(consultationId ? { consultationId } : {}),
  })
    .sort({ createdAt: -1 })
    .limit(6)
    .lean();

  const context = [
    'RETRIEVED_PATIENT_CONTEXT',
    hitText || 'No vector chunks found.',
    '',
    'ALWAYS_INCLUDE_ACTIVE_CHECKLIST',
    activeChecklist.map(formatChecklistItem).join('\n') || 'N/A',
    '',
    'ALWAYS_INCLUDE_PROGRESSION',
    `level=${progress?.level || 1} xp=${progress?.xp || 0} streak=${progress?.streak || 0} totalCompleted=${progress?.totalCompleted || 0}`,
    '',
    'RECENT_CHAT',
    recentMessages
      .reverse()
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n') || 'N/A',
  ].join('\n');

  return {
    context,
    tokenEstimate: estimateTokensFromText(context),
    chunkIds,
  };
}

export async function retrieveAdaptiveContext(
  userId: string,
  query: string,
  consultationId?: string
): Promise<RetrievedContext> {
  const small = await buildSmallContext(userId, consultationId);
  const policy = decideContextPolicy(small.tokenEstimate);

  if (policy.mode === 'small') {
    const contextString = await summarizeForSmallContextIfNeeded(
      small.context,
      policy.shouldSummarizeSmallContext
    );
    return {
      mode: 'small',
      tokenEstimate: estimateTokensFromText(contextString),
      contextString,
      topChunkIds: [],
    };
  }

  try {
    const vector = await buildVectorContext(userId, query, consultationId);
    return {
      mode: 'vector',
      tokenEstimate: vector.tokenEstimate,
      contextString: vector.context,
      topChunkIds: vector.chunkIds,
    };
  } catch (error) {
    console.warn('[RAG] Vector retrieval failed, falling back to small context:', error);
    return {
      mode: 'small',
      tokenEstimate: small.tokenEstimate,
      contextString: small.context,
      topChunkIds: [],
    };
  }
}

export function estimateChatRequestTokens(userPrompt: string, contextString: string): number {
  return estimateTokensFromTexts([userPrompt, contextString]);
}

