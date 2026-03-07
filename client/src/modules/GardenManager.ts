import { OrthographicCamera, Vector3, MathUtils } from 'three';
import { PersistenceService } from './PersistenceService';
import type { FlowerData } from './PersistenceService';
import type { StarSelectionData } from '../types';
import { CONFIG } from '../config';
import { normalizeFlowerParams } from './FlowerShape';
import { v4 as uuidv4 } from 'uuid';
import {
  DEFAULT_GARDEN_DISPLAY_SETTINGS,
  normalizeGardenDisplaySettings,
  type GardenDisplaySettings,
} from './GardenDisplaySettings';

const FLOWER_VISUAL_RADIUS = 104;
const FLOWER_LABEL_GROWTH_MARGIN = 4;
const FLOWER_SCALE_MIN = 1;
const FLOWER_SCALE_MAX = 3.15;
const FLOWER_SCALE_RENDER_MIN = 0.35;
const FLOWER_SCALE_RENDER_MAX = 4.8;
const FLOWER_SCALE_CENTROID = 0.5;
const FLOWER_SCALE_SPREAD = 0.2;
const LABEL_EDGE_GUARD = 10;
const LABEL_FLAT_GAP = 10;
const LABEL_TRIES_PER_RING = 26;
const LABEL_TEXT_PADDING = 6;
const LABEL_ORBIT_SCALE = 0.6;
const FLOWER_SPAWN_MARGIN = 20;
const FLOWER_MIN_SEPARATION = 100;
const FLOWER_TRIES_PER_RING = 22;
const FLOWER_RING_FACTORS = [1.0, 1.2, 1.4, 1.75, 2.1];
const FLOWER_HITBOX_SCALE = 1.4;
const LABEL_COLLISION_GAIN = 1.45;
const MIN_LIFESPAN_MS = 30 * 1000;
const MIN_WITHERING_MS = 5000;
const FLOWER_SCREEN_CAPACITY_FOR_RETENTION = 15;
const FLOWER_GROWTH_STAGE_COUNT = 6;
const FLOWER_AGING_STAGE_MS = 1000 * 60 * 60;
const FLOWER_AGING_STAGE_COUNT = 2;
const FLOWER_AGING_SATURATION_DROP = 0.3;

export class GardenManager {
  flowers: FlowerData[] = [];
  selectedStarData: StarSelectionData | null = null;
  cameraPosition = new Vector3(CONFIG.GARDEN_WIDTH / 2, CONFIG.GARDEN_HEIGHT / 2, 100);
  private storageSignature = '';
  private readOnlyMode = true;
  private driftPhase = 0;
  private readonly driftRadiusX = 4.6;
  private readonly driftRadiusY = 3.3;
  private displaySettings: GardenDisplaySettings;

  constructor(displaySettings: Partial<GardenDisplaySettings> = {}) {
    this.displaySettings = normalizeGardenDisplaySettings({
      ...DEFAULT_GARDEN_DISPLAY_SETTINGS,
      ...displaySettings,
    });
  }

  static layoutFlowers(
    flowers: FlowerData[],
    displaySettings: Partial<GardenDisplaySettings> = {},
  ) {
    const manager = new GardenManager(displaySettings);
    return manager.ensureGardenLayout(flowers);
  }

  applyDisplaySettings(displaySettings: Partial<GardenDisplaySettings> = {}) {
    this.displaySettings = normalizeGardenDisplaySettings({
      ...this.displaySettings,
      ...displaySettings,
    });
  }

