import { invokeAsrModel, invokeTextModel } from '../sagemaker';

/**
 * Voice Agent: transcribes audio using MedASR, then summarizes with MedGemma-text.
 * Designed to catch every clinical detail from doctor–patient conversations.
 */
export async function processVoice(audioBase64: string): Promise<string> {
  // Step 1: Transcribe audio using MedASR
  const transcription = await invokeAsrModel(audioBase64);

  // Step 2: Summarize the transcription with high specificity
  const prompt = `You are a clinical AI assistant. Below is a transcription of a medical consultation (doctor–patient conversation or patient's verbal description).

YOUR JOB: Extract EVERY specific medical detail from this transcription.

CRITICAL RULES:
1. Extract EXACT medication names, dosages, frequencies, durations, and administration instructions.
2. Extract EXACT appointment dates, doctor names, clinic locations, phone numbers.
3. Extract EXACT test/lab names and preparation instructions.
4. Extract EXACT dietary and lifestyle instructions with quantities and timeframes.
5. Extract EXACT warning signs and when to seek emergency care.
6. Note who said what if relevant (doctor's recommendation vs patient's question).
7. If the doctor mentioned a condition, include its explanation and prognosis.
8. Include any numbers mentioned: blood pressure readings, lab values, weight, temperature.

NEVER generalise. If the doctor said "take two pills in the morning and one at night", write exactly that, not "take medication as directed".

Transcription:
${transcription.text}

Detailed Medical Summary:`;

  const summary = await invokeTextModel(prompt);
  return summary.text;
}
