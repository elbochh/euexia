import { invokeTextModel } from '../googleGemma';

/**
 * Text Agent: processes raw text input using the configured text model.
 * Extracts every specific clinical detail from patient text.
 */
export async function processText(text: string): Promise<string> {
  const prompt = `You are a clinical AI assistant. A patient has written a description of their medical visit.

Extract a DETAILED MEDICAL SUMMARY that captures every concrete fact from their text, including:
- diagnoses/conditions
- medications (name, dose, frequency, duration, key instructions)
- tests and lab work (which tests, preparation, frequency, key results if present)
- follow‑ups (when, with whom, and purpose)
- lifestyle advice (diet, activity, restrictions)
- warning signs and thresholds that require seeking help.

Do NOT invent new information; only use what is implied or stated.

Patient text:
${text}

Detailed medical summary:`;

  const result = await invokeTextModel(prompt);
  return result.text;
}
