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

const COLOR_LUMINANCE = {
  min: 0.16,
  max: 0.84,
};

const COLOR_SATURATION = {
  min: 44,
  max: 92,
};

const COLOR_SPACE_SMOOTHING = {
  radius: 0.008,
  centerWeight: 0.44,
  axisWeight: 0.0933333333,
};

type LabVector = { L: number; a: number; b: number };
type PaletteAnchor = { color: LabVector; dir: [number, number, number]; bias: number; };

function wrap01(value: number) {
  return (value % 1 + 1) % 1;
}

function smoothSeed(
  key: keyof FlowerRenderParams,
  x: number,
  y: number,
  z: number,
  radius = COLOR_SPACE_SMOOTHING.radius,
) {
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

  let r = x * 3.2406 + y * (-1.5372) + z * (-0.4986);
  let g = x * (-0.9689) + y * 1.8758 + z * 0.0415;
  let b = x * 0.0557 + y * (-0.204) + z * 1.057;

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

const COLOR_PERCEPTUAL_ANCHORS: PaletteAnchor[] = [
  { color: rgbToLab(0.93, 0.18, 0.19), dir: [1.0, 0.0, 0.1], bias: 1.12 },   // red
  { color: rgbToLab(0.98, 0.81, 0.20), dir: [0.31, 0.95, 0.02], bias: 1.1 },  // yellow
  { color: rgbToLab(0.16, 0.78, 0.28), dir: [-0.22, 0.97, -0.06], bias: 1.08 }, // green
  { color: rgbToLab(0.25, 0.74, 0.95), dir: [-0.95, -0.2, 0.13], bias: 1.05 },  // sky
  { color: rgbToLab(0.56, 0.30, 0.84), dir: [-0.78, -0.62, -0.06], bias: 1.06 }, // purple
];

function blendPerceptualPalette(
  x: number,
  y: number,
  z: number,
  driftSeedA: number,
  driftSeedB: number,
  driftSeedC: number,
) {
  const px = (x * 2.6) + (driftSeedA - 0.5) * 0.4;
  const py = (y * 2.4) + (driftSeedB - 0.5) * 0.4;
  const pz = (z * 1.2) + (driftSeedC - 0.5) * 0.3;
  const len = Math.hypot(px, py, pz) || 1;
  const ux = px / len;
  const uy = py / len;
  const uz = pz / len;

  const sharpness = 2.85;
  const weights = COLOR_PERCEPTUAL_ANCHORS.map((anchor) => {
    const dir = anchor.dir;
    const dot = ux * dir[0] + uy * dir[1] + uz * dir[2];
    return anchor.bias * Math.exp(sharpness * dot);
  });

  const total = weights.reduce((acc, w) => acc + w, 0);
  const out: LabVector = { L: 0, a: 0, b: 0 };

  if (total <= 0) {
    return COLOR_PERCEPTUAL_ANCHORS[0].color;
  }

  for (let i = 0; i < weights.length; i += 1) {
    const w = weights[i] / total;
    out.L += COLOR_PERCEPTUAL_ANCHORS[i].color.L * w;
    out.a += COLOR_PERCEPTUAL_ANCHORS[i].color.a * w;
    out.b += COLOR_PERCEPTUAL_ANCHORS[i].color.b * w;
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

  static mapCoordinatesToColor(x: number, y: number, z: number) {
    const L = CONFIG.CUBE_SIZE;
    const normalizedX = clamp01((x / L + 1) / 2);
    const normalizedY = clamp01((y / L + 1) / 2);
    const normalizedZ = clamp01((z / L + 1) / 2);

    const posPhase = (normalizedX + normalizedY * 0.61 + normalizedZ * 0.29) / 2.9;
    const centeredX = normalizedX - 0.5;
    const centeredY = normalizedY - 0.5;
    const centeredZ = normalizedZ - 0.5;

    const hueSeedA = smoothSeed('m', normalizedX, normalizedY, normalizedZ);
    const hueSeedB = smoothSeed('radialTwist', normalizedY, normalizedZ, normalizedX);
    const satSeed = smoothSeed('petalCrest', normalizedZ, normalizedX, normalizedY);
    const lumSeed = smoothSeed('coreGlow', normalizedX, normalizedY, normalizedZ);
    const glowSeed = smoothSeed('fractalIntensity', normalizedY, normalizedX, normalizedZ);
    const ringContrastSeed = smoothSeed('ringContrast', normalizedY, normalizedZ, normalizedX);
    const depthEchoSeed = smoothSeed('depthEcho', normalizedX, normalizedY, normalizedZ);
    const symmetrySeed = smoothSeed('symmetry', normalizedY, normalizedX, normalizedZ);
    const ringBandsSeed = smoothSeed('ringBands', normalizedZ, normalizedY, normalizedX);
    const petalCountSeed = smoothSeed('petalCount', normalizedZ, normalizedX, normalizedY);
    const radialTwistSeed = smoothSeed('radialTwist', normalizedX, normalizedZ, normalizedY);
    const spreadSeed = smoothSeed('petalSpread', normalizedX, normalizedZ, normalizedY);

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

    const huePhase = Math.sin(hueSeedA * Math.PI * 2 + 0.24 * hueWave * Math.PI * 2) * 0.04
      + Math.cos(posPhase * Math.PI * 2 + hueSeedB * Math.PI * 2) * 0.04;

    const proceduralHue = wrap01(hueWave + huePhase);
    const blendLab = blendPerceptualPalette(
      centeredX,
      centeredY,
      centeredZ,
      hueSeedA,
      glowSeed,
      lumSeed,
    );

    const localAngle = proceduralHue * Math.PI * 2 + hueSeedB * Math.PI * 2;
    const localGain = 0.6 + 0.4 * visibilityGate;
    const lab = {
      L: clamp(blendLab.L + (proportionalBlend(visibilityGate) - 0.5) * 12, 20, 88),
      a: blendLab.a + Math.cos(localAngle) * 6 * localGain,
      b: blendLab.b + Math.sin(localAngle) * 6 * localGain,
    };

    const linearColor = labToLinearRgb(lab);
    const perceptualHsl = rgbToHslLinear(linearColor);
    const saturation = clamp01(
      0.45 * (lerp(COLOR_SATURATION.min, COLOR_SATURATION.max, visibilityGate) / 100) +
      0.55 * perceptualHsl.s
    );

    const targetLuminance = lerp(COLOR_LUMINANCE.min, COLOR_LUMINANCE.max, visibilityGate);
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
