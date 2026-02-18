export type RetrievalMode = 'small' | 'vector';

export interface ContextPolicyDecision {
  mode: RetrievalMode;
  tokenEstimate: number;
  shouldSummarizeSmallContext: boolean;
}

const SMALL_DIRECT_MAX_TOKENS = Number(process.env.RAG_SMALL_DIRECT_MAX_TOKENS || 2500);
const SMALL_SUMMARIZE_MAX_TOKENS = Number(process.env.RAG_SMALL_SUMMARIZE_MAX_TOKENS || 7000);

export function estimateTokensFromText(input: string): number {
  if (!input) return 0;
  // Approximation: 1 token ~= 4 chars for English-heavy content.
  return Math.ceil(input.length / 4);
}

export function estimateTokensFromTexts(inputs: string[]): number {
  return inputs.reduce((sum, text) => sum + estimateTokensFromText(text), 0);
}

export function decideContextPolicy(tokenEstimate: number): ContextPolicyDecision {
  if (tokenEstimate <= SMALL_DIRECT_MAX_TOKENS) {
    return { mode: 'small', tokenEstimate, shouldSummarizeSmallContext: false };
  }
  if (tokenEstimate <= SMALL_SUMMARIZE_MAX_TOKENS) {
    return { mode: 'small', tokenEstimate, shouldSummarizeSmallContext: true };
  }
  return { mode: 'vector', tokenEstimate, shouldSummarizeSmallContext: false };
}

