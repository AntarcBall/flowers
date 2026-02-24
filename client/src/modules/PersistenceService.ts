import { CONFIG } from '../config';
import { normalizeFlowerParams } from './FlowerShape';
import type { FlowerRenderParams } from '../types';

export interface FlowerData {
  id: string;
  x: number;
  y: number;
  color: string;
  params: FlowerRenderParams;
  timestamp: number;
  plantedAt?: number;
}

function sanitizeFlower(raw: unknown, index: number): FlowerData | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const anyRaw = raw as Partial<FlowerData> & { x?: unknown; y?: unknown; color?: unknown; id?: unknown; params?: unknown; timestamp?: unknown; plantedAt?: unknown };

  const color = typeof anyRaw.color === 'string' && anyRaw.color.trim() ? anyRaw.color : '#f2f6ff';

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

  const clampedX = Math.max(0, Math.min(CONFIG.GARDEN_SIZE, Number.isFinite(x) ? x : 0));
  const clampedY = Math.max(0, Math.min(CONFIG.GARDEN_SIZE, Number.isFinite(y) ? y : 0));

  return {
    id,
    x: clampedX,
    y: clampedY,
    color,
    params,
    timestamp: Number.isFinite(baseTimestamp) ? baseTimestamp : now,
    plantedAt: Number.isFinite(plantedAt) ? plantedAt : now,
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
