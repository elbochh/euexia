import { invokeTextModel } from '../sagemaker';

export interface MedGemmaChatRequest {
  systemPrompt: string;
  userMessage: string;
  /** Recent conversation turns (compact) for continuity */
  conversationHistory?: Array<{ role: string; content: string }>;
}

export interface MedGemmaChatResponse {
  text: string;
  raw?: any;
}

/**
 * Strip prompt echo if TGI returns the prompt prepended to the answer.
 */
function stripPromptEcho(fullText: string, prompt: string): string {
  const text = (fullText || '').trim();
  const promptTrimmed = (prompt || '').trim();
  if (!text || !promptTrimmed) return text;

  if (text.startsWith(promptTrimmed)) {
    return text.slice(promptTrimmed.length).trim();
  }
  // Relaxed whitespace check
  const normP = promptTrimmed.replace(/\s+/g, ' ');
  const normT = text.replace(/\s+/g, ' ');
  if (normT.startsWith(normP)) {
    return text.slice(Math.min(promptTrimmed.length, text.length)).trim();
  }
  return text;
}

/**
 * Stop tokens / labels that signal the model started a new "turn" or section.
 * Everything from the first occurrence onward is discarded.
 */
const STOP_PATTERNS = [
  /\n\s*Assistant:/i,
  /\n\s*User:/i,
  /\n\s*System:/i,
  /\n\s*Final Answer/i,
  /\n\s*Human:/i,
  /\n\s*Doctor:/i,
  /\n\s*Patient:/i,
];

function truncateAtFirstStop(text: string): string {
  let earliest = text.length;
  for (const pat of STOP_PATTERNS) {
    const m = text.match(pat);
    if (m && m.index !== undefined && m.index < earliest) {
      earliest = m.index;
    }
  }
  return text.slice(0, earliest).trim();
}

// ---------------------------------------------------------------------------
// Refusal detection — patterns that indicate the model refused to answer
// ---------------------------------------------------------------------------
const REFUSAL_PATTERNS = [
  /i (cannot|can't|am unable to|do not have access)/i,
  /no information (available|to provide)/i,
  /not in my (knowledge base|current knowledge)/i,
  /i('m| am) sorry.{0,30}(cannot|can't|unable|do not have)/i,
  /please (consult|contact|visit|see) (your|a) (doctor|physician|healthcare)/i,
  /i don't have (enough|sufficient|the) (information|data|context)/i,
  /outside (my|the) (scope|capabilities)/i,
  /not (qualified|able) to (provide|answer|assist)/i,
];

function isRefusal(text: string): boolean {
  if (!text || text.length < 15) return false;
  const isShort = text.length < 300;
  const matchesRefusal = REFUSAL_PATTERNS.some((p) => p.test(text));
  return isShort && matchesRefusal;
}

// ---------------------------------------------------------------------------
// Fuzzy sentence dedup — catches near-duplicates
// ---------------------------------------------------------------------------
function normalizeSentence(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isFuzzySimilar(a: string, b: string): boolean {
  const na = normalizeSentence(a);
  const nb = normalizeSentence(b);
  if (na === nb) return true;
  if (na.length > 20 && nb.length > 20) {
    if (na.includes(nb) || nb.includes(na)) return true;
  }
  const wordsA = new Set(na.split(' '));
  const wordsB = new Set(nb.split(' '));
  if (wordsA.size < 3 || wordsB.size < 3) return false;
  let overlap = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) overlap++;
  }
  const overlapRatio = overlap / Math.min(wordsA.size, wordsB.size);
  return overlapRatio > 0.8;
}

/**
 * Post-process MedGemma output:
 *  1. Remove leading role labels
 *  2. Remove code fences and programming code
 *  3. Deduplicate lines and sentences (exact + fuzzy)
 *  4. Cap at reasonable limits
 */
