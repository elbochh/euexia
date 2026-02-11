import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

type CliArgs = {
  context: string;
  size: '1024x1024' | '1792x1024' | '1024x1792';
  theme?: string; // Optional override
};

interface ThemeProfile {
  themeKey: string;
  specialty: string;
  specificElements: string[];
  themeKeywords: string[];
}

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = {
    context: 'Brush teeth twice daily, floss nightly, take antibiotics once at night for 3 days.',
    size: '1024x1024',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const val = argv[i + 1];
    if (!key?.startsWith('--') || typeof val !== 'string') continue;
    if (key === '--context') out.context = val;
    if (key === '--theme') out.theme = val;
    if (key === '--size' && (val === '1024x1024' || val === '1792x1024' || val === '1024x1792')) {
      out.size = val;
    }
  }

  return out;
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
 * Use GPT-4o-mini to detect theme from user context
 */
async function detectThemeWithGPT(context: string): Promise<ThemeProfile> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_THEME_MODEL || 'gpt-4o-mini';
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required for theme detection');
  }

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
${context}`;

  try {
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
              'You classify medical consultation themes. Return strict JSON only with stable specialty decisions.',
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
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      throw new Error('No content in GPT response');
    }

    const parsed = JSON.parse(content);
    const specialty = String(parsed?.specialty || 'general wellness').trim();
    const themeKey = slugifyTheme(String(parsed?.theme_key || specialty));
    const themeKeywords = Array.isArray(parsed?.theme_keywords)
      ? parsed.theme_keywords.map((v: any) => String(v)).filter(Boolean).slice(0, 10)
      : [];
    const specificElements = Array.isArray(parsed?.specific_elements)
      ? parsed.specific_elements.map((v: any) => String(v)).filter(Boolean).slice(0, 12)
      : [];

    return { themeKey, specialty, themeKeywords, specificElements };
  } catch (error) {
    console.error('Theme detection error:', error);
    throw error;
  }
}

function buildPrompt(themeProfile: ThemeProfile, context: string): string {
  const elementsList = themeProfile.specificElements.length > 0
    ? `\nSIDE ELEMENTS TO PLACE ALONG THE PATH:\n${themeProfile.specificElements.map((el, i) => `${i + 1}. ${el}`).join('\n')}`
    : '';

  // Determine what the entire world should be made of based on theme
  let worldMaterial = '';
  let noPeopleNote = '';
  const themeKeyLower = themeProfile.themeKey.toLowerCase();
  const specialtyLower = themeProfile.specialty.toLowerCase();
  
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
             themeProfile.themeKeywords.some(k => k.toLowerCase().includes('fiber') || k.toLowerCase().includes('stool') || k.toLowerCase().includes('bowel'))) {
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
- Medical Specialty: ${themeProfile.specialty}
- User Context: ${context}
- Theme Keywords: ${themeProfile.themeKeywords.join(', ')}${elementsList}
- On BOTH SIDES of the path, place themed elements that match the medical specialty.
- Make themed elements look natural and integrated into the landscape.
${noPeopleNote}

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

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is missing in backend/.env');
  }

  const args = parseArgs(process.argv.slice(2));
  
  console.log('Step 1: Detecting theme with GPT-4o-mini...');
  console.log(`User context: ${args.context}`);
  
  let themeProfile: ThemeProfile;
  if (args.theme) {
    // Manual theme override
    themeProfile = {
      themeKey: slugifyTheme(args.theme),
      specialty: args.theme,
      themeKeywords: [args.theme],
      specificElements: [],
    };
    console.log(`Using manual theme: ${args.theme}`);
  } else {
    // Auto-detect with GPT
    themeProfile = await detectThemeWithGPT(args.context);
    console.log(`Detected theme: ${themeProfile.specialty} (${themeProfile.themeKey})`);
    console.log(`Theme keywords: ${themeProfile.themeKeywords.join(', ')}`);
    console.log(`Side elements: ${themeProfile.specificElements.slice(0, 5).join(', ')}...`);
  }

  const prompt = buildPrompt(themeProfile, args.context);
  const model = process.env.OPENAI_IMAGE_MODEL || 'dall-e-3';

  console.log('\nStep 2: Generating image with DALL-E...');
  console.log(`Model: ${model}`);
  console.log(`Size: ${args.size}`);

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      prompt,
      n: 1,
      size: args.size,
      quality: model === 'gpt-image-1' ? 'high' : 'standard',
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Image generation failed: ${response.status} ${body}`);
  }

  const data: any = await response.json();
  const item = data?.data?.[0];
  let buffer: Buffer;

  if (item?.b64_json) {
    buffer = Buffer.from(item.b64_json, 'base64');
  } else if (item?.url) {
    const imageResp = await fetch(item.url);
    if (!imageResp.ok) {
      throw new Error('Failed to download generated image.');
    }
    buffer = Buffer.from(await imageResp.arrayBuffer());
  } else {
    throw new Error('No image payload returned from OpenAI.');
  }
  
  const outDir = path.join(__dirname, '../../maps/playground');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const safeTheme = themeProfile.themeKey;
  const fileName = `test-${safeTheme}-${Date.now()}.png`;
  const filePath = path.join(outDir, fileName);
  fs.writeFileSync(filePath, buffer);

  console.log('\n✅ Done!');
  console.log(`Saved: ${filePath}`);
  console.log(`\nPrompt used:\n${prompt}`);
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});


