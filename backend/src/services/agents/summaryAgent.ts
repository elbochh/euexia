import { invokeTextModel } from '../sagemaker';

/**
 * Summary Aggregator Agent: combines all individual summaries into a unified
 * checklist paragraph describing the patient's care plan
 */
export async function aggregateSummaries(summaries: string[]): Promise<string> {
  const combinedSummaries = summaries
    .map((s, i) => `--- Summary ${i + 1} ---\n${s}`)
    .join('\n\n');

  const prompt = `You are a medical AI assistant. Below are multiple summaries from a patient's recent medical consultation, extracted from different sources (voice recordings, images of reports, text notes, and PDF documents).

Please combine all the information into a single, comprehensive checklist paragraph that describes everything the patient needs to do as part of their post-consultation care plan. Include:
- All medications with exact dosages and timing
- All lifestyle recommendations (diet, exercise, hydration)
- All follow-up appointments with dates/timeframes
- All tests or lab work needed
- Any precautions or things to avoid

Write this as a clear, actionable paragraph that the patient can follow:

${combinedSummaries}

Comprehensive Care Plan Checklist:`;

  const result = await invokeTextModel(prompt);
  return result.text;
}

