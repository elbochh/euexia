/**
 * Automatic FBX to Sprite Sheet Renderer
 * 
 * This service automatically detects FBX files in the character folders,
 * renders them to sprite sheets using Three.js, and caches the results.
 * The rendered sprites are then used by the game automatically.
 */

import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

const spriteSheetCache = new Map<string, string>();
const spriteSheetRenderPromises = new Map<string, Promise<string | null>>();
const RENDER_PIPELINE_VERSION = 'v5-mega-frame-mobile-safe';
const MODEL_PATH_PREFERENCES: Record<'player' | 'doctor', Record<'idle' | 'walk', string[]>> = {
  player: {
    // Keep player movement animation as highest priority.
    walk: [
      '/characters/player/models/walk.fbx',
      '/characters/player/models/model.fbx',
      '/characters/player/models/idle.fbx',
    ],
    idle: [
      '/characters/player/models/idle.fbx',
      '/characters/player/models/model.fbx',
      '/characters/player/models/walk.fbx',
    ],
  },
  doctor: {
    // Prefer idle animation for doctor so the consultant does not stay in rigid bind pose.
    idle: [
      '/characters/doctor/models/idle.fbx',
      '/characters/doctor/models/model.fbx',
    ],
    // Doctor has no walk animation in current game usage; keep same appearance if requested.
    walk: [
      '/characters/doctor/models/model.fbx',
      '/characters/doctor/models/idle.fbx',
    ],
  },
};

interface RenderOptions {
  frameCount?: number;
  frameWidth?: number;
  frameHeight?: number;
  cameraHeight?: number;
  textureCandidates?: string[];
}

/**
 * Renders an FBX animation to a sprite sheet
 */
export async function renderFBXToSpriteSheet(
  fbxPath: string,
  options: RenderOptions = {}
): Promise<string> {
  const {
    frameCount = 8,
    frameWidth = 768,
    frameHeight = 768,
    cameraHeight = 1.6,
    textureCandidates = [],
  } = options;

  // Create offscreen canvas for rendering
  const canvas = document.createElement('canvas');
  canvas.width = frameWidth * frameCount;
  canvas.height = frameHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // Create Three.js scene
  const scene = new THREE.Scene();
  scene.background = null; // Transparent

  // Camera setup for 3/4 front view (character-friendly framing)
  const camera = new THREE.PerspectiveCamera(24, frameWidth / frameHeight, 0.1, 2400);
  camera.position.set(1.8, cameraHeight, 2.4);
  camera.lookAt(0, 0.8, 0);

  // Renderer
  const renderer = new THREE.WebGLRenderer({
    canvas: document.createElement('canvas'),
    alpha: true,
    antialias: true,
  });
  renderer.setSize(frameWidth, frameHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;

  // Lighting
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.6);
  directionalLight.position.set(3, 7, 5);
  scene.add(directionalLight);
  scene.add(new THREE.AmbientLight(0xffffff, 1.15));
  scene.add(new THREE.HemisphereLight(0xffffff, 0x5b6a7a, 0.9));

  // Load FBX model
  const loader = new FBXLoader();
  const fbx = await new Promise<THREE.Group>((resolve, reject) => {
    loader.load(
      fbxPath,
      (object: THREE.Group) => resolve(object),
      undefined,
      reject
    );
  });

  let fallbackSkinMap: THREE.Texture | null = null;
  if (textureCandidates.length > 0) {
    const loader = new THREE.TextureLoader();
    for (const textureUrl of textureCandidates) {
      try {
        const exists = await fetch(textureUrl, { cache: 'no-store' });
        if (!exists.ok) continue;
        fallbackSkinMap = await new Promise<THREE.Texture>((resolve, reject) => {
          loader.load(textureUrl, resolve, undefined, reject);
        });
        fallbackSkinMap.colorSpace = THREE.SRGBColorSpace;
        break;
      } catch {
        // Try next texture candidate.
      }
    }
  }

  // Some Mixamo/Kenney FBX files reference texture maps that are not present at runtime.
  // Replace missing-map materials so the character still renders visibly instead of black.
  fbx.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!(mesh as any).isMesh || !mesh.material) return;

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const patched = materials.map((mat: any) => {
      const hasUsableMap = !!mat?.map?.image;
      if (hasUsableMap) {
        if (mat.map) {
          mat.map.colorSpace = THREE.SRGBColorSpace;
          mat.needsUpdate = true;
        }
        return mat as THREE.Material;
      }

      const color =
        mat?.color && typeof mat.color.clone === 'function'
          ? mat.color.clone()
          : new THREE.Color(0xdbe4f0);
      const fallback = new THREE.MeshStandardMaterial({
        color,
        map: fallbackSkinMap || null,
        roughness: 0.62,
        metalness: 0.02,
        side: THREE.DoubleSide,
        transparent: false,
        alphaTest: 0,
        emissive: new THREE.Color(0x222222),
        emissiveIntensity: 0.18,
      });
      (fallback as any).skinning = (mesh as any).isSkinnedMesh === true;
      return fallback;
    });

    mesh.material = Array.isArray(mesh.material) ? patched : patched[0];
  });

  // Center and scale model
  // Compute bounds from renderable meshes only (exclude armature/bone extents).
  fbx.updateMatrixWorld(true);
  const box = new THREE.Box3();
  fbx.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!(mesh as any).isMesh || !mesh.geometry) return;
    if (!mesh.geometry.boundingBox) {
      mesh.geometry.computeBoundingBox();
    }
    if (!mesh.geometry.boundingBox) return;
    const meshBox = mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
    box.union(meshBox);
  });
  if (box.isEmpty()) {
    box.setFromObject(fbx);
  }
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  // Keep model smaller inside frame to avoid head/feet clipping in generated sprite sheets.
  const scale = 1.45 / maxDim;
  
  fbx.scale.multiplyScalar(scale);
  fbx.position.sub(center.multiplyScalar(scale));

  // Re-fit model after scaling so it stays centered and grounded in frame.
  const fittedBox = new THREE.Box3().setFromObject(fbx);
  const fittedCenter = fittedBox.getCenter(new THREE.Vector3());
  const fittedSize = fittedBox.getSize(new THREE.Vector3());
  fbx.position.x -= fittedCenter.x;
  fbx.position.z -= fittedCenter.z;
  fbx.position.y += -fittedBox.min.y;

  // Fit camera to full character height so body is fully visible in sprite frames.
  // Intentionally oversized framing to prevent any head/feet clipping on mobile.
  const fitDistance = Math.max(7.2, fittedSize.y * 4.2, fittedSize.x * 6.2);
  const focusY = Math.max(0.45, fittedSize.y * 0.42);
  camera.position.set(fitDistance * 0.16, focusY + fittedSize.y * 0.14, fitDistance);
  camera.lookAt(0, focusY, 0);
  camera.updateProjectionMatrix();
  
  scene.add(fbx);

  // Setup animation mixer
  let mixer: THREE.AnimationMixer | null = null;
  const animations = fbx.animations || [];
  if (animations.length > 0) {
    mixer = new THREE.AnimationMixer(fbx);
    const action = mixer.clipAction(animations[0]);
    action.play();
  }

  let lastTime = 0;

  // Render each frame
  for (let i = 0; i < frameCount; i++) {
    // Update animation
    if (mixer) {
      const time = (i / frameCount) * (animations[0]?.duration || 1);
      mixer.update(Math.max(0, time - lastTime));
      lastTime = time;
    }

    // Render frame
    renderer.render(scene, camera);

    // Copy to sprite sheet canvas
    ctx.drawImage(
      renderer.domElement,
      0, 0, frameWidth, frameHeight,
      i * frameWidth, 0, frameWidth, frameHeight
    );
  }

  // Cleanup
  renderer.dispose();
  scene.remove(fbx);
  fbx.traverse((child) => {
    if ((child as THREE.Mesh).geometry) {
      (child as THREE.Mesh).geometry.dispose();
    }
    if ((child as THREE.Mesh).material) {
      const material = (child as THREE.Mesh).material as THREE.Material;
      if (Array.isArray(material)) {
        material.forEach((mat) => mat.dispose());
      } else {
        material.dispose();
      }
    }
  });

  // Convert canvas to data URL
  return canvas.toDataURL('image/png');
}

