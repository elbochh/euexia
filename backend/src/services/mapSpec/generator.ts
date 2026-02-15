import {
  ChecklistSignals,
  GeneratedMapSpec,
  MapPoint,
  MapThemeId,
  ValidationResult,
} from './types';
import { sanitizeAndValidateMapSpec } from './schema';
import { invokeTextModel } from '../sagemaker';

type ChecklistLikeItem = {
  category?: string;
  title?: string;
  description?: string;
};

const THEME_BASE_PATHS: Record<MapThemeId, MapPoint[]> = {
  desert_pyramids: [
    { x: 0.08, y: 0.92 },
    { x: 0.2, y: 0.78 },
    { x: 0.36, y: 0.7 },
    { x: 0.24, y: 0.56 },
    { x: 0.45, y: 0.48 },
    { x: 0.7, y: 0.53 },
    { x: 0.85, y: 0.38 },
    { x: 0.65, y: 0.28 },
    { x: 0.5, y: 0.14 },
  ],
  jungle_garden: [
    { x: 0.1, y: 0.92 },
    { x: 0.28, y: 0.82 },
    { x: 0.17, y: 0.68 },
    { x: 0.4, y: 0.62 },
    { x: 0.58, y: 0.68 },
    { x: 0.78, y: 0.52 },
    { x: 0.6, y: 0.37 },
    { x: 0.38, y: 0.3 },
    { x: 0.55, y: 0.14 },
  ],
  city_vitamins: [
    { x: 0.12, y: 0.9 },
    { x: 0.22, y: 0.76 },
    { x: 0.37, y: 0.8 },
    { x: 0.48, y: 0.65 },
    { x: 0.34, y: 0.53 },
    { x: 0.55, y: 0.44 },
    { x: 0.75, y: 0.56 },
    { x: 0.82, y: 0.36 },
    { x: 0.62, y: 0.18 },
  ],
  wellness_generic: [
    { x: 0.1, y: 0.9 },
    { x: 0.25, y: 0.78 },
    { x: 0.18, y: 0.62 },
    { x: 0.42, y: 0.56 },
    { x: 0.62, y: 0.6 },
    { x: 0.78, y: 0.42 },
    { x: 0.58, y: 0.28 },
    { x: 0.35, y: 0.2 },
    { x: 0.55, y: 0.1 },
  ],
};

const THEME_PALETTES = {
  desert_pyramids: {
    primary: '#F59E0B',
    secondary: '#D97706',
    accent: '#FCD34D',
    ground: '#B0893A',
    sky: '#7C2D12',
  },
  jungle_garden: {
    primary: '#22C55E',
    secondary: '#15803D',
    accent: '#86EFAC',
    ground: '#2D6A4F',
    sky: '#14532D',
  },
  city_vitamins: {
    primary: '#3B82F6',
    secondary: '#1D4ED8',
    accent: '#93C5FD',
    ground: '#4B5563',
    sky: '#172554',
  },
  wellness_generic: {
    primary: '#8B5CF6',
    secondary: '#7C3AED',
    accent: '#C4B5FD',
    ground: '#475569',
    sky: '#1E293B',
  },
} as const;

function containsAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

