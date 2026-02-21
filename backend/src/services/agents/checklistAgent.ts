import { invokeTextModel, invokeOpenAIForChecklist } from '../sagemaker';

export interface ChecklistItemData {
  title: string;
  description: string;
  frequency: string;
  category: string;
  xpReward: number;
  coinReward: number;
  // Timing / scheduling fields
  unlockAfterHours: number;   // hours after consultation before this can first be checked
  cooldownHours: number;      // hours between recurring completions (0 = one-time task)
  totalRequired: number;      // total completions needed (1 = one-time, 0 = ongoing/indefinite)
  durationDays: number;       // how many days this task is relevant (0 = indefinite)
  timeOfDay: string;          // preferred time: "morning", "afternoon", "evening", "night", "any"
}

/** Event-based checklist: one row per occurrence (e.g. 7 events for "daily for 7 days") */
export interface ChecklistEventData {
  title: string;
  description: string;
  category: string;
  xpReward: number;
  coinReward: number;
  unlockAt: string;     // ISO date-time, e.g. "2025-02-20T00:00:00.000Z" for day 1 00:00, 19:00 for night
  groupId: string;     // legacy alias for sequenceId
  sequenceId: string;  // dependency chain id (event N requires N-1 in same sequenceId)
  starGroupId: string; // same starGroupId = same star on map
  orderInGroup: number; // 0, 1, 2, ... event N unlocks when previous in group is completed
}

/* ------------------------------------------------------------------ */
/*  Prompt builders — keep them short to leave room for model output  */
/* ------------------------------------------------------------------ */

function buildStructuredPrompt(paragraph: string): string {
  return `You are a clinical AI assistant. Convert the care plan into a JSON array.

RULES:
1. One item per medication, test, appointment, or lifestyle instruction.
2. "title" must be SHORT and CLEAN — just the action + medicine name (e.g. "Take Bisoprolol", "Check INR levels", "Walk 30 minutes"). NO dosage, NO frequency, NO duration in the title.
3. "description" must be HELPFUL and PRACTICAL for the patient:
   - For medications: include exact dose, how many tablets, before/after meals, with water, morning/evening, duration, and any warnings.
   - For lifestyle: include specific practical tips the patient can follow.
   - For appointments: include what to bring, what to mention.
   - Write as if advising a friend — warm, clear, actionable.
4. Return ONLY a valid JSON array — no explanation, no markdown.

JSON schema for each object:
{
  "title": "string (SHORT, max 30 chars, just action + name, e.g. 'Take Bisoprolol')",
  "description": "string (practical advice: dose, when, with/without food, tips)",
  "frequency": "once|daily|twice daily|three times daily|every X hours|weekly|as needed",
  "category": "medication|nutrition|exercise|monitoring|appointment|test|lifestyle|general",
  "xpReward": 5-30,
  "coinReward": 3-15,
  "unlockAfterHours": 0,
  "cooldownHours": 0-168,
  "totalRequired": 0-999,
  "durationDays": 0-365,
  "timeOfDay": "morning|afternoon|evening|night|any"
}

Example:
[
  {
    "title": "Take Bisoprolol",
    "description": "Take 1 tablet (2.5mg) every morning with breakfast. Swallow with a full glass of water. Do not skip doses — this helps control your heart rate. Continue for 2 weeks.",
    "frequency": "daily",
    "category": "medication",
    "xpReward": 25,
    "coinReward": 12,
    "unlockAfterHours": 0,
    "cooldownHours": 24,
    "totalRequired": 14,
    "durationDays": 14,
    "timeOfDay": "morning"
  },
  {
    "title": "Take Omeprazole",
    "description": "Take 1 capsule (40mg) 30 minutes before breakfast on an empty stomach. This protects your stomach lining. Continue for 2 weeks.",
    "frequency": "daily",
    "category": "medication",
    "xpReward": 25,
    "coinReward": 12,
    "unlockAfterHours": 0,
    "cooldownHours": 24,
    "totalRequired": 14,
    "durationDays": 14,
    "timeOfDay": "morning"
  },
  {
    "title": "Book follow-up visit",
    "description": "Schedule a follow-up appointment within 2 weeks. Bring your medication list and any blood test results. Mention how you felt on the new medications.",
    "frequency": "once",
    "category": "appointment",
    "xpReward": 20,
    "coinReward": 10,
    "unlockAfterHours": 0,
    "cooldownHours": 0,
    "totalRequired": 1,
    "durationDays": 14,
    "timeOfDay": "any"
  }
]

Care plan:
${paragraph}

JSON array:`;
}

