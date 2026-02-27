import { OrthographicCamera, Vector3, MathUtils } from 'three';
import { PersistenceService } from './PersistenceService';
import type { FlowerData } from './PersistenceService';
import type { FlowerRenderParams, StarSelectionData } from '../types';
import { CONFIG } from '../config';
import { buildFlowerProfile, normalizeFlowerParams } from './FlowerShape';
import { v4 as uuidv4 } from 'uuid';

const FLOWER_RENDER_SCALE = 104;
const LABEL_FLOWER_RADIUS_SCALE = 0.5;
const FLOWER_LABEL_GROWTH_MARGIN = 4;
const LABEL_EDGE_GUARD = 10;
const LABEL_FLAT_GAP = 10;
const LABEL_TRIES_PER_RING = 26;
const LABEL_RING_FACTORS = [1, 1.04, 1.09, 1.16, 1.24, 1.33];
const LABEL_TEXT_PADDING = 6;
const LABEL_ADJACENT_OFFSET = 8;
const FLOWER_SPAWN_MARGIN = 20;
const FLOWER_MIN_SEPARATION = 100;
const FLOWER_TRIES_PER_RING = 22;
const FLOWER_RING_FACTORS = [1.0, 1.2, 1.4, 1.75, 2.1];
const FLOWER_HITBOX_SCALE = 1.22;
const LABEL_COLLISION_GAIN = 1.08;
const MIN_LIFESPAN_MS = 30 * 1000;
const MIN_WITHERING_MS = 5000;
const FLOWER_RADIUS_CACHE_LIMIT = 256;

export class GardenManager {
  flowers: FlowerData[] = [];
  selectedStarData: StarSelectionData | null = null;
  cameraPosition = new Vector3(CONFIG.GARDEN_WIDTH / 2, CONFIG.GARDEN_HEIGHT / 2, 100);
  private flowerRadiusCache = new Map<string, number>();
  private storageSignature = '';
  private readOnlyMode = true;
  private driftPhase = 0;
  private readonly driftRadiusX = 4.6;
  private readonly driftRadiusY = 3.3;

  private get gardenWidth() {
    return CONFIG.GARDEN_WIDTH;
  }

  private get gardenHeight() {
    return CONFIG.GARDEN_HEIGHT;
  }

  init() {
    this.readOnlyMode = true;
    this.cameraPosition = new Vector3(this.gardenWidth / 2, this.gardenHeight / 2, 100);
    this.storageSignature = '';
    this.reloadFromStorage(true);
    PersistenceService.save(this.flowers);
  }

  private buildStorageSignature(entries: FlowerData[]) {
    if (entries.length === 0) return 'empty';
    return entries
      .map(
        (entry) =>
          `${entry.id}|${entry.timestamp}|${entry.plantedAt ?? entry.timestamp}|${entry.lifeSpanMs ?? 0}|${
            entry.witheringMs ?? 0
          }`,
      )
      .join(',');
  }

  private materializeStoredFlowers() {
    return this.ensureLabelPlacement(PersistenceService.load());
  }

  private resolveLifeSpanMs(flower: FlowerData) {
    const rawLifeSpan = Number(flower.lifeSpanMs);
    const base = Number.isFinite(rawLifeSpan) && rawLifeSpan > 0 ? rawLifeSpan : CONFIG.FLOWER_LIFESPAN_MS;
    return Math.max(MIN_LIFESPAN_MS, base);
  }

  private resolveWitheringMs(flower: FlowerData, lifeSpanMs: number) {
    const rawWithering = Number(flower.witheringMs);
    const base = Number.isFinite(rawWithering) && rawWithering > 0 ? rawWithering : CONFIG.FLOWER_WITHERING_MS;
    const boundedBase = Math.min(base, Math.max(MIN_WITHERING_MS, lifeSpanMs * 0.9));
    return Math.max(MIN_WITHERING_MS, boundedBase);
  }

