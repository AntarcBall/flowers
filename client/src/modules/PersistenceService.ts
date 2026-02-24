import { CONFIG } from '../config';

export interface FlowerData {
  id: string;
  x: number;
  y: number;
  color: string;
  params: Record<string, number>;
  timestamp: number;
}

export class PersistenceService {
  static readonly STORAGE_UPDATED_EVENT = 'flower:storage-updated';

  static load(): FlowerData[] {
    try {
      const data = localStorage.getItem(CONFIG.STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Failed to load garden', e);
      return [];
    }
  }

  static save(flowers: FlowerData[]) {
    try {
      const json = JSON.stringify(flowers);
      localStorage.setItem(CONFIG.STORAGE_KEY, json);
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new Event(PersistenceService.STORAGE_UPDATED_EVENT));
      }
    } catch (e) {
      console.error('Failed to save garden', e);
    }
  }
}
