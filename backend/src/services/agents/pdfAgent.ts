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
    const textPrompt = `You are a clinical AI assistant. Below is text extracted from a medical PDF document (discharge summary, prescription, consultation report, lab results, etc.).

YOUR JOB: Extract EVERY specific medical detail from this document.

CRITICAL: This document may contain MEDICATION TABLES (TTO tables, prescription tables, medication lists with columns like "Drug", "Dose", "Frequency", "Route", "Duration"). 
You MUST extract EVERY medication from these tables, even if they appear in a structured table format. Do NOT skip any medications.

EXTRACT ALL OF THE FOLLOWING (if present):

1. MEDICATIONS: Extract EVERY medication from tables and text. For each medication, extract:
   - Exact drug name (e.g., "Bisoprolol", "Alendronic Acid", "Adcal-D3", "Omeprazole", "Glyceryl Trinitrate", "Warfarin Sodium", "Folic Acid", "Ramipril", "Simvastatin", "Gliclazide")
   - Exact dose (e.g., "2.5mg", "70mg", "Two tablets", "400 micrograms per dose", "5mg", "7.5mg", "40mg", "120mg")
   - Exact frequency (e.g., "Once daily", "Twice daily", "When required", "Every night")
   - Route (e.g., "Orally", "Sublingual")
   - Duration (e.g., "2 weeks", "Two weeks")
   - Special instructions (e.g., "as per INR", "Stop after course is finished", "Check INR")
   
   IMPORTANT: If you see a medication table with columns like "TTO Drug", "Dose", "Frequency", "Route", "Duration", "GP Action", 
   extract EVERY row as a separate medication entry. Count the rows — if there are 10 medications in the table, list all 10.
   Do NOT summarize medications into categories like "multiple heart medications" or "various medications".
   Do NOT skip medications even if they seem similar.

2. FOLLOW-UP APPOINTMENTS: Extract ALL appointments mentioned:
   - Exact timeframes (e.g., "6 weeks", "8 weeks", "within 2 weeks")
   - Doctor names (e.g., "Dr Wide", "Dr Deep", "Dr Patel")
   - Department/clinic names
   - What to bring or mention

3. TESTS & MONITORING: Extract ALL tests and monitoring instructions:
   - Test names (e.g., "FBC", "Colonoscopy", "INR", "CT Colonography")
   - Frequency (e.g., "every two weeks", "when required", "repeat")
   - Thresholds (e.g., "if Hb falls below 8.00")
   - Preparation instructions (e.g., "no fasting required")

4. LAB RESULTS: test name, patient value, reference range, interpretation

5. DIAGNOSES: condition name with any staging/grading (e.g., "Left Ventricular Failure", "Anaemia (Iron deficient)")

6. PROCEDURES: what was done, findings, follow-up needed (e.g., "OGD showed iron stained stool", "Colonoscopy to be arranged")

7. VITAL SIGNS: all values with units

8. EQUIPMENT: Extract any equipment provided (e.g., "Home Oxygen", "wheelchair")

9. REFERRALS: Extract any referrals (e.g., "Occupational and Physiotherapy referral")

10. LIFESTYLE: dietary restrictions (specific foods/amounts), exercise (type/duration/frequency), activity limitations

11. WARNING SIGNS: exact symptoms that require emergency care, with thresholds

12. DATES: all relevant dates (consultation, next appointment, test deadlines)

CRITICAL RULES:
- Preserve EXACT numbers, dates, and drug names. Never round or generalise.
- If you see 10 medications, list ALL 10 separately with their exact details.
- If you see multiple follow-up appointments, list ALL of them.
- If you see a medication table, extract every row — do not summarize or group them.

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
