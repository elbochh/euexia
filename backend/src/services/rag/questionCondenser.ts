import { invokeTextModel } from '../sagemaker';

/**
 * Truncate a message to a max length, cutting at last sentence boundary.
 * This prevents long assistant responses from eating up the condenser budget.
 */
function truncateForCondenser(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const cut = text.slice(0, maxLen);
  // Try to cut at a sentence boundary
  const lastDot = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('.\n'));
  if (lastDot > maxLen * 0.5) {
    return cut.slice(0, lastDot + 1).trim() + ' [...]';
  }
  return cut.trim() + ' [...]';
}

/**
 * Condense a follow-up question + recent chat history into a standalone question.
 * This is the "condense_question" step from ConversationalRetrievalChain.
 *
 * Key design choices:
 *  - Truncate long assistant messages so they don't overwhelm the condenser prompt
 *  - Include enough history for the model to understand follow-up references
 *  - Output a standalone question that captures the full intent
 *
 * Example:
 *   History: Patient asked for meal recommendations → Doctor gave a list of meals
 *   Follow-up: "how will these affect my disease?"
 *   Condensed: "How will iron-rich foods, low-sodium diet, and high-fiber meals positively affect left ventricular failure and anemia?"
 */
export async function condenseQuestion(
  recentHistory: Array<{ role: string; content: string }>,
  currentQuestion: string
): Promise<string> {
  // If no history, the question is already standalone
  if (!recentHistory.length) return currentQuestion;

  // Build compact history: truncate long assistant messages, keep user messages shorter
  const historyText = recentHistory
    .slice(-6) // Last 3 exchanges
    .map((h) => {
      const role = h.role === 'user' ? 'Patient' : 'Doctor';
      // Truncate long messages — assistant messages especially can be very long
      const maxLen = h.role === 'assistant' ? 200 : 150;
      const content = truncateForCondenser(h.content, maxLen);
      return `${role}: ${content}`;
    })
    .join('\n');

  const prompt = `Given this patient-doctor conversation, rephrase the patient's latest question into a STANDALONE question. The standalone question must make sense on its own without the conversation — include the specific topics, foods, medications, or conditions being discussed.

Chat History:
${historyText}

Latest Question: ${currentQuestion}

IMPORTANT: The standalone question must reference specific items from the conversation (e.g., specific meals, medications, conditions mentioned). Output ONLY the rephrased question.

Standalone Question:`;

  try {
    const result = await invokeTextModel(prompt, {
      max_new_tokens: 100,
      temperature: 0.1,
      return_full_text: false,
      repetition_penalty: 1.1,
    });
    const condensed = (result.text || '').trim();
    // Remove any leading labels the model might add
    const cleaned = condensed
      .replace(/^(Standalone Question|Question|Rephrased):\s*/i, '')
      .trim();
    // Take only the first line (model might generate extra text)
    const firstLine = cleaned.split('\n')[0].trim();
    // Sanity: if condensation failed or is too long/short, use original
    if (!firstLine || firstLine.length > 400 || firstLine.length < 5) {
      return currentQuestion;
    }
    return firstLine;
  } catch (err) {
    console.warn('[RAG] Question condensation failed, using original:', err);
    return currentQuestion;
  }
}