function postProcess(text: string): string {
  let out = (text || '').trim();
  if (!out) return '';

  // Remove leading role labels
  out = out.replace(/^(Assistant|Doctor|AI|System|Final Answer)[:\s]*/i, '').trim();

  // Truncate at the FIRST stop pattern (model generating extra turns)
  out = truncateAtFirstStop(out);

  // Remove CLOSED code fences (```...```)
  out = out.replace(/```[\s\S]*?```/g, '');

  // Remove UNCLOSED code fences (```lang ... to end of string)
  out = out.replace(/```[a-z]*\n[\s\S]*/gi, '');

  // Remove any remaining standalone ``` lines
  out = out.replace(/^```[a-z]*$/gm, '');

  // Remove Python/code-like lines (def, import, return, if/else, class, etc.)
  out = out
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      if (/^\s*(def |class |import |from |return |if |elif |else:|for |while |try:|except |print\(|#\s)/.test(trimmed)) return false;
      if (/^\s*[a-z_]+\s*=\s*/.test(trimmed) && /[(\[\{]/.test(trimmed)) return false;
      if (/^\s*"""/.test(trimmed)) return false;
      if (/^\s*f"/.test(trimmed)) return false;
      return true;
    })
    .join('\n');

  // Strip leftover artifacts
  out = out.replace(/^(Final Answer|Answer)[:\s]*/gim, '');

  // Normalize bullet markers: "* " → "• " for consistency
  out = out.replace(/^\*\s+/gm, '• ');

  // Split into lines, preserving bullet structure
  const lines = out
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  // Deduplicate lines (exact + fuzzy)
  const uniqueLines: string[] = [];
  for (const line of lines) {
    const isDup = uniqueLines.some((existing) => isFuzzySimilar(line, existing));
    if (isDup) continue;
    uniqueLines.push(line);
  }

  // Within non-bullet paragraphs, also deduplicate sentences
  const finalLines: string[] = [];
  const keptSentences: string[] = [];
  for (const line of uniqueLines) {
    if (/^[•\-*]/.test(line)) {
      const bulletContent = line.replace(/^[•\-*]\s*/, '');
      const isDup = keptSentences.some((s) => isFuzzySimilar(bulletContent, s));
      if (!isDup) {
        finalLines.push(line);
        keptSentences.push(bulletContent);
      }
    } else {
      const sentences = line.split(/(?<=[.!?])\s+/).filter(Boolean);
      const kept: string[] = [];
      for (const s of sentences) {
        const isDup = keptSentences.some((existing) => isFuzzySimilar(s, existing));
        if (isDup) continue;
        keptSentences.push(s);
        kept.push(s);
      }
      if (kept.length) finalLines.push(kept.join(' '));
    }
  }

  // Cap at 12 lines
  out = finalLines.slice(0, 12).join('\n');

  // Hard cap — cut at last complete sentence within budget
  const maxChars = Number(process.env.RAG_CHAT_OUTPUT_MAX_CHARS || 1200);
  if (out.length > maxChars) {
    const trimmed = out.slice(0, maxChars);
    const lastEnd = Math.max(
      trimmed.lastIndexOf('. '),
      trimmed.lastIndexOf('.\n'),
      trimmed.lastIndexOf('!'),
      trimmed.lastIndexOf('?')
    );
    out = lastEnd > maxChars * 0.4
      ? trimmed.slice(0, lastEnd + 1).trim()
      : trimmed.trim();
  }

  return out;
}

/**
 * Truncate a message for conversation history inclusion.
 * Keeps it short so it doesn't eat up the token budget.
 */
function truncateForHistory(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const cut = text.slice(0, maxLen);
  const lastDot = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('.\n'));
  if (lastDot > maxLen * 0.5) {
    return cut.slice(0, lastDot + 1).trim();
  }
  return cut.trim() + '...';
}

/**
 * Build the generation prompt with optional conversation history for continuity.
 */
function buildPrompt(request: MedGemmaChatRequest): string {
  const parts: string[] = [];

  parts.push(`System: ${request.systemPrompt}`);

  // Include recent conversation history (compact) so the model knows
  // what it previously said — this enables coherent follow-up responses.
  if (request.conversationHistory && request.conversationHistory.length > 0) {
    parts.push('');
    parts.push('Recent conversation:');
    for (const turn of request.conversationHistory) {
      const role = turn.role === 'user' ? 'Patient' : 'Doctor';
      // Keep history messages compact — 150 chars for user, 250 for assistant
      const maxLen = turn.role === 'assistant' ? 250 : 150;
      const content = truncateForHistory(turn.content, maxLen);
      parts.push(`${role}: ${content}`);
    }
  }

  parts.push('');
  parts.push(`Patient: ${request.userMessage}`);
  parts.push('');
  parts.push('Doctor:');

  return parts.join('\n');
}

/**
 * Generate a response from MedGemma via SageMaker TGI.
 *
 * Now includes recent conversation history in the prompt so the model
 * can maintain context across turns (e.g., "how will THESE meals affect my disease").
 *
 * If the model refuses, retries once with a simpler general-knowledge prompt.
 */
export async function generateChatResponse(
  request: MedGemmaChatRequest
): Promise<MedGemmaChatResponse> {
  const prompt = buildPrompt(request);

  const result = await invokeTextModel(prompt, {
    max_new_tokens: Number(process.env.RAG_CHAT_MAX_NEW_TOKENS || 512),
    temperature: Number(process.env.RAG_CHAT_TEMPERATURE || 0.3),
    repetition_penalty: Number(process.env.RAG_CHAT_REPETITION_PENALTY || 1.2),
    return_full_text: false,
  });

  const cleaned = stripPromptEcho(result.text || '', prompt);
  const processed = postProcess(cleaned);

  // ── Refusal detection: if model refused, retry with a simpler prompt ──
  if (isRefusal(processed)) {
    console.warn('[RAG] Detected refusal, retrying with general-knowledge prompt...');

    const retryParts = [
      'System: You are a helpful, knowledgeable health assistant.',
      'You must ALWAYS provide a useful answer. Give evidence-based general health advice.',
      'Be specific and practical — include food names, exercise examples, exact actions.',
      'If the question is about a specific patient detail you lack, say so briefly then still provide helpful general guidance.',
    ];

    // Include conversation history in retry too
    if (request.conversationHistory && request.conversationHistory.length > 0) {
      retryParts.push('');
      retryParts.push('Recent conversation:');
      for (const turn of request.conversationHistory) {
        const role = turn.role === 'user' ? 'Patient' : 'Doctor';
        const content = truncateForHistory(turn.content, 200);
        retryParts.push(`${role}: ${content}`);
      }
    }

    retryParts.push('');
    retryParts.push(`Patient: ${request.userMessage}`);
    retryParts.push('');
    retryParts.push('Doctor:');

    const retryPrompt = retryParts.join('\n');

    const retryResult = await invokeTextModel(retryPrompt, {
      max_new_tokens: Number(process.env.RAG_CHAT_MAX_NEW_TOKENS || 512),
      temperature: 0.5,
      repetition_penalty: 1.2,
      return_full_text: false,
    });

    const retryCleaned = stripPromptEcho(retryResult.text || '', retryPrompt);
    const retryProcessed = postProcess(retryCleaned);

    if (retryProcessed && !isRefusal(retryProcessed)) {
      console.log('[RAG] Retry succeeded, using general-knowledge answer');
      return { text: retryProcessed, raw: retryResult.raw };
    }

    console.warn('[RAG] Retry also refused, returning fallback message');
    return {
      text: 'I can help with that! However, I need a bit more context. Could you rephrase your question or provide more details about what specific information you\'re looking for?',
      raw: retryResult.raw,
    };
  }

  return { text: processed, raw: result.raw };
}
