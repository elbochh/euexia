import { invokeTextModel, invokeImageModel } from '../sagemaker';

/**
 * PDF Agent: extracts text from PDF and processes with MedGemma-text
 * For image-heavy PDFs, also sends page images to the multimodal model
 */
export async function processPdf(
  pdfText: string,
  pageImages?: string[]
): Promise<string> {
  const summaries: string[] = [];

  // Process extracted text
  if (pdfText && pdfText.trim().length > 0) {
    const textPrompt = `You are a medical AI assistant. Below is text extracted from a medical PDF document (such as a consultation report, lab results, or prescription). Please create a detailed medical summary covering:
- Diagnoses and conditions mentioned
- Medications prescribed (names, dosages, frequency)
- Lab results and their values
- Lifestyle recommendations
- Follow-up instructions
- Any warnings or precautions

Extracted PDF text:
${pdfText}

Medical Summary:`;

    const textResult = await invokeTextModel(textPrompt);
    summaries.push(textResult.text);
  }

  // Process page images (if available)
  if (pageImages && pageImages.length > 0) {
    for (const pageImage of pageImages.slice(0, 5)) {
      const imagePrompt = `Analyze this page from a medical PDF document and extract any relevant medical information including diagnoses, medications, lab results, and recommendations.`;
      const imageResult = await invokeImageModel(pageImage, imagePrompt);
      summaries.push(imageResult.text);
    }
  }

  return summaries.join('\n\n');
}

