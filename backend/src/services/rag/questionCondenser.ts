import { invokeTextModel } from '../sagemaker';

/**
 * Condense a follow-up question + recent chat history into a standalone question.
 * This is the "condense_question" step from ConversationalRetrievalChain.
 *
 * Example:
 *   History: Patient asked about hemorrhoid treatment → Doctor recommended fiber.
 *   Follow-up: "what vegetables should I eat?"
 *   Condensed: "What specific vegetables are recommended for hemorrhoid management?"
 */
export async function condenseQuestion(
  recentHistory: Array<{ role: string; content: string }>,
  currentQuestion: string
): Promise<string> {
  // If no history, the question is already standalone
  if (!recentHistory.length) return currentQuestion;

  const historyText = recentHistory
    .slice(-4) // Last 2 exchanges max
    .map((h) => `${h.role === 'user' ? 'Patient' : 'Doctor'}: ${h.content}`)
    .join('\n');

  const prompt = `Given the following conversation between a patient and doctor, rephrase the patient's latest question into a standalone question that includes all necessary medical context. Output ONLY the rephrased question, nothing else.

Chat History:
${historyText}

Latest Question: ${currentQuestion}

Standalone Question:`;

  try {
    const result = await invokeTextModel(prompt, {
      max_new_tokens: 60,
      temperature: 0.1,
      return_full_text: false,
      repetition_penalty: 1.1,
    });
    const condensed = (result.text || '').trim();
    // Remove any leading labels the model might add
    const cleaned = condensed
      .replace(/^(Standalone Question|Question|Rephrased):\s*/i, '')
      .trim();
    // Sanity: if condensation failed or is too long/short, use original
    if (!cleaned || cleaned.length > 300 || cleaned.length < 5) {
      return currentQuestion;
    }
    return cleaned;
  } catch (err) {
    console.warn('[RAG] Question condensation failed, using original:', err);
    return currentQuestion;
  }
}
