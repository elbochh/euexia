import {
  GeneratedMapSpec,
  MapDecor,
  MapNode,
  MapPoint,
  ValidationResult,
} from './types';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0.5;
  return Math.max(0, Math.min(1, value));
}

function toPoint(input: any, fallback: MapPoint): MapPoint {
  return {
    x: clamp01(Number(input?.x ?? fallback.x)),
    y: clamp01(Number(input?.y ?? fallback.y)),
  };
}

function sanitizeNode(input: any, index: number, fallbackPoint: MapPoint): MapNode {
  const point = toPoint(input, fallbackPoint);
  return {
    id: typeof input?.id === 'string' && input.id.length > 0 ? input.id : `n${index + 1}`,
    index,
    stageType:
      typeof input?.stageType === 'string' && input.stageType.length > 0
        ? input.stageType
        : 'general',
    label:
      typeof input?.label === 'string' && input.label.length > 0
        ? input.label.slice(0, 60)
        : `Stage ${index + 1}`,
    x: point.x,
    y: point.y,
  };
}

function sanitizeDecor(input: any): MapDecor | null {
  const assetId = typeof input?.assetId === 'string' ? input.assetId : '';
  if (!assetId) return null;

  const point = toPoint(input, { x: 0.5, y: 0.5 });
  const scale = Number(input?.scale ?? 1);
  const layer =
    input?.layer === 'back' || input?.layer === 'mid' || input?.layer === 'front'
      ? input.layer
      : 'mid';

  return {
    assetId: assetId.slice(0, 48),
    x: point.x,
    y: point.y,
    scale: Number.isFinite(scale) ? Math.max(0.5, Math.min(2, scale)) : 1,
    layer,
  };
}

function isHex(value: any): boolean {
  return typeof value === 'string' && HEX_COLOR.test(value);
}

export function sanitizeAndValidateMapSpec(
  candidate: any,
  expectedNodeCount: number,
  fallbackPath: MapPoint[]
): { spec: GeneratedMapSpec; validation: ValidationResult } {
  const warnings: string[] = [];

  const themeId =
    candidate?.themeId === 'desert_pyramids' ||
    candidate?.themeId === 'jungle_garden' ||
    candidate?.themeId === 'city_vitamins' ||
    candidate?.themeId === 'wellness_generic'
      ? candidate.themeId
      : 'wellness_generic';
  if (themeId === 'wellness_generic') warnings.push('Invalid or missing themeId; fallback used.');

  const palette = {
    primary: isHex(candidate?.palette?.primary) ? candidate.palette.primary : '#3B82F6',
    secondary: isHex(candidate?.palette?.secondary) ? candidate.palette.secondary : '#1D4ED8',
    accent: isHex(candidate?.palette?.accent) ? candidate.palette.accent : '#93C5FD',
    ground: isHex(candidate?.palette?.ground) ? candidate.palette.ground : '#374151',
    sky: isHex(candidate?.palette?.sky) ? candidate.palette.sky : '#0F172A',
  };

  const rawPath = Array.isArray(candidate?.path) ? candidate.path : [];
  const path =
    rawPath.length >= 2
      ? rawPath.map((p: any, idx: number) => toPoint(p, fallbackPath[idx % fallbackPath.length]))
      : fallbackPath;
  if (rawPath.length < 2) warnings.push('Path had fewer than 2 points; fallback path used.');

  const rawNodes = Array.isArray(candidate?.nodes) ? candidate.nodes : [];
  const targetCount = Math.max(2, expectedNodeCount);
  const nodes: MapNode[] = [];
  for (let i = 0; i < targetCount; i += 1) {
    const fallbackPoint = path[Math.min(i, path.length - 1)];
    nodes.push(sanitizeNode(rawNodes[i], i, fallbackPoint));
  }
  if (rawNodes.length !== targetCount) {
    warnings.push(`Node count normalized to ${targetCount}.`);
  }

  const rawDecor = Array.isArray(candidate?.decor) ? candidate.decor : [];
  const decor = rawDecor
    .map((d: any) => sanitizeDecor(d))
    .filter((d: MapDecor | null): d is MapDecor => d !== null)
    .slice(0, 40);
  if (rawDecor.length > 40) warnings.push('Decor trimmed to 40 items.');

  const character = {
    skin:
      typeof candidate?.character?.skin === 'string' && candidate.character.skin.length > 0
        ? candidate.character.skin.slice(0, 32)
        : 'explorer_default',
    ...toPoint(candidate?.character, nodes[0]),
  };

  const spec: GeneratedMapSpec = {
    version: 1,
    themeId,
    styleTier:
      candidate?.styleTier === 'enhanced' || candidate?.styleTier === 'ai_art'
        ? candidate.styleTier
        : 'template',
    palette,
    background: {
      imageUrl:
        typeof candidate?.background?.imageUrl === 'string' &&
        candidate.background.imageUrl.startsWith('http')
          ? candidate.background.imageUrl
          : undefined,
      parallaxLayers: Array.isArray(candidate?.background?.parallaxLayers)
        ? candidate.background.parallaxLayers
            .map((layer: any) => ({
              assetId: typeof layer?.assetId === 'string' ? layer.assetId.slice(0, 48) : '',
              speed: Number.isFinite(Number(layer?.speed))
                ? Math.max(0.05, Math.min(1.5, Number(layer.speed)))
                : 0.2,
              opacity: Number.isFinite(Number(layer?.opacity))
                ? Math.max(0.1, Math.min(1, Number(layer.opacity)))
                : 0.5,
            }))
            .filter((layer: any) => layer.assetId)
            .slice(0, 8)
        : [],
    },
    path,
    nodes,
    decor,
    character,
    meta: {
      source: candidate?.meta?.source === 'ai' ? 'ai' : 'fallback',
      seed: Number.isFinite(Number(candidate?.meta?.seed))
        ? Number(candidate.meta.seed)
        : Math.floor(Date.now() % 1000000),
      checklistCount: targetCount,
    },
  };

  return {
    spec,
    validation: {
      ok: warnings.length === 0,
      warnings,
    },
  };
}


