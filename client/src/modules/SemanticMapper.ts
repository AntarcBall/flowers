import { CONFIG } from '../config';
import type { FlowerRenderParams } from '../types';

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
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

const COLOR_HUE_ANCHORS = [
  { angle: -2.62, hue: 355, width: 1.05, boost: 1.22 },
  { angle: -2.0, hue: 50, width: 0.95, boost: 1.28 },
  { angle: -1.1, hue: 110, width: 0.98, boost: 1.06 },
  { angle: -0.25, hue: 165, width: 0.98, boost: 0.95 },
  { angle: 0.62, hue: 205, width: 1.06, boost: 0.99 },
  { angle: 1.47, hue: 250, width: 1.0, boost: 0.98 },
  { angle: 2.35, hue: 300, width: 1.01, boost: 1.1 },
];

const COLOR_SATURATION = {
  min: 44,
  max: 92,
};

const COLOR_SPACE_SMOOTHING = {
  radius: 0.008,
  centerWeight: 0.44,
  axisWeight: 0.0933333333,
};

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

function wrapSigned(value: number) {
  return ((value + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
}

function hueFromAnchors(dirAngle: number, dirBoost: number) {
  const weights = COLOR_HUE_ANCHORS.map((anchor) => {
    const delta = wrapSigned(dirAngle - anchor.angle);
    return Math.exp(-(delta * delta) / (2 * anchor.width * anchor.width)) * (anchor.boost + dirBoost);
  });

  let x = 0;
  let y = 0;
  let total = 0;

  for (let i = 0; i < COLOR_HUE_ANCHORS.length; i += 1) {
    const anchor = COLOR_HUE_ANCHORS[i];
    const w = weights[i];
    const radians = (anchor.hue / 360) * Math.PI * 2;
    x += Math.cos(radians) * w;
    y += Math.sin(radians) * w;
    total += w;
  }

  if (total <= 0) return 0;
  return ((Math.atan2(y, x) / (Math.PI * 2) + 1) * 360) % 360;
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
    const dirAngle = Math.atan2(centeredY + centeredZ * 0.11, centeredX + centeredZ * 0.17);

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
    const dirBoost = 0.42 * satSeed + 0.28 * glowSeed + 0.18 * lumSeed + 0.12 * depthEchoSeed;
    const anchorHue = hueFromAnchors(dirAngle, dirBoost);
    const radiusBlend = clamp01(
      (Math.abs(centeredX) + Math.abs(centeredY) + Math.abs(centeredZ)) / 1.45
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

    const huePhase = Math.sin(hueSeedA * Math.PI * 2 + 0.24 * hueWave * Math.PI * 2)
      * 0.04
      + Math.cos(posPhase * Math.PI * 2 + hueSeedB * Math.PI * 2) * 0.04;

    const proceduralHue = wrap01(hueWave + huePhase);
    const anchorInfluence = 0.84 - 0.42 * radiusBlend;
    const hue = lerp(proceduralHue, anchorHue / 360, clamp01(anchorInfluence));
    const visibilityGate = clamp01(
      0.34 * satSeed + 0.22 * glowSeed + 0.16 * lumSeed + 0.14 * ringContrastSeed + 0.14 * depthEchoSeed
    );
    const saturation = clamp01(
      lerp(COLOR_SATURATION.min, COLOR_SATURATION.max, visibilityGate) / 100
    );

    const targetLuminance = lerp(COLOR_LUMINANCE.min, COLOR_LUMINANCE.max, visibilityGate);
    return matchLuminance(hue, saturation, targetLuminance);
  }
}