function buildSimpleRetryPrompt(paragraph: string): string {
  return `Convert this medical care plan into a JSON array. Each medication, test, appointment, or lifestyle instruction = 1 object.

TITLE RULE: Short name only (e.g. "Take Bisoprolol", "Check INR", "Eat more fiber"). No dose or frequency in title.
DESCRIPTION RULE: Include dose, timing, before/after meals, practical patient advice, duration.

Fields: title (short name), description (practical advice with dose), frequency, category, xpReward (5-30), coinReward (3-15), unlockAfterHours, cooldownHours, totalRequired, durationDays, timeOfDay.

Return ONLY a JSON array.

Care plan:
${paragraph}

[`;
}

/* ------------------------------------------------------------------ */
/*  JSON extraction & repair                                          */
/* ------------------------------------------------------------------ */

/**
 * Extract a JSON array from potentially messy model output.
 * Handles: markdown fences, leading text, truncated JSON.
 */
function extractJsonArray(raw: string): any[] {
  let text = raw.trim();

  // Strip markdown code fences (```json ... ``` or ``` ... ```)
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');

  // Find first '[' 
  const start = text.indexOf('[');
  if (start === -1) {
    throw new Error('No JSON array opening bracket found');
  }

  // Try balanced bracket extraction first
  let bracketCount = 0;
  let end = -1;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === '[') bracketCount++;
    if (ch === ']') bracketCount--;
    if (bracketCount === 0) {
      end = i + 1;
      break;
    }
  }

  // Case 1: Found balanced brackets — standard parse
  if (end !== -1) {
    const jsonStr = text.substring(start, end);
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    throw new Error('Parsed result is empty array');
  }

  // Case 2: Truncated output — try to repair
  console.warn('[Checklist] JSON appears truncated, attempting repair...');
  let truncated = text.substring(start);

  // Remove trailing incomplete object (cut at last complete '}')
  const lastCloseBrace = truncated.lastIndexOf('}');
  if (lastCloseBrace === -1) {
    throw new Error('No complete JSON object found in truncated output');
  }
  truncated = truncated.substring(0, lastCloseBrace + 1);

  // Close the array
  truncated = truncated.trimEnd();
  if (truncated.endsWith(',')) {
    truncated = truncated.slice(0, -1);
  }
  truncated += ']';

  const repaired = JSON.parse(truncated);
  if (Array.isArray(repaired) && repaired.length > 0) {
    console.log(`[Checklist] Repaired truncated JSON — recovered ${repaired.length} items`);
    return repaired;
  }
  throw new Error('Repaired JSON is empty');
}

/* ------------------------------------------------------------------ */
/*  Validation & defaults                                              */
/* ------------------------------------------------------------------ */

/**
 * Clean model-generated titles: strip dosage/frequency info, keep just action + name.
 * "Take Bisoprolol 2.5mg orally, once daily, for 2 weeks" → "Take Bisoprolol"
 */
function cleanTitle(raw: string): string {
  let t = raw.trim();

  // Remove anything after a dose pattern (number + mg/mcg/ml)
  t = t.replace(/\s+\d+\s*(?:mg|mcg|ml|g|tablets?|capsules?)\b.*/i, '');
  // Remove trailing frequency/duration phrases
  t = t.replace(/\s*(?:,\s*)?(?:once|twice|three times|daily|orally|for \d+|every \d+).*$/i, '');
  // Remove parenthetical info like (morning)
  t = t.replace(/\s*\(.*?\)\s*/g, '');
  // Trim trailing punctuation / whitespace
  t = t.replace(/[\s,.\-:]+$/, '').trim();

  // Cap at 35 chars, cut at last word boundary
  if (t.length > 35) {
    t = t.substring(0, 35);
    const lastSpace = t.lastIndexOf(' ');
    if (lastSpace > 10) t = t.substring(0, lastSpace);
  }

  return t || raw.slice(0, 35);
}

