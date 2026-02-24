import { CONFIG } from '../config';

export class SemanticMapper {
  static mapCoordinatesToParams(x: number, y: number, z: number) {
    const L = CONFIG.CUBE_SIZE;
    const normalizedX = x / L;
    const normalizedY = y / L;
    const normalizedZ = z / L;

    const params: Record<string, number> = {};
    const keys = Object.keys(CONFIG.FLOWER_RANGES) as Array<keyof typeof CONFIG.FLOWER_RANGES>;

    for (const key of keys) {
      const seed = CONFIG.SEEDS[key];
      const range = CONFIG.FLOWER_RANGES[key];

      const rawVal = Math.sin(seed.freq[0] * normalizedX + seed.phase[0]) +
                     Math.sin(seed.freq[1] * normalizedY + seed.phase[1]) +
                     Math.sin(seed.freq[2] * normalizedZ + seed.phase[2]);

      const t = (rawVal + 3) / 6;

      params[key] = range.min + t * (range.max - range.min);
    }

    params.m = Math.round(params.m);

    return params;
  }
}
