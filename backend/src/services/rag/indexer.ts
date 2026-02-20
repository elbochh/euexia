import { Consultation } from '../../models/Consultation';
import { ChecklistItem } from '../../models/ChecklistItem';
import { ContextChunk, type ContextChunkSourceType } from '../../models/ContextChunk';
import { ChatMessage } from '../../models/ChatMessage';
import { estimateTokensFromText } from './contextPolicy';
import { embedText } from './embeddingService';
import { recursiveSplit, deduplicateChunks } from './textSplitter';

async function upsertChunk(input: {
  userId: string;
  consultationId?: string;
  sourceType: ContextChunkSourceType;
  sourceId: string;
  content: string;
  metadata?: Record<string, any>;
}) {
  const content = (input.content || '').trim();
  if (!content) return;
  const embedding = await embedText(content);
  const tokenEstimate = estimateTokensFromText(content);
  await ContextChunk.updateOne(
    {
      userId: input.userId,
      consultationId: input.consultationId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
    },
    {
      $set: {
        userId: input.userId,
        consultationId: input.consultationId || null,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        content,
        tokenEstimate,
        embedding,
        metadata: input.metadata || {},
      },
    },
    { upsert: true }
  );
}

/**
 * Index all consultation data (summary, uploads, checklist items) into
 * semantically-split, deduplicated context chunks for vector search.
 */
export async function indexConsultationContext(
  userId: string,
  consultationId: string
): Promise<void> {
  const consultation = await Consultation.findOne({ _id: consultationId, userId }).lean();
  if (!consultation) return;

  const checklistItems = await ChecklistItem.find({ userId, consultationId })
    .sort({ order: 1 })
    .lean();

  // --- Consultation summary: semantic split + dedup ---
  const rawSummary =
    consultation.aggregatedSummary || consultation.checklistParagraph || '';
  const summaryChunks = deduplicateChunks(recursiveSplit(rawSummary, 600, 80));
  for (let i = 0; i < summaryChunks.length; i++) {
    await upsertChunk({
      userId,
      consultationId,
      sourceType: 'consultation_summary',
      sourceId: `${consultationId}:summary:${i}`,
      content: summaryChunks[i],
    });
  }

  // --- Upload summaries: semantic split + dedup ---
  for (let i = 0; i < (consultation.uploads || []).length; i++) {
    const upload = consultation.uploads[i];
    if (!upload.summary) continue;
    const uploadChunks = deduplicateChunks(recursiveSplit(upload.summary, 500, 60));
    for (let j = 0; j < uploadChunks.length; j++) {
      await upsertChunk({
        userId,
        consultationId,
        sourceType: 'upload_summary',
        sourceId: `${consultationId}:upload:${i}:${j}`,
        content: uploadChunks[j],
        metadata: { uploadType: upload.type },
      });
    }
  }

  // --- Checklist items: one compact chunk per item ---
  for (const item of checklistItems) {
    await upsertChunk({
      userId,
      consultationId,
      sourceType: 'checklist_item',
      sourceId: String(item._id),
      content: `${item.title}: ${item.description} (${item.frequency}, ${item.category})`,
      metadata: {
        checklistCategory: item.category,
        isActiveChecklist: !item.isFullyDone,
      },
    });
  }
}

/**
 * Index a single user chat message for future vector retrieval.
 * Assistant messages are NOT indexed to prevent recursive context pollution.
 */
export async function indexChatMessageChunk(messageId: string): Promise<void> {
  const msg = await ChatMessage.findById(messageId).lean();
  if (!msg || !msg.content) return;
  // Only index user messages
  if (msg.role !== 'user') return;

  await upsertChunk({
    userId: String(msg.userId),
    consultationId: msg.consultationId ? String(msg.consultationId) : undefined,
    sourceType: 'chat_message',
    sourceId: String(msg._id),
    content: msg.content,
    metadata: { createdAtSource: msg.createdAt, role: msg.role },
  });
}