/**
 * Checks if sprite sheet exists, if not renders from FBX
 */
export async function getOrRenderSpriteSheet(
  characterId: 'player' | 'doctor',
  animation: 'idle' | 'walk'
): Promise<string | null> {
  const fbxCandidates =
    MODEL_PATH_PREFERENCES[characterId]?.[animation] || [
      `/characters/${characterId}/models/${animation}.fbx`,
      `/characters/${characterId}/models/model.fbx`,
    ];
  
  let fbxPath: string | null = null;
  for (const candidate of fbxCandidates) {
    try {
      const fbxResponse = await fetch(candidate, { cache: 'no-store' });
      if (fbxResponse.ok) {
        fbxPath = candidate;
        console.log(`✅ Found FBX file: ${candidate}`);
        break;
      }
    } catch {
      // Continue to next candidate
    }
  }
  
  if (!fbxPath) {
    console.warn(`No FBX file found for ${characterId}/${animation} (tried: ${fbxCandidates.join(', ')})`);
    return null;
  }

  const cacheKey = `${RENDER_PIPELINE_VERSION}:${characterId}:${animation}:${fbxPath}`;
  const cached = spriteSheetCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  const inFlight = spriteSheetRenderPromises.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const renderPromise = (async () => {
    try {
    const textureCandidates = [
      `/characters/${characterId}/${animation}.png`,
      `/characters/${characterId}/idle.png`,
      `/characters/${characterId}/walk.png`,
    ];

    // Render FBX to sprite sheet
    console.log(`🎨 Rendering ${characterId}/${animation} from FBX: ${fbxPath}...`);
    const spriteDataUrl = await renderFBXToSpriteSheet(fbxPath, {
      frameCount: 8,
      frameWidth: 768,
      frameHeight: 768,
      textureCandidates,
    });
    
    console.log(`✅ Rendered ${characterId}/${animation} sprite sheet`);
    
    // Return data URL directly so Pixi can parse it as an image.
    spriteSheetCache.set(cacheKey, spriteDataUrl);
    return spriteDataUrl;
    } catch (error) {
      console.error(`Failed to render ${characterId}/${animation}:`, error);
      return null;
    } finally {
      spriteSheetRenderPromises.delete(cacheKey);
    }
  })();
  spriteSheetRenderPromises.set(cacheKey, renderPromise);
  return renderPromise;
}

