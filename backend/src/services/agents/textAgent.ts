import { invokeTextModel } from '../sagemaker';

/**
 * Text Agent: processes raw text input using MedGemma
 * Extracts every specific clinical detail from patient text.
 */
export async function processText(text: string): Promise<string> {
  const prompt = `You are a clinical AI assistant. A patient has written a description of their recent medical consultation. Your job is to extract EVERY specific medical detail.

CRITICAL: Extract EXACT details. Never generalise.
- Drug names (brand AND generic if mentioned), EXACT dosages (mg, mL, tablets), EXACT frequency ("every 8 hours", "twice daily"), duration ("for 7 days"), special instructions ("take with food", "on empty stomach")
- EXACT dates and timeframes for follow-ups ("return in 2 weeks", "appointment on March 5th")
- EXACT test names and preparation ("fasting glucose test — no food for 12 hours before")
- SPECIFIC dietary instructions ("avoid dairy for 3 days", "increase fiber to 25g/day")
- SPECIFIC activity restrictions ("no heavy lifting over 10lbs for 2 weeks", "walk 30 min daily")
- SPECIFIC warning signs ("go to ER if fever exceeds 102°F", "call doctor if redness spreads")
- Doctor names, clinic names, phone numbers if mentioned

If the patient is vague, extract what IS there — do not invent details.
If the patient mentions a condition, include its medical name and what was explained about it.

Patient's text:
${text}

Detailed Medical Summary:`;

  const result = await invokeTextModel(prompt);
  return result.text;
}