  private filterExpired(flowers: FlowerData[], now = Date.now()) {
    const alive: FlowerData[] = [];
    let removed = 0;

    for (const flower of flowers) {
      const plantedAt = Number.isFinite(flower.plantedAt) ? flower.plantedAt : flower.timestamp;
      const ageMs = Math.max(0, now - plantedAt);
      const lifeSpanMs = this.resolveLifeSpanMs(flower);
      if (ageMs < lifeSpanMs) {
        alive.push(flower);
      } else {
        removed += 1;
      }
    }

    return { flowers: alive, removed };
  }

  private pruneExpiredFlowers(now: number = Date.now()) {
    const { flowers: alive, removed } = this.filterExpired(this.flowers, now);

    if (removed > 0) {
      this.flowers = alive;
      if (this.flowers.length === 0) {
        this.storageSignature = '';
      } else {
        this.storageSignature = this.buildStorageSignature(this.flowers);
      }
      PersistenceService.save(this.flowers);
      return true;
    }

    return false;
  }

  reloadFromStorage(force = false) {
    const { flowers: loaded, removed } = this.filterExpired(this.materializeStoredFlowers(), Date.now());
    const signature = this.buildStorageSignature(loaded);
    if (force || signature !== this.storageSignature) {
      this.flowers = loaded;
      this.storageSignature = signature;
      if (removed) {
        PersistenceService.save(this.flowers);
      }
      return true;
    }
    return false;
  }

  private clamp01(value: number) {
    return Math.max(0, Math.min(1, value));
  }

  private hash01(x: number, y: number) {
    return this.clamp01(Math.sin(x * 0.013 + y * 0.017 + Math.sin(x * 0.0071) * 2.89) * 0.5 + 0.5);
  }

  private resolveFlowerDisplayRadius(params: FlowerRenderParams, color: string) {
    const normalized = normalizeFlowerParams(params);
    const key = `${color}|${JSON.stringify(normalized)}`;
    const cached = this.flowerRadiusCache.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const profile = buildFlowerProfile(normalized, color);
    let maxSq = 0;
    for (const point of profile.outerPoints) {
      const d2 = point.x * point.x + point.y * point.y;
      if (d2 > maxSq) {
        maxSq = d2;
      }
    }

    const radius = maxSq > 0 ? Math.sqrt(maxSq) * FLOWER_RENDER_SCALE : FLOWER_RENDER_SCALE;
    this.flowerRadiusCache.set(key, radius);

    if (this.flowerRadiusCache.size > FLOWER_RADIUS_CACHE_LIMIT) {
      const oldestKey = this.flowerRadiusCache.keys().next().value;
      if (oldestKey) {
        this.flowerRadiusCache.delete(oldestKey);
      }
    }

    return radius;
  }

  private estimateLabelRadius(word: string) {
    const chars = Math.max(1, [...word].length);
    const base = 42 + 4.8 * chars + Math.sqrt(chars) * 18;
    return Math.max(48, Math.min(220, Math.round(base)));
  }

  private resolveLabelRadius(word: string) {
    return this.estimateLabelRadius(word);
  }

  private resolveFlowerHitboxRadius(flower: FlowerData) {
    const baseRadius = this.resolveFlowerDisplayRadius(flower.params, flower.color) * FLOWER_HITBOX_SCALE;
    const orbitLabelRadius = this.resolveLabelRadius(flower.word || '');
    const labelOffsetDistance = Math.sqrt(
      Math.pow(flower.labelOffsetX || 0, 2) + Math.pow(flower.labelOffsetY || 0, 2),
    );
    const labelOrbitRadius = labelOffsetDistance + (flower.labelRadius ?? orbitLabelRadius);

    return Math.max(baseRadius, labelOrbitRadius + LABEL_FLAT_GAP, LABEL_TEXT_PADDING);
  }

  private distanceSq(ax: number, ay: number, bx: number, by: number) {
    const dx = ax - bx;
    const dy = ay - by;
    return dx * dx + dy * dy;
  }