function validateAndNormalize(items: any[]): ChecklistItemData[] {
  const validCategories = ['medication', 'nutrition', 'exercise', 'monitoring', 'appointment', 'test', 'lifestyle', 'general'];
  const validTimes = ['morning', 'afternoon', 'evening', 'night', 'any'];

  return items
    .filter((item: any) => item && typeof item === 'object' && item.title && item.description)
    .map((item: any) => ({
      title: cleanTitle(String(item.title)),
      description: String(item.description),
      frequency: item.frequency || 'once',
      category: validCategories.includes(item.category) ? item.category : 'general',
      xpReward: typeof item.xpReward === 'number' ? Math.min(30, Math.max(5, item.xpReward)) : 10,
      coinReward: typeof item.coinReward === 'number' ? Math.min(15, Math.max(3, item.coinReward)) : 5,
      unlockAfterHours: typeof item.unlockAfterHours === 'number' ? Math.max(0, item.unlockAfterHours) : 0,
      cooldownHours: typeof item.cooldownHours === 'number' ? Math.max(0, item.cooldownHours) : 0,
      totalRequired: typeof item.totalRequired === 'number' ? Math.max(0, item.totalRequired) : 1,
      durationDays: typeof item.durationDays === 'number' ? Math.max(0, item.durationDays) : 0,
      timeOfDay: validTimes.includes(item.timeOfDay) ? item.timeOfDay : 'any',
    }));
}

/* ------------------------------------------------------------------ */
/*  Rule-based fallback: split paragraph into items manually           */
/* ------------------------------------------------------------------ */

/**
 * Extract a short medicine/action name from a line of text.
 * e.g. "Bisoprolol 2.5mg once daily orally for 2 weeks" → "Take Bisoprolol"
 *      "Follow-up appointment in 2 weeks"               → "Book follow-up"
 */
function extractShortTitle(line: string, category: string): string {
  const clean = line
    .replace(/^\*\*.*?\*\*:?\s*/, '')   // strip markdown bold headers
    .replace(/^[\d\.\-\*•]+\s*/, '')    // strip list markers
    .trim();

  if (category === 'medication') {
    // Try to find the drug name — usually the first capitalized word before dose info
    const drugMatch = clean.match(/^(?:Take\s+)?([A-Z][a-zA-Z\-]+(?:\s+[A-Z][a-zA-Z\-]+)?)/);
    if (drugMatch) return `Take ${drugMatch[1]}`;
    // Fallback: first 2 words
    const words = clean.split(/\s+/).slice(0, 2).join(' ');
    return `Take ${words}`;
  }
  if (category === 'appointment') return 'Book follow-up visit';
  if (category === 'test') {
    const testMatch = clean.match(/(CBC|INR|HbA1c|blood test|x-?ray|scan|MRI|ECG|ultrasound)/i);
    return testMatch ? `Get ${testMatch[1]} done` : 'Get lab tests done';
  }
  if (category === 'monitoring') {
    const monMatch = clean.match(/(blood pressure|blood sugar|weight|temperature|heart rate)/i);
    return monMatch ? `Check ${monMatch[1]}` : 'Monitor health';
  }
  if (category === 'nutrition') {
    // Extract key dietary action
    if (/fiber/i.test(clean)) return 'Eat more fiber';
    if (/water|hydrat/i.test(clean)) return 'Drink enough water';
    if (/sodium|salt/i.test(clean)) return 'Reduce salt intake';
    if (/vegetable/i.test(clean)) return 'Eat more vegetables';
    if (/fruit/i.test(clean)) return 'Eat more fruits';
    return 'Follow diet plan';
  }
  if (category === 'exercise') {
    if (/walk/i.test(clean)) return 'Go for a walk';
    return 'Daily exercise';
  }

  // General fallback: first few words
  const shortTitle = clean.split(/\s+/).slice(0, 4).join(' ');
  return shortTitle.length > 30 ? shortTitle.substring(0, 27) + '...' : shortTitle;
}

