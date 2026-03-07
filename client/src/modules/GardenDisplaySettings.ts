export const GARDEN_DISPLAY_SETTINGS_STORAGE_KEY = 'garden_display_settings';

export type GardenDisplaySettings = {
  flowerScaleMeanMultiplier: number;
  labelScale: number;
};

export const DEFAULT_GARDEN_DISPLAY_SETTINGS: GardenDisplaySettings = {
  flowerScaleMeanMultiplier: 0.7,
  labelScale: 0.5,
};

function clamp(value: number, min: number, max: number) {
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : min;
}

export function normalizeGardenDisplaySettings(
  input: Partial<GardenDisplaySettings> = {},
): GardenDisplaySettings {
  return {
    flowerScaleMeanMultiplier: clamp(
      input.flowerScaleMeanMultiplier ?? DEFAULT_GARDEN_DISPLAY_SETTINGS.flowerScaleMeanMultiplier,
      0.35,
      1.4,
    ),
    labelScale: clamp(
      input.labelScale ?? DEFAULT_GARDEN_DISPLAY_SETTINGS.labelScale,
      0.25,
      1.5,
    ),
  };
}

export function loadGardenDisplaySettings() {
  try {
    const raw = localStorage.getItem(GARDEN_DISPLAY_SETTINGS_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_GARDEN_DISPLAY_SETTINGS;
    }
    return normalizeGardenDisplaySettings(JSON.parse(raw));
  } catch {
    return DEFAULT_GARDEN_DISPLAY_SETTINGS;
  }
}

export function saveGardenDisplaySettings(settings: GardenDisplaySettings) {
  try {
    localStorage.setItem(
      GARDEN_DISPLAY_SETTINGS_STORAGE_KEY,
      JSON.stringify(normalizeGardenDisplaySettings(settings)),
    );
  } catch {
    return;
  }
}
