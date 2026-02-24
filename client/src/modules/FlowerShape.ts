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
    outlineWeight: normalizedField(params.outlineWeight, 1.3, 'outlineWeight')
  };

  safe.m = clamp(Math.round(safe.m), CONFIG.FLOWER_RANGES.m.min, CONFIG.FLOWER_RANGES.m.max);

  return safe;
}

function buildRing(params: ReturnType<typeof normalizeFlowerParams>, scale: number, layerSeed: number) {
  const segmentRange = CONFIG.FLOWER_SHAPE.segments;
  const segmentT = clamp01((params.m - CONFIG.FLOWER_RANGES.m.min) / (CONFIG.FLOWER_RANGES.m.max - CONFIG.FLOWER_RANGES.m.min));
  const shapeT = clamp01((params.petalCount - CONFIG.FLOWER_RANGES.petalCount.min) / (CONFIG.FLOWER_RANGES.petalCount.max - CONFIG.FLOWER_RANGES.petalCount.min));
  const sampleCount = Math.round(lerp(segmentRange.min, segmentRange.max, (segmentT + shapeT) / 2));
  const points: Vector2[] = [];

  for (let i = 0; i <= sampleCount; i += 1) {
    const t = i / sampleCount;
    const phi = t * TAU;
    const angle = phi + params.rot;
    const core = superR(angle, params.m, params.n1, params.n2, params.n3);
    const petal = Math.sin(phi * params.petalCount * params.petalSpread * 0.55 + params.rot + layerSeed * 1.13);
    const crest = Math.cos(phi * (params.m / 2 + params.petalCount * 0.13) + params.rot * 2);
    const wave = 1 + 0.22 * params.petalStretch * petal + 0.09 * params.petalCrest * crest;
    const radius = Math.max(0.0001, core * wave * scale);

    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);
    points.push(new Vector2(x, y));
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
      normalized.coreRadius + 0.22
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
    normalized.coreRadius * CONFIG.FLOWER_SHAPE.coreBaseScale,
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