export function deriveChecklistSignals(items: ChecklistLikeItem[]): ChecklistSignals {
  const categories: Record<string, number> = {};
  const keywords = {
    vegetables: 0,
    vitamins: 0,
    medication: 0,
    exercise: 0,
    tests: 0,
    hydration: 0,
  };

  items.forEach((item) => {
    const category = (item.category || 'general').toLowerCase();
    categories[category] = (categories[category] || 0) + 1;

    const text = `${item.title} ${item.description}`.toLowerCase();
    if (containsAny(text, ['vegetable', 'greens', 'salad', 'nutrition'])) keywords.vegetables += 1;
    if (containsAny(text, ['vitamin', 'supplement', 'capsule'])) keywords.vitamins += 1;
    if (containsAny(text, ['medication', 'pill', 'tablet', 'dose', 'medicine'])) keywords.medication += 1;
    if (containsAny(text, ['exercise', 'walk', 'run', 'cardio', 'workout'])) keywords.exercise += 1;
    if (containsAny(text, ['test', 'lab', 'blood', 'scan', 'appointment'])) keywords.tests += 1;
    if (containsAny(text, ['water', 'hydration', 'drink'])) keywords.hydration += 1;
  });

  const dominantCategory =
    Object.entries(categories).sort((a, b) => b[1] - a[1])[0]?.[0] || 'general';

  return {
    checklistCount: items.length,
    categories,
    keywords,
    dominantFocus: dominantCategory,
  };
}

function pickThemeFromSignals(signals: ChecklistSignals): MapThemeId {
  if (signals.keywords.vegetables + signals.keywords.exercise >= 3) return 'jungle_garden';
  if (signals.keywords.vitamins + signals.keywords.tests >= 3) return 'city_vitamins';
  if (signals.keywords.medication >= 3) return 'city_vitamins';
  if (signals.dominantFocus === 'nutrition' || signals.dominantFocus === 'exercise') {
    return 'jungle_garden';
  }
  if (signals.dominantFocus === 'medication' || signals.dominantFocus === 'test') {
    return 'city_vitamins';
  }
  return 'desert_pyramids';
}

function resamplePath(path: MapPoint[], targetCount: number): MapPoint[] {
  const count = Math.max(2, targetCount);
  if (path.length >= count) return path.slice(0, count);
  const out: MapPoint[] = [];
  for (let i = 0; i < count; i += 1) {
    const t = i / (count - 1);
    const scaled = t * (path.length - 1);
    const left = Math.floor(scaled);
    const right = Math.min(path.length - 1, left + 1);
    const local = scaled - left;
    const p1 = path[left];
    const p2 = path[right];
    out.push({
      x: p1.x + (p2.x - p1.x) * local,
      y: p1.y + (p2.y - p1.y) * local,
    });
  }
  return out;
}

function fallbackDecorForTheme(theme: MapThemeId, signals: ChecklistSignals) {
  if (theme === 'jungle_garden') {
    return [
      { assetId: 'tree_big', x: 0.18, y: 0.28, scale: 1.2, layer: 'back' as const },
      { assetId: 'veggie_patch', x: 0.58, y: 0.72, scale: 1.1, layer: 'mid' as const },
      { assetId: 'waterfall', x: 0.78, y: 0.34, scale: 1.0, layer: 'back' as const },
    ];
  }
  if (theme === 'city_vitamins') {
    return [
      { assetId: 'tower_block', x: 0.16, y: 0.22, scale: 1.3, layer: 'back' as const },
      { assetId: 'lab_sign', x: 0.72, y: 0.2, scale: 1.0, layer: 'mid' as const },
      { assetId: 'pill_statue', x: 0.62, y: 0.78, scale: 0.9, layer: 'front' as const },
    ];
  }
  if (signals.keywords.vegetables > 0) {
    return [
      { assetId: 'palm', x: 0.6, y: 0.44, scale: 1.0, layer: 'mid' as const },
      { assetId: 'cactus', x: 0.12, y: 0.62, scale: 1.1, layer: 'front' as const },
    ];
  }
  return [
    { assetId: 'pyramid_large', x: 0.24, y: 0.36, scale: 1.3, layer: 'back' as const },
    { assetId: 'pyramid_small', x: 0.78, y: 0.3, scale: 1.1, layer: 'back' as const },
    { assetId: 'oasis_tree', x: 0.62, y: 0.52, scale: 1.0, layer: 'mid' as const },
  ];
}

