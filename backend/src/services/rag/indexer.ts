import { Consultation } from '../../models/Consultation';
import { ChecklistItem } from '../../models/ChecklistItem';
import { ContextChunk, type ContextChunkSourceType } from '../../models/ContextChunk';
import { ChatMessage } from '../../models/ChatMessage';
import { estimateTokensFromText } from './contextPolicy';
import { embedText } from './embeddingService';

function chunkText(text: string, maxChars: number): string[] {
  const safe = (text || '').trim();
  if (!safe) return [];
  if (safe.length <= maxChars) return [safe];
  const out: string[] = [];
  let start = 0;
  while (start < safe.length) {
    out.push(safe.slice(start, start + maxChars));
    start += maxChars;
  }
  return out;
}

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

export async function indexConsultationContext(userId: string, consultationId: string): Promise<void> {
  const consultation = await Consultation.findOne({ _id: consultationId, userId }).lean();
  if (!consultation) return;

  const checklistItems = await ChecklistItem.find({ userId, consultationId }).sort({ order: 1 }).lean();

  const summaryChunks = chunkText(
    consultation.aggregatedSummary || consultation.checklistParagraph || '',
    1200
  );
  for (let i = 0; i < summaryChunks.length; i += 1) {
    await upsertChunk({
      userId,
      consultationId,
      sourceType: 'consultation_summary',
      sourceId: `${consultationId}:summary:${i}`,
      content: summaryChunks[i],
    });
  }

  for (let i = 0; i < (consultation.uploads || []).length; i += 1) {
    const upload = consultation.uploads[i];
    if (!upload.summary) continue;
    const uploadChunks = chunkText(upload.summary, 900);
    for (let j = 0; j < uploadChunks.length; j += 1) {
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

  for (const item of checklistItems) {
    await upsertChunk({
      userId,
      consultationId,
      sourceType: 'checklist_item',
      sourceId: String(item._id),
      content: `${item.title}\n${item.description}\nfrequency=${item.frequency}\ncategory=${item.category}`,
      metadata: {
        checklistCategory: item.category,
        isActiveChecklist: !item.isFullyDone,
      },
    });
  }
}

export async function indexChatMessageChunk(messageId: string): Promise<void> {
  const msg = await ChatMessage.findById(messageId).lean();
  if (!msg || !msg.content) return;

  await upsertChunk({
    userId: String(msg.userId),
    consultationId: msg.consultationId ? String(msg.consultationId) : undefined,
    sourceType: 'chat_message',
    sourceId: String(msg._id),
    content: `${msg.role}: ${msg.content}`,
    metadata: { createdAtSource: msg.createdAt },
  });
}

