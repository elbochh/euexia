import mongoose from 'mongoose';
import { ChecklistItem } from '../../models/ChecklistItem';
import { GameProgress } from '../../models/GameProgress';
import { Consultation } from '../../models/Consultation';
import { ContextChunk } from '../../models/ContextChunk';
import { estimateTokensFromText } from './contextPolicy';
import { embedText } from './embeddingService';

export interface RetrievedContext {
  mode: 'vector';
  tokenEstimate: number;
  contextString: string;
  topChunkIds: string[];
}

const CONTEXT_TOKEN_BUDGET = Number(process.env.RAG_CONTEXT_TOKEN_BUDGET || 1800);
const VECTOR_TOP_K = Number(process.env.RAG_VECTOR_TOP_K || 10);

// ---------------------------------------------------------------------------
// Cosine similarity
// ---------------------------------------------------------------------------
function cosineSim(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
}

// ---------------------------------------------------------------------------
// MMR (Maximal Marginal Relevance) reranking
// ---------------------------------------------------------------------------
interface ChunkHit {
  content: string;
  embedding: number[];
  _id: string;
  sourceType: string;
  sourceId: string;
}

function mmrRerank(
  queryEmbedding: number[],
  chunks: ChunkHit[],
  k: number,
  lambda = 0.6
): ChunkHit[] {
  if (chunks.length <= k) return chunks;

  const selected: ChunkHit[] = [];
  const remaining = [...chunks];
  const querySims = remaining.map((c) => cosineSim(queryEmbedding, c.embedding));

  while (selected.length < k && remaining.length > 0) {
    let bestIdx = 0;
    let bestScore = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const relevance = querySims[i];
      let maxDiversity = 0;
      for (const sel of selected) {
        const sim = cosineSim(remaining[i].embedding, sel.embedding);
        if (sim > maxDiversity) maxDiversity = sim;
      }
      const mmrScore = lambda * relevance - (1 - lambda) * maxDiversity;
      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestIdx = i;
      }
    }

    selected.push(remaining[bestIdx]);
    remaining.splice(bestIdx, 1);
    querySims.splice(bestIdx, 1);
  }

  return selected;
}

// ---------------------------------------------------------------------------
// Text-level deduplication for retrieved blocks
// ---------------------------------------------------------------------------
function dedupeTextBlocks(blocks: string[]): string[] {
  const kept: string[] = [];
  for (const block of blocks) {
    const words = new Set(
      block
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
    );
    let isDup = false;
    for (const k of kept) {
      const kWords = new Set(
        k
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .split(/\s+/)
      );
      const overlap = [...words].filter((w) => kWords.has(w)).length;
      if (overlap / Math.max(words.size, kWords.size, 1) > 0.6) {
        isDup = true;
        break;
      }
    }
    if (!isDup) kept.push(block);
  }
  return kept;
}

function trimToCharBudget(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars).trim() + '\n[...truncated]';
}

// ---------------------------------------------------------------------------
// Atlas Vector Search (may fail if index not configured)
// ---------------------------------------------------------------------------
async function atlasVectorSearch(
  queryEmbedding: number[],
  filter: Record<string, any>,
  indexName: string,
  topK: number
): Promise<ChunkHit[]> {
  return ContextChunk.aggregate([
    {
      $vectorSearch: {
        index: indexName,
        path: 'embedding',
        queryVector: queryEmbedding,
        numCandidates: Math.max(topK * 10, 60),
        limit: topK,
        filter,
      },
    },
    { $project: { content: 1, sourceType: 1, sourceId: 1, embedding: 1 } },
  ]);
}

// ---------------------------------------------------------------------------
// Cosine-similarity fallback: fetch all relevant chunks and rank in-memory
// This works without Atlas Vector Search index.
// ---------------------------------------------------------------------------
async function cosineFallbackSearch(
  queryEmbedding: number[],
  userId: string,
  consultationId: string | undefined,
  topK: number
): Promise<ChunkHit[]> {
  const filter: Record<string, any> = {
    userId: new mongoose.Types.ObjectId(userId),
    sourceType: { $in: ['consultation_summary', 'upload_summary', 'checklist_item'] },
  };
  if (consultationId) {
    filter.consultationId = new mongoose.Types.ObjectId(consultationId);
  }

  // Fetch all chunks for this user/consultation (with embedding)
  const allChunks = await ContextChunk.find(filter)
    .select('content sourceType sourceId embedding')
    .lean();

  if (!allChunks.length) return [];

  // Score each chunk by cosine similarity to the query
  const scored = allChunks
    .filter((c: any) => c.embedding && c.embedding.length > 0)
    .map((c: any) => ({
      _id: String(c._id),
      content: c.content,
      sourceType: c.sourceType,
      sourceId: c.sourceId,
      embedding: c.embedding,
      score: cosineSim(queryEmbedding, c.embedding),
    }))
    .sort((a, b) => b.score - a.score);

  console.log(
    `[RAG] Cosine fallback: scored ${scored.length} chunks, top score: ${scored[0]?.score?.toFixed(3) ?? 'N/A'}`
  );

  return scored.slice(0, topK);
}

// ---------------------------------------------------------------------------
// Main retrieval function
// ---------------------------------------------------------------------------

/**
 * Retrieve focused patient context for a standalone question.
 *
 * Pipeline:
 *   1. Embed the standalone question
 *   2. Try Atlas Vector Search → fall back to in-memory cosine search
 *   3. MMR rerank for diversity (avoid near-duplicate chunks)
 *   4. Text-level deduplication
 *   5. Append always-include structured data (active checklist + game progress)
 *   6. Trim to token budget
 */