function buildFallbackMapSpec(signals: ChecklistSignals, nodeCount: number): GeneratedMapSpec {
  const theme = pickThemeFromSignals(signals);
  const basePath = THEME_BASE_PATHS[theme];
  const count = Math.max(2, nodeCount);
  const path = resamplePath(basePath, count);

  const nodes = path.map((point, index) => ({
    id: `n${index + 1}`,
    index,
    stageType:
      index < nodeCount
        ? Object.keys(signals.categories)[index % Math.max(Object.keys(signals.categories).length, 1)] ||
          'general'
        : 'general',
    label: `Stage ${index + 1}`,
    x: point.x,
    y: point.y,
  }));

  return {
    version: 1,
    themeId: theme,
    styleTier: 'enhanced',
    palette: THEME_PALETTES[theme],
    background: {
      parallaxLayers:
        theme === 'desert_pyramids'
          ? [
              { assetId: 'far_dunes', speed: 0.08, opacity: 0.35 },
              { assetId: 'near_dunes', speed: 0.18, opacity: 0.5 },
            ]
          : theme === 'jungle_garden'
            ? [
                { assetId: 'far_trees', speed: 0.08, opacity: 0.4 },
                { assetId: 'near_vines', speed: 0.2, opacity: 0.55 },
              ]
            : [
                { assetId: 'far_skyline', speed: 0.08, opacity: 0.35 },
                { assetId: 'near_skyline', speed: 0.16, opacity: 0.55 },
              ],
    },
    path,
    nodes,
    decor: fallbackDecorForTheme(theme, signals),
    character: {
      skin: theme === 'city_vitamins' ? 'medic_neo' : 'explorer_default',
      x: path[0].x,
      y: path[0].y,
    },
    meta: {
      source: 'fallback',
      seed: Math.floor(Date.now() % 1000000),
      checklistCount: nodeCount,
    },
  };
}

function buildMapPrompt(signals: ChecklistSignals, nodeCount: number, items: ChecklistLikeItem[], startIndex: number): string {
  const itemsForMap = items.slice(startIndex, startIndex + nodeCount);
  const itemsDescription = itemsForMap.map((item, idx) => 
    `Step ${startIndex + idx + 1}: ${item.title} - ${item.description || 'No description'}`
  ).join('\n');

  return `You are a professional game map designer. Create a beautiful, detailed, vibrant JSON map spec for a mobile quest game that looks like a rich fantasy island or world map with diverse biomes and landscapes.

CRITICAL REQUIREMENTS FOR VISUAL RICHNESS:
1. Create a WINDING, INTERESTING PATH that snakes through diverse terrain - not a straight line!
2. Include MULTIPLE BIOMES: forests, mountains, beaches, rivers, lakes, deserts, grasslands, etc.
3. Add 10-20 DECORATIVE ELEMENTS: trees, buildings, landmarks, rocks, waterfalls, bridges, boats, etc.
4. Use VARIED TERRAIN: mix of flat areas, hills, valleys, water features
5. Make the path VISUALLY INTERESTING: curves, loops, elevation changes
6. Place nodes at INTERESTING LOCATIONS: near landmarks, on islands, at crossroads, etc.
7. Create a COHESIVE THEME that matches the medical/wellness checklist items

VISUAL STYLE:
- Think of maps like those in adventure games: colorful, detailed, with varied landscapes
- Path should connect nodes in a logical but visually interesting route
- Each node should be at a distinct, memorable location
- Decor should be scattered naturally, not clustered
- Use parallax layers for depth (far mountains, near trees, etc.)

Rules:
- Output ONLY valid JSON (no markdown, no code blocks, no explanations).
- Coordinates must be normalized floats between 0 and 1.
- Include exactly ${Math.max(2, nodeCount)} nodes in order.
- Path should have ${Math.max(nodeCount + 2, 8)} points minimum for smooth curves.
- Make path and nodes readable on phone (nodes spaced well, path clear).
- Theme should reflect checklist signals (nutrition=jungle, medication=city, etc.).
- Add 10-20 decor items for visual richness (trees, buildings, landmarks, etc.).
- Do not include copyrighted game names.

Checklist Items for this map:
${itemsDescription}

Signals:
${JSON.stringify(signals, null, 2)}

JSON shape required (output ONLY the JSON object):
{
  "version": 1,
  "themeId": "desert_pyramids|jungle_garden|city_vitamins|wellness_generic",
  "styleTier": "ai_art",
  "palette": {
    "primary": "#RRGGBB",
    "secondary": "#RRGGBB",
    "accent": "#RRGGBB",
    "ground": "#RRGGBB",
    "sky": "#RRGGBB"
  },
  "background": {
    "parallaxLayers": [
      {"assetId":"far_mountains","speed":0.05,"opacity":0.3},
      {"assetId":"mid_trees","speed":0.12,"opacity":0.5},
      {"assetId":"near_grass","speed":0.2,"opacity":0.6}
    ]
  },
  "path": [{"x": 0.1, "y": 0.9}, {"x": 0.15, "y": 0.85}, {"x": 0.2, "y": 0.8}],
  "nodes": [{"id":"n1","index":0,"stageType":"nutrition","label":"Step ${startIndex + 1}","x":0.1,"y":0.9}],
  "decor": [
    {"assetId":"tree_big","x":0.3,"y":0.5,"scale":1.2,"layer":"back"},
    {"assetId":"house_small","x":0.6,"y":0.4,"scale":1.0,"layer":"mid"},
    {"assetId":"bridge","x":0.5,"y":0.6,"scale":0.9,"layer":"front"}
  ],
  "character": {"skin":"explorer_default","x":0.1,"y":0.9},
  "meta": {"source":"ai","seed":${Math.floor(Math.random() * 1000000)},"checklistCount":${Math.max(2, nodeCount)}}
}`;
}

