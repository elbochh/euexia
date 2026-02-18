import { invokeTextModel } from '../sagemaker';

/**
 * Summary Aggregator Agent: combines all individual summaries into a unified
 * checklist paragraph describing the patient's care plan.
 *
 * The prompt is engineered to preserve every specific detail so downstream
 * agents (checklist structurer, theme detector) receive rich context.
 */
export async function aggregateSummaries(summaries: string[]): Promise<string> {
  const combinedSummaries = summaries
    .map((s, i) => `--- Summary ${i + 1} ---\n${s}`)
    .join('\n\n');

  const prompt = `You are a clinical AI assistant creating a post-consultation care plan.

Below are multiple summaries extracted from different sources of the same patient consultation (voice recordings, images of reports, text notes, PDF documents).

YOUR JOB: Merge all summaries into ONE comprehensive, highly specific care plan paragraph.

CRITICAL RULES — follow them strictly:
1. PRESERVE every specific detail: drug names, exact dosages (mg, mL), exact timing ("every 8 hours", "twice daily with meals"), exact dates ("return on March 3rd"), exact lab values ("HbA1c 7.2%").
2. NEVER generalise. Replace nothing with vague language.
3. If two summaries mention the same medication but with different details, include BOTH and note the discrepancy.
4. Include WHEN each action should start relative to now (e.g., "starting today", "starting in 3 days", "after 1 week").
5. Include HOW LONG each action should continue (e.g., "for 7 days", "for 2 weeks", "ongoing/indefinite").
6. Include SPECIFIC WARNING SIGNS that require immediate medical attention (e.g., "fever above 101°F", "blood in stool", "difficulty breathing").

STRUCTURE the paragraph covering ALL of these sections (skip sections with no data):
• MEDICATIONS: exact name, dose, route, frequency, duration, special instructions (with food? empty stomach?)
• DIET & NUTRITION: specific foods to eat/avoid, quantities, calorie/macro targets if mentioned
• EXERCISE & ACTIVITY: type of exercise, duration, frequency, restrictions
• MONITORING: what to track (blood pressure, blood sugar, weight, symptoms), how often, target values
• FOLLOW-UP: exact appointment dates/timeframes, which doctor/department, what to bring
• TESTS & LAB WORK: test names, preparation instructions, where to go
• PRECAUTIONS: activities to avoid, drug interactions, warning signs requiring ER visit
• LIFESTYLE: sleep, stress management, work restrictions, travel precautions

BAD example (too vague):
"Take prescribed medication regularly and follow up with your doctor."

GOOD example (specific):
"Take Amoxicillin 500mg orally every 8 hours (at 8AM, 4PM, 12AM) with food for 10 days starting today. Take Ibuprofen 400mg every 6 hours as needed for pain, not exceeding 3 tablets per day, for a maximum of 5 days. Schedule a follow-up with Dr. Patel (ENT) within 2 weeks. Go to LabCorp for a CBC blood test in 7 days — no fasting required. Avoid alcohol for 10 days while on antibiotics. Seek immediate care if temperature exceeds 102°F, if swelling spreads to the neck, or if you have difficulty swallowing or breathing."

Summaries:
${combinedSummaries}

Comprehensive, SPECIFIC Care Plan:`;

  const result = await invokeTextModel(prompt);
  return result.text;
}
