import { invokeTextModel } from '../googleGemma';

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

  const prompt = `You are a clinical AI assistant. Merge these partial summaries into ONE clear, detailed care‑plan paragraph for the patient.

Goals:
- Preserve every concrete medical detail (drug name, dose, route, frequency, duration, dates, lab values, thresholds).
- Make the plan easy to read and patient‑friendly.
${medicationMandate}
Cover, when present:
- Medications (name, dose, route, frequency, duration, special instructions).
- Follow‑up appointments (when, with whom, where, what to bring).
- Tests & labs (which tests, how often, preparation, thresholds).
- Monitoring (what to track, how often, when to worry).
- Lifestyle (diet, exercise, restrictions, sleep/stress advice).
- Warning signs that require urgent or emergency care.

Summaries:
${combinedSummaries}

Final care‑plan paragraph:`;

  const result = await invokeTextModel(prompt);
  return result.text;
}
