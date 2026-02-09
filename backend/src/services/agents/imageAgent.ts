import { invokeImageModel } from '../sagemaker';

/**
 * Image Agent: analyzes medical images using MedGemma-4b-it multimodal model
 */
export async function processImage(imageBase64: string): Promise<string> {
  const prompt = `You are a medical AI assistant. Analyze this medical image (which may be a photo of a medical report, prescription, lab results, X-ray, or any other medical document). Please extract and summarize:
- Any diagnoses or conditions mentioned
- Medication names, dosages, and frequencies
- Lab results and their significance
- Recommendations from the healthcare provider
- Follow-up instructions
- Any other relevant medical information

Please provide a detailed medical summary:`;

  const result = await invokeImageModel(imageBase64, prompt);
  return result.text;
}

