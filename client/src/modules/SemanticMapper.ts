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

    const hueSeedA = toSeed('m', normalizedX, normalizedY, normalizedZ);
    const hueSeedB = toSeed('radialTwist', normalizedY, normalizedZ, normalizedX);
    const satSeed = toSeed('petalCrest', normalizedZ, normalizedX, normalizedY);
    const lumSeed = toSeed('coreGlow', normalizedX, normalizedY, normalizedZ);
    const glowSeed = toSeed('fractalIntensity', normalizedY, normalizedX, normalizedZ);

    const hue = Math.round((hueSeedA * 300 + hueSeedB * 120) % 360);
    const sat = Math.round(42 + satSeed * 44 + glowSeed * 12);
    const lum = Math.round(28 + lumSeed * 30 + satSeed * 12 + glowSeed * 10);

    return `hsl(${hue}, ${sat}%, ${Math.max(16, Math.min(88, lum))}%)`;
  }
}