  private clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
  }

  private isInsideGarden(x: number, y: number, radius: number) {
    return (
      x >= radius + LABEL_EDGE_GUARD &&
      x <= this.gardenWidth - radius - LABEL_EDGE_GUARD &&
      y >= radius + LABEL_EDGE_GUARD &&
      y <= this.gardenHeight - radius - LABEL_EDGE_GUARD
    );
  }

  private canPlaceFlower(centerX: number, centerY: number, placed: FlowerData[]) {
    const minClearSq = FLOWER_MIN_SEPARATION * FLOWER_MIN_SEPARATION;
    for (const flower of placed) {
      if (this.distanceSq(centerX, centerY, flower.x, flower.y) < minClearSq) {
        return false;
      }
    }

    return true;
  }

  private resolveFlowerPlacement(x: number, y: number, placed: FlowerData[]) {
    if (placed.length === 0) {
      return { x, y };
    }

    const startAngle = this.toLabelPlacementSeed(x, y);

    for (const ringFactor of FLOWER_RING_FACTORS) {
      const radius = (this.selectedStarData
        ? this.resolveFlowerDisplayRadius(this.selectedStarData.params, this.selectedStarData.color)
        : FLOWER_RENDER_SCALE) * ringFactor;
      for (let i = 0; i < FLOWER_TRIES_PER_RING; i += 1) {
        const angle = startAngle + (i / FLOWER_TRIES_PER_RING) * Math.PI * 2;
        const candidateX = this.clamp(
          x + Math.cos(angle) * radius,
          LABEL_EDGE_GUARD + FLOWER_SPAWN_MARGIN,
          this.gardenWidth - LABEL_EDGE_GUARD - FLOWER_SPAWN_MARGIN,
        );
        const candidateY = this.clamp(
          y + Math.sin(angle) * radius,
          LABEL_EDGE_GUARD + FLOWER_SPAWN_MARGIN,
          this.gardenHeight - LABEL_EDGE_GUARD - FLOWER_SPAWN_MARGIN,
        );

        if (!this.isInsideGarden(candidateX, candidateY, FLOWER_RENDER_SCALE * LABEL_FLOWER_RADIUS_SCALE)) {
          continue;
        }

        if (!this.canPlaceFlower(candidateX, candidateY, placed)) {
          continue;
        }

        return { x: candidateX, y: candidateY };
      }
    }

    return {
      x: this.clamp(x, LABEL_EDGE_GUARD + FLOWER_SPAWN_MARGIN, this.gardenWidth - LABEL_EDGE_GUARD - FLOWER_SPAWN_MARGIN),
      y: this.clamp(y, LABEL_EDGE_GUARD + FLOWER_SPAWN_MARGIN, this.gardenHeight - LABEL_EDGE_GUARD - FLOWER_SPAWN_MARGIN),
    };
  }

  private toLabelPlacementSeed(x: number, y: number) {
    return this.hash01(x, y) * Math.PI * 2;
  }

  private resolvePreferredLabelDistance(labelRadius: number, flowerOuterRadius: number) {
    const labelScaleBoost = Math.min(labelRadius, 180) * 0.02;
    return flowerOuterRadius * LABEL_FLOWER_RADIUS_SCALE + LABEL_ADJACENT_OFFSET + labelScaleBoost;
  }

  private canPlaceLabel(
    centerX: number,
    centerY: number,
    placementRadius: number,
    placed: FlowerData[],
  ) {
    for (const flower of placed) {
      const flowerRadius = this.resolveFlowerHitboxRadius(flower);
      const clearRadius =
        (flowerRadius + placementRadius + FLOWER_LABEL_GROWTH_MARGIN) * LABEL_COLLISION_GAIN;

      if (this.distanceSq(centerX, centerY, flower.x, flower.y) < clearRadius * clearRadius) {
        return false;
      }

      if (
        flower.labelOffsetX !== undefined &&
        flower.labelOffsetY !== undefined &&
        flower.labelRadius !== undefined
      ) {
        const existingLabelX = flower.x + flower.labelOffsetX;
        const existingLabelY = flower.y + flower.labelOffsetY;
        const existingLabelRadius = this.resolveLabelRadius(flower.word || '');
        const requiredSq =
          Math.pow(
            placementRadius +
              (flower.labelRadius ?? existingLabelRadius) +
              LABEL_FLAT_GAP * LABEL_COLLISION_GAIN,
            2,
          );
        if (this.distanceSq(centerX, centerY, existingLabelX, existingLabelY) < requiredSq) {
          return false;
        }
      }
    }

    return true;
  }

  private resolveLabelPlacement(
    x: number,
    y: number,
    labelRadius: number,
    placed: FlowerData[],
    flowerOuterRadius: number,
  ) {
    const startAngle = this.toLabelPlacementSeed(x, y);
    const baseRadius = this.resolvePreferredLabelDistance(labelRadius, flowerOuterRadius);
    const outerRadius = baseRadius;

    for (const ringFactor of LABEL_RING_FACTORS) {
      const radius = outerRadius * ringFactor;
      for (let i = 0; i < LABEL_TRIES_PER_RING; i += 1) {
        const angle = startAngle + (i / LABEL_TRIES_PER_RING) * Math.PI * 2;
        const candidateX = this.clamp(x + Math.cos(angle) * radius, LABEL_EDGE_GUARD, this.gardenWidth - LABEL_EDGE_GUARD);
        const candidateY = this.clamp(y + Math.sin(angle) * radius, LABEL_EDGE_GUARD, this.gardenHeight - LABEL_EDGE_GUARD);
        const offsetX = candidateX - x;
        const offsetY = candidateY - y;

        if (!this.isInsideGarden(candidateX, candidateY, labelRadius + LABEL_EDGE_GUARD)) {
          continue;
        }

        if (!this.canPlaceLabel(candidateX, candidateY, labelRadius, placed)) {
          continue;
        }

        return { offsetX, offsetY };
      }
    }

    const fallbackRadius = outerRadius;
    const fallbackAngle = this.toLabelPlacementSeed(x, y) * 1.8;
    const fallbackX = this.clamp(
      x + Math.cos(fallbackAngle) * fallbackRadius,
      LABEL_EDGE_GUARD + LABEL_TEXT_PADDING,
      this.gardenWidth - LABEL_EDGE_GUARD - LABEL_TEXT_PADDING,
    );
    const fallbackY = this.clamp(
      y + Math.sin(fallbackAngle) * fallbackRadius,
      LABEL_EDGE_GUARD + LABEL_TEXT_PADDING,
      this.gardenHeight - LABEL_EDGE_GUARD - LABEL_TEXT_PADDING,
    );
    return {
      offsetX: fallbackX - x,
      offsetY: fallbackY - y,
    };
  }

  private ensureLabelPlacement(rawFlowers: FlowerData[]) {
    const normalized: FlowerData[] = [];
    for (const flower of rawFlowers) {
      const word = flower.word || 'Unknown Bloom';
      const labelRadius = this.resolveLabelRadius(word);
      const flowerOuterRadius = this.resolveFlowerDisplayRadius(flower.params, flower.color);
      const { offsetX, offsetY } = this.resolveLabelPlacement(
        flower.x,
        flower.y,
        labelRadius,
        normalized,
        flowerOuterRadius,
      );

      normalized.push({
        ...flower,
        word,
        labelOffsetX: offsetX,
        labelOffsetY: offsetY,
        labelRadius,
      });
    }

    return normalized;
  }

  update(deltaTime: number, camera: OrthographicCamera, inputs?: Record<string, boolean>) {
    const { SCROLL_SPEED } = CONFIG;

    if (!this.readOnlyMode) {
      const inputState = inputs ?? {};
      if (inputState['w'] || inputState['W']) this.cameraPosition.y += SCROLL_SPEED;
      if (inputState['s'] || inputState['S']) this.cameraPosition.y -= SCROLL_SPEED;
      if (inputState['a'] || inputState['A']) this.cameraPosition.x -= SCROLL_SPEED;
      if (inputState['d'] || inputState['D']) this.cameraPosition.x += SCROLL_SPEED;
    } else {
      this.driftPhase += deltaTime * 0.15;
      const targetX = this.gardenWidth / 2 + Math.sin(this.driftPhase) * this.driftRadiusX;
      const targetY = this.gardenHeight / 2 + Math.cos(this.driftPhase * 0.7) * this.driftRadiusY;
      this.cameraPosition.x = MathUtils.lerp(this.cameraPosition.x, targetX, 0.18);
      this.cameraPosition.y = MathUtils.lerp(this.cameraPosition.y, targetY, 0.18);
    }

    this.cameraPosition.x = MathUtils.clamp(this.cameraPosition.x, 0, this.gardenWidth);
    this.cameraPosition.y = MathUtils.clamp(this.cameraPosition.y, 0, this.gardenHeight);

    camera.position.set(this.cameraPosition.x, this.cameraPosition.y, 100);
    camera.lookAt(this.cameraPosition.x, this.cameraPosition.y, 0);

    return this.pruneExpiredFlowers();
  }

  getFlowerState(flower: FlowerData, now = Date.now()) {
    const plantedAt = Number.isFinite(flower.plantedAt) ? flower.plantedAt : flower.timestamp;
    const ageMs = Math.max(0, now - plantedAt);
    const lifeSpanMs = this.resolveLifeSpanMs(flower);
    const witheringMs = this.resolveWitheringMs(flower, lifeSpanMs);
    const witherStartMs = Math.max(0, lifeSpanMs - witheringMs);
    let vitality = 1;

    if (ageMs >= lifeSpanMs) {
      vitality = 0;
    } else if (ageMs > witherStartMs) {
      vitality = 1 - (ageMs - witherStartMs) / witheringMs;
    }

    return {
      plantedAt,
      ageMs,
      growth: Math.min(1, Math.max(0, ageMs / CONFIG.FLOWER_GROWTH_MS)),
      lifeSpanMs,
      witheringMs,
      vitality: Math.max(0, Math.min(1, vitality)),
    };
  }

  plantFlower(x: number, y: number) {
    if (!this.selectedStarData) return null;

    const now = Date.now();
    const resolved = this.resolveFlowerPlacement(x, y, this.flowers);
    const normalizedParams = normalizeFlowerParams(this.selectedStarData.params);
    const word = this.selectedStarData.word || 'Unknown Bloom';
    const labelRadius = this.resolveLabelRadius(word);
    const { x: resolvedX, y: resolvedY } = resolved;
    const flowerOuterRadius = this.resolveFlowerDisplayRadius(normalizedParams, this.selectedStarData.color);
    const { offsetX, offsetY } = this.resolveLabelPlacement(resolvedX, resolvedY, labelRadius, this.flowers, flowerOuterRadius);

    const newFlower: FlowerData = {
      id: uuidv4(),
      x: resolvedX,
      y: resolvedY,
      color: this.selectedStarData.color,
      params: normalizedParams,
      word,
      timestamp: now,
      plantedAt: now,
      lifeSpanMs: Math.round(CONFIG.FLOWER_LIFESPAN_MS * (0.7 + 0.6 * this.hash01(resolvedX, resolvedY))),
      witheringMs: Math.round(CONFIG.FLOWER_WITHERING_MS * (0.6 + 0.8 * this.hash01(resolvedY, resolvedX))),
      labelOffsetX: offsetX,
      labelOffsetY: offsetY,
      labelRadius,
    };

    this.flowers.push(newFlower);
    PersistenceService.save(this.flowers);

    return newFlower;
  }
}

