import { OrthographicCamera, Vector3, MathUtils } from 'three';
import { PersistenceService } from './PersistenceService';
import type { FlowerData } from './PersistenceService';
import type { FlowerRenderParams } from '../types';
import { CONFIG } from '../config';
import { normalizeFlowerParams } from './FlowerShape';
import { v4 as uuidv4 } from 'uuid';

export class GardenManager {
  flowers: FlowerData[] = [];
  selectedStarData: { color: string; params: FlowerRenderParams } | null = null;
  cameraPosition = new Vector3(CONFIG.GARDEN_SIZE / 2, CONFIG.GARDEN_SIZE / 2, 100);

  init() {
    this.flowers = PersistenceService.load();
  }

  update(inputs: Record<string, boolean>, camera: OrthographicCamera) {
    const { SCROLL_SPEED, GARDEN_SIZE } = CONFIG;

    if (inputs['w'] || inputs['W']) this.cameraPosition.y -= SCROLL_SPEED;
    if (inputs['s'] || inputs['S']) this.cameraPosition.y += SCROLL_SPEED;
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
    const newFlower: FlowerData = {
      id: uuidv4(),
      x,
      y,
      color: this.selectedStarData.color,
      params: normalizedParams,
      timestamp: now,
      plantedAt: now,
    };

    this.flowers.push(newFlower);
    PersistenceService.save(this.flowers);

    return newFlower;
  }
}
