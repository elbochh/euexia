import mongoose from 'mongoose';
import { ChecklistItem } from '../../models/ChecklistItem';
import { GameProgress } from '../../models/GameProgress';
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
// Cosine similarity for MMR
// ---------------------------------------------------------------------------
function cosineSim(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
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
  lambda = 0.6 // 0.6 = relevance-biased, 0.4 = diversity-biased
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
// Main retrieval function
// ---------------------------------------------------------------------------

/**
 * Retrieve focused patient context for a standalone question.
 *
 * Pipeline:
 *   1. Embed the standalone question
 *   2. Vector search for top-K relevant chunks
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

  // --- Step 1: Vector search for relevant chunks ---
  const filter: Record<string, any> = {
    userId: new mongoose.Types.ObjectId(userId),
    sourceType: { $in: ['consultation_summary', 'upload_summary', 'checklist_item'] },
  };
  if (consultationId) {
    filter.consultationId = new mongoose.Types.ObjectId(consultationId);
  }

  let hits: ChunkHit[] = [];
  try {
    hits = await ContextChunk.aggregate([
      {
        $vectorSearch: {
          index: vectorIndexName,
          path: 'embedding',
          queryVector: queryEmbedding,
          numCandidates: Math.max(VECTOR_TOP_K * 10, 60),
          limit: VECTOR_TOP_K,
          filter,
        },
      },
      { $project: { content: 1, sourceType: 1, sourceId: 1, embedding: 1 } },
    ]);
  } catch (err) {
    console.warn('[RAG] Vector search failed, will use fallback:', err);
  }

  // --- Step 2: MMR rerank for diversity ---
  const diverse = mmrRerank(queryEmbedding, hits, Math.min(5, hits.length));

  // --- Step 3: Text-level deduplication ---
  const chunkTexts = diverse.map((h) => (h.content || '').trim());
  const uniqueTexts = dedupeTextBlocks(chunkTexts);
  const retrievedSection =
    uniqueTexts.length > 0
      ? uniqueTexts
          .map((t, i) => `[${i + 1}] ${trimToCharBudget(t, 400)}`)
          .join('\n\n')
      : 'No relevant records found.';

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
    return `${status} ${item.title} (${item.frequency}, ${item.completionCount}/${item.totalRequired || '∞'})`;
  });

  // --- Step 5: Assemble context ---
  const contextString = [
    'RELEVANT_MEDICAL_CONTEXT:',
    retrievedSection,
    '',
    'ACTIVE_TASKS:',
    checklistLines.join('\n') || 'None',
    '',
    'GAME_PROGRESS:',
    `Level ${progress?.level || 1} | XP ${progress?.xp || 0} | Streak ${progress?.streak || 0}`,
  ].join('\n');

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
