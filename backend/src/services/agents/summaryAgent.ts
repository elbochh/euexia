import { invokeTextModel } from '../sagemaker';

/**
 * Summary Aggregator Agent: combines all individual summaries into a unified
 * checklist paragraph describing the patient's care plan.
 *
 * The prompt is engineered to preserve every specific detail so downstream
 * agents (checklist structurer, theme detector) receive rich context.
 *
 * @param summaries - Array of individual upload summaries
 * @param knownMedications - Optional pre-extracted medication list (from rule-based extractor).
 *   Injected into the prompt so the AI model has an authoritative checklist of medications
 *   it MUST include — prevents probabilistic omissions.
 */
export async function aggregateSummaries(
  summaries: string[],
  knownMedications?: string
): Promise<string> {
  const combinedSummaries = summaries
    .map((s, i) => `--- Summary ${i + 1} ---\n${s}`)
    .join('\n\n');

  // Build medication mandate section — only if we pre-extracted medications
  const medicationMandate = knownMedications
    ? `\nMANDATORY MEDICATION LIST (pre-extracted from source — you MUST include ALL of these):
${knownMedications}
IMPORTANT: Every medication above MUST appear in your output with its full details. If you omit any, your output is INCORRECT.\n`
    : '';

  const prompt = `You are a clinical AI assistant creating a post-consultation care plan.

Below are multiple summaries extracted from different sources of the same patient consultation (voice recordings, images of reports, text notes, PDF documents).

YOUR JOB: Merge all summaries into ONE comprehensive, highly specific care plan paragraph.
${medicationMandate}
CRITICAL RULES — follow them strictly (ALL sections are EQUALLY IMPORTANT):
1. MEDICATIONS: You MUST include EVERY medication from the source and the mandatory list above. Do NOT skip any. List each medication separately with name, dose, route, frequency, duration.
2. APPOINTMENTS: Extract ALL follow-up appointments with exact timeframes, doctor names, departments, and what to bring/mention.
3. TESTS: Extract ALL tests with specific test names, frequency, preparation instructions, and where to go.
4. MONITORING: Extract ALL monitoring instructions with specific what to track, how often, and target values/thresholds.
5. LIFESTYLE: Extract ALL diet, exercise, and activity instructions with specific details.
6. PRESERVE every specific detail: drug names, exact dosages (mg, mL), exact timing ("every 8 hours", "twice daily with meals"), exact dates ("return on March 3rd"), exact lab values ("HbA1c 7.2%").
7. NEVER generalise. Replace nothing with vague language.
8. If two summaries mention the same item but with different details, include BOTH and note the discrepancy.
9. Include WHEN each action should start relative to now (e.g., "starting today", "starting in 3 days", "after 1 week").
10. Include HOW LONG each action should continue (e.g., "for 7 days", "for 2 weeks", "ongoing/indefinite").
11. Include SPECIFIC WARNING SIGNS that require immediate medical attention (e.g., "fever above 101°F", "blood in stool", "difficulty breathing").

STRUCTURE the paragraph covering ALL of these sections (skip sections with no data):
• MEDICATIONS: exact name, dose, route, frequency, duration, special instructions (with food? empty stomach?)
• FOLLOW-UP APPOINTMENTS: exact dates/timeframes, which doctor/department, what to bring
• TESTS & LAB WORK: test names, preparation instructions, where to go, frequency
• MONITORING: what to track (blood pressure, blood sugar, weight, symptoms), how often, target values
• DIET & NUTRITION: specific foods to eat/avoid, quantities, calorie/macro targets if mentioned
• EXERCISE & ACTIVITY: type of exercise, duration, frequency, restrictions
• PRECAUTIONS: activities to avoid, drug interactions, warning signs requiring ER visit
• LIFESTYLE: sleep, stress management, work restrictions, travel precautions

BAD example (too vague):
"Take prescribed medication regularly and follow up with your doctor."

GOOD example (specific and balanced):
"Take Amoxicillin 500mg orally every 8 hours (at 8AM, 4PM, 12AM) with food for 10 days starting today. Take Ibuprofen 400mg every 6 hours as needed for pain, not exceeding 3 tablets per day, for a maximum of 5 days. Schedule a follow-up with Dr. Patel (ENT) within 2 weeks — bring your medication list and any blood test results. Go to LabCorp for a CBC blood test in 7 days — no fasting required. Check your blood pressure daily and record the readings. Monitor your temperature twice daily — seek immediate care if it exceeds 102°F. Walk 30 minutes daily, gradually increasing to 45 minutes after 1 week. Avoid alcohol for 10 days while on antibiotics. Seek immediate care if temperature exceeds 102°F, if swelling spreads to the neck, or if you have difficulty swallowing or breathing."

Summaries:
${combinedSummaries}

Comprehensive, SPECIFIC Care Plan:`;

  const result = await invokeTextModel(prompt);
  return result.text;
}
