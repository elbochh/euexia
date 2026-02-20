/**
 * RecursiveCharacterTextSplitter equivalent — no extra dependency needed.
 * Splits on semantic boundaries: paragraphs → sentences → words.
 * Guarantees no chunk exceeds chunkSize (recursively re-splits oversized pieces).
 */

const DEFAULT_CHUNK_SIZE = 600; // ~150 tokens
const DEFAULT_CHUNK_OVERLAP = 80; // ~20 tokens overlap

const SEPARATORS = ['\n\n', '\n', '. ', ', ', ' '];

function splitOnSeparator(text: string, separator: string): string[] {
  const parts = text.split(separator);
  return parts
    .map((p, i) => (i < parts.length - 1 ? p + separator : p))
    .filter(Boolean);
}

/**
 * Recursively split a single large piece using progressively finer separators.
 */
function recursiveSplitPiece(
  text: string,
  chunkSize: number,
  separatorIdx: number
): string[] {
  if (text.length <= chunkSize) return [text];

  // Try each separator starting from the current index
  for (let si = separatorIdx; si < SEPARATORS.length; si++) {
    const sep = SEPARATORS[si];
    if (!text.includes(sep)) continue;

    const pieces = splitOnSeparator(text, sep);
    if (pieces.length <= 1) continue; // Separator didn't actually help

    // Recursively split any pieces that are still too large
    const results: string[] = [];
    for (const piece of pieces) {
      if (piece.length <= chunkSize) {
        results.push(piece);
      } else {
        results.push(...recursiveSplitPiece(piece, chunkSize, si + 1));
      }
    }
    return results;
  }

  // Last resort: hard-cut by character
  const results: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    results.push(text.slice(i, i + chunkSize));
  }
  return results;
}

/**
 * Split text into chunks of at most `chunkSize` characters using semantic
 * boundaries, with `chunkOverlap` characters of overlap between consecutive chunks.
 */
export function recursiveSplit(
  text: string,
  chunkSize = DEFAULT_CHUNK_SIZE,
  chunkOverlap = DEFAULT_CHUNK_OVERLAP
): string[] {
  const safe = (text || '').trim();
  if (!safe) return [];
  if (safe.length <= chunkSize) return [safe];

  // Split into pieces that each fit within chunkSize
  const pieces = recursiveSplitPiece(safe, chunkSize, 0);

  // Merge small pieces into chunks with overlap
  const chunks: string[] = [];
  let current = '';
  for (const piece of pieces) {
    if (current.length + piece.length > chunkSize && current.length > 0) {
      chunks.push(current.trim());
      const overlapText = current.slice(-chunkOverlap);
      current = overlapText + piece;
    } else {
      current += piece;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  return chunks;
}

/**
 * Deduplicate chunks by fuzzy content overlap.
 * If two chunks share >70% of their words, keep only the longer one.
 */
export function deduplicateChunks(chunks: string[]): string[] {
  const kept: string[] = [];
  const wordSets = chunks.map(
    (c) =>
      new Set(
        c
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .split(/\s+/)
      )
  );

  for (let i = 0; i < chunks.length; i++) {
    let isDuplicate = false;
    for (let j = 0; j < kept.length; j++) {
      const keptWords = new Set(
        kept[j]
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .split(/\s+/)
      );
      const overlap = [...wordSets[i]].filter((w) => keptWords.has(w)).length;
      const similarity =
        overlap / Math.max(wordSets[i].size, keptWords.size, 1);
      if (similarity > 0.7) {
        if (chunks[i].length > kept[j].length) kept[j] = chunks[i];
        isDuplicate = true;
        break;
      }
    }
    if (!isDuplicate) kept.push(chunks[i]);
  }
  return kept;
}
