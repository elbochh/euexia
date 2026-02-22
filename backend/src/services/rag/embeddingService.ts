// eslint-disable-next-line @typescript-eslint/no-require-imports
const { pipeline } = require('@xenova/transformers');

let embedderPromise: Promise<any> | null = null;

const DEFAULT_EMBED_DIM = Number(process.env.RAG_EMBED_DIM || 384);
const HF_EMBED_MODEL = process.env.RAG_EMBED_MODEL || 'Xenova/all-MiniLM-L6-v2';

function l2Normalize(values: number[]): number[] {
  const norm = Math.sqrt(values.reduce((sum, v) => sum + v * v, 0)) || 1;
  return values.map((v) => v / norm);
}

function hashToDeterministicEmbedding(text: string, dim: number): number[] {
  const out = new Array<number>(dim).fill(0);
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    const idx = (code + i * 31) % dim;
    out[idx] += (code % 97) / 97;
  }
  return l2Normalize(out);
}

async function getEmbedder() {
  if (!embedderPromise) {
    embedderPromise = pipeline('feature-extraction', HF_EMBED_MODEL, { quantized: true });
  }
  return embedderPromise;
}

function meanPoolTensor(data: Float32Array | number[], dims: number[]): number[] {
  // Expected dims from transformer.js feature-extraction:
  // [batch, tokens, hidden] or [tokens, hidden]
  if (dims.length === 2) {
    const [tokens, hidden] = dims;
    const out = new Array<number>(hidden).fill(0);
    for (let t = 0; t < tokens; t += 1) {
      for (let h = 0; h < hidden; h += 1) {
        out[h] += Number(data[t * hidden + h] || 0);
      }
    }
    for (let h = 0; h < hidden; h += 1) out[h] /= Math.max(tokens, 1);
    return out;
  }
  if (dims.length === 3) {
    const [, tokens, hidden] = dims;
    const out = new Array<number>(hidden).fill(0);
    for (let t = 0; t < tokens; t += 1) {
      for (let h = 0; h < hidden; h += 1) {
        out[h] += Number(data[t * hidden + h] || 0);
      }
    }
    for (let h = 0; h < hidden; h += 1) out[h] /= Math.max(tokens, 1);
    return out;
  }
  return Array.from({ length: DEFAULT_EMBED_DIM }, () => 0);
}

export async function embedText(text: string): Promise<number[]> {
  const safe = (text || '').trim();
  if (!safe) return hashToDeterministicEmbedding('', DEFAULT_EMBED_DIM);

  try {
    const embedder = await getEmbedder();
    const output = await embedder(safe, { pooling: 'none', normalize: false });
    const vector = meanPoolTensor(output.data as Float32Array, output.dims as number[]);
    return l2Normalize(vector);
  } catch (error) {
    // Fallback keeps system working if local model load fails in constrained envs.
    console.warn('[RAG] embedText fallback hash embedding:', error);
    return hashToDeterministicEmbedding(safe, DEFAULT_EMBED_DIM);
  }
}

