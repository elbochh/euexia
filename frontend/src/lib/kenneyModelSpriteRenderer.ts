import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const spriteSheetCache = new Map<string, string>();
const renderPromises = new Map<string, Promise<string | null>>();

type CharacterId = 'player' | 'doctor';
type AnimationId = 'idle' | 'walk';

const KENNEY_MODEL_PATHS: Record<CharacterId, string> = {
  // Swapped to a more regular civilian look (non-zombie).
  player: '/kenney_blocky-characters_20/Models/GLB%20format/character-a.glb',
  doctor: '/kenney_blocky-characters_20/Models/GLB%20format/character-i.glb',
};

const KENNEY_CLIP_NAMES: Record<CharacterId, Record<AnimationId, string>> = {
  player: {
    idle: 'idle',
    walk: 'walk',
  },
  doctor: {
    idle: 'idle',
    // Doctor stays mostly static in map UX; fallback to idle if walk isn't desired.
    walk: 'walk',
  },
};

async function renderKenneyModelToSpriteSheet(
  modelPath: string,
  preferredClipName: string,
  frameCount: number = 12,
  frameWidth: number = 192,
  frameHeight: number = 192
): Promise<string> {
  const sheetCanvas = document.createElement('canvas');
  sheetCanvas.width = frameWidth * frameCount;
  sheetCanvas.height = frameHeight;
  const sheetCtx = sheetCanvas.getContext('2d');
  if (!sheetCtx) throw new Error('Failed to create sprite sheet canvas context');

  const rendererCanvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({
    canvas: rendererCanvas,
    alpha: true,
    antialias: true,
    powerPreference: 'low-power',
  });
  renderer.setSize(frameWidth, frameHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(24, frameWidth / frameHeight, 0.1, 1000);
  camera.position.set(1.8, 1.8, 2.2);
  camera.lookAt(0, 0.8, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 1.15));
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(4, 7, 5);
  scene.add(key);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x7a8aa0, 0.7);
  scene.add(hemi);

  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(modelPath);
  const model = gltf.scene;
  scene.add(model);

  // Fit model in frame.
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const scale = 1.4 / maxDim;
  model.scale.setScalar(scale);
  model.position.sub(center.multiplyScalar(scale));
  const fitted = new THREE.Box3().setFromObject(model);
  model.position.y += -fitted.min.y;

  const fitted2 = new THREE.Box3().setFromObject(model);
  const fittedSize = fitted2.getSize(new THREE.Vector3());
  const focusY = Math.max(0.45, fittedSize.y * 0.45);
  const distance = Math.max(3.8, fittedSize.y * 2.8);
  camera.position.set(distance * 0.28, focusY + fittedSize.y * 0.2, distance);
  camera.lookAt(0, focusY, 0);
  camera.updateProjectionMatrix();

  const animations = gltf.animations || [];
  let mixer: THREE.AnimationMixer | null = null;
  let clipDuration = 1;
  if (animations.length > 0) {
    mixer = new THREE.AnimationMixer(model);
    const preferred = animations.find((a) => a.name?.toLowerCase() === preferredClipName.toLowerCase());
    const fallback =
      animations.find((a) => a.name?.toLowerCase() === 'walk') ||
      animations.find((a) => a.name?.toLowerCase() === 'idle') ||
      animations[0];
    const clip = preferred || fallback;
    if (clip) {
      const action = mixer.clipAction(clip);
      action.play();
      clipDuration = Math.max(clip.duration || 1, 0.1);
    }
  }

  for (let i = 0; i < frameCount; i += 1) {
    if (mixer) {
      const t = (i / frameCount) * clipDuration;
      mixer.setTime(t);
    }
    renderer.render(scene, camera);
    sheetCtx.drawImage(renderer.domElement, 0, 0, frameWidth, frameHeight, i * frameWidth, 0, frameWidth, frameHeight);
  }

  renderer.dispose();
  scene.remove(model);

  return sheetCanvas.toDataURL('image/png');
}

export async function getOrRenderKenneySpriteSheet(
  characterId: CharacterId,
  animation: AnimationId
): Promise<string | null> {
  const modelPath = KENNEY_MODEL_PATHS[characterId];
  const clipName = KENNEY_CLIP_NAMES[characterId][animation] || 'idle';
  const cacheKey = `${characterId}:${animation}:${modelPath}:${clipName}`;

  const cached = spriteSheetCache.get(cacheKey);
  if (cached) return cached;

  const inFlight = renderPromises.get(cacheKey);
  if (inFlight) return inFlight;

  const p = (async () => {
    try {
      const out = await renderKenneyModelToSpriteSheet(modelPath, clipName);
      spriteSheetCache.set(cacheKey, out);
      return out;
    } catch (error) {
      console.error(`Failed to render Kenney model for ${characterId}/${animation}:`, error);
      return null;
    } finally {
      renderPromises.delete(cacheKey);
    }
  })();

  renderPromises.set(cacheKey, p);
  return p;
}

