/**
 * Helper to render 3D models (FBX) to Pixi.js textures
 * This allows us to use 3D models in our 2D game
 */

import * as THREE from 'three';
import { Texture } from 'pixi.js';

// Note: FBXLoader needs to be loaded separately
// We'll use dynamic imports or CDN

export interface ModelConfig {
  modelPath: string;
  animationPath?: string;
  scale?: number;
  cameraHeight?: number;
}

export class ThreeModelRenderer {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private model: THREE.Group | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private clock: THREE.Clock;
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement, width: number = 128, height: number = 128) {
    this.canvas = canvas;
    this.canvas.width = width;
    this.canvas.height = height;

    // Initialize Three.js scene
    this.scene = new THREE.Scene();
    this.scene.background = null; // Transparent

    // Camera setup for top-down view
    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    this.camera.position.set(0, 5, 0);
    this.camera.lookAt(0, 0, 0);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    // Lighting
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 5);
    this.scene.add(directionalLight);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.5));

    this.clock = new THREE.Clock();
  }

  async loadModel(config: ModelConfig): Promise<void> {
    // Load FBX model
    // Note: This requires FBXLoader to be available
    // We'll use dynamic import or expect it to be loaded globally
    
    try {
      // For now, we'll need to load FBXLoader separately
      // This is a placeholder - actual implementation needs FBXLoader
      console.warn('FBX loading requires FBXLoader. Please use the web tool to render sprites first.');
      
      // TODO: Implement FBX loading when FBXLoader is available
      // const loader = new (window as any).THREE.FBXLoader();
      // const model = await loader.loadAsync(config.modelPath);
      // this.model = model;
      // ... rest of loading logic
    } catch (error) {
      console.error('Failed to load 3D model:', error);
      throw error;
    }
  }

  update(deltaTime: number): void {
    if (this.mixer) {
      this.mixer.update(deltaTime);
    }
    this.renderer.render(this.scene, this.camera);
  }

  getTexture(): Texture {
    return Texture.from(this.canvas);
  }

  dispose(): void {
    this.renderer.dispose();
    if (this.model) {
      this.scene.remove(this.model);
    }
  }
}