  init() {
    this.readOnlyMode = true;
    this.cameraPosition = new Vector3(CONFIG.GARDEN_WIDTH / 2, CONFIG.GARDEN_HEIGHT / 2, 100);
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
    return this.ensureGardenLayout(PersistenceService.load());
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
    if (flowers.length >= FLOWER_SCREEN_CAPACITY_FOR_RETENTION) {
      return { flowers, removed: 0 };
    }

    const alive: FlowerData[] = [];
    let removed = 0;

    for (const flower of flowers) {
      const plantedAt = Number.isFinite(flower.plantedAt) ? flower.plantedAt : flower.timestamp;
      const ageMs = Math.max(0, now - plantedAt);
      const lifeSpanMs = this.resolveLifeSpanMs(flower);
      const removalAt = lifeSpanMs + FLOWER_AGING_STAGE_MS * FLOWER_AGING_STAGE_COUNT;
      if (ageMs < removalAt) {
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

  private hash01ByWord(word: string, salt = '') {
    const normalized = (word || 'Unknown Bloom').trim().toLowerCase();
    let hash = 2166136261;
    for (let i = 0; i < normalized.length; i += 1) {
      hash ^= normalized.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    for (let i = 0; i < salt.length; i += 1) {
      hash ^= salt.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return this.clamp01((hash >>> 0) / 0xffffffff);
  }

  private resolveFlowerScaleNoise(word: string) {
    const u1 = this.clamp(this.hash01ByWord(word, 'normal-u1'), 1e-6, 1 - 1e-6);
    const u2 = this.clamp(this.hash01ByWord(word, 'normal-u2'), 1e-6, 1 - 1e-6);
    const normalSample = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return this.clamp01(FLOWER_SCALE_CENTROID + normalSample * FLOWER_SCALE_SPREAD);
  }

  private resolveFlowerScale(word: string) {
    const baseScale = FLOWER_SCALE_MIN + this.resolveFlowerScaleNoise(word) * (FLOWER_SCALE_MAX - FLOWER_SCALE_MIN);
    const scaled = baseScale * this.displaySettings.flowerScaleMeanMultiplier;
    return this.clamp(scaled, FLOWER_SCALE_RENDER_MIN, FLOWER_SCALE_RENDER_MAX);
  }

  private resolveFlowerVisualRadius(scaleFactor: number) {
    return FLOWER_VISUAL_RADIUS * this.clamp(scaleFactor, FLOWER_SCALE_MIN, FLOWER_SCALE_MAX);
  }

  private estimateLabelRadius(word: string) {
    const chars = Math.max(1, [...word].length);
    const base = 42 + 4.8 * chars + Math.sqrt(chars) * 18;
    return Math.max(24, Math.min(330, Math.round(base * this.displaySettings.labelScale)));
  }

  private resolveLabelRadius(word: string) {
    return this.estimateLabelRadius(word);
  }

  private resolveFlowerHitboxRadius(flower: FlowerData) {
    const baseRadius = this.resolveFlowerVisualRadius(flower.scaleFactor ?? 1) * FLOWER_HITBOX_SCALE;
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

  private isInsideGarden(x: number, y: number, radius: number, width: number, height: number) {
    return (
      x >= radius + LABEL_EDGE_GUARD &&
      x <= width - radius - LABEL_EDGE_GUARD &&
      y >= radius + LABEL_EDGE_GUARD &&
      y <= height - radius - LABEL_EDGE_GUARD
    );
  }

  private canPlaceFlower(centerX: number, centerY: number, placed: FlowerData[], newScaleFactor: number) {
    for (const flower of placed) {
      const currentRadius = this.resolveFlowerVisualRadius(flower.scaleFactor ?? 1);
      const required = Math.max(FLOWER_MIN_SEPARATION, this.resolveFlowerVisualRadius(newScaleFactor) + currentRadius);
      if (this.distanceSq(centerX, centerY, flower.x, flower.y) < required * required) {
        return false;
      }
    }

    return true;
  }

  private resolveFlowerPlacement(x: number, y: number, placed: FlowerData[], scaleFactor: number) {
    const startAngle = this.toLabelPlacementSeed(x, y);
    const visualRadius = this.resolveFlowerVisualRadius(scaleFactor);
    const maxX = CONFIG.GARDEN_WIDTH - LABEL_EDGE_GUARD - FLOWER_SPAWN_MARGIN;
    const maxY = CONFIG.GARDEN_HEIGHT - LABEL_EDGE_GUARD - FLOWER_SPAWN_MARGIN;
    const minX = LABEL_EDGE_GUARD + FLOWER_SPAWN_MARGIN;
    const minY = LABEL_EDGE_GUARD + FLOWER_SPAWN_MARGIN;
    const clampedX = this.clamp(x, minX, maxX);
    const clampedY = this.clamp(y, minY, maxY);

    if (
      this.isInsideGarden(clampedX, clampedY, visualRadius, CONFIG.GARDEN_WIDTH, CONFIG.GARDEN_HEIGHT) &&
      this.canPlaceFlower(clampedX, clampedY, placed, scaleFactor)
    ) {
      return { x: clampedX, y: clampedY };
    }

    for (const ringFactor of FLOWER_RING_FACTORS) {
      const radius = visualRadius * ringFactor;
      for (let i = 0; i < FLOWER_TRIES_PER_RING; i += 1) {
        const angle = startAngle + (i / FLOWER_TRIES_PER_RING) * Math.PI * 2;
        const candidateX = this.clamp(
          x + Math.cos(angle) * radius,
          minX,
          maxX,
        );
        const candidateY = this.clamp(
          y + Math.sin(angle) * radius,
          minY,
          maxY,
        );

        if (!this.isInsideGarden(candidateX, candidateY, visualRadius, CONFIG.GARDEN_WIDTH, CONFIG.GARDEN_HEIGHT)) {
          continue;
        }

        if (!this.canPlaceFlower(candidateX, candidateY, placed, scaleFactor)) {
          continue;
        }

        return { x: candidateX, y: candidateY };
      }
    }

    return {
      x: clampedX,
      y: clampedY,
    };
  }

  private toLabelPlacementSeed(x: number, y: number) {
    return this.hash01(x, y) * Math.PI * 2;
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
        (flowerRadius + placementRadius) * LABEL_COLLISION_GAIN + FLOWER_LABEL_GROWTH_MARGIN * LABEL_COLLISION_GAIN;

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
    scaleFactor: number,
    preferredOffsetX?: number,
    preferredOffsetY?: number,
  ) {
    const startAngle = this.toLabelPlacementSeed(x, y);
    const fixedRadius =
      (this.resolveFlowerVisualRadius(scaleFactor) +
        FLOWER_LABEL_GROWTH_MARGIN +
        LABEL_FLAT_GAP +
        LABEL_TEXT_PADDING) *
      LABEL_ORBIT_SCALE;

    if (preferredOffsetX !== undefined && preferredOffsetY !== undefined) {
      const preferredX = x + preferredOffsetX;
      const preferredY = y + preferredOffsetY;
      if (
        this.isInsideGarden(
          preferredX,
          preferredY,
          labelRadius + LABEL_EDGE_GUARD,
          CONFIG.GARDEN_WIDTH,
          CONFIG.GARDEN_HEIGHT,
        ) &&
        this.canPlaceLabel(preferredX, preferredY, labelRadius, placed)
      ) {
        return { offsetX: preferredOffsetX, offsetY: preferredOffsetY };
      }
    }

    const candidates = [];

    for (let i = 0; i < LABEL_TRIES_PER_RING; i += 1) {
      const angle = startAngle + (i / LABEL_TRIES_PER_RING) * Math.PI * 2;
      const candidateX = this.clamp(
        x + Math.cos(angle) * fixedRadius,
        LABEL_EDGE_GUARD,
        CONFIG.GARDEN_WIDTH - LABEL_EDGE_GUARD,
      );
      const candidateY = this.clamp(
        y + Math.sin(angle) * fixedRadius,
        LABEL_EDGE_GUARD,
        CONFIG.GARDEN_HEIGHT - LABEL_EDGE_GUARD,
      );
      const offsetX = candidateX - x;
      const offsetY = candidateY - y;

      if (!this.isInsideGarden(candidateX, candidateY, labelRadius + LABEL_EDGE_GUARD, CONFIG.GARDEN_WIDTH, CONFIG.GARDEN_HEIGHT)) {
        candidates.push({ x: candidateX, y: candidateY, offsetX, offsetY, clearance: -Infinity });
        continue;
      }

      if (this.canPlaceLabel(candidateX, candidateY, labelRadius, placed)) {
        return { offsetX, offsetY };
      }

      let minClearanceSq = Number.POSITIVE_INFINITY;
      for (const flower of placed) {
        const flowerRadius = this.resolveFlowerHitboxRadius(flower);
        const clearRadius =
          (flowerRadius + labelRadius) * LABEL_COLLISION_GAIN + FLOWER_LABEL_GROWTH_MARGIN * LABEL_COLLISION_GAIN;
        minClearanceSq = Math.min(
          minClearanceSq,
          this.distanceSq(candidateX, candidateY, flower.x, flower.y) - clearRadius * clearRadius,
        );

        if (
          flower.labelOffsetX !== undefined &&
          flower.labelOffsetY !== undefined &&
          flower.labelRadius !== undefined
        ) {
          const existingLabelX = flower.x + flower.labelOffsetX;
          const existingLabelY = flower.y + flower.labelOffsetY;
          const existingLabelRadius = this.resolveLabelRadius(flower.word || '');
          const requiredSq = Math.pow(
            labelRadius + flower.labelRadius + LABEL_FLAT_GAP * LABEL_COLLISION_GAIN,
            2,
          );
          minClearanceSq = Math.min(
            minClearanceSq,
            this.distanceSq(candidateX, candidateY, existingLabelX, existingLabelY) - requiredSq,
          );
        }
      }

      candidates.push({ x: candidateX, y: candidateY, offsetX, offsetY, clearance: minClearanceSq });
    }

    const selected =
      candidates.length > 0
        ? candidates.reduce((best, current) => (current.clearance > best.clearance ? current : best))
        : null;

    if (selected) {
      return { offsetX: selected.offsetX, offsetY: selected.offsetY };
    }

    const fallbackAngle = startAngle + 0.5;
    const fallbackX = this.clamp(
      x + Math.cos(fallbackAngle) * fixedRadius,
      LABEL_EDGE_GUARD + LABEL_TEXT_PADDING,
      CONFIG.GARDEN_WIDTH - LABEL_EDGE_GUARD - LABEL_TEXT_PADDING,
    );
    const fallbackY = this.clamp(
      y + Math.sin(fallbackAngle) * fixedRadius,
      LABEL_EDGE_GUARD + LABEL_TEXT_PADDING,
      CONFIG.GARDEN_HEIGHT - LABEL_EDGE_GUARD - LABEL_TEXT_PADDING,
    );
    return {
      offsetX: fallbackX - x,
      offsetY: fallbackY - y,
    };
  }

  private ensureGardenLayout(rawFlowers: FlowerData[]) {
    const normalized: FlowerData[] = [];
    for (const flower of rawFlowers) {
      const word = flower.word || 'Unknown Bloom';
      const labelRadius = this.resolveLabelRadius(word);
      const resolvedScale = this.resolveFlowerScale(word);
      const { x, y } = this.resolveFlowerPlacement(
        flower.x,
        flower.y,
        normalized,
        resolvedScale,
      );
      const { offsetX, offsetY } = this.resolveLabelPlacement(
        x,
        y,
        labelRadius,
        normalized,
        resolvedScale,
        flower.labelOffsetX,
        flower.labelOffsetY,
      );

      normalized.push({
        ...flower,
        x,
        y,
        word,
        scaleFactor: resolvedScale,
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
      const targetX = CONFIG.GARDEN_WIDTH / 2 + Math.sin(this.driftPhase) * this.driftRadiusX;
      const targetY = CONFIG.GARDEN_HEIGHT / 2 + Math.cos(this.driftPhase * 0.7) * this.driftRadiusY;
      this.cameraPosition.x = MathUtils.lerp(this.cameraPosition.x, targetX, 0.18);
      this.cameraPosition.y = MathUtils.lerp(this.cameraPosition.y, targetY, 0.18);
    }

    this.cameraPosition.x = MathUtils.clamp(this.cameraPosition.x, 0, CONFIG.GARDEN_WIDTH);
    this.cameraPosition.y = MathUtils.clamp(this.cameraPosition.y, 0, CONFIG.GARDEN_HEIGHT);

    camera.position.set(this.cameraPosition.x, this.cameraPosition.y, 100);
    camera.lookAt(this.cameraPosition.x, this.cameraPosition.y, 0);

    return this.pruneExpiredFlowers();
  }

  getFlowerState(flower: FlowerData, now = Date.now()) {
    const plantedAt = Number.isFinite(flower.plantedAt) ? flower.plantedAt : flower.timestamp;
    const ageMs = Math.max(0, now - plantedAt);
    const lifeSpanMs = this.resolveLifeSpanMs(flower);
    const witheringMs = this.resolveWitheringMs(flower, lifeSpanMs);
    const bypassAging = this.flowers.length >= FLOWER_SCREEN_CAPACITY_FOR_RETENTION;
    let saturationFactor = 1;

    if (!bypassAging && ageMs >= lifeSpanMs) {
      const agingStage = Math.min(
        FLOWER_AGING_STAGE_COUNT,
        Math.floor((ageMs - lifeSpanMs) / FLOWER_AGING_STAGE_MS) + 1,
      );
      saturationFactor = Math.max(0.1, 1 - agingStage * FLOWER_AGING_SATURATION_DROP);
    }

    const rawGrowth = Math.min(1, Math.max(0, ageMs / CONFIG.FLOWER_GROWTH_MS));
    const growth =
      rawGrowth >= 1
        ? 1
        : Math.floor(rawGrowth * FLOWER_GROWTH_STAGE_COUNT) / FLOWER_GROWTH_STAGE_COUNT;

    return {
      plantedAt,
      ageMs,
      growth,
      lifeSpanMs,
      witheringMs,
      vitality: 1,
      saturationFactor,
    };
  }

  plantFlower(x: number, y: number) {
    if (!this.selectedStarData) return null;

    const now = Date.now();
    const word = this.selectedStarData.word || 'Unknown Bloom';
    const scaleFactor = this.resolveFlowerScale(word);
    const resolved = this.resolveFlowerPlacement(x, y, this.flowers, scaleFactor);
    const normalizedParams = normalizeFlowerParams(this.selectedStarData.params);
    const labelRadius = this.resolveLabelRadius(word);
    const { x: resolvedX, y: resolvedY } = resolved;
    const { offsetX, offsetY } = this.resolveLabelPlacement(
      resolvedX,
      resolvedY,
      labelRadius,
      this.flowers,
      scaleFactor,
    );

    const newFlower: FlowerData = {
      id: uuidv4(),
      x: resolvedX,
      y: resolvedY,
      color: this.selectedStarData.color,
      params: normalizedParams,
      word,
      timestamp: now,
      plantedAt: now,
      scaleFactor,
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
