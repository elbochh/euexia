import { invokeTextModel, invokeImageModel } from '../sagemaker';

/**
 * PDF Agent: extracts text from PDF and processes it with the configured text model.
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
    const textPrompt = `You are a clinical AI assistant. Below is text extracted from a medical PDF (discharge summary, prescription, report, or lab results).

Write a DETAILED MEDICAL SUMMARY that captures all concrete information, especially:
- medications (from both text AND tables: drug, dose, frequency, route, duration, key notes)
- diagnoses and main problems
- tests and lab work (which tests, important results or thresholds, follow‑up plans)
- follow‑up appointments (when, with whom, purpose)
- monitoring instructions and warning signs
- lifestyle advice (diet, activity, restrictions).

Medication tables (Drug / Dose / Frequency / Route / Duration / GP Action, etc.) must be fully reflected: do not skip any rows or merge them into vague phrases.

Preserve exact numbers, dates, and names; do not round or generalise.

Extracted PDF text:
${pdfText}

Detailed medical summary:`;

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