function ruleBasedFallback(paragraph: string): ChecklistItemData[] {
  const items: ChecklistItemData[] = [];

  // Split by common separators: bullet points, numbered lists, line breaks, semicolons
  const lines = paragraph
    .split(/(?:\n|(?:^|\.\s+)(?=\d+\.\s)|(?:^|\s)[\*\-•]\s|;\s*)/gm)
    .map(l => l.trim())
    .filter(l => l.length > 15); // skip very short fragments

  // Common medication keywords to detect category
  const medKeywords = /(?:mg|mcg|ml|tablet|capsule|dose|spray|inhaler|cream|ointment|injection|oral|sublingual|topical|daily|twice|three times|every \d+ hours)/i;
  const appointmentKeywords = /(?:follow.?up|appointment|schedule|visit|return|check.?up|review)/i;
  const testKeywords = /(?:blood test|lab|CBC|INR|HbA1c|x.?ray|scan|MRI|ultrasound|ECG|test result)/i;
  const monitorKeywords = /(?:monitor|check|record|measure|track|blood pressure|weight|blood sugar|temperature)/i;
  const nutritionKeywords = /(?:diet|eat|food|fiber|fruit|vegetable|drink|water|sodium|salt|calorie|meal)/i;
  const exerciseKeywords = /(?:exercise|walk|swim|jog|physical|activity|stretch|yoga|movement)/i;

  for (const line of lines) {
    // Determine category
    let category = 'general';
    if (medKeywords.test(line)) category = 'medication';
    else if (appointmentKeywords.test(line)) category = 'appointment';
    else if (testKeywords.test(line)) category = 'test';
    else if (monitorKeywords.test(line)) category = 'monitoring';
    else if (nutritionKeywords.test(line)) category = 'nutrition';
    else if (exerciseKeywords.test(line)) category = 'exercise';

    const cleanLine = line.replace(/^\*\*.*?\*\*:?\s*/, '').replace(/^[\d\.\-\*•]+\s*/, '');
    const title = extractShortTitle(cleanLine, category);

    const xpMap: Record<string, number> = {
      medication: 25, appointment: 20, test: 20, monitoring: 15, nutrition: 10, exercise: 15, lifestyle: 10, general: 10,
    };

    items.push({
      title,
      description: cleanLine,
      frequency: category === 'medication' ? 'daily' : 'once',
      category,
      xpReward: xpMap[category] || 10,
      coinReward: Math.round((xpMap[category] || 10) / 2),
      unlockAfterHours: 0,
      cooldownHours: category === 'medication' ? 24 : 0,
      totalRequired: category === 'appointment' || category === 'test' ? 1 : 0,
      durationDays: 14,
      timeOfDay: 'any',
    });
  }

  // Deduplicate by title similarity
  const seen = new Set<string>();
  const deduped = items.filter(item => {
    const key = item.title.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return deduped.length > 0 ? deduped : [];
}

/* ------------------------------------------------------------------ */
/*  Event-based structuring (GPT-4.1 only)                            */
/* ------------------------------------------------------------------ */

function buildEventsPrompt(paragraph: string, nowIso: string): string {
  return `You are a clinical AI assistant. Convert the care plan into a JSON array of EVENTS.
Each event = one actionable occurrence the patient can mark complete. Use "now" as the consultation time.

RULES:
1. One event per occurrence. "Take medicine X daily for 7 days" = 7 events (same title, groupId, orderInGroup 0..6).
2. Events that can be done the same day without order = same groupId, same or different orderInGroup.
3. unlockAt = exact date-time in ISO 8601 (e.g. "2025-02-20T00:00:00.000Z"). Day 1 = first day from now, Day 2 = next day, etc.
4. Time of day: "morning" → 08:00, "afternoon" → 14:00, "evening" → 18:00, "night" → 19:00. Default 00:00 if not specified.
5. sequenceId: string to represent a routine chain (e.g. "tylenol-night"). Events with same sequenceId are sequential by orderInGroup.
6. starGroupId: string to group events under the same star on map. SAME DAY events should usually share the same starGroupId.
7. orderInGroup: 0, 1, 2, ... For sequential unlock inside sequenceId (event N unlocks only when event N-1 is completed).
8. Include progress marker in title for recurring chains, e.g. "Drink water (1/3)", "Drink water (2/3)".
9. title: SHORT (e.g. "Take Amoxicillin", "Check blood pressure"). description: practical advice with dose/timing.
10. Return ONLY a valid JSON array — no markdown, no explanation.
Reference "now" for relative dates: ${nowIso}

JSON schema per event:
{
  "title": "string (short, max 30 chars)",
  "description": "string (practical advice)",
  "category": "medication|nutrition|exercise|monitoring|appointment|test|lifestyle|general",
  "xpReward": 5-30,
  "coinReward": 3-15,
  "unlockAt": "ISO 8601 date-time string",
  "groupId": "string (legacy alias, set same as sequenceId)",
  "sequenceId": "string (dependency chain id)",
  "starGroupId": "string (same star on map, typically same day bucket)",
  "orderInGroup": 0-based index within group
}

Example (daily medicine for 3 days, morning):
[
  {"title":"Take Amoxicillin (1/3)","description":"Take 500mg with breakfast.","category":"medication","xpReward":25,"coinReward":12,"unlockAt":"2025-02-20T08:00:00.000Z","groupId":"amox","sequenceId":"amox","starGroupId":"2025-02-20","orderInGroup":0},
  {"title":"Take Amoxicillin (2/3)","description":"Take 500mg with breakfast.","category":"medication","xpReward":25,"coinReward":12,"unlockAt":"2025-02-21T08:00:00.000Z","groupId":"amox","sequenceId":"amox","starGroupId":"2025-02-21","orderInGroup":1},
  {"title":"Take Amoxicillin (3/3)","description":"Take 500mg with breakfast.","category":"medication","xpReward":25,"coinReward":12,"unlockAt":"2025-02-22T08:00:00.000Z","groupId":"amox","sequenceId":"amox","starGroupId":"2025-02-22","orderInGroup":2}
]

Care plan:
${paragraph}

JSON array:`;
}

function validateAndNormalizeEvents(raw: any[], now: Date): ChecklistEventData[] {
  const validCategories = ['medication', 'nutrition', 'exercise', 'monitoring', 'appointment', 'test', 'lifestyle', 'general'];
  const normalized = raw
    .filter((item: any) => item && typeof item === 'object' && item.title)
    .map((item: any, index: number) => {
      let unlockAt = item.unlockAt;
      if (typeof unlockAt !== 'string' || isNaN(Date.parse(unlockAt))) {
        // Default: day 0 at 00:00
        const d = new Date(now);
        d.setHours(0, 0, 0, 0);
        unlockAt = d.toISOString();
      }
      const sequenceId = String(item.sequenceId ?? item.groupId ?? `seq-${index}`);
      const dateKey = new Date(unlockAt).toISOString().slice(0, 10);
      const starGroupId = String(item.starGroupId ?? dateKey);
      const groupId = String(item.groupId ?? sequenceId);
      const orderInGroup = typeof item.orderInGroup === 'number' ? Math.max(0, item.orderInGroup) : 0;
      return {
        title: cleanTitle(String(item.title)),
        description: String(item.description ?? ''),
        category: validCategories.includes(item.category) ? item.category : 'general',
        xpReward: typeof item.xpReward === 'number' ? Math.min(30, Math.max(5, item.xpReward)) : 10,
        coinReward: typeof item.coinReward === 'number' ? Math.min(15, Math.max(3, item.coinReward)) : 5,
        unlockAt,
        groupId,
        sequenceId,
        starGroupId,
        orderInGroup,
      };
    });

  const totalsBySequence = new Map<string, number>();
  normalized.forEach((e) => {
    totalsBySequence.set(e.sequenceId, (totalsBySequence.get(e.sequenceId) || 0) + 1);
  });

  return normalized.map((e) => {
    const total = totalsBySequence.get(e.sequenceId) || 1;
    const hasProgressSuffix = /\(\d+\/\d+\)$/.test(e.title.trim());
    if (total > 1 && !hasProgressSuffix) {
      return { ...e, title: `${e.title} (${e.orderInGroup + 1}/${total})` };
    }
    return e;
  });
}

/**
 * Structure care plan as events (GPT-4.1 only). One DB row per event; map has one star per groupId.
 */
export async function structureChecklistAsEvents(paragraph: string): Promise<ChecklistEventData[]> {
  const now = new Date();
  const nowIso = now.toISOString();
  const prompt = buildEventsPrompt(paragraph, nowIso);

  try {
    const result = await invokeOpenAIForChecklist(prompt);
    const parsed = extractJsonArray(result.text);
    const events = validateAndNormalizeEvents(parsed, now);
    if (events.length > 0) {
      console.log(`[Checklist] structureChecklistAsEvents: ${events.length} events from GPT-4.1`);
      return events;
    }
  } catch (err: any) {
    console.warn('[Checklist] structureChecklistAsEvents failed:', err.message);
  }

  // Fallback: use legacy structureChecklist and expand to one event per item
  const legacy = await structureChecklist(paragraph);
  const fallback: ChecklistEventData[] = [];
  for (let i = 0; i < legacy.length; i++) {
    const item = legacy[i];
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    if (item.timeOfDay === 'morning') d.setHours(8, 0, 0, 0);
    else if (item.timeOfDay === 'afternoon') d.setHours(14, 0, 0, 0);
    else if (item.timeOfDay === 'evening') d.setHours(18, 0, 0, 0);
    else if (item.timeOfDay === 'night') d.setHours(19, 0, 0, 0);
    const count = item.totalRequired > 0 ? item.totalRequired : 1;
    for (let j = 0; j < count; j++) {
      const unlock = new Date(d.getTime() + j * 24 * 60 * 60 * 1000);
      fallback.push({
        title: item.title,
        description: item.description,
        category: item.category,
        xpReward: item.xpReward,
        coinReward: item.coinReward,
        unlockAt: unlock.toISOString(),
        groupId: `g${i}`,
        sequenceId: `g${i}`,
        starGroupId: unlock.toISOString().slice(0, 10),
        orderInGroup: j,
      });
    }
  }
  console.log(`[Checklist] structureChecklistAsEvents fallback: ${fallback.length} events`);
  return fallback.length > 0 ? fallback : [{
    title: 'Follow care plan',
    description: paragraph.substring(0, 500),
    category: 'general',
    xpReward: 10,
    coinReward: 5,
    unlockAt: now.toISOString(),
    groupId: 'g0',
    sequenceId: 'g0',
    starGroupId: now.toISOString().slice(0, 10),
    orderInGroup: 0,
  }];
}

/* ------------------------------------------------------------------ */
/*  Main entry point                                                   */
/* ------------------------------------------------------------------ */

/**
 * Checklist Structurer Agent: converts a care plan paragraph into a
 * structured JSON list of checklist items with TIMING constraints.
 *
 * Strategy:
 *  1. Ask model with structured prompt (4096 output tokens)
 *  2. If JSON parse fails → repair truncated JSON
 *  3. If still fails → retry with simpler prompt
 *  4. If still fails → rule-based splitting as last resort
 */
export async function structureChecklist(paragraph: string): Promise<ChecklistItemData[]> {
  // ── Attempt 1: Structured prompt ──
  console.log('[Checklist] Attempt 1: Structured prompt...');
  try {
    const prompt = buildStructuredPrompt(paragraph);
    const result = await invokeTextModel(prompt, {
      max_new_tokens: 4096,
      temperature: 0.1,
      return_full_text: false,
      repetition_penalty: 1.05,
    });

    console.log('[Checklist] Raw response length:', result.text.length);
    console.log('[Checklist] Raw response (first 300):', result.text.substring(0, 300));

    const parsed = extractJsonArray(result.text);
    const valid = validateAndNormalize(parsed);

    if (valid.length > 0) {
      console.log(`[Checklist] ✅ Attempt 1 succeeded: ${valid.length} items`);
      return valid;
    }
  } catch (err: any) {
    console.warn(`[Checklist] Attempt 1 failed: ${err.message}`);
  }

  // ── Attempt 2: Simpler prompt (prefill the opening bracket) ──
  console.log('[Checklist] Attempt 2: Simple retry prompt...');
  try {
    const retryPrompt = buildSimpleRetryPrompt(paragraph);
    const result = await invokeTextModel(retryPrompt, {
      max_new_tokens: 4096,
      temperature: 0.15,
      return_full_text: false,
      repetition_penalty: 1.05,
    });

    // Prepend the '[' we used to prefill
    const fullText = '[' + result.text;
    console.log('[Checklist] Retry response length:', fullText.length);
    console.log('[Checklist] Retry response (first 300):', fullText.substring(0, 300));

    const parsed = extractJsonArray(fullText);
    const valid = validateAndNormalize(parsed);

    if (valid.length > 0) {
      console.log(`[Checklist] ✅ Attempt 2 succeeded: ${valid.length} items`);
      return valid;
    }
  } catch (err: any) {
    console.warn(`[Checklist] Attempt 2 failed: ${err.message}`);
  }

  // ── Attempt 3: Rule-based fallback ──
  console.log('[Checklist] Attempt 3: Rule-based splitting...');
  const ruleBased = ruleBasedFallback(paragraph);
  if (ruleBased.length > 0) {
    console.log(`[Checklist] ✅ Rule-based fallback produced ${ruleBased.length} items`);
    return ruleBased;
  }

  // ── Ultimate fallback: single generic item (should rarely reach here) ──
  console.warn('[Checklist] ⚠️ All attempts failed — using single-item fallback');
  return [
    {
      title: 'Follow care plan',
      description: paragraph.substring(0, 500),
      frequency: 'daily',
      category: 'general',
      xpReward: 10,
      coinReward: 5,
      unlockAfterHours: 0,
      cooldownHours: 24,
      totalRequired: 0,
      durationDays: 0,
      timeOfDay: 'any',
    },
  ];
}
