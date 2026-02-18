import { invokeImageModel } from '../sagemaker';

/**
 * Image Agent: analyzes medical images using MedGemma-4b-it multimodal model.
 * Extracts every detail from medical documents, prescriptions, lab reports, etc.
 */
export async function processImage(imageBase64: string): Promise<string> {
  const prompt = `You are a clinical AI assistant. Analyze this medical image carefully. It may be a prescription, lab report, discharge summary, X-ray, medical certificate, doctor's notes, or any medical document.

YOUR JOB: Extract EVERY piece of information visible in this image.

EXTRACT ALL OF THE FOLLOWING (if present):
1. MEDICATIONS: exact drug name, dose (mg/mL), form (tablet/capsule/injection), frequency, duration, refills, special instructions
2. LAB RESULTS: test name, patient value, reference range, flag (high/low/normal)
3. DIAGNOSES: condition name, ICD code if visible, severity, stage
4. VITAL SIGNS: blood pressure, heart rate, temperature, weight, height, BMI, oxygen saturation
5. DOCTOR INSTRUCTIONS: follow-up date, activity restrictions, dietary instructions, warning signs
6. PATIENT INFO: age, gender (to contextualise the medical information)
7. DATES: consultation date, next appointment date, test dates
8. DOCTOR/CLINIC INFO: doctor name, specialty, clinic name, contact number

CRITICAL: Read the EXACT text from the image. Do not approximate or generalise numbers, dates, or medication names.

Detailed Medical Summary:`;

  const result = await invokeImageModel(imageBase64, prompt);
  return result.text;
}
