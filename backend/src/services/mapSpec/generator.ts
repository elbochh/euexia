import {
  ChecklistSignals,
  GeneratedMapSpec,
  MapPoint,
  MapThemeId,
  ValidationResult,
} from './types';
import { sanitizeAndValidateMapSpec } from './schema';

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

function buildMapPrompt(signals: ChecklistSignals, nodeCount: number): string {
  return `You are a game map designer. Create a JSON map spec for a mobile quest map.

Rules:
- Output ONLY valid JSON (no markdown).
- Coordinates must be normalized floats between 0 and 1.
- Include exactly ${Math.max(2, nodeCount)} nodes in order.
- Make path and nodes readable on phone.
- Theme should reflect checklist signals.
- Do not include copyrighted game names.

Signals:
${JSON.stringify(signals, null, 2)}

JSON shape required:
{
  "version": 1,
  "themeId": "desert_pyramids|jungle_garden|city_vitamins|wellness_generic",
  "styleTier": "template|enhanced|ai_art",
  "palette": {
    "primary": "#RRGGBB",
    "secondary": "#RRGGBB",
    "accent": "#RRGGBB",
    "ground": "#RRGGBB",
    "sky": "#RRGGBB"
  },
  "background": {
    "imageUrl": "https://...",
    "parallaxLayers": [{"assetId":"far_dunes","speed":0.1,"opacity":0.5}]
  },
  "path": [{"x": 0.1, "y": 0.9}],
  "nodes": [{"id":"n1","index":0,"stageType":"nutrition","label":"Stage 1","x":0.1,"y":0.9}],
  "decor": [{"assetId":"tree_big","x":0.5,"y":0.4,"scale":1,"layer":"mid"}],
  "character": {"skin":"explorer_default","x":0.1,"y":0.9},
  "meta": {"source":"ai","seed":12345,"checklistCount":${Math.max(2, nodeCount)}}
}`;
}

async function tryGenerateWithOpenAI(
  signals: ChecklistSignals,
  nodeCount: number
): Promise<any | null> {
  const enabled = process.env.USE_AI_MAP_GENERATION === 'true';
  const apiKey = process.env.OPENAI_API_KEY;
  if (!enabled || !apiKey) return null;

  const model = process.env.OPENAI_MAP_MODEL || 'gpt-4.1-mini';
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.5,
      messages: [
        { role: 'system', content: 'Return strict JSON only.' },
        { role: 'user', content: buildMapPrompt(signals, nodeCount) },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI map generation failed: ${response.status} ${body}`);
  }

  const payload: any = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') return null;

  try {
    return JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]);
  }
}

export async function generateMapSpecForChecklist(
  items: ChecklistLikeItem[]
): Promise<{
  mapSpec: GeneratedMapSpec;
  source: 'ai' | 'fallback';
  signals: ChecklistSignals;
  validation: ValidationResult;
}> {
  const signals = deriveChecklistSignals(items);
  const checklistCount = Math.max(2, signals.checklistCount || 2);

  const fallback = buildFallbackMapSpec(signals, checklistCount);
  const fallbackPath = fallback.path;

  try {
    const aiRaw = await tryGenerateWithOpenAI(signals, checklistCount);
    if (!aiRaw) {
      return {
        mapSpec: fallback,
        source: 'fallback',
        signals,
        validation: { ok: true, warnings: ['AI map generation disabled or unavailable; fallback used.'] },
      };
    }

    const normalized = sanitizeAndValidateMapSpec(aiRaw, checklistCount, fallbackPath);
    normalized.spec.meta.source = 'ai';
    return {
      mapSpec: normalized.spec,
      source: 'ai',
      signals,
      validation: normalized.validation,
    };
  } catch (error) {
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


