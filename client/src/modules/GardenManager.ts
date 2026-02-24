import { OrthographicCamera, Vector3, MathUtils } from 'three';
import { PersistenceService } from './PersistenceService';
import type { FlowerData } from './PersistenceService';
import type { StarSelectionData } from '../types';
import { CONFIG } from '../config';
import { normalizeFlowerParams } from './FlowerShape';
import { v4 as uuidv4 } from 'uuid';

const FLOWER_VISUAL_RADIUS = 104;
const FLOWER_LABEL_GROWTH_MARGIN = 4;
const LABEL_EDGE_GUARD = 10;
const LABEL_FLAT_GAP = 8;
const LABEL_TRIES_PER_RING = 26;
const LABEL_RING_FACTORS = [1.03, 1.08, 1.15, 1.24, 1.34];
const LABEL_TEXT_PADDING = 4;

export class GardenManager {
  flowers: FlowerData[] = [];
  selectedStarData: StarSelectionData | null = null;
  cameraPosition = new Vector3(CONFIG.GARDEN_SIZE / 2, CONFIG.GARDEN_SIZE / 2, 100);

  init() {
    this.flowers = this.ensureLabelPlacement(PersistenceService.load());
    PersistenceService.save(this.flowers);
  }

  private clamp01(value: number) {
    return Math.max(0, Math.min(1, value));
  }

  private hash01(x: number, y: number) {
    return this.clamp01(Math.sin(x * 0.013 + y * 0.017 + Math.sin(x * 0.0071) * 2.89) * 0.5 + 0.5);
  }

  private estimateLabelRadius(word: string) {
    return Math.min(120, 54 + word.length * 4.1);
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
      x <= CONFIG.GARDEN_SIZE - radius - LABEL_EDGE_GUARD &&
      y >= radius + LABEL_EDGE_GUARD &&
      y <= CONFIG.GARDEN_SIZE - radius - LABEL_EDGE_GUARD
    );
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
    const minClearSq =
      Math.pow(FLOWER_VISUAL_RADIUS + placementRadius + FLOWER_LABEL_GROWTH_MARGIN, 2);

    for (const flower of placed) {
      if (
        this.distanceSq(centerX, centerY, flower.x, flower.y) <
        minClearSq
      ) {
        return false;
      }

      if (
        flower.labelOffsetX !== undefined &&
        flower.labelOffsetY !== undefined &&
        flower.labelRadius !== undefined
      ) {
        const existingLabelX = flower.x + flower.labelOffsetX;
        const existingLabelY = flower.y + flower.labelOffsetY;
        const requiredSq =
          Math.pow(placementRadius + flower.labelRadius + LABEL_FLAT_GAP, 2);
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
  ) {
    const startAngle = this.toLabelPlacementSeed(x, y);
    const outerRadius = FLOWER_VISUAL_RADIUS + FLOWER_LABEL_GROWTH_MARGIN + LABEL_FLAT_GAP + LABEL_TEXT_PADDING;

    for (const ringFactor of LABEL_RING_FACTORS) {
      const radius = outerRadius * ringFactor;
      for (let i = 0; i < LABEL_TRIES_PER_RING; i += 1) {
        const angle = startAngle + (i / LABEL_TRIES_PER_RING) * Math.PI * 2;
        const candidateX = this.clamp(
          x + Math.cos(angle) * radius,
          LABEL_EDGE_GUARD,
          CONFIG.GARDEN_SIZE - LABEL_EDGE_GUARD,
        );
        const candidateY = this.clamp(
          y + Math.sin(angle) * radius,
          LABEL_EDGE_GUARD,
          CONFIG.GARDEN_SIZE - LABEL_EDGE_GUARD,
        );
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
      CONFIG.GARDEN_SIZE - LABEL_EDGE_GUARD - LABEL_TEXT_PADDING,
    );
    const fallbackY = this.clamp(
      y + Math.sin(fallbackAngle) * fallbackRadius,
      LABEL_EDGE_GUARD + LABEL_TEXT_PADDING,
      CONFIG.GARDEN_SIZE - LABEL_EDGE_GUARD - LABEL_TEXT_PADDING,
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
      const labelRadius = this.estimateLabelRadius(word);
      const { offsetX, offsetY } = this.resolveLabelPlacement(
        flower.x,
        flower.y,
        labelRadius,
        normalized,
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

  update(inputs: Record<string, boolean>, camera: OrthographicCamera) {
    const { SCROLL_SPEED, GARDEN_SIZE } = CONFIG;

    if (inputs['w'] || inputs['W']) this.cameraPosition.y += SCROLL_SPEED;
    if (inputs['s'] || inputs['S']) this.cameraPosition.y -= SCROLL_SPEED;
    if (inputs['a'] || inputs['A']) this.cameraPosition.x -= SCROLL_SPEED;
    if (inputs['d'] || inputs['D']) this.cameraPosition.x += SCROLL_SPEED;

    this.cameraPosition.x = MathUtils.clamp(this.cameraPosition.x, 0, GARDEN_SIZE);
    this.cameraPosition.y = MathUtils.clamp(this.cameraPosition.y, 0, GARDEN_SIZE);

    camera.position.set(this.cameraPosition.x, this.cameraPosition.y, 100);
    camera.lookAt(this.cameraPosition.x, this.cameraPosition.y, 0);
  }

  plantFlower(x: number, y: number) {
    if (!this.selectedStarData) return null;

    const now = Date.now();
    const normalizedParams = normalizeFlowerParams(this.selectedStarData.params);
    const word = this.selectedStarData.word || 'Unknown Bloom';
    const labelRadius = this.estimateLabelRadius(word);
    const { offsetX, offsetY } = this.resolveLabelPlacement(x, y, labelRadius, this.flowers);

    const newFlower: FlowerData = {
      id: uuidv4(),
      x,
      y,
      color: this.selectedStarData.color,
      params: normalizedParams,
      word,
      timestamp: now,
      plantedAt: now,
      labelOffsetX: offsetX,
      labelOffsetY: offsetY,
      labelRadius,
    };

    this.flowers.push(newFlower);
    PersistenceService.save(this.flowers);

    return newFlower;
  }
}
