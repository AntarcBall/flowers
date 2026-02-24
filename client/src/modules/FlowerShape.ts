import { Color, Shape, Vector2 } from 'three';
import { CONFIG } from '../config';
import type { FlowerRenderParams } from '../types';

const TAU = Math.PI * 2;
const DEFAULT_ROT_WRAP = Math.PI * 2;

type FlowerPalette = {
  outer: string;
  outerGlow: string;
  inner: string;
  innerGlow: string;
  core: string;
  coreGlow: string;
  edge: string;
  line: string;
};

export type FlowerProfile = {
  outerPoints: Vector2[];
  innerPoints: Vector2[];
  outerShape: Shape;
  innerShape: Shape;
  outerLine: Float32Array;
  innerLine: Float32Array;
  coreRadius: number;
  haloRadius: number;
  palette: FlowerPalette;
  strokeWeight: number;
};

const PROFILE_CACHE_MAX = 180;
const PROFILE_CACHE = new Map<string, FlowerProfile>();

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, value));
}

function clamp01(value: number) {
  return clamp(value, 0, 1);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * clamp01(t);
}

function wrapPi2(value: number) {
  return ((value % DEFAULT_ROT_WRAP) + DEFAULT_ROT_WRAP) % DEFAULT_ROT_WRAP;
}

function hashColor(base: string, shiftH: number, multS = 1, multL = 1) {
  const c = new Color(base);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  const sat = clamp(hsl.s * multS, 0.05, 1);
  const lum = clamp(hsl.l * multL, 0.04, 0.95);
  const hue = ((hsl.h + shiftH) % 1 + 1) % 1;
  const out = new Color();
  out.setHSL(hue, sat, lum);
  return `#${out.getHexString()}`;
}

function superR(phi: number, m: number, n1: number, n2: number, n3: number, a = 1, b = 1) {
  const t1 = Math.pow(Math.abs(Math.cos((m * phi) / 4) / a), n2);
  const t2 = Math.pow(Math.abs(Math.sin((m * phi) / 4) / b), n3);
  const base = t1 + t2;
  if (base <= 0 || !Number.isFinite(base)) {
    return 0;
  }
  const r = Math.pow(base, -1 / n1);
  if (!Number.isFinite(r)) {
    return 0;
  }
  return r;
}

function makeShapeFromPoints(points: Vector2[]) {
  const shape = new Shape();
  const [firstPoint, ...restPoints] = points;
  if (!firstPoint) {
    return shape;
  }
  shape.moveTo(firstPoint.x, firstPoint.y);
  for (const point of restPoints) {
    shape.lineTo(point.x, point.y);
  }
  shape.closePath();
  return shape;
}

function toLineBuffer(points: Vector2[]) {
  const output = new Float32Array(points.length * 3);
  for (let i = 0; i < points.length; i += 1) {
    const p = points[i];
    const offset = i * 3;
    output[offset] = p.x;
    output[offset + 1] = p.y;
    output[offset + 2] = 0;
  }
  return output;
}

function normalizedField(value: number | undefined, fallback: number, key: keyof typeof CONFIG.FLOWER_RANGES) {
  const range = CONFIG.FLOWER_RANGES[key];
  return clamp(value ?? fallback, range.min, range.max);
}

export function normalizeFlowerParams(params: Partial<FlowerRenderParams> = {}) {
  const safe = {
    m: normalizedField(params.m, 6, 'm'),
    n1: normalizedField(params.n1, 2, 'n1'),
    n2: normalizedField(params.n2, 2, 'n2'),
    n3: normalizedField(params.n3, 2, 'n3'),
    rot: wrapPi2(params.rot ?? 0),
    petalCount: Math.round(normalizedField(params.petalCount, 7, 'petalCount')),
    petalStretch: normalizedField(params.petalStretch, 1, 'petalStretch'),
    petalCrest: normalizedField(params.petalCrest, 1, 'petalCrest'),
    petalSpread: normalizedField(params.petalSpread, 1, 'petalSpread'),
    coreRadius: normalizedField(params.coreRadius, 0.32, 'coreRadius'),
    coreGlow: normalizedField(params.coreGlow, 0.4, 'coreGlow'),
    rimWidth: normalizedField(params.rimWidth, 0.45, 'rimWidth'),
    outlineWeight: normalizedField(params.outlineWeight, 1.3, 'outlineWeight'),
    symmetry: normalizedField(params.symmetry, 8, 'symmetry'),
    mandalaDepth: normalizedField(params.mandalaDepth, 0.5, 'mandalaDepth'),
    ringBands: normalizedField(params.ringBands, 2, 'ringBands'),
    radialTwist: normalizedField(params.radialTwist, 0.2, 'radialTwist'),
    innerVoid: normalizedField(params.innerVoid, 0.2, 'innerVoid'),
    fractalIntensity: normalizedField(params.fractalIntensity, 0.4, 'fractalIntensity'),
    sectorWarp: normalizedField(params.sectorWarp, 0.2, 'sectorWarp'),
    ringContrast: normalizedField(params.ringContrast, 0.4, 'ringContrast'),
    depthEcho: normalizedField(params.depthEcho, 0.3, 'depthEcho'),
  };

  safe.m = clamp(Math.round(safe.m), CONFIG.FLOWER_RANGES.m.min, CONFIG.FLOWER_RANGES.m.max);
  safe.symmetry = clamp(Math.round(safe.symmetry), CONFIG.FLOWER_RANGES.symmetry.min, CONFIG.FLOWER_RANGES.symmetry.max);
  safe.ringBands = clamp(Math.round(safe.ringBands), CONFIG.FLOWER_RANGES.ringBands.min, CONFIG.FLOWER_RANGES.ringBands.max);

  return safe;
}