async function tryGenerateWithOpenAI(
  signals: ChecklistSignals,
  nodeCount: number,
  items: ChecklistLikeItem[],
  startIndex: number
): Promise<any | null> {
  const enabled = process.env.USE_AI_MAP_GENERATION === 'true';
  const provider = (process.env.AI_MAP_SPEC_PROVIDER || 'openai').toLowerCase();
  const apiKey = process.env.OPENAI_API_KEY;
  if (!enabled || (provider === 'openai' && !apiKey)) {
    console.log('AI map generation disabled or no API key');
    return null;
  }

  const model = process.env.OPENAI_MAP_MODEL || 'gpt-4.1-mini';
  console.log(`Generating AI map with ${provider}:${model} for ${nodeCount} nodes starting at index ${startIndex}`);
  
  try {
    let content: string = '';
    const userPrompt = buildMapPrompt(signals, nodeCount, items, startIndex);
    if (provider === 'sagemaker') {
      const result = await invokeTextModel(
        `You are a professional game map designer. Return ONLY valid JSON object.\n\n${userPrompt}`
      );
      content = result.text;
    } else {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: 0.8,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: 'You are a professional game map designer. You MUST return ONLY valid JSON. No markdown, no code blocks, no explanations, no text outside the JSON object. Just the raw JSON object starting with { and ending with }.'
            },
            { role: 'user', content: userPrompt },
          ],
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        console.error(`OpenAI API error: ${response.status}`, body);
        throw new Error(`OpenAI map generation failed: ${response.status} ${body}`);
      }

      const payload: any = await response.json();
      content = payload?.choices?.[0]?.message?.content;
    }

    if (typeof content !== 'string') {
      console.error('Map generation returned non-string content');
      return null;
    }

    // Try to parse JSON, handling markdown code blocks if present
    let jsonContent = content.trim();
    if (jsonContent.startsWith('```')) {
      jsonContent = jsonContent.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    try {
      const parsed = JSON.parse(jsonContent);
      console.log('Successfully generated AI map');
      return parsed;
    } catch (parseError) {
      console.error('Failed to parse OpenAI response as JSON, trying to extract JSON...', parseError);
      // Try to extract JSON from the response
      const match = jsonContent.match(/\{[\s\S]*\}/);
      if (match) {
        return JSON.parse(match[0]);
      }
      return null;
    }
  } catch (error) {
    console.error('OpenAI map generation error:', error);
    throw error;
  }
}

