import { invokeTextModel } from '../sagemaker';

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

/**
 * Checklist Structurer Agent: converts a care plan paragraph into a
 * structured JSON list of checklist items with TIMING constraints.
 */
export async function structureChecklist(paragraph: string): Promise<ChecklistItemData[]> {
  const prompt = `You are a clinical AI assistant. Convert the care plan below into a JSON array of SPECIFIC, ACTIONABLE checklist items with TIMING information.

CRITICAL RULES:
1. Each item must be specific enough that the patient knows EXACTLY what to do, when, and for how long.
2. Include medication names, dosages, times, dates, and specific instructions.
3. Break down complex instructions into separate items (e.g., separate item per medication).
4. Assign realistic TIMING — patients should NOT be able to check off everything at once.

For EACH item, provide these fields:
- "title": Short, specific action (include medication/test name). Max 60 chars.
- "description": Detailed step-by-step instructions. Include exact dosage, timing, duration, and any special notes.
- "frequency": Specific schedule. Use: "once", "daily", "twice daily", "three times daily", "every X hours", "weekly", "every X days", "as needed"
- "category": One of: "medication", "nutrition", "exercise", "monitoring", "appointment", "test", "lifestyle", "general"
- "xpReward": 5-30 (higher for critical items like medications=25, appointments=20, monitoring=15, lifestyle=10)
- "coinReward": 3-15 (proportional to xpReward)
- "unlockAfterHours": Hours from NOW before this task becomes available. Use:
    • 0 for tasks that can be done right now (e.g., "take first dose now")
    • 8 for "every 8 hours" second dose
    • 24 for tasks starting tomorrow
    • 168 for tasks starting in 1 week
    • 336 for tasks starting in 2 weeks
- "cooldownHours": Hours between completions for recurring tasks. Use:
    • 0 for one-time tasks (appointment, single test)
    • 6, 8, 12, 24 for medications (matching their frequency)
    • 24 for daily tasks (exercise, monitoring)
    • 168 for weekly tasks
- "totalRequired": How many times this needs to be completed:
    • 1 for one-time tasks (appointment, single test)
    • 7 for a 7-day medication course (daily)
    • 14 for a 14-day course
    • 21 for "twice daily for 10 days" (round up)
    • 0 for ongoing/indefinite tasks (lifestyle changes, chronic medication)
- "durationDays": How many days this task is relevant:
    • 0 for ongoing/indefinite
    • 7 for a 7-day course
    • 14 for 2 weeks
    • 30 for 1 month
- "timeOfDay": When to do it: "morning", "afternoon", "evening", "night", "any"

GOOD EXAMPLES:
[
  {
    "title": "Take Amoxicillin 500mg (morning)",
    "description": "Take 1 capsule of Amoxicillin 500mg with a full glass of water and food. Take at approximately 8:00 AM. Do not skip doses even if you feel better. Complete the full 10-day course.",
    "frequency": "daily",
    "category": "medication",
    "xpReward": 25,
    "coinReward": 12,
    "unlockAfterHours": 0,
    "cooldownHours": 24,
    "totalRequired": 10,
    "durationDays": 10,
    "timeOfDay": "morning"
  },
  {
    "title": "Take Amoxicillin 500mg (evening)",
    "description": "Take 1 capsule of Amoxicillin 500mg with food at approximately 8:00 PM. This is your second daily dose — maintain 12 hours between doses.",
    "frequency": "daily",
    "category": "medication",
    "xpReward": 25,
    "coinReward": 12,
    "unlockAfterHours": 12,
    "cooldownHours": 24,
    "totalRequired": 10,
    "durationDays": 10,
    "timeOfDay": "evening"
  },
  {
    "title": "Schedule follow-up with Dr. Smith",
    "description": "Call Dr. Smith's office to schedule a follow-up appointment within 2 weeks. Mention you are following up after your consultation for acute anal fissure treatment.",
    "frequency": "once",
    "category": "appointment",
    "xpReward": 20,
    "coinReward": 10,
    "unlockAfterHours": 0,
    "cooldownHours": 0,
    "totalRequired": 1,
    "durationDays": 14,
    "timeOfDay": "any"
  },
  {
    "title": "Sitz bath (warm soak)",
    "description": "Sit in a warm sitz bath (shallow warm water covering the hips) for 15-20 minutes. This reduces pain and promotes healing. Use plain warm water — no soap or additives.",
    "frequency": "three times daily",
    "category": "lifestyle",
    "xpReward": 15,
    "coinReward": 8,
    "unlockAfterHours": 0,
    "cooldownHours": 6,
    "totalRequired": 0,
    "durationDays": 14,
    "timeOfDay": "any"
  },
  {
    "title": "Increase fiber intake to 25-30g",
    "description": "Eat high-fiber foods throughout the day: whole grains (oatmeal, whole wheat bread), fruits (apples, pears, berries), vegetables (broccoli, carrots), and legumes (lentils, beans). Target 25-30g of fiber daily to soften stools.",
    "frequency": "daily",
    "category": "nutrition",
    "xpReward": 15,
    "coinReward": 8,
    "unlockAfterHours": 0,
    "cooldownHours": 24,
    "totalRequired": 0,
    "durationDays": 0,
    "timeOfDay": "any"
  },
  {
    "title": "Drink 8+ glasses of water",
    "description": "Drink at least 8 glasses (2 litres) of water throughout the day. Proper hydration softens stools and reduces straining. Avoid excessive caffeine and alcohol as they can dehydrate.",
    "frequency": "daily",
    "category": "nutrition",
    "xpReward": 10,
    "coinReward": 5,
    "unlockAfterHours": 0,
    "cooldownHours": 24,
    "totalRequired": 0,
    "durationDays": 0,
    "timeOfDay": "morning"
  }
]

BAD EXAMPLES (too vague — NEVER do this):
- { "title": "Take medication", "description": "Follow doctor's instructions" }
- { "title": "Eat healthy", "description": "Maintain a good diet" }
- { "title": "Follow up", "description": "See doctor when needed" }

Care plan paragraph:
${paragraph}

Return ONLY a valid JSON array, no other text:`;

  const result = await invokeTextModel(prompt);

  try {
    // Extract JSON array using balanced bracket counting (robust against extra text)
    let jsonStr = result.text.trim();

    // Remove markdown code blocks if present
    jsonStr = jsonStr.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');

    // Find the JSON array by looking for balanced brackets
    const startIndex = jsonStr.indexOf('[');
    if (startIndex === -1) {
      throw new Error('No JSON array found in response');
    }

    // Find the matching closing bracket by counting brackets
    let bracketCount = 0;
    let endIndex = startIndex;
    for (let i = startIndex; i < jsonStr.length; i++) {
      if (jsonStr[i] === '[') bracketCount++;
      if (jsonStr[i] === ']') bracketCount--;
      if (bracketCount === 0) {
        endIndex = i + 1;
        break;
      }
    }

    // Extract just the JSON array portion
    jsonStr = jsonStr.substring(startIndex, endIndex);

    // Try to parse
    const items: ChecklistItemData[] = JSON.parse(jsonStr);

    // Validate it's an array with items
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('Parsed JSON is not a non-empty array');
    }

    // Validate each item has required fields and fill in defaults
    const validItems = items
      .filter((item: any) => item && item.title && item.description)
      .map((item: any) => ({
        title: String(item.title).slice(0, 80),
        description: String(item.description),
        frequency: item.frequency || 'once',
        category: item.category || 'general',
        xpReward: typeof item.xpReward === 'number' ? item.xpReward : 10,
        coinReward: typeof item.coinReward === 'number' ? item.coinReward : 5,
        // Timing fields with safe defaults
        unlockAfterHours: typeof item.unlockAfterHours === 'number' ? Math.max(0, item.unlockAfterHours) : 0,
        cooldownHours: typeof item.cooldownHours === 'number' ? Math.max(0, item.cooldownHours) : 0,
        totalRequired: typeof item.totalRequired === 'number' ? Math.max(0, item.totalRequired) : 1,
        durationDays: typeof item.durationDays === 'number' ? Math.max(0, item.durationDays) : 0,
        timeOfDay: ['morning', 'afternoon', 'evening', 'night', 'any'].includes(item.timeOfDay) ? item.timeOfDay : 'any',
      }));

    if (validItems.length === 0) {
      throw new Error('No valid checklist items found in parsed JSON');
    }

    console.log(`Successfully parsed ${validItems.length} checklist items from AI`);
    return validItems;
  } catch (error) {
    console.error('Failed to parse checklist JSON, using fallback:', error);
    console.error('Response text (first 500 chars):', result.text.substring(0, 500));
    // Fallback: create a single item from the paragraph
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
}