function buildRing(params: ReturnType<typeof normalizeFlowerParams>, scale: number, layerSeed: number) {
  const segmentRange = CONFIG.FLOWER_SHAPE.segments;
  const segmentT = clamp01((params.m - CONFIG.FLOWER_RANGES.m.min) / (CONFIG.FLOWER_RANGES.m.max - CONFIG.FLOWER_RANGES.m.min));
  const shapeT = clamp01((params.petalCount - CONFIG.FLOWER_RANGES.petalCount.min) / (CONFIG.FLOWER_RANGES.petalCount.max - CONFIG.FLOWER_RANGES.petalCount.min));
  const symmetryT = clamp01((params.symmetry - CONFIG.FLOWER_RANGES.symmetry.min) / (CONFIG.FLOWER_RANGES.symmetry.max - CONFIG.FLOWER_RANGES.symmetry.min));
  const bandsT = clamp01((params.ringBands - CONFIG.FLOWER_RANGES.ringBands.min) / (CONFIG.FLOWER_RANGES.ringBands.max - CONFIG.FLOWER_RANGES.ringBands.min));
  const sampleCount = Math.round(
    lerp(segmentRange.min, segmentRange.max, (segmentT + shapeT + symmetryT + bandsT) / 4)
  );
  const points: Vector2[] = [];
  const sectors = Math.max(1, Math.round(params.symmetry));
  const sectorAngle = TAU / sectors;
  const mandalaDepth = params.mandalaDepth;
  const bandBlend = 1 + params.ringBands * 0.17;
  const twist = params.radialTwist * Math.PI * 2;
  const fractal = params.fractalIntensity;
  const innerVoid = params.innerVoid;
  const sectorWarp = params.sectorWarp;
  const ringContrast = params.ringContrast;
  const depthEcho = params.depthEcho;

  for (let i = 0; i <= sampleCount; i += 1) {
    const t = i / sampleCount;
    const phi = t * TAU;
    const angle = phi + params.rot;
    const core = superR(angle, params.m, params.n1, params.n2, params.n3);

    const snappedSector = Math.round(angle / sectorAngle) * sectorAngle;
    const foldedAngle = angle * (1 - mandalaDepth) + snappedSector * mandalaDepth;
    const sectorLocal = (angle / sectorAngle) % 1;
    const sectorPeak = 1 - Math.abs(1 - 2 * sectorLocal);
    const sectorPulse = Math.cos((sectorLocal - 0.5) * Math.PI);
    const warp = 1 + sectorWarp * 0.2 * (0.35 + 0.65 * sectorPeak) * sectorPulse;

    const petal = Math.sin(phi * params.petalCount * params.petalSpread * 0.55 + foldedAngle + layerSeed * 1.13);
    const crest = Math.cos(phi * (params.m / 2 + params.petalCount * 0.13) + foldedAngle * 2);
    const spiral = Math.cos((sectors * 0.6 + bandBlend) * foldedAngle + twist + layerSeed * 1.05);
    const bandWobble = Math.cos((params.ringBands * 1.7 + 1.3) * foldedAngle + twist * 1.05 + layerSeed);
    const ringPulse = Math.sin((params.petalCount * 0.22 + sectors * 0.32) * foldedAngle + twist + layerSeed);
    const star = Math.cos(foldedAngle * (sectors * bandBlend));

    const mandalaGate = 1 + 0.35 * mandalaDepth * (0.35 + 0.65 * (1 - Math.abs(star)));
    const ringCut = (0.5 + 0.5 * Math.sin(foldedAngle * (sectors + 1) + layerSeed * 1.5));
    const innerCut = 1 - innerVoid * (0.25 + 0.55 * (0.2 + 0.8 * ringCut) * (0.85 + 0.15 * depthEcho));
    const contrast = 1 + 0.32 * ringContrast * (0.5 + 0.5 * Math.cos(foldedAngle * (sectors + 2.8 + ringContrast * 2) + layerSeed));
    const depthRipple = 1 + depthEcho * 0.14 * (0.25 + 0.75 * Math.sin(foldedAngle * (params.m + params.petalCount * 0.25) + twist + layerSeed * 0.8 + bandWobble * 0.25));
    const fractalWave = fractal * (0.5 + 0.5 * Math.cos(foldedAngle * (sectors + 2.3) + params.rot + layerSeed * 1.7 + spiral * 0.2));

    const wave = 1
      + 0.20 * params.petalStretch * petal
      + 0.09 * params.petalCrest * crest
      + 0.16 * mandalaDepth * (0.5 + 0.5 * spiral)
      + 0.10 * params.ringBands * (0.4 + 0.6 * ringPulse)
      + 0.06 * fractalWave
      + 0.06 * ringContrast * bandWobble;
    const radius = Math.max(0.0001, core * wave * scale);
    const shapedRadius = Math.max(0.0001, radius * mandalaGate * innerCut * warp * contrast * depthRipple * warp);
    const x2 = shapedRadius * Math.cos(angle);
    const y2 = shapedRadius * Math.sin(angle);
    points.push(new Vector2(x2, y2));
  }

  return points;
}

