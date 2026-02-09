import { invokeAsrModel, invokeTextModel } from '../sagemaker';

/**
 * Voice Agent: transcribes audio using MedASR, then summarizes with MedGemma-text
 */
export async function processVoice(audioBase64: string): Promise<string> {
  // Step 1: Transcribe audio using MedASR
  const transcription = await invokeAsrModel(audioBase64);

  // Step 2: Summarize the transcription using MedGemma-text
  const prompt = `You are a medical AI assistant. Below is a transcription of a patient's description of their recent medical consultation. Please create a detailed medical summary covering:
- Diagnoses and conditions discussed
- Medications prescribed (names, dosages, frequency)
- Lifestyle recommendations
- Follow-up appointments or tests ordered
- Any warnings or precautions mentioned

Transcription:
${transcription.text}

Medical Summary:`;

  const summary = await invokeTextModel(prompt);
  return summary.text;
}

