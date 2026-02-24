import { OrthographicCamera, Vector3, MathUtils } from 'three';
import { PersistenceService } from './PersistenceService';
import type { FlowerData } from './PersistenceService';
import { CONFIG } from '../config';
import { v4 as uuidv4 } from 'uuid';

export class GardenManager {
  flowers: FlowerData[] = [];
  selectedStarData: { color: string; params: Record<string, number> } | null = null;
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

    const newFlower: FlowerData = {
      id: uuidv4(),
      x,
      y,
      color: this.selectedStarData.color,
      params: this.selectedStarData.params,
      timestamp: Date.now(),
    };

    this.flowers.push(newFlower);
    PersistenceService.save(this.flowers);
    
    return newFlower;
  }
}
