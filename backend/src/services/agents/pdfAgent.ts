import { invokeTextModel, invokeImageModel } from '../sagemaker';

/**
 * PDF Agent: extracts text from PDF and processes with MedGemma-text.
 * For image-heavy PDFs, also sends page images to the multimodal model.
 * Designed for maximum detail extraction.
 */
export async function processPdf(
  pdfText: string,
  pageImages?: string[]
): Promise<string> {
  const summaries: string[] = [];

  // Process extracted text
  if (pdfText && pdfText.trim().length > 0) {
    const textPrompt = `You are a clinical AI assistant. Below is text extracted from a medical PDF document (consultation report, lab results, prescription, discharge summary, etc.).

YOUR JOB: Extract EVERY specific medical detail from this document.

EXTRACT ALL OF THE FOLLOWING (if present):
1. MEDICATIONS: exact drug name, dose, form, frequency, duration, refills, special instructions (with food? before bed?)
2. LAB RESULTS: test name, patient value, reference range, interpretation
3. DIAGNOSES: condition name with any staging/grading
4. PROCEDURES: what was done, findings, follow-up needed
5. VITAL SIGNS: all values with units
6. FOLLOW-UP: exact dates, which doctor/department, what tests to bring
7. LIFESTYLE: dietary restrictions (specific foods/amounts), exercise (type/duration/frequency), activity limitations (specific restrictions with duration)
8. WARNING SIGNS: exact symptoms that require emergency care, with thresholds (e.g., "fever above 101°F")
9. DATES: all relevant dates (consultation, next appointment, test deadlines)

CRITICAL: Preserve EXACT numbers, dates, and drug names. Never round or generalise.

Extracted PDF text:
${pdfText}

Detailed Medical Summary:`;

    const textResult = await invokeTextModel(textPrompt);
    summaries.push(textResult.text);
  }

  // Process page images (if available)
  if (pageImages && pageImages.length > 0) {
    for (const pageImage of pageImages.slice(0, 5)) {
      const imagePrompt = `Analyze this page from a medical PDF document. Extract ALL visible text, numbers, medication names, lab values, dates, and instructions. Be extremely precise — read exact values and names from the image.`;
      const imageResult = await invokeImageModel(pageImage, imagePrompt);
      summaries.push(imageResult.text);
    }
  }

  return summaries.join('\n\n');
}
