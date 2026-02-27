export const PERFORMANCE_SETTINGS_STORAGE_KEY = 'space_performance_settings';

export type SpacePerformanceSettings = {
  enabled: boolean;
  dprMin: number;
  dprMax: number;
  showHud: boolean;
  hudScale: number;
  hudOpacity: number;
  hudCrosshair: boolean;
  hudSpeedometer: boolean;
  hudPositionPanel: boolean;
  hudHeadingCompass: boolean;
  hudTargetPanel: boolean;
  hudThrottleBar: boolean;
  hudRangeReadout: boolean;
  antialias: boolean;
  backgroundStarDensity: number;
  backgroundPointSize: number;
  starGeometrySegments: number;
  starScale: number;
  shipScale: number;
  maxVisibleLabels: number;
  labelUpdateIntervalMs: number;
  labelConeScale: number;
  labelFontScale: number;
  labelFontMin: number;
  labelOffsetX: number;
  labelOffsetY: number;
  aimSampleStep: number;
  launchTrailLimit: number;
  shipQuality: number;
  gridDensity: number;
};

export const DEFAULT_SPACE_PERFORMANCE_SETTINGS: SpacePerformanceSettings = {
  enabled: true,
  dprMin: 1.0,
  dprMax: 1.5,
  showHud: true,
  hudScale: 1,
  hudOpacity: 0.95,
  hudCrosshair: true,
  hudSpeedometer: true,
  hudPositionPanel: true,
  hudHeadingCompass: true,
  hudTargetPanel: true,
  hudThrottleBar: true,
  hudRangeReadout: true,
  antialias: false,
  backgroundStarDensity: 0.85,
  backgroundPointSize: 2.3,
  starGeometrySegments: 8,
  starScale: 1,
  shipScale: 1,
  maxVisibleLabels: 8,
  labelUpdateIntervalMs: 55,
  labelConeScale: 0.9,
  labelFontScale: 1,
  labelFontMin: 10,
  labelOffsetX: 0,
  labelOffsetY: 0,
  aimSampleStep: 1,
  launchTrailLimit: 6,
  shipQuality: 1,
  gridDensity: 1,
};

function clamp(value: number, min: number, max: number) {
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : min;
}

