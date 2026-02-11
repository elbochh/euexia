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

  // Specialty-level detection first
  if (allText.match(/\b(dentist|dental|teeth|tooth|oral|gum|toothpaste|floss)\b/)) {
    specialty = 'dentistry';
    themeKeywords.push('dental', 'oral care', 'teeth');
    specificElements.push(
      'giant tooth statues',
      'toothbrush towers',
      'toothpaste streams',
      'floss bridges',
      'smiling molar landmarks'
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

Rules:
- Return JSON only.
- Pick exactly one specialty.
- Theme must reflect user input directly, not generic wellness assumptions.
- If dental/tooth/oral terms appear, choose dentistry.
- If chiropractor/spine/back/bone alignment terms appear, choose chiropractic.
- If chest xray/radiology/lung imaging terms appear, choose chest_radiology.
- If back/spine/vertebra/posture terms appear, choose chiropractic.
- Include 5-10 side elements that fit the specialty.

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
  context?: string
): string {
  const profile = themeProfile || analyzeChecklistTheme(items);
  const { specificElements, themeKeywords, specialty } = profile;
  
  const elementsList = specificElements.length > 0
    ? `\nSIDE ELEMENTS TO PLACE ALONG THE PATH:\n${specificElements.map((el, i) => `${i + 1}. ${el}`).join('\n')}`
    : '';

  // Build context string from items if not provided
  const contextText = context || items.map((item, idx) => 
    `Step ${idx + 1}: "${item.title}"${item.description ? ` - ${item.description}` : ''}`
  ).join('\n');

  // Determine what the entire world should be made of based on theme (EXACT same logic as test script)
  let worldMaterial = '';
  let noPeopleNote = '';
  const themeKeyLower = profile.themeKey?.toLowerCase() || '';
  const specialtyLower = specialty.toLowerCase();
  
  if (themeKeyLower.includes('chiropractic') || themeKeyLower.includes('spine') || themeKeyLower.includes('back')) {
    worldMaterial = 'an artificial world made ENTIRELY of bones, vertebrae, spine structures, and skeletal elements. Trees are vertebra pillars and bone structures, ground is made of bone fragments, everything is skeletal - creating a dense bone-world landscape. NO leaves, NO green vegetation, NO traditional plants.';
    noPeopleNote = 'NO people, NO human figures, NO characters - only bones, vertebrae, spine structures, and skeletal elements.';
  } else if (themeKeyLower.includes('dentist') || themeKeyLower.includes('dental')) {
    worldMaterial = 'an artificial world made ENTIRELY of teeth, tooth structures, toothbrush bristles, and dental elements. Trees are giant molars and tooth structures, ground is made of tooth fragments, everything is dental - creating a dense dental-world landscape. NO leaves, NO green vegetation, NO traditional plants.';
    noPeopleNote = 'NO people, NO human figures, NO characters - only teeth, dental tools, and oral care elements.';
  } else if (themeKeyLower.includes('nutrition') || themeKeyLower.includes('vegetable')) {
    worldMaterial = 'an artificial world made ENTIRELY of vegetables, fruits, and healthy food elements. Trees are giant vegetables, ground is made of food elements, everything is nutrition-themed - creating a dense food-world landscape. NO traditional leaves or green jungle vegetation.';
  } else if (themeKeyLower.includes('vitamin') || themeKeyLower.includes('supplement')) {
    worldMaterial = 'an artificial world made ENTIRELY of vitamin bottles, supplement capsules, and nutrient elements. Trees are giant vitamin bottles, ground is made of capsules, everything is supplement-themed - creating a dense vitamin-world landscape. NO traditional leaves or green jungle vegetation.';
  } else if (themeKeyLower.includes('medication') || themeKeyLower.includes('pharmacy')) {
    worldMaterial = 'an artificial world made ENTIRELY of pills, medicine bottles, and pharmaceutical elements. Trees are giant medicine bottles, ground is made of pills, everything is pharmaceutical - creating a dense medication-world landscape. NO traditional leaves or green jungle vegetation.';
  } else if (themeKeyLower.includes('fissure') || themeKeyLower.includes('bowel') || themeKeyLower.includes('digestive') || 
             specialtyLower.includes('gastroenterology') || specialtyLower.includes('digestive') ||
             themeKeywords.some(k => k.toLowerCase().includes('fiber') || k.toLowerCase().includes('stool') || k.toLowerCase().includes('bowel'))) {
    worldMaterial = 'an artificial world made ENTIRELY of digestive system elements - intestines as trees and structures, fiber strands, water droplets, stool softeners, digestive organs. Trees are coiled intestines, ground is made of digestive elements, everything is digestive-system themed - creating a dense digestive-world landscape. NO traditional leaves, NO green vegetation, NO plants.';
    noPeopleNote = 'NO people, NO human figures, NO characters - only digestive system elements, intestines, fiber, and digestive-related medical elements.';
  } else {
    worldMaterial = 'an artificial world made ENTIRELY of themed medical elements related to the specialty. Everything in the landscape should be constructed from medical/health elements - NO traditional leaves, NO green vegetation, NO natural plants. The world should feel dense and jungle-like in structure but be completely artificial and themed.';
  }

  return `Create a beautiful, detailed, 3D perspective/isometric view medical map background image with a SINGLE MAIN PATH, like a Rick and Morty dimension portal view.

CRITICAL LAYOUT REQUIREMENTS (MUST FOLLOW):
- EXACTLY ONE SINGLE MAIN PATH ONLY. No branches, no forks, no crossroads, no multiple routes.
- PERSPECTIVE VIEW: The image should be viewed from a person's perspective looking down a path into the distance (isometric/3D perspective, NOT top-down).
- The path starts from the BOTTOM/FOREGROUND of the image and winds SNAKE-LIKE into the DISTANCE/TOP of the image.
- The path should be thick, wide, and clearly visible, receding into the distance with proper perspective (wider in foreground, narrower in background).
- The path should be SNAKE-LIKE and WAVY - like a serpent winding its way into the distance, with smooth S-curves and gentle bends visible from the perspective view.
- The path should curve and wind naturally, creating a serpentine/snake-like appearance as it extends into the distance.
- Use proper 3D perspective: foreground elements are larger, background elements are smaller, creating depth.
- NO city layouts, NO complex road networks, NO side paths, NO branches.
- The path must be the dominant visual element, clearly visible as it winds from foreground to background.

THEME REQUIREMENTS:
- Medical Specialty: ${specialty}
- User Context: ${contextText}
- Theme Keywords: ${themeKeywords.join(', ')}${elementsList}
- On BOTH SIDES of the path, place themed elements that match the medical specialty.
- Make themed elements look natural and integrated into the landscape.
${noPeopleNote ? `${noPeopleNote}\n` : ''}
VISUAL STYLE REQUIREMENTS:
- ARTIFICIAL WORLD: The entire landscape should be ${worldMaterial}
- The world should feel dense and jungle-like in STRUCTURE (dense, layered, complex) but be completely artificial and made of themed elements.
- NO traditional vegetation: NO leaves, NO green plants, NO natural trees, NO grass, NO traditional jungle elements.
- EVERYTHING must be made of themed medical elements - trees, ground, structures, everything.
- 3D REALISTIC STYLE: Three-dimensional depth, realistic lighting, shadows, and perspective.
- ISOMETRIC/PERSPECTIVE VIEW: Like Rick and Morty dimension portals - viewed from a person's perspective looking down a path into the distance, NOT top-down.
- The camera/viewpoint should be positioned as if standing at the start of the path, looking forward into the themed world.
- Use proper perspective: foreground is close and large, background is distant and smaller, creating a sense of depth and distance.
- Vibrant, colorful, high-detail illustration with Rick and Morty aesthetic.
- The path should look like a cleared route through this artificial themed-element world, receding into the distance.
- Think Rick and Morty dimension style - an entire artificial world constructed from a single theme, viewed from a person's perspective.

TECHNICAL REQUIREMENTS:
- No text overlays, no UI elements, no numbers, no labels.
- No people, no human figures, no characters (unless theme specifically requires it).
- This is a pure background image only.
- High quality, detailed, professional illustration.
- The path must be clearly visible and easy to follow from bottom to top.

IMPORTANT: The image must show EXACTLY ONE MAIN PATH from bottom to top. The jungle/vegetation around the path should be made entirely of themed medical elements (bones for chiropractic, teeth for dental, vegetables for nutrition, etc.), not traditional trees. 3D realistic style with themed-element jungle.`;
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
    // Build context from raw consultation text first, otherwise fallback to map chunk text
    const context = (params.rawContext && params.rawContext.trim()) || items.map((item, idx) =>
      `${item.title}${item.description ? ` - ${item.description}` : ''}`
    ).join('. ');
    let prompt = buildImagePrompt(signals, items, effectiveTheme, context);
    const themeKey = params.themeKey || effectiveTheme.themeKey;
    const stepCount = params.stepCount || Math.max(2, items.length);
    const imageModel = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';

    // Continuation instruction for maps after the first one.
    if ((params.continuationLevel || 1) > 1) {
      prompt += `\n\nCONTINUATION REQUIREMENT:\n- This is LEVEL ${params.continuationLevel} of the SAME world.\n- Continue from the previous map image with the same visual identity, style, color language, and themed world objects.\n- Keep path continuity so it feels like the next chapter, not a new unrelated map.`;
    }

    // Hard cap required by image generation endpoint.
    if (prompt.length > 4000) {
      const keep = 3950;
      prompt = `${prompt.slice(0, keep)}...`;
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
      size: '1024x1792',
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
    
    const prompt = `You are analyzing a medical journey map image. This image shows a single path winding from the bottom/foreground to the top/background in a perspective/isometric view (like Rick and Morty dimension portals).

Your task:
1. Identify the SINGLE MAIN PATH in the image - it should be a snake-like winding path from bottom to top
2. Determine ${stepCount} checkpoint positions along this path, evenly distributed from start to end
3. Return the path as a series of points following the path's curve
4. Return checkpoint positions as nodes placed ON the path

IMPORTANT:
- The image is viewed from a person's perspective (isometric/3D perspective), NOT top-down
- Coordinates should be normalized (0.0 to 1.0) where:
  - x: 0.0 = left edge, 1.0 = right edge
  - y: 0.0 = top edge, 1.0 = bottom edge (y increases downward)
- The path starts near the bottom (y close to 1.0) and winds to the top (y close to 0.0)
- Checkpoints should be evenly spaced along the path's length
- All checkpoints must be ON the path, not beside it

Return ONLY a valid JSON object with this exact structure:
{
  "path": [
    {"x": 0.5, "y": 0.95},
    {"x": 0.52, "y": 0.88},
    ...
  ],
  "nodes": [
    {"x": 0.5, "y": 0.95, "index": 0},
    {"x": 0.52, "y": 0.88, "index": 1},
    ...
  ]
}

The "path" array should have 15-25 points that trace the path's curve.
The "nodes" array should have exactly ${stepCount} checkpoints evenly distributed along the path.`;

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

