import { CONFIG } from '../config';
import type { FlowerRenderParams } from '../types';

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function toSeed(key: keyof FlowerRenderParams, x: number, y: number, z: number) {
  const seed = CONFIG.SEEDS[key as keyof typeof CONFIG.SEEDS];
  const signal = Math.sin(seed.freq[0] * x + seed.phase[0]) +
    Math.sin(seed.freq[1] * y + seed.phase[1]) +
    Math.sin(seed.freq[2] * z + seed.phase[2]);
  return clamp01((signal + 3) / 6);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export type ColorTuningSettings = {
  luminanceMin: number;
  luminanceMax: number;
  saturationMin: number;
  saturationMax: number;
  smoothingRadius: number;
  paletteSharpness: number;
  huePhaseAmplitude: number;
  lightnessSwing: number;
  chromaJitter: number;
};

export type ColorAnchor = {
  id: string;
  label: string;
  x: number;
  y: number;
  z: number;
  r: number;
  g: number;
  b: number;
  bias: number;
};

export type ColorMappingPreset = {
  version: 1;
  name: string;
  updatedAt: string;
  tuning: ColorTuningSettings;
  anchors: ColorAnchor[];
};

const LEGACY_SKY_ANCHOR_ID = 'sky';
const BLUE_ANCHOR_ID = 'blue';
const BLUE_ANCHOR_LABEL = 'Blue';

export const DEFAULT_COLOR_TUNING_SETTINGS: ColorTuningSettings = {
  luminanceMin: 0.16,
  luminanceMax: 0.84,
  saturationMin: 44,
  saturationMax: 92,
  smoothingRadius: 0.008,
  paletteSharpness: 2.85,
  huePhaseAmplitude: 0.04,
  lightnessSwing: 12,
  chromaJitter: 6,
};

export const DEFAULT_COLOR_ANCHORS: ColorAnchor[] = [
  { id: 'red', label: 'Red', x: 1.0, y: 0.0, z: 0.1, r: 237, g: 46, b: 48, bias: 1.12 },
  { id: 'yellow', label: 'Yellow', x: 0.31, y: 0.95, z: 0.02, r: 250, g: 207, b: 51, bias: 1.1 },
  { id: 'green', label: 'Green', x: -0.22, y: 0.97, z: -0.06, r: 41, g: 199, b: 71, bias: 1.08 },
  { id: BLUE_ANCHOR_ID, label: BLUE_ANCHOR_LABEL, x: -0.95, y: -0.2, z: 0.13, r: 56, g: 128, b: 245, bias: 1.05 },
  { id: 'purple', label: 'Purple', x: -0.78, y: -0.62, z: -0.06, r: 143, g: 77, b: 214, bias: 1.06 },
];

export const DEFAULT_COLOR_MAPPING_PRESET: ColorMappingPreset = {
  version: 1,
  name: 'default-space-palette',
  updatedAt: '',
  tuning: { ...DEFAULT_COLOR_TUNING_SETTINGS },
  anchors: DEFAULT_COLOR_ANCHORS.map((anchor) => ({ ...anchor })),
};

const COLOR_SPACE_SMOOTHING = {
  centerWeight: 0.44,
  axisWeight: 0.0933333333,
};

type LabVector = { L: number; a: number; b: number };
type PaletteAnchorRuntime = {
  color: LabVector;
  position: [number, number, number];
  bias: number;
};

let activeColorMappingPreset: ColorMappingPreset = {
  ...DEFAULT_COLOR_MAPPING_PRESET,
  tuning: { ...DEFAULT_COLOR_MAPPING_PRESET.tuning },
  anchors: DEFAULT_COLOR_MAPPING_PRESET.anchors.map((anchor) => ({ ...anchor })),
};

function wrap01(value: number) {
  return (value % 1 + 1) % 1;
}

function roundChannel(value: number) {
  return Math.round(clamp(value, 0, 255));
}

export function normalizeColorTuningSettings(settings: Partial<ColorTuningSettings>) {
  const merged = { ...DEFAULT_COLOR_TUNING_SETTINGS, ...settings };
  const luminanceA = clamp(merged.luminanceMin, 0.02, 0.96);
  const luminanceB = clamp(merged.luminanceMax, 0.04, 0.98);
  const saturationA = clamp(merged.saturationMin, 0, 100);
  const saturationB = clamp(merged.saturationMax, 0, 100);

  return {
    luminanceMin: Math.min(luminanceA, luminanceB),
    luminanceMax: Math.max(luminanceA, luminanceB),
    saturationMin: Math.min(saturationA, saturationB),
    saturationMax: Math.max(saturationA, saturationB),
    smoothingRadius: clamp(merged.smoothingRadius, 0.0005, 0.08),
    paletteSharpness: clamp(merged.paletteSharpness, 0.8, 6),
    huePhaseAmplitude: clamp(merged.huePhaseAmplitude, 0, 0.2),
    lightnessSwing: clamp(merged.lightnessSwing, 0, 28),
    chromaJitter: clamp(merged.chromaJitter, 0, 18),
  };
}

function normalizeColorAnchor(anchor: Partial<ColorAnchor>, fallback: ColorAnchor): ColorAnchor {
  const rawId = typeof anchor.id === 'string' && anchor.id.trim() ? anchor.id.trim() : fallback.id;
  const rawLabel = typeof anchor.label === 'string' && anchor.label.trim() ? anchor.label.trim() : fallback.label;
  const useBlueAlias = rawId === LEGACY_SKY_ANCHOR_ID || rawLabel.toLowerCase() === LEGACY_SKY_ANCHOR_ID;

  return {
    id: useBlueAlias ? BLUE_ANCHOR_ID : rawId,
    label: useBlueAlias ? BLUE_ANCHOR_LABEL : rawLabel,
    x: clamp(Number.isFinite(anchor.x) ? Number(anchor.x) : fallback.x, -1.4, 1.4),
    y: clamp(Number.isFinite(anchor.y) ? Number(anchor.y) : fallback.y, -1.4, 1.4),
    z: clamp(Number.isFinite(anchor.z) ? Number(anchor.z) : fallback.z, -1.4, 1.4),
    r: roundChannel(Number.isFinite(anchor.r) ? Number(anchor.r) : fallback.r),
    g: roundChannel(Number.isFinite(anchor.g) ? Number(anchor.g) : fallback.g),
    b: roundChannel(Number.isFinite(anchor.b) ? Number(anchor.b) : fallback.b),
    bias: clamp(Number.isFinite(anchor.bias) ? Number(anchor.bias) : fallback.bias, 0.1, 4),
  };
}

export function normalizeColorMappingPreset(input?: Partial<ColorMappingPreset> | ColorMappingPreset | null) {
  const rawAnchors = Array.isArray(input?.anchors) && input.anchors.length > 0
    ? input.anchors
    : DEFAULT_COLOR_ANCHORS;

  return {
    version: 1 as const,
    name: typeof input?.name === 'string' && input.name.trim() ? input.name.trim() : DEFAULT_COLOR_MAPPING_PRESET.name,
    updatedAt: typeof input?.updatedAt === 'string' ? input.updatedAt : '',
    tuning: normalizeColorTuningSettings(input?.tuning ?? {}),
    anchors: rawAnchors.map((anchor, index) => normalizeColorAnchor(anchor, DEFAULT_COLOR_ANCHORS[index % DEFAULT_COLOR_ANCHORS.length])),
  };
}

export function cloneColorMappingPreset(preset: ColorMappingPreset) {
  return normalizeColorMappingPreset(preset);
}

export function getActiveColorMappingPreset() {
  return activeColorMappingPreset;
}

export function setActiveColorMappingPreset(input: Partial<ColorMappingPreset> | ColorMappingPreset) {
  activeColorMappingPreset = normalizeColorMappingPreset(input);
  return activeColorMappingPreset;
}

function smoothSeed(
  key: keyof FlowerRenderParams,
  x: number,
  y: number,
  z: number,
  settings: ColorTuningSettings,
) {
  const radius = settings.smoothingRadius;
  const center = toSeed(key, x, y, z) * COLOR_SPACE_SMOOTHING.centerWeight;
  const axisOffset = COLOR_SPACE_SMOOTHING.axisWeight;

  return center +
    axisOffset * toSeed(key, x + radius, y, z) +
    axisOffset * toSeed(key, x - radius, y, z) +
    axisOffset * toSeed(key, x, y + radius, z) +
    axisOffset * toSeed(key, x, y - radius, z) +
    axisOffset * toSeed(key, x, y, z + radius) +
    axisOffset * toSeed(key, x, y, z - radius);
}

function srgbToLinear(value: number) {
  const clamped = clamp(value, 0, 1);
  return clamped <= 0.04045 ? clamped / 12.92 : ((clamped + 0.055) / 1.055) ** 2.4;
}

function rgbToLab(red: number, green: number, blue: number) {
  const r = srgbToLinear(red);
  const g = srgbToLinear(green);
  const b = srgbToLinear(blue);

  const x = 0.4124 * r + 0.3576 * g + 0.1805 * b;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = 0.0193 * r + 0.1192 * g + 0.9505 * b;

  const Xn = 0.95047;
  const Yn = 1.0;
  const Zn = 1.08883;

  const xr = x / Xn;
  const yr = y / Yn;
  const zr = z / Zn;

  const delta = 216 / 24389;
  const f = (t: number) => (t > delta ? Math.cbrt(t) : (7.787 * t + 16 / 116));

  const fx = f(xr);
  const fy = f(yr);
  const fz = f(zr);

  return {
    L: clamp(116 * fy - 16, 0, 100),
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

function labToLinearRgb(color: LabVector) {
  const fy = (color.L + 16) / 116;
  const fx = fy + color.a / 500;
  const fz = fy - color.b / 200;

  const invf = (value: number) => {
    const t = Math.max(0, value);
    const t3 = t ** 3;
    return t3 > 0.008856 ? t3 : (116 * t - 16) / 903.3;
  };

  const xr = invf(fx);
  const yr = invf(fy);
  const zr = invf(fz);

  const Xn = 0.95047;
  const Zn = 1.08883;

  const x = xr * Xn;
  const y = yr * 1.0;
  const z = zr * Zn;

  const r = x * 3.2406 + y * (-1.5372) + z * (-0.4986);
  const g = x * (-0.9689) + y * 1.8758 + z * 0.0415;
  const b = x * 0.0557 + y * (-0.204) + z * 1.057;

  return {
    r: clamp01(r),
    g: clamp01(g),
    b: clamp01(b),
  };
}

function hslToRgbLinear(hue: number, saturation: number, lightness: number) {
  const h = hue / 360;
  const s = clamp01(saturation);
  const l = clamp01(lightness);

  const hueToChannel = (t: number) => {
    const tMod = (t % 1 + 1) % 1;
    if (2 * tMod < 1) return l + (s * (1 - Math.abs(2 * l - 1)) * (tMod - 1 / 6) * 6);
    if (tMod < 0.5) return l - (s * (1 - Math.abs(2 * l - 1)) / 2);
    if (3 * tMod < 2) return l + (s * (1 - Math.abs(2 * l - 1)) * (2 / 3 - tMod) * 6);
    return l - (s * (1 - Math.abs(2 * l - 1)) / 2);
  };

  return {
    r: hueToChannel(h + 1 / 3),
    g: hueToChannel(h),
    b: hueToChannel(h - 1 / 3),
  };
}

function rgbToHslLinear(rgb: { r: number; g: number; b: number }) {
  const r = clamp01(rgb.r);
  const g = clamp01(rgb.g);
  const b = clamp01(rgb.b);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const l = (max + min) / 2;

  let h = 0;
  let s = 0;

  if (delta > 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    if (max === r) h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / delta + 2) / 6;
    else h = ((r - g) / delta + 4) / 6;
  }

  return { h: wrap01(h), s: clamp01(s), l: clamp01(l) };
}

function linearLuminance(rgb: { r: number; g: number; b: number }) {
  return 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
}

function hexFromLinearRgb(rgb: { r: number; g: number; b: number }) {
  const toHex = (value: number) => {
    const n = Math.round(clamp01(value) * 255)
      .toString(16)
      .padStart(2, '0');
    return n;
  };
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

function matchLuminance(hue: number, saturation: number, target: number) {
  let low = 0;
  let high = 1;

  for (let i = 0; i < 16; i += 1) {
    const mid = (low + high) / 2;
    const midRgb = hslToRgbLinear(hue, saturation, mid);
    const midY = linearLuminance(midRgb);

    if (midY < target) {
      low = mid;
    } else {
      high = mid;
    }
  }

  const finalY = hslToRgbLinear(hue, saturation, (low + high) / 2);
  return hexFromLinearRgb(finalY);
}

function resolveAnchorPosition(anchor: ColorAnchor, fallback: ColorAnchor): [number, number, number] {
  const x = Number.isFinite(anchor.x) ? anchor.x : fallback.x;
  const y = Number.isFinite(anchor.y) ? anchor.y : fallback.y;
  const z = Number.isFinite(anchor.z) ? anchor.z : fallback.z;
  return [
    clamp(x, -1.4, 1.4),
    clamp(y, -1.4, 1.4),
    clamp(z, -1.4, 1.4),
  ];
}

function resolvePaletteAnchors(preset: ColorMappingPreset): PaletteAnchorRuntime[] {
  return preset.anchors.map((anchor, index) => {
    const fallback = DEFAULT_COLOR_ANCHORS[index % DEFAULT_COLOR_ANCHORS.length];
    return {
      color: rgbToLab(anchor.r / 255, anchor.g / 255, anchor.b / 255),
      position: resolveAnchorPosition(anchor, fallback),
      bias: clamp(anchor.bias, 0.1, 4),
    };
  });
}

function blendPerceptualPalette(
  x: number,
  y: number,
  z: number,
  driftSeedA: number,
  driftSeedB: number,
  driftSeedC: number,
  settings: ColorTuningSettings,
  anchors: PaletteAnchorRuntime[],
) {
  const px = clamp(x + (driftSeedA - 0.5) * 0.18, -1.4, 1.4);
  const py = clamp(y + (driftSeedB - 0.5) * 0.18, -1.4, 1.4);
  const pz = clamp(z + (driftSeedC - 0.5) * 0.14, -1.4, 1.4);

  const weights = anchors.map((anchor) => {
    const dx = px - anchor.position[0];
    const dy = py - anchor.position[1];
    const dz = pz - anchor.position[2];
    const distSq = dx * dx + dy * dy + dz * dz;
    return anchor.bias * Math.exp(-settings.paletteSharpness * distSq * 2.4);
  });

  const total = weights.reduce((acc, weight) => acc + weight, 0);
  const out: LabVector = { L: 0, a: 0, b: 0 };

  if (total <= 0 || anchors.length === 0) {
    return rgbToLab(1, 1, 1);
  }

  for (let index = 0; index < weights.length; index += 1) {
    const weight = weights[index] / total;
    out.L += anchors[index].color.L * weight;
    out.a += anchors[index].color.a * weight;
    out.b += anchors[index].color.b * weight;
  }

  return out;
}

export class SemanticMapper {
  static mapCoordinatesToParams(x: number, y: number, z: number) {
    const L = CONFIG.CUBE_SIZE;
    const normalizedX = x / L;
    const normalizedY = y / L;
    const normalizedZ = z / L;

    const params: FlowerRenderParams = {} as FlowerRenderParams;
    const baseKeys = ['m', 'n1', 'n2', 'n3', 'rot'] as Array<keyof FlowerRenderParams>;

    for (const key of baseKeys) {
      const seed = CONFIG.SEEDS[key as keyof typeof CONFIG.SEEDS];
      const range = CONFIG.FLOWER_RANGES[key as keyof typeof CONFIG.FLOWER_RANGES];

      const rawVal = Math.sin(seed.freq[0] * normalizedX + seed.phase[0]) +
                     Math.sin(seed.freq[1] * normalizedY + seed.phase[1]) +
                     Math.sin(seed.freq[2] * normalizedZ + seed.phase[2]);

      const t = (rawVal + 3) / 6;
      params[key] = range.min + t * (range.max - range.min);
    }

    params.m = Math.max(1, Math.round(params.m));

    params.petalCount = 4 + Math.round(toSeed('petalCount', normalizedX, normalizedY, normalizedZ) * 9);
    params.petalStretch = 0.48 + toSeed('petalStretch', normalizedY, normalizedZ, normalizedX) * 1.04;
    params.petalCrest = 0.46 + toSeed('petalCrest', normalizedZ, normalizedX, normalizedY) * 1.22;
    params.petalSpread = 0.87 + toSeed('petalSpread', normalizedX, normalizedZ, normalizedY) * 0.44;
    params.coreRadius = 0.1 + toSeed('coreRadius', normalizedY, normalizedX, normalizedZ) * 0.42;
    params.coreGlow = 0.12 + toSeed('coreGlow', normalizedZ, normalizedY, normalizedX) * 0.85;
    params.rimWidth = 0.25 + toSeed('rimWidth', normalizedX, normalizedY, normalizedZ) * 0.65;
    params.outlineWeight = 0.9 + toSeed('outlineWeight', normalizedY, normalizedZ, normalizedX) * 1.4;
    params.symmetry = 3 + Math.round(toSeed('symmetry', normalizedZ, normalizedX, normalizedY) * 17);
    params.mandalaDepth = 0.22 + toSeed('mandalaDepth', normalizedY, normalizedZ, normalizedX) * 0.76;
    params.ringBands = 1 + Math.round(toSeed('ringBands', normalizedX, normalizedY, normalizedZ) * 7);
    params.radialTwist = toSeed('radialTwist', normalizedZ, normalizedX, normalizedY) * 1.8;
    params.innerVoid = toSeed('innerVoid', normalizedY, normalizedX, normalizedZ) * 0.72;
    params.fractalIntensity = toSeed('fractalIntensity', normalizedX, normalizedZ, normalizedY) * 2.2;
    params.sectorWarp = toSeed('sectorWarp', normalizedZ, normalizedY, normalizedX) * 1.22;
    params.ringContrast = toSeed('ringContrast', normalizedY, normalizedZ, normalizedX);
    params.depthEcho = 0.02 + toSeed('depthEcho', normalizedX, normalizedY, normalizedZ) * 0.98;

    return params;
  }

  static mapCoordinatesToColor(
    x: number,
    y: number,
    z: number,
    preset: ColorMappingPreset = activeColorMappingPreset,
  ) {
    const resolvedPreset = preset ?? activeColorMappingPreset;
    const settings = resolvedPreset.tuning;
    const anchors = resolvePaletteAnchors(resolvedPreset);
    const L = CONFIG.CUBE_SIZE;
    const normalizedX = clamp01((x / L + 1) / 2);
    const normalizedY = clamp01((y / L + 1) / 2);
    const normalizedZ = clamp01((z / L + 1) / 2);

    const posPhase = (normalizedX + normalizedY * 0.61 + normalizedZ * 0.29) / 2.9;
    const centeredX = normalizedX * 2 - 1;
    const centeredY = normalizedY * 2 - 1;
    const centeredZ = normalizedZ * 2 - 1;

    const hueSeedA = smoothSeed('m', normalizedX, normalizedY, normalizedZ, settings);
    const hueSeedB = smoothSeed('radialTwist', normalizedY, normalizedZ, normalizedX, settings);
    const satSeed = smoothSeed('petalCrest', normalizedZ, normalizedX, normalizedY, settings);
    const lumSeed = smoothSeed('coreGlow', normalizedX, normalizedY, normalizedZ, settings);
    const glowSeed = smoothSeed('fractalIntensity', normalizedY, normalizedX, normalizedZ, settings);
    const ringContrastSeed = smoothSeed('ringContrast', normalizedY, normalizedZ, normalizedX, settings);
    const depthEchoSeed = smoothSeed('depthEcho', normalizedX, normalizedY, normalizedZ, settings);
    const symmetrySeed = smoothSeed('symmetry', normalizedY, normalizedX, normalizedZ, settings);
    const ringBandsSeed = smoothSeed('ringBands', normalizedZ, normalizedY, normalizedX, settings);
    const petalCountSeed = smoothSeed('petalCount', normalizedZ, normalizedX, normalizedY, settings);
    const radialTwistSeed = smoothSeed('radialTwist', normalizedX, normalizedZ, normalizedY, settings);
    const spreadSeed = smoothSeed('petalSpread', normalizedX, normalizedZ, normalizedY, settings);

    const visibilityGate = clamp01(
      0.34 * satSeed + 0.22 * glowSeed + 0.16 * lumSeed + 0.14 * ringContrastSeed + 0.14 * depthEchoSeed
    );

    const hueWave =
      0.22 * hueSeedA +
      0.16 * hueSeedB +
      0.14 * lumSeed +
      0.10 * glowSeed +
      0.09 * ringContrastSeed +
      0.08 * depthEchoSeed +
      0.08 * spreadSeed +
      0.06 * symmetrySeed +
      0.06 * ringBandsSeed +
      0.04 * petalCountSeed +
      0.04 * radialTwistSeed;

    const huePhase = Math.sin(hueSeedA * Math.PI * 2 + 0.24 * hueWave * Math.PI * 2) * settings.huePhaseAmplitude
      + Math.cos(posPhase * Math.PI * 2 + hueSeedB * Math.PI * 2) * settings.huePhaseAmplitude;

    const proceduralHue = wrap01(hueWave + huePhase);
    const blendLab = blendPerceptualPalette(
      centeredX,
      centeredY,
      centeredZ,
      hueSeedA,
      glowSeed,
      lumSeed,
      settings,
      anchors,
    );

    const localAngle = proceduralHue * Math.PI * 2 + hueSeedB * Math.PI * 2;
    const localGain = 0.6 + 0.4 * visibilityGate;
    const lab = {
      L: clamp(blendLab.L + (proportionalBlend(visibilityGate) - 0.5) * settings.lightnessSwing, 20, 88),
      a: blendLab.a + Math.cos(localAngle) * settings.chromaJitter * localGain,
      b: blendLab.b + Math.sin(localAngle) * settings.chromaJitter * localGain,
    };

    const linearColor = labToLinearRgb(lab);
    const perceptualHsl = rgbToHslLinear(linearColor);
    const saturation = clamp01(
      0.45 * (lerp(settings.saturationMin, settings.saturationMax, visibilityGate) / 100) +
      0.55 * perceptualHsl.s
    );

    const targetLuminance = lerp(settings.luminanceMin, settings.luminanceMax, visibilityGate);
    return matchLuminance(
      clamp01(perceptualHsl.h + huePhase * 0.5) * 360,
      saturation,
      targetLuminance,
    );
  }
}

function proportionalBlend(value: number) {
  return 0.5 + value * 0.25 + (value - 0.5) * (value - 0.5) * 0.15;
}