export function normalizeSpacePerformanceSettings(
  input: Partial<SpacePerformanceSettings> = {},
): SpacePerformanceSettings {
  return {
    enabled: input.enabled ?? DEFAULT_SPACE_PERFORMANCE_SETTINGS.enabled,
    dprMin: clamp(input.dprMin ?? DEFAULT_SPACE_PERFORMANCE_SETTINGS.dprMin, 0.5, 2),
    dprMax: clamp(input.dprMax ?? DEFAULT_SPACE_PERFORMANCE_SETTINGS.dprMax, 0.5, 2),
    showHud: Boolean(input.showHud ?? DEFAULT_SPACE_PERFORMANCE_SETTINGS.showHud),
    hudScale: clamp(input.hudScale ?? DEFAULT_SPACE_PERFORMANCE_SETTINGS.hudScale, 0.6, 1.4),
    hudOpacity: clamp(input.hudOpacity ?? DEFAULT_SPACE_PERFORMANCE_SETTINGS.hudOpacity, 0.35, 1),
    hudCrosshair: Boolean(input.hudCrosshair ?? DEFAULT_SPACE_PERFORMANCE_SETTINGS.hudCrosshair),
    hudSpeedometer: Boolean(input.hudSpeedometer ?? DEFAULT_SPACE_PERFORMANCE_SETTINGS.hudSpeedometer),
    hudPositionPanel: Boolean(input.hudPositionPanel ?? DEFAULT_SPACE_PERFORMANCE_SETTINGS.hudPositionPanel),
    hudHeadingCompass: Boolean(input.hudHeadingCompass ?? DEFAULT_SPACE_PERFORMANCE_SETTINGS.hudHeadingCompass),
    hudTargetPanel: Boolean(input.hudTargetPanel ?? DEFAULT_SPACE_PERFORMANCE_SETTINGS.hudTargetPanel),
    hudThrottleBar: Boolean(input.hudThrottleBar ?? DEFAULT_SPACE_PERFORMANCE_SETTINGS.hudThrottleBar),
    hudRangeReadout: Boolean(input.hudRangeReadout ?? DEFAULT_SPACE_PERFORMANCE_SETTINGS.hudRangeReadout),
    antialias: Boolean(input.antialias ?? DEFAULT_SPACE_PERFORMANCE_SETTINGS.antialias),
    backgroundStarDensity: clamp(
      input.backgroundStarDensity ?? DEFAULT_SPACE_PERFORMANCE_SETTINGS.backgroundStarDensity,
      0.2,
      1,
    ),
    backgroundPointSize: clamp(
      input.backgroundPointSize ?? DEFAULT_SPACE_PERFORMANCE_SETTINGS.backgroundPointSize,
      1,
      3.4,
    ),
    starGeometrySegments: Math.round(clamp(
      input.starGeometrySegments ?? DEFAULT_SPACE_PERFORMANCE_SETTINGS.starGeometrySegments,
      4,
      16,
    )),
    starScale: clamp(
      input.starScale ?? DEFAULT_SPACE_PERFORMANCE_SETTINGS.starScale,
      0.2,
      3,
    ),
    shipScale: clamp(
      input.shipScale ?? DEFAULT_SPACE_PERFORMANCE_SETTINGS.shipScale,
      0.2,
      3,
    ),
    maxVisibleLabels: Math.round(clamp(
      input.maxVisibleLabels ?? DEFAULT_SPACE_PERFORMANCE_SETTINGS.maxVisibleLabels,
      0,
      20,
    )),
    labelUpdateIntervalMs: Math.round(clamp(
      input.labelUpdateIntervalMs ?? DEFAULT_SPACE_PERFORMANCE_SETTINGS.labelUpdateIntervalMs,
      24,
      220,
    )),
    labelConeScale: clamp(
      input.labelConeScale ?? DEFAULT_SPACE_PERFORMANCE_SETTINGS.labelConeScale,
      0.55,
      1.35,
    ),
    labelFontScale: clamp(
      input.labelFontScale ?? DEFAULT_SPACE_PERFORMANCE_SETTINGS.labelFontScale,
      0.5,
      30,
    ),
    labelFontMin: clamp(
      Math.round(input.labelFontMin ?? DEFAULT_SPACE_PERFORMANCE_SETTINGS.labelFontMin),
      1,
      75,
    ),
    labelOffsetX: Math.round(clamp(input.labelOffsetX ?? DEFAULT_SPACE_PERFORMANCE_SETTINGS.labelOffsetX, -1000, 100)),
    labelOffsetY: Math.round(clamp(input.labelOffsetY ?? DEFAULT_SPACE_PERFORMANCE_SETTINGS.labelOffsetY, -300, 100)),
    aimSampleStep: Math.max(1, Math.round(clamp(
      input.aimSampleStep ?? DEFAULT_SPACE_PERFORMANCE_SETTINGS.aimSampleStep,
      1,
      8,
    ))),
    launchTrailLimit: Math.round(clamp(
      input.launchTrailLimit ?? DEFAULT_SPACE_PERFORMANCE_SETTINGS.launchTrailLimit,
      0,
      10,
    )),
    shipQuality: clamp(input.shipQuality ?? DEFAULT_SPACE_PERFORMANCE_SETTINGS.shipQuality, 0, 1),
    gridDensity: clamp(
      input.gridDensity ?? DEFAULT_SPACE_PERFORMANCE_SETTINGS.gridDensity,
      0,
      1,
    ),
  };
}

export function loadSpacePerformanceSettings() {
  try {
    const raw = localStorage.getItem(PERFORMANCE_SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SPACE_PERFORMANCE_SETTINGS;
    return normalizeSpacePerformanceSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_SPACE_PERFORMANCE_SETTINGS;
  }
}

export function saveSpacePerformanceSettings(settings: SpacePerformanceSettings) {
  try {
    localStorage.setItem(
      PERFORMANCE_SETTINGS_STORAGE_KEY,
      JSON.stringify(normalizeSpacePerformanceSettings(settings)),
    );
  } catch {
    return;
  }
}