export async function retrieveContext(
  userId: string,
  standaloneQuestion: string,
  consultationId?: string
): Promise<RetrievedContext> {
  const queryEmbedding = await embedText(standaloneQuestion);
  const vectorIndexName =
    process.env.MONGODB_VECTOR_INDEX || 'context_embedding_index';

  // --- Step 1: Try Atlas Vector Search, fallback to cosine ---
  const filter: Record<string, any> = {
    userId: new mongoose.Types.ObjectId(userId),
    sourceType: { $in: ['consultation_summary', 'upload_summary', 'checklist_item'] },
  };
  if (consultationId) {
    filter.consultationId = new mongoose.Types.ObjectId(consultationId);
  }

  let hits: ChunkHit[] = [];
  try {
    hits = await atlasVectorSearch(queryEmbedding, filter, vectorIndexName, VECTOR_TOP_K);
    if (hits.length > 0) {
      console.log(`[RAG] Atlas Vector Search returned ${hits.length} chunks`);
    }
  } catch (err: any) {
    console.warn(`[RAG] Atlas Vector Search unavailable (${err?.codeName || err?.message || 'unknown'}), using cosine fallback`);
  }

  // Fallback: in-memory cosine similarity search
  if (hits.length === 0) {
    try {
      hits = await cosineFallbackSearch(queryEmbedding, userId, consultationId, VECTOR_TOP_K);
      if (hits.length > 0) {
        console.log(`[RAG] Cosine fallback returned ${hits.length} chunks`);
      } else {
        console.warn(`[RAG] No context chunks found for user ${userId}, consultation ${consultationId || 'any'}`);
      }
    } catch (fallbackErr) {
      console.error('[RAG] Cosine fallback also failed:', fallbackErr);
    }
  }

  // --- Step 2: MMR rerank for diversity ---
  const diverse = mmrRerank(queryEmbedding, hits, Math.min(5, hits.length));

  // --- Step 3: Text-level deduplication ---
  const chunkTexts = diverse.map((h) => (h.content || '').trim());
  const uniqueTexts = dedupeTextBlocks(chunkTexts);
  let retrievedSection = '';

  if (uniqueTexts.length > 0) {
    retrievedSection = uniqueTexts
      .map((t, i) => `[${i + 1}] ${trimToCharBudget(t, 400)}`)
      .join('\n\n');
  } else {
    // Ultimate fallback: load consultation summary directly from DB
    // This handles cases where indexing never ran or failed
    console.warn('[RAG] No chunks found, trying direct consultation lookup...');
    try {
      const consultationFilter: Record<string, any> = { userId };
      if (consultationId) {
        consultationFilter._id = consultationId;
      }
      const consultations = await Consultation.find(consultationFilter)
        .sort({ createdAt: -1 })
        .limit(2)
        .select('aggregatedSummary checklistParagraph')
        .lean();

      const directTexts = consultations
        .map((c: any) => (c.aggregatedSummary || c.checklistParagraph || '').trim())
        .filter((t: string) => t.length > 0);

      if (directTexts.length > 0) {
        retrievedSection = directTexts
          .map((t: string, i: number) => `[${i + 1}] ${trimToCharBudget(t, 600)}`)
          .join('\n\n');
        console.log(`[RAG] Direct consultation fallback: loaded ${directTexts.length} summaries`);
      } else {
        retrievedSection = 'No relevant patient records found.';
      }
    } catch (dbErr) {
      console.error('[RAG] Direct consultation lookup failed:', dbErr);
      retrievedSection = 'No relevant patient records found.';
    }
  }

  // --- Step 4: Always-include structured data (compact) ---
  const activeChecklist = await ChecklistItem.find({
    userId,
    ...(consultationId ? { consultationId } : {}),
    isFullyDone: false,
  })
    .sort({ order: 1 })
    .limit(10)
    .lean();

  const progress = await GameProgress.findOne({ userId }).lean();

  const checklistLines = activeChecklist.map((item: any) => {
    const status = item.isCompleted
      ? '✓'
      : item.unlockAt && new Date() < new Date(item.unlockAt)
        ? '🔒'
        : '○';
    return `${status} ${item.title}: ${item.description || ''} (${item.frequency}, ${item.completionCount}/${item.totalRequired || '∞'})`;
  });

  // --- Step 5: Assemble context ---
  const contextString = [
    'PATIENT_MEDICAL_CONTEXT:',
    retrievedSection,
    '',
    'PATIENT_ACTIVE_TASKS:',
    checklistLines.join('\n') || 'None',
    '',
    'GAME_PROGRESS:',
    `Level ${progress?.level || 1} | XP ${progress?.xp || 0} | Streak ${progress?.streak || 0}`,
  ].join('\n');

  console.log(`[RAG] Context assembled: ${contextString.length} chars, ${uniqueTexts.length} retrieved chunks, ${checklistLines.length} active tasks`);

  // --- Step 6: Trim to token budget ---
  const finalContext = trimToCharBudget(
    contextString,
    CONTEXT_TOKEN_BUDGET * 4
  );

  return {
    mode: 'vector',
    tokenEstimate: estimateTokensFromText(finalContext),
    contextString: finalContext,
    topChunkIds: diverse.map((h) => String(h._id)),
  };
}

/**
 * Estimate combined token count for a chat request (user prompt + context).
 */
export function estimateChatRequestTokens(
  userPrompt: string,
  contextString: string
): number {
  return estimateTokensFromText(userPrompt) + estimateTokensFromText(contextString);
}