const MIN_STEPS_PER_MAP = 3;
const MAX_STEPS_PER_MAP = 6;

export async function generateMapSpecForChecklist(
  items: ChecklistLikeItem[],
  startIndex: number = 0,
  maxSteps: number = MAX_STEPS_PER_MAP
): Promise<{
  mapSpec: GeneratedMapSpec;
  source: 'ai' | 'fallback';
  signals: ChecklistSignals;
  validation: ValidationResult;
}> {
  const itemsForMap = items.slice(startIndex, startIndex + maxSteps);
  if (itemsForMap.length === 0) {
    throw new Error('No items to generate map for');
  }

  const signals = deriveChecklistSignals(itemsForMap);
  const nodeCount = Math.min(Math.max(MIN_STEPS_PER_MAP, itemsForMap.length), maxSteps);

  const fallback = buildFallbackMapSpec(signals, nodeCount);
  const fallbackPath = fallback.path;

  try {
    const aiRaw = await tryGenerateWithOpenAI(signals, nodeCount, items, startIndex);
    if (!aiRaw) {
      return {
        mapSpec: fallback,
        source: 'fallback',
        signals,
        validation: { ok: true, warnings: ['AI map generation disabled or unavailable; fallback used.'] },
      };
    }

    const normalized = sanitizeAndValidateMapSpec(aiRaw, nodeCount, fallbackPath);
    normalized.spec.meta.source = 'ai';
    
    // Update node labels to reflect actual step numbers
    normalized.spec.nodes = normalized.spec.nodes.map((node, idx) => ({
      ...node,
      label: `Step ${startIndex + idx + 1}`,
      stageType: itemsForMap[idx]?.category || node.stageType,
    }));

    return {
      mapSpec: normalized.spec,
      source: 'ai',
      signals,
      validation: normalized.validation,
    };
  } catch (error) {
    console.error('Map generation error:', error);
    return {
      mapSpec: fallback,
      source: 'fallback',
      signals,
      validation: {
        ok: false,
        warnings: [`AI map generation failed; fallback used. ${String(error)}`],
      },
    };
  }
}

/**
 * Generate multiple maps for a checklist, splitting into chunks of 3-6 steps
 */
export async function generateMapsForChecklist(
  items: ChecklistLikeItem[]
): Promise<Array<{
  mapSpec: GeneratedMapSpec;
  source: 'ai' | 'fallback';
  signals: ChecklistSignals;
  validation: ValidationResult;
  startIndex: number;
  endIndex: number;
}>> {
  const maps: Array<{
    mapSpec: GeneratedMapSpec;
    source: 'ai' | 'fallback';
    signals: ChecklistSignals;
    validation: ValidationResult;
    startIndex: number;
    endIndex: number;
  }> = [];

  let currentIndex = 0;
  while (currentIndex < items.length) {
    // Determine how many steps for this map (3-6, but don't exceed remaining items)
    const remaining = items.length - currentIndex;
    const stepsForThisMap = Math.min(
      Math.max(MIN_STEPS_PER_MAP, Math.floor(Math.random() * (MAX_STEPS_PER_MAP - MIN_STEPS_PER_MAP + 1)) + MIN_STEPS_PER_MAP),
      remaining
    );

    const result = await generateMapSpecForChecklist(items, currentIndex, stepsForThisMap);
    maps.push({
      ...result,
      startIndex: currentIndex,
      endIndex: currentIndex + stepsForThisMap - 1,
    });

    currentIndex += stepsForThisMap;
  }

  return maps;
}


