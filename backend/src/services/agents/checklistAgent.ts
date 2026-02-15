import { invokeTextModel } from '../sagemaker';

export interface ChecklistItemData {
  title: string;
  description: string;
  frequency: string;
  category: string;
  xpReward: number;
  coinReward: number;
}

/**
 * Checklist Structurer Agent: converts a care plan paragraph into a
 * structured JSON list of checklist items
 */
export async function structureChecklist(paragraph: string): Promise<ChecklistItemData[]> {
  const prompt = `You are a medical AI assistant. Convert the following care plan paragraph into a JSON array of checklist items. Each item should have:
- "title": short action title (max 50 chars)
- "description": detailed description of what to do
- "frequency": one of "once", "daily", "weekly", "monthly", or a specific schedule like "every 8 hours"
- "category": one of "medication", "nutrition", "exercise", "monitoring", "appointment", "test", "lifestyle", "general"
- "xpReward": number between 5-30 based on importance (higher for critical items)
- "coinReward": number between 3-15 based on importance

Return ONLY a valid JSON array, no other text.

Care plan paragraph:
${paragraph}

JSON checklist:`;

  const result = await invokeTextModel(prompt);

  try {
    // Try to parse the JSON from the response
    let jsonStr = result.text.trim();
    // Extract JSON array if wrapped in markdown code blocks
    const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }
    const items: ChecklistItemData[] = JSON.parse(jsonStr);
    
    // Validate items
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('Checklist items must be a non-empty array');
    }
    
    // Validate each item has required fields
    const validItems = items.filter((item) => {
      return item.title && item.description && item.category;
    });
    
    if (validItems.length === 0) {
      throw new Error('No valid checklist items found');
    }
    
    console.log(`Successfully parsed ${validItems.length} checklist items from GPT`);
    return validItems;
  } catch (error) {
    console.error('Failed to parse checklist JSON:', error);
    console.error('GPT response was:', result.text);
    // Fallback: create a single item from the paragraph
    console.warn('Using fallback checklist item');
    return [
      {
        title: 'Follow care plan',
        description: paragraph.substring(0, 500), // Limit description length
        frequency: 'daily',
        category: 'general',
        xpReward: 10,
        coinReward: 5,
      },
    ];
  }
}

