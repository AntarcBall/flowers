import { CONFIG } from '../config';
import { normalizeFlowerParams } from './FlowerShape';
import type { FlowerRenderParams } from '../types';

export interface FlowerData {
  id: string;
  x: number;
  y: number;
  color: string;
  params: FlowerRenderParams;
  word: string;
  timestamp: number;
  plantedAt?: number;
  lifeSpanMs?: number;
  witheringMs?: number;
  labelOffsetX?: number;
  labelOffsetY?: number;
  labelRadius?: number;
}

type RawFlowerLike = Partial<FlowerData> & {
  x?: unknown;
  y?: unknown;
  color?: unknown;
  id?: unknown;
  params?: unknown;
  timestamp?: unknown;
  plantedAt?: unknown;
  word?: unknown;
  lifeSpanMs?: unknown;
  witheringMs?: unknown;
  labelOffsetX?: unknown;
  labelOffsetY?: unknown;
  labelRadius?: unknown;
};

function sanitizeLifeSpan(rawSpan: unknown, fallback: number) {
  const normalized = Number(rawSpan);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return fallback;
  }

  return normalized;
}

function sanitizeWithering(rawWithering: unknown, fallback: number, lifeSpanMs: number) {
  const normalized = Number(rawWithering);
  const fallbackWithering = Math.min(fallback, Math.max(1000, lifeSpanMs * 0.2));

  if (!Number.isFinite(normalized) || normalized <= 0) {
    return fallbackWithering;
  }

  const bounded = Math.min(normalized, Math.max(1000, lifeSpanMs * 0.9));
  return Math.max(1000, bounded);
}

function sanitizeFlower(raw: unknown, index: number): FlowerData | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const anyRaw = raw as RawFlowerLike;

  const color = typeof anyRaw.color === 'string' && anyRaw.color.trim() ? anyRaw.color : '#f2f6ff';
  const word =
    typeof anyRaw.word === 'string' && anyRaw.word.trim() ? anyRaw.word : 'Unknown Bloom';

  const x = Number(anyRaw.x);
  const y = Number(anyRaw.y);

  const id =
    typeof anyRaw.id === 'string' && anyRaw.id.trim()
      ? anyRaw.id
      : `flower-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`;

  const params = normalizeFlowerParams((anyRaw.params as FlowerRenderParams) || {});
  const now = Date.now();
  const baseTimestamp = Number(anyRaw.timestamp);
  const plantedAt = Number(anyRaw.plantedAt);
  const labelOffsetX = Number(anyRaw.labelOffsetX);
  const labelOffsetY = Number(anyRaw.labelOffsetY);
  const labelRadius = Number(anyRaw.labelRadius);

  const clampedX = Math.max(0, Math.min(CONFIG.GARDEN_SIZE, Number.isFinite(x) ? x : 0));
  const clampedY = Math.max(0, Math.min(CONFIG.GARDEN_SIZE, Number.isFinite(y) ? y : 0));

  const lifeSpanMs = sanitizeLifeSpan(anyRaw.lifeSpanMs, CONFIG.FLOWER_LIFESPAN_MS);
  const witheringMs = sanitizeWithering(anyRaw.witheringMs, CONFIG.FLOWER_WITHERING_MS, lifeSpanMs);

  return {
    id,
    x: clampedX,
    y: clampedY,
    color,
    word,
    params,
    timestamp: Number.isFinite(baseTimestamp) ? baseTimestamp : now,
    plantedAt: Number.isFinite(plantedAt) ? plantedAt : now,
    lifeSpanMs,
    witheringMs,
    labelOffsetX: Number.isFinite(labelOffsetX) ? labelOffsetX : undefined,
    labelOffsetY: Number.isFinite(labelOffsetY) ? labelOffsetY : undefined,
    labelRadius: Number.isFinite(labelRadius) ? labelRadius : undefined,
  };
}

export class PersistenceService {
  static load(): FlowerData[] {
    try {
      const data = localStorage.getItem(CONFIG.STORAGE_KEY);
      const parsed = data ? JSON.parse(data) : [];
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .map((entry, index) => sanitizeFlower(entry, index))
        .filter((value): value is FlowerData => value !== null);
    } catch (e) {
      console.error('Failed to load garden', e);
      return [];
    }
  }

  static save(flowers: FlowerData[]) {
    try {
      const json = JSON.stringify(flowers);
      localStorage.setItem(CONFIG.STORAGE_KEY, json);
    } catch (e) {
      console.error('Failed to save garden', e);
    }
  }
}
