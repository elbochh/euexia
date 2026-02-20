import { invokeTextModel } from '../sagemaker';

export interface MedGemmaChatRequest {
  systemPrompt: string;
  userMessage: string;
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
 * Post-process MedGemma output:
 *  1. Remove leading role labels ("Assistant:", "Doctor:", etc.)
 *  2. Remove markdown code fences
 *  3. Deduplicate sentences globally
 *  4. Cap at 5 bullet points / 800 chars
 */
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

  // Strip leftover artifacts
  out = out.replace(/^(Final Answer|Answer)[:\s]*/gim, '');

  // Normalize bullet markers: "* " → "• " for consistency
  out = out.replace(/^\*\s+/gm, '• ');

  // Split into lines, preserving bullet structure
  const lines = out
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  // Deduplicate lines
  const seenLines = new Set<string>();
  const uniqueLines: string[] = [];
  for (const line of lines) {
    const key = line.replace(/\s+/g, ' ').toLowerCase().trim();
    if (seenLines.has(key)) continue;
    seenLines.add(key);
    uniqueLines.push(line);
  }

  // Within non-bullet paragraphs, also deduplicate sentences
  const finalLines: string[] = [];
  const seenSentences = new Set<string>();
  for (const line of uniqueLines) {
    if (/^[•\-*]/.test(line)) {
      // Bullet — keep as-is (already deduped at line level)
      finalLines.push(line);
    } else {
      // Paragraph — deduplicate sentences within it
      const sentences = line.split(/(?<=[.!?])\s+/).filter(Boolean);
      const kept: string[] = [];
      for (const s of sentences) {
        const key = s.replace(/\s+/g, ' ').toLowerCase().trim();
        if (seenSentences.has(key)) continue;
        seenSentences.add(key);
        kept.push(s);
      }
      if (kept.length) finalLines.push(kept.join(' '));
    }
  }

  // Cap at 6 lines
  out = finalLines.slice(0, 6).join('\n');

  // Hard cap — cut at last complete sentence within budget
  const maxChars = Number(process.env.RAG_CHAT_OUTPUT_MAX_CHARS || 800);
  if (out.length > maxChars) {
    const trimmed = out.slice(0, maxChars);
    // Find last sentence-ending punctuation
    const lastEnd = Math.max(
      trimmed.lastIndexOf('. '),
      trimmed.lastIndexOf('.\n'),
      trimmed.lastIndexOf('!'),
      trimmed.lastIndexOf('?')
    );
    out = lastEnd > maxChars * 0.5
      ? trimmed.slice(0, lastEnd + 1).trim()
      : trimmed.trim();
  }

  return out;
}

/**
 * Generate a response from MedGemma via SageMaker TGI.
 *
 * History is NOT included in the generation prompt – it was already used
 * upstream for question condensation. This keeps the prompt short and
 * prevents the model from echoing older turns.
 */
export async function generateChatResponse(
  request: MedGemmaChatRequest
): Promise<MedGemmaChatResponse> {
  // Build a clean flat prompt for TGI
  const prompt = `System: ${request.systemPrompt}\n\nUser: ${request.userMessage}\n\nAssistant:`;

  const result = await invokeTextModel(prompt, {
    max_new_tokens: Number(process.env.RAG_CHAT_MAX_NEW_TOKENS || 250),
    temperature: Number(process.env.RAG_CHAT_TEMPERATURE || 0.3),
    repetition_penalty: Number(process.env.RAG_CHAT_REPETITION_PENALTY || 1.15),
    return_full_text: false,
  });

  const cleaned = stripPromptEcho(result.text || '', prompt);
  const final = postProcess(cleaned);

  return { text: final, raw: result.raw };
}
