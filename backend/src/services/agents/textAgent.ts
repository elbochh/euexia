import { invokeTextModel } from '../sagemaker';

/**
 * Text Agent: processes raw text input using MedGemma-27b-text-it
 */
export async function processText(text: string): Promise<string> {
  const prompt = `You are a medical AI assistant. Below is a patient's text description of their recent medical consultation. Please create a detailed medical summary covering:
- Diagnoses and conditions discussed
- Medications prescribed (names, dosages, frequency)
- Lifestyle recommendations
- Follow-up appointments or tests ordered
- Any warnings or precautions mentioned

Patient's text:
${text}

Medical Summary:`;

  const result = await invokeTextModel(prompt);
  return result.text;
}

