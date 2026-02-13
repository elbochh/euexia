import fs from 'fs';
import path from 'path';
import { ChecklistSignals, GeneratedMapSpec, MapNode, MapPoint, MapThemeId } from './mapSpec/types';
import { invokeImageGenerationModel, invokeImageModel, invokeTextModel } from './sagemaker';

const MAPS_DIR = path.join(__dirname, '../../maps');
const PROMPT_VERSION = 2;

// Ensure maps directory exists
if (!fs.existsSync(MAPS_DIR)) {
  fs.mkdirSync(MAPS_DIR, { recursive: true });
}

type ChecklistItemLike = { title: string; description?: string; category?: string };

export interface ThemeProfile {
  themeKey: string;
  specialty: string;
  specificElements: string[];
  themeKeywords: string[];
}

function slugifyTheme(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50) || 'general_wellness';
}

/**
 * Extract specific items and specialty themes from checklist items.
 */
export function analyzeChecklistTheme(items: ChecklistItemLike[]): ThemeProfile {
  const allText = items.map(item => `${item.title} ${item.description || ''}`).join(' ').toLowerCase();
  const specificElements: string[] = [];
  const themeKeywords: string[] = [];
  let specialty = 'general wellness';

  // Specialty-level detection first - DENTISTRY (check first, most specific)
  if (allText.match(/\b(wisdom tooth|tooth removal|tooth extraction|extraction|dentist|dental|teeth|tooth|oral|gum|toothpaste|floss|molar|canine|incisor|root canal|cavity|filling|braces|orthodontist|oral surgery|toothache|dental hygiene|brushing teeth|tooth pain|dental care|tooth cleaning)\b/)) {
    specialty = 'dentistry';
    themeKeywords.push('dental', 'oral care', 'teeth', 'tooth');
    specificElements.push(
      'giant tooth statues',
      'toothbrush towers',
      'toothpaste streams',
      'floss bridges',
      'smiling molar landmarks',
      'dental tools',
      'pearly white teeth structures'
    );
  } else if (allText.match(/\b(chiropractor|chiropractic|spine|vertebra|posture|back pain|back)\b/)) {
    specialty = 'chiropractic';
    themeKeywords.push('spine', 'bones', 'posture');
    specificElements.push(
      'vertebra-shaped arches',
      'spine totems',
      'bone pillars',
      'posture clinic huts',
      'rib-cage rock formations'
    );
  } else if (allText.match(/\b(chest x.?ray|x.?ray chest|pulmonary x.?ray|lung x.?ray)\b/)) {
    specialty = 'chest radiology';
    themeKeywords.push('chest xray', 'lungs', 'radiology');
    specificElements.push(
      'lung-shaped cliffs',
      'x-ray panel signposts',
      'radiology scanner stations',
      'thorax icon carvings',
      'transparent rib-cage monuments'
    );
  } else if (allText.match(/\b(radiology|x.?ray|ct|mri|ultrasound|imaging)\b/)) {
    specialty = 'radiology';
    themeKeywords.push('medical imaging', 'radiology');
    specificElements.push(
      'imaging crystal towers',
      'scan chamber ruins',
      'x-ray murals',
      'medical lens beacons'
    );
  } else if (allText.match(/\b(cardiology|heart|bp|blood pressure|pulse)\b/)) {
    specialty = 'cardiology';
    themeKeywords.push('heart health', 'circulation');
    specificElements.push(
      'heart-shaped groves',
      'artery river channels',
      'pulse beacon towers',
      'stethoscope stone arches'
    );
  } else if (allText.match(/\b(orthopedic|orthopaedic|bone|joint|knee|hip|fracture)\b/)) {
    specialty = 'orthopedics';
    themeKeywords.push('bones', 'joints');
    specificElements.push(
      'bone ridge formations',
      'joint-ring arches',
      'cast workshop huts',
      'skeletal guardian statues'
    );
  } else if (allText.match(/\b(medication|pill|tablet|capsule|antibiotic|prescription|medicine|pharmacy)\b/)) {
    specialty = 'medication';
    themeKeywords.push('pharmacy', 'medicine');
    specificElements.push(
      'pill-shaped trees',
      'capsule stones',
      'pharmacy stalls',
      'bottle shrines'
    );
  } else if (allText.match(/\b(exercise|workout|run|walk|cardio|fitness|gym)\b/)) {
    specialty = 'fitness';
    themeKeywords.push('exercise', 'movement');
    specificElements.push(
      'running lane markings',
      'fitness camp outposts',
      'training totems',
      'agility arches'
    );
  } else if (allText.match(/\b(nutrition|diet|vegetable|fruit|healthy food|salad)\b/)) {
    specialty = 'nutrition';
    themeKeywords.push('healthy food', 'nutrition');
    specificElements.push(
      'fruit orchards',
      'vegetable terraces',
      'nutrition stands',
      'farmstone windmills'
    );
  }

  // Secondary enrichers
  if (allText.match(/\b(hydration|water|drink)\b/)) {
    themeKeywords.push('hydration');
    specificElements.push('hydration springs', 'water refill shrines');
  }

  if (allText.match(/\b(vitamin|supplement|mineral)\b/)) {
    themeKeywords.push('supplements');
    specificElements.push('vitamin crystal gardens', 'supplement kiosks');
  }

  const themeKey = slugifyTheme(specialty);
  return { themeKey, specialty, specificElements, themeKeywords };
}

