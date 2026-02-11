export type MapThemeId =
  | 'desert_pyramids'
  | 'jungle_garden'
  | 'city_vitamins'
  | 'wellness_generic';

export interface ThemePalette {
  primary: string;
  secondary: string;
  accent: string;
  ground: string;
  sky: string;
}

export interface MapPoint {
  x: number; // normalized [0..1]
  y: number; // normalized [0..1]
}

export interface MapNode extends MapPoint {
  id: string;
  index: number;
  stageType: string;
  label: string;
}

export interface MapDecor extends MapPoint {
  assetId: string;
  scale: number; // [0.5..2]
  layer: 'back' | 'mid' | 'front';
}

export interface CharacterSpawn extends MapPoint {
  skin: string;
}

export interface MapBackground {
  imageUrl?: string;
  parallaxLayers?: Array<{
    assetId: string;
    speed: number;
    opacity: number;
  }>;
}

export interface GeneratedMapSpec {
  version: 1;
  themeId: MapThemeId;
  styleTier: 'template' | 'enhanced' | 'ai_art';
  palette: ThemePalette;
  background: MapBackground;
  path: MapPoint[];
  nodes: MapNode[];
  decor: MapDecor[];
  character: CharacterSpawn;
  meta: {
    source: 'ai' | 'fallback';
    seed: number;
    checklistCount: number;
  };
}

export interface ChecklistSignals {
  checklistCount: number;
  categories: Record<string, number>;
  keywords: {
    vegetables: number;
    vitamins: number;
    medication: number;
    exercise: number;
    tests: number;
    hydration: number;
  };
  dominantFocus: string;
}

export interface ValidationResult {
  ok: boolean;
  warnings: string[];
}