export function buildFlowerProfile(params: FlowerRenderParams, color: string): FlowerProfile {
  const normalized = normalizeFlowerParams(params);
  const cacheKey = `${color}|${JSON.stringify(normalized)}`;
  const cachedProfile = PROFILE_CACHE.get(cacheKey);
  if (cachedProfile) {
    return cachedProfile;
  }

  const outerPoints = buildRing(normalized, 1, 0.11);
  const innerScale = Math.max(
    CONFIG.FLOWER_SHAPE.innerScale.min,
    Math.min(
      CONFIG.FLOWER_SHAPE.innerScale.max,
      normalized.coreRadius + 0.22 - normalized.innerVoid * 0.28
    )
  );
  const innerPoints = buildRing(normalized, innerScale, 0.54);

  const outerShape = makeShapeFromPoints(outerPoints);
  const innerShape = makeShapeFromPoints(innerPoints);

  const palette: FlowerPalette = {
    outer: hashColor(color, -0.03, 0.95, 1.15),
    outerGlow: hashColor(color, 0.0, 1.05, 1.3),
    inner: hashColor(color, 0.08, 0.9, 0.82),
    innerGlow: hashColor(color, 0.18, 1.1, 1.05),
    core: hashColor(color, -0.12, 1.05, 0.92),
    coreGlow: hashColor(color, -0.06, 1.4, 1.35),
    edge: hashColor(color, -0.03, 1.2, 1.05),
    line: hashColor(color, 0.0, 1.15, 0.95),
  };

  const core = clamp(
    normalized.coreRadius * CONFIG.FLOWER_SHAPE.coreBaseScale * (1 - normalized.innerVoid * 0.45),
    0.08,
    1
  );
  const halo = clamp(core * CONFIG.FLOWER_SHAPE.glowSpread * (0.55 + normalized.coreGlow * 0.9), 0.08, 2.8);
  const strokeWeight = clamp(normalized.outlineWeight * CONFIG.FLOWER_SHAPE.lineSmoothingScale, 0.7, 4.0);

  const profile: FlowerProfile = {
    outerPoints,
    innerPoints,
    outerShape,
    innerShape,
    outerLine: toLineBuffer(outerPoints),
    innerLine: toLineBuffer(innerPoints),
    coreRadius: core,
    haloRadius: halo,
    palette,
    strokeWeight,
  };

  if (PROFILE_CACHE.size >= PROFILE_CACHE_MAX) {
    const oldestKey = PROFILE_CACHE.keys().next().value;
    if (oldestKey) {
      PROFILE_CACHE.delete(oldestKey);
    }
  }
  PROFILE_CACHE.set(cacheKey, profile);

  return profile;
}