/**
 * Ask GPT-4o-mini to determine specialty/theme from user checklist context.
 * This is used once per consultation so all generated maps keep a consistent theme.
 */
export async function detectThemeWithOpenAI(
  items: ChecklistItemLike[],
  rawContext: string = ''
): Promise<ThemeProfile> {
  const provider = (process.env.AI_THEME_PROVIDER || 'openai').toLowerCase();
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_THEME_MODEL || 'gpt-4.1-mini';
  if (provider === 'openai' && !apiKey) return analyzeChecklistTheme(items);

  const checklistText = items
    .map((item, idx) => `${idx + 1}. ${item.title}${item.description ? ` - ${item.description}` : ''}`)
    .join('\n');

  const prompt = `Determine ONE primary medical specialty theme from the consultation/checklist content.

CRITICAL RULES:
- Return JSON only.
- Pick exactly one specialty based on SPECIFIC keywords in the content.
- Theme must reflect user input directly, not generic wellness assumptions.
- Be VERY SPECIFIC: Look for exact medical terms and procedures mentioned.

SPECIFIC THEME DETECTION RULES (check in order):
1. DENTISTRY: If ANY of these appear → "tooth", "teeth", "dental", "dentist", "wisdom tooth", "tooth removal", "extraction", "oral", "gum", "molar", "canine", "incisor", "root canal", "cavity", "filling", "braces", "orthodontist", "oral surgery", "toothache", "dental hygiene", "flossing", "brushing teeth"
2. CHIROPRACTIC: If ANY of these appear → "chiropractor", "spine", "back pain", "vertebra", "alignment", "posture", "spinal", "subluxation", "adjustment", "neck pain", "lower back"
3. CHEST RADIOLOGY: If ANY of these appear → "chest xray", "chest x-ray", "lung imaging", "pulmonary", "radiology", "CT scan chest", "chest imaging"
4. MEDICATION: If ANY of these appear → "medication", "prescription", "antibiotic", "dosage", "pharmacy", "pill", "tablet", "medicine", "drug"
5. NUTRITION: If ANY of these appear → "diet", "nutrition", "vegetable", "fruit", "calorie", "meal plan", "eating", "food"
6. FITNESS: If ANY of these appear → "exercise", "workout", "fitness", "gym", "running", "walking", "cardio"
7. GENERAL WELLNESS: Only if none of the above match

Include 5-10 side elements that fit the specialty.

Output JSON schema:
{
  "theme_key": "dentistry|chiropractic|chest_radiology|radiology|cardiology|orthopedics|medication|fitness|nutrition|general_wellness",
  "specialty": "Human readable specialty name",
  "theme_keywords": ["keyword1", "keyword2"],
  "specific_elements": ["element1", "element2", "element3"]
}

Raw consultation context:
${rawContext || '(none)'}

Checklist items:
${checklistText}`;

  try {
    let content = '';
    if (provider === 'sagemaker') {
      const result = await invokeTextModel(prompt);
      content = result.text || '';
    } else {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                'You classify medical checklist themes. Return strict JSON only with stable specialty decisions.',
            },
            { role: 'user', content: prompt },
          ],
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Theme detection failed: ${response.status} ${body}`);
      }

      const payload: any = await response.json();
      content = payload?.choices?.[0]?.message?.content || '';
    }

    if (typeof content !== 'string') return analyzeChecklistTheme(items);

    const parsed = JSON.parse(content);
    const specialty = String(parsed?.specialty || 'general wellness').trim();
    const themeKey = slugifyTheme(String(parsed?.theme_key || specialty));
    const themeKeywords = Array.isArray(parsed?.theme_keywords)
      ? parsed.theme_keywords.map((v: any) => String(v)).filter(Boolean).slice(0, 10)
      : [];
    const specificElements = Array.isArray(parsed?.specific_elements)
      ? parsed.specific_elements.map((v: any) => String(v)).filter(Boolean).slice(0, 12)
      : [];

    if (!themeKey) return analyzeChecklistTheme(items);
    return { themeKey, specialty, themeKeywords, specificElements };
  } catch (error) {
    console.warn('Theme detection fallback used:', error);
    return analyzeChecklistTheme(items);
  }
}

/**
 * Legacy-compatible wrapper.
 */
function extractMapThemes(items: ChecklistItemLike[]): {
  specificElements: string[];
  themeKeywords: string[];
  overallTheme: string;
} {
  const profile = analyzeChecklistTheme(items);
  return {
    specificElements: profile.specificElements,
    themeKeywords: profile.themeKeywords,
    overallTheme: profile.specialty,
  };
}

/**
 * Generate a detailed prompt for DALL-E to create a fantasy map image
 * Uses the EXACT same logic as the test script
 */
function buildImagePrompt(
  _signals: ChecklistSignals,
  items: ChecklistItemLike[],
  themeProfile?: ThemeProfile,
  _context?: string
): string {
  const profile = themeProfile || analyzeChecklistTheme(items);
  const { themeKeywords, specialty } = profile;
  
  // Determine optimistic world material based on theme
  let worldMaterial = '';
  const themeKeyLower = profile.themeKey?.toLowerCase() || '';
  const specialtyLower = specialty.toLowerCase();
  
  if (themeKeyLower.includes('chiropractic') || themeKeyLower.includes('spine') || themeKeyLower.includes('back')) {
    worldMaterial = 'a vibrant world of glowing spine structures, healthy vertebrae, and strong bone formations. Trees are elegant vertebra pillars, ground sparkles with bone fragments. Bright, optimistic, healing energy.';
  } else if (themeKeyLower.includes('dentist') || themeKeyLower.includes('dental')) {
    worldMaterial = 'a bright world of pearly white teeth, shiny dental tools, and healthy oral care elements. Trees are gleaming molars, ground glistens with tooth structures. Clean, fresh, optimistic.';
  } else if (themeKeyLower.includes('nutrition') || themeKeyLower.includes('vegetable')) {
    worldMaterial = 'a colorful world of fresh vegetables, vibrant fruits, and healthy food. Trees are giant colorful vegetables, ground is lush with food elements. Bright, energetic, life-giving.';
  } else if (themeKeyLower.includes('vitamin') || themeKeyLower.includes('supplement')) {
    worldMaterial = 'a glowing world of bright vitamin bottles, colorful supplement capsules, and nutrient elements. Trees are radiant vitamin bottles, ground sparkles with capsules. Energetic, vibrant, healthful.';
  } else if (themeKeyLower.includes('medication') || themeKeyLower.includes('pharmacy')) {
    worldMaterial = 'a positive world of healing elements - colorful medicine bottles, bright wellness symbols, health icons. Trees are vibrant health symbols, ground glows with positive medical elements. Optimistic, healing, hopeful.';
  } else if (themeKeyLower.includes('fissure') || themeKeyLower.includes('bowel') || themeKeyLower.includes('digestive') || 
             specialtyLower.includes('gastroenterology') || specialtyLower.includes('digestive') ||
             themeKeywords.some(k => k.toLowerCase().includes('fiber') || k.toLowerCase().includes('stool') || k.toLowerCase().includes('bowel'))) {
    worldMaterial = 'a vibrant world of healthy digestive elements - colorful fiber strands, glowing water droplets, wellness symbols. Trees are healthy digestive structures, ground sparkles with wellness elements. Bright, positive, healing.';
  } else {
    worldMaterial = 'a vibrant, optimistic world made of positive health and wellness elements. Bright, colorful, energetic themed elements. NO traditional vegetation.';
  }

  // Use only top 5 theme keywords to keep it short
  const keywords = themeKeywords.slice(0, 5).join(', ');

  return `Create a vibrant, optimistic 3D perspective medical map with a SINGLE SNAKE-LIKE PATH that CROSSES THE ENTIRE IMAGE from bottom edge to top edge.

CRITICAL PATH REQUIREMENTS:
- Path MUST start at the very BOTTOM EDGE of the image (y=1.0) and wind ALL THE WAY to the very TOP EDGE (y=0.0)
- Path MUST be visible from bottom to top, crossing the full height of the image
- Path should be snake-like with smooth curves, winding from bottom foreground to top background
- Path must be wide, clearly visible, and the dominant visual element
- Use 3D perspective: path wider at bottom (foreground), narrower at top (background)

LAYOUT: One main path only, perspective view (NOT top-down), path spans full image height from bottom edge to top edge.

THEME: ${specialty}. Keywords: ${keywords}. World made of ${worldMaterial}. Place positive themed elements along both sides of path.

STYLE: 3D isometric perspective like Rick and Morty portals. Vibrant, colorful, optimistic, high-detail. Bright lighting, positive energy. NO traditional vegetation, NO people, NO text. Pure background image.`;
}

/**
 * Generate a map image using DALL-E API
 */
export async function generateMapImage(
  signals: ChecklistSignals,
  items: ChecklistItemLike[],
  params: {
    consultationId?: string;
    mapIndex?: number;
    themeKey?: string;
    stepCount?: number;
    themeProfile?: ThemeProfile;
    rawContext?: string;
    previousImagePath?: string;
    continuationLevel?: number;
  } = {}
): Promise<{ imagePath: string; imageUrl: string; imageBuffer?: Buffer } | null> {
  const enabled = process.env.USE_AI_MAP_GENERATION === 'true';
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!enabled || !apiKey) {
    console.log('AI image generation disabled or no API key');
    return null;
  }

  try {
    const effectiveTheme = params.themeProfile || analyzeChecklistTheme(items);
    // Don't pass context - only use theme for image generation
    let prompt = buildImagePrompt(signals, items, effectiveTheme);
    const themeKey = params.themeKey || effectiveTheme.themeKey;
    const stepCount = params.stepCount || Math.max(2, items.length);
    const imageModel = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';

    // Continuation instruction for maps after the first one.
    if ((params.continuationLevel || 1) > 1) {
      prompt += `\n\nCONTINUATION: Level ${params.continuationLevel} of same world. Continue visual style and path from previous map.`;
    }

    // Safety check - prompt should now be well under limit, but keep as safeguard
    if (prompt.length > 4000) {
      console.warn(`Prompt still too long (${prompt.length} chars), truncating...`);
      prompt = prompt.slice(0, 3950);
    }

    console.log(
      `Generating map image with DALL-E for theme ${themeKey}, steps ${stepCount}, consultation ${params.consultationId || 'n/a'}, map ${params.mapIndex ?? 'n/a'}`
    );
    console.log(`Prompt length: ${prompt.length} characters`);
    console.log(`\nPrompt used:\n${prompt}\n`);

    const previousImageBuffer =
      typeof params.previousImagePath === 'string' &&
      params.previousImagePath.length > 0 &&
      fs.existsSync(params.previousImagePath)
        ? fs.readFileSync(params.previousImagePath)
        : undefined;

    const generated = await invokeImageGenerationModel({
      prompt,
      previousImageBuffer,
      size: '1024x1536', // Vertical/portrait orientation for mobile (supported by DALL-E)
      quality: imageModel === 'gpt-image-1' ? 'high' : 'standard',
    });

    let imageBuffer: Buffer;
    if (generated.b64_json) {
      imageBuffer = Buffer.from(generated.b64_json, 'base64');
    } else if (generated.url) {
      const imageResponse = await fetch(generated.url);
      if (!imageResponse.ok) {
        throw new Error('Failed to download generated image');
      }
      imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    } else {
      console.error('No image payload in image generation response');
      return null;
    }
    
    // Save locally
    const filename = `map-${themeKey}-${stepCount}-${Date.now()}.png`;
    const filePath = path.join(MAPS_DIR, filename);
    fs.writeFileSync(filePath, imageBuffer);

    const imageUrlPath = `/maps/${filename}`;

    console.log(`Successfully generated and saved map image: ${filePath}`);
    
    return {
      imagePath: filePath,
      imageUrl: imageUrlPath,
      imageBuffer, // Return buffer for analysis
    };
  } catch (error) {
    console.error('Map image generation error:', error);
    return null;
  }
}

/**
 * Build a complete GeneratedMapSpec from analyzed path and nodes
 */
export function buildMapSpecFromAnalysis(
  path: MapPoint[],
  nodes: MapNode[],
  signals: ChecklistSignals,
  items: ChecklistItemLike[],
  imageUrl: string,
  themeProfile: ThemeProfile
): GeneratedMapSpec {
  const themeId: MapThemeId = 'wellness_generic'; // Default theme
  
  // Generate a simple palette based on theme
  const palette = {
    primary: '#8B5CF6',
    secondary: '#7C3AED',
    accent: '#C4B5FD',
    ground: '#475569',
    sky: '#1E293B',
  };

  // Character spawn at first node
  const character = {
    x: nodes[0]?.x || 0.5,
    y: nodes[0]?.y || 0.9,
    skin: 'default',
  };

  // Minimal decor (can be enhanced later)
  const decor: any[] = [];

  return {
    version: 1,
    themeId,
    styleTier: 'ai_art',
    palette,
    background: {
      imageUrl,
    },
    path,
    nodes,
    decor,
    character,
    meta: {
      source: 'ai',
      seed: Date.now(),
      checklistCount: items.length,
    },
  };
}

/**
 * Analyze a generated map image with GPT-4 Vision to extract checkpoint positions
 */
export async function analyzeMapImageForCheckpoints(
  imageBuffer: Buffer,
  stepCount: number,
  items: ChecklistItemLike[]
): Promise<{ path: MapPoint[]; nodes: MapNode[] } | null> {
  const provider = (process.env.AI_VISION_PROVIDER || 'openai').toLowerCase();
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_VISION_MODEL || 'gpt-4.1-mini';
  
  if (!apiKey) {
    console.error('OPENAI_API_KEY missing for image analysis');
    return null;
  }

  try {
    // Convert buffer to base64
    const imageBase64 = imageBuffer.toString('base64');
    
    const itemsList = items.map((item, idx) => `  ${idx + 1}. ${item.title || `Step ${idx + 1}`}`).join('\n');
    
    const prompt = `You are analyzing a medical journey map image. This image shows a single path winding from the bottom/foreground to the top/background in a perspective/isometric view (like Rick and Morty dimension portals).

CRITICAL REQUIREMENTS:
1. You MUST identify the SINGLE MAIN PATHWAY in the image - it should be a snake-like winding path from bottom to top
2. You MUST determine EXACTLY ${stepCount} checkpoint positions along this path
3. Each checkpoint corresponds to a step in the journey:
${itemsList}
4. Checkpoints MUST be evenly distributed along the path's length from start (bottom) to end (top)
5. ALL checkpoints MUST be positioned directly ON the pathway, not beside it or off the path

COORDINATE SYSTEM:
- The image is viewed from a person's perspective (isometric/3D perspective), NOT top-down
- Coordinates are normalized (0.0 to 1.0) where:
  - x: 0.0 = left edge of image, 1.0 = right edge of image
  - y: 0.0 = top edge of image, 1.0 = bottom edge of image (y increases downward)
- The path typically starts near the bottom-center (x ~0.5, y ~0.9-0.95) and winds upward
- The path typically ends near the top (y ~0.05-0.15)

NODE PLACEMENT RULES:
- The first node (index 0) should be near the START of the path (bottom, y close to 1.0)
- The last node (index ${stepCount - 1}) should be near the END of the path (top, y close to 0.0)
- Intermediate nodes should be evenly spaced along the path's curve
- Each node's x and y coordinates must be ON the visible pathway
- If the path curves left/right, follow the curve with the nodes

Return ONLY a valid JSON object with this exact structure (no markdown, no code blocks):
{
  "path": [
    {"x": 0.5, "y": 0.95},
    {"x": 0.52, "y": 0.88},
    {"x": 0.48, "y": 0.82},
    ...
  ],
  "nodes": [
    {"x": 0.5, "y": 0.95, "index": 0},
    {"x": 0.52, "y": 0.88, "index": 1},
    {"x": 0.48, "y": 0.82, "index": 2},
    ...
  ]
}

REQUIREMENTS:
- The "path" array should have 20-30 points that accurately trace the path's curve from bottom to top
- The "nodes" array MUST have exactly ${stepCount} checkpoints (no more, no less)
- Each node must have an "index" field (0, 1, 2, ..., ${stepCount - 1})
- All coordinates must be between 0.0 and 1.0
- Nodes must be in order from start (index 0) to end (index ${stepCount - 1})`;

    let content = '';
    if (provider === 'sagemaker') {
      const result = await invokeImageModel(imageBase64, prompt);
      content = result.text || '';
    } else {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: prompt,
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/png;base64,${imageBase64}`,
                  },
                },
              ],
            },
          ],
          max_tokens: 2000,
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        console.error(`GPT-4 Vision API error: ${response.status}`, body);
        return null;
      }

      const data: any = await response.json();
      content = data.choices?.[0]?.message?.content || '';
    }
    
    if (!content || typeof content !== 'string') {
      console.error('No content in GPT-4 Vision response');
      return null;
    }

    // Extract JSON from response
    let jsonStr = content.trim();
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    const parsed = JSON.parse(jsonStr);
    
    // Validate and normalize
    const path: MapPoint[] = Array.isArray(parsed.path)
      ? parsed.path
          .filter((p: any) => typeof p?.x === 'number' && typeof p?.y === 'number')
          .map((p: any) => ({
            x: Math.max(0, Math.min(1, p.x)),
            y: Math.max(0, Math.min(1, p.y)),
          }))
      : [];

    const nodes: MapNode[] = Array.isArray(parsed.nodes)
      ? parsed.nodes
          .filter((n: any) => typeof n?.x === 'number' && typeof n?.y === 'number')
          .slice(0, stepCount)
          .map((n: any, idx: number) => ({
            x: Math.max(0, Math.min(1, n.x)),
            y: Math.max(0, Math.min(1, n.y)),
            id: `node-${idx}`,
            index: idx,
            stageType: items[idx]?.category || 'general',
            label: `Step ${idx + 1}`,
          }))
      : [];

    if (path.length === 0 || nodes.length !== stepCount) {
      console.error(`Invalid path/nodes from GPT-4 Vision: path=${path.length}, nodes=${nodes.length}, expected=${stepCount}`);
      return null;
    }

    console.log(`Successfully analyzed image: extracted path with ${path.length} points and ${nodes.length} checkpoints`);
    
    return { path, nodes };
  } catch (error) {
    console.error('Image analysis error:', error);
    return null;
  }
}

/**
 * Generate a fallback map image (placeholder or default)
 */
export function getFallbackMapImage(): { imagePath: string; imageUrl: string } {
  return {
    imagePath: '',
    imageUrl: '',
  };
}

export { PROMPT_VERSION };

