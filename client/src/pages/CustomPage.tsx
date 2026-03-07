import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { FlowerPreview } from '../components/FlowerPreview';
import SpacePositionMap from '../components/SpacePositionMap';
import {
  DEFAULT_COLOR_MAPPING_PRESET,
  cloneColorMappingPreset,
  normalizeColorMappingPreset,
  type ColorAnchor,
  type ColorMappingPreset,
  type ColorTuningSettings,
  SemanticMapper,
} from '../modules/SemanticMapper';
import {
  COLOR_PRESET_INSTALL_PATH,
  COLOR_PRESET_PUBLIC_FILENAME,
  applyColorPreset,
  downloadColorPresetFile,
  ensureColorPresetLoaded,
  subscribeToColorPreset,
  type ColorPresetSource,
} from '../modules/ColorPresetStore';
import type { FlowerRenderParams } from '../types';
import './CustomPage.css';

type ActiveTab = 'main' | '3d';

type StarRecord = {
  id: number | string;
  word: string;
  x: number;
  y: number;
  z: number;
};

type ColorMetrics = {
  hue: number;
  saturation: number;
  lightness: number;
  luminance: number;
};

type AnalyzedStar = StarRecord & {
  params: FlowerRenderParams;
  appliedColor: string;
  draftColor: string;
  appliedMetrics: ColorMetrics;
  draftMetrics: ColorMetrics;
};

type DistributionSummary = {
  count: number;
  averageLuminance: number;
  averageSaturation: number;
  averageLightness: number;
  dominantHue: number;
  hueBins: number[];
};

type ControlSpec = {
  key: keyof ColorTuningSettings;
  label: string;
  min: number;
  max: number;
  step: number;
};

type AnchorControlSpec = {
  key: 'x' | 'y' | 'z' | 'r' | 'g' | 'b';
  label: string;
  small: number;
  large: number;
  digits: number;
};

const SWATCH_LIMIT = 240;
const PREVIEW_LIMIT = 6;

const MAIN_CONTROL_SPECS: ControlSpec[] = [
  { key: 'luminanceMin', label: 'Luminance min', min: 0.02, max: 0.5, step: 0.01 },
  { key: 'luminanceMax', label: 'Luminance max', min: 0.4, max: 0.98, step: 0.01 },
  { key: 'saturationMin', label: 'Saturation min', min: 0, max: 90, step: 1 },
  { key: 'saturationMax', label: 'Saturation max', min: 10, max: 100, step: 1 },
  { key: 'smoothingRadius', label: 'Smoothing radius', min: 0.0005, max: 0.03, step: 0.0005 },
  { key: 'paletteSharpness', label: 'Palette sharpness', min: 0.8, max: 5.6, step: 0.05 },
  { key: 'huePhaseAmplitude', label: 'Hue phase amp', min: 0, max: 0.12, step: 0.002 },
  { key: 'lightnessSwing', label: 'Lightness swing', min: 0, max: 24, step: 0.25 },
  { key: 'chromaJitter', label: 'Chroma jitter', min: 0, max: 14, step: 0.25 },
];

const THREE_NOISE_SPECS: ControlSpec[] = [
  { key: 'smoothingRadius', label: 'Smoothing radius', min: 0.0005, max: 0.03, step: 0.0005 },
  { key: 'paletteSharpness', label: 'Palette sharpness', min: 0.8, max: 5.6, step: 0.05 },
  { key: 'huePhaseAmplitude', label: 'Hue phase amp', min: 0, max: 0.12, step: 0.002 },
  { key: 'lightnessSwing', label: 'Lightness swing', min: 0, max: 24, step: 0.25 },
  { key: 'chromaJitter', label: 'Chroma jitter', min: 0, max: 14, step: 0.25 },
];

const ANCHOR_CONTROL_SPECS: AnchorControlSpec[] = [
  { key: 'x', label: 'X', small: 0.02, large: 0.08, digits: 2 },
  { key: 'y', label: 'Y', small: 0.02, large: 0.08, digits: 2 },
  { key: 'z', label: 'Z', small: 0.02, large: 0.08, digits: 2 },
  { key: 'r', label: 'R', small: 4, large: 12, digits: 0 },
  { key: 'g', label: 'G', small: 4, large: 12, digits: 0 },
  { key: 'b', label: 'B', small: 4, large: 12, digits: 0 },
];

const SOURCE_LABELS: Record<ColorPresetSource, string> = {
  default: 'Default',
  localStorage: 'Local storage',
  publicFile: 'Public file',
  runtime: 'Runtime',
};

const OMNISCIENT_ZOOM_MIN = 1;
const OMNISCIENT_ZOOM_MAX = 4;
const OMNISCIENT_ZOOM_STEP = 0.25;
const OMNISCIENT_ROTATION_DEFAULT = {
  yaw: -0.86,
  pitch: -0.64,
  roll: -0.28,
};
const OMNISCIENT_DRAG_ROTATION_SPEED = 0.008;
const OMNISCIENT_PITCH_MIN = -1.45;
const OMNISCIENT_PITCH_MAX = 1.45;
const OMNISCIENT_YAW_DRAG_DIRECTION = -1;
const OMNISCIENT_PITCH_DRAG_DIRECTION = -1;

function hexToRgb(hex: string) {
  const normalized = hex.replace('#', '').trim();
  const value = normalized.length === 3
    ? normalized.split('').map((segment) => `${segment}${segment}`).join('')
    : normalized;

  if (!/^[0-9a-f]{6}$/i.test(value)) {
    return { r: 0, g: 0, b: 0 };
  }

  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

function rgbToHsl(rgb: { r: number; g: number; b: number }) {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let hue = 0;
  const lightness = (max + min) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));

  if (delta > 0) {
    if (max === r) {
      hue = ((g - b) / delta + (g < b ? 6 : 0)) * 60;
    } else if (max === g) {
      hue = ((b - r) / delta + 2) * 60;
    } else {
      hue = ((r - g) / delta + 4) * 60;
    }
  }

  return {
    hue,
    saturation: saturation * 100,
    lightness: lightness * 100,
  };
}

function relativeLuminance(rgb: { r: number; g: number; b: number }) {
  const toLinear = (value: number) => {
    const normalized = value / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * toLinear(rgb.r) + 0.7152 * toLinear(rgb.g) + 0.0722 * toLinear(rgb.b);
}

function measureColor(hex: string): ColorMetrics {
  const rgb = hexToRgb(hex);
  const hsl = rgbToHsl(rgb);
  return {
    hue: hsl.hue,
    saturation: hsl.saturation,
    lightness: hsl.lightness,
    luminance: relativeLuminance(rgb),
  };
}

function formatNumber(value: number, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : '0.00';
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function pickEvenly<T>(items: T[], limit: number) {
  if (items.length <= limit) return items;

  return Array.from({ length: limit }, (_, index) => {
    const targetIndex = Math.floor((index / limit) * items.length);
    return items[Math.min(items.length - 1, targetIndex)];
  });
}

function buildSummary(metrics: ColorMetrics[]): DistributionSummary {
  if (metrics.length === 0) {
    return {
      count: 0,
      averageLuminance: 0,
      averageSaturation: 0,
      averageLightness: 0,
      dominantHue: 0,
      hueBins: Array.from({ length: 12 }, () => 0),
    };
  }

  const hueBins = Array.from({ length: 12 }, () => 0);
  let totalLuminance = 0;
  let totalSaturation = 0;
  let totalLightness = 0;

  for (const entry of metrics) {
    const bin = Math.max(0, Math.min(11, Math.floor((entry.hue % 360) / 30)));
    hueBins[bin] += 1;
    totalLuminance += entry.luminance;
    totalSaturation += entry.saturation;
    totalLightness += entry.lightness;
  }

  let dominantHueIndex = 0;
  for (let index = 1; index < hueBins.length; index += 1) {
    if (hueBins[index] > hueBins[dominantHueIndex]) {
      dominantHueIndex = index;
    }
  }

  return {
    count: metrics.length,
    averageLuminance: totalLuminance / metrics.length,
    averageSaturation: totalSaturation / metrics.length,
    averageLightness: totalLightness / metrics.length,
    dominantHue: dominantHueIndex * 30,
    hueBins,
  };
}

function histogramGradient(index: number) {
  return `linear-gradient(180deg, hsl(${index * 30}, 92%, 66%), hsl(${index * 30 + 12}, 74%, 42%))`;
}

function HistogramPanel({
  title,
  tag,
  tone,
  summary,
}: {
  title: string;
  tag: string;
  tone: 'base' | 'tuned';
  summary: DistributionSummary;
}) {
  const peak = Math.max(...summary.hueBins, 1);

  return (
    <div className="compare-card">
      <div className="compare-title">
        <div>
          <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>{title}</div>
          <div className="panel-note">Hue density across sampled stars</div>
        </div>
        <div className={`compare-tag ${tone}`}>{tag}</div>
      </div>

      <div className="histogram">
        {summary.hueBins.map((value, index) => (
          <div
            key={`${title}-bin-${index}`}
            className="histogram-bar"
            style={{
              height: `${Math.max(8, (value / peak) * 100)}%`,
              background: histogramGradient(index),
            }}
            title={`${index * 30} deg: ${value}`}
          />
        ))}
      </div>

      <div className="histogram-labels">
        <span>0</span>
        <span>60</span>
        <span>120</span>
        <span>180</span>
        <span>240</span>
        <span>300</span>
      </div>

      <div className="summary-grid">
        <div className="summary-card">
          avg luminance
          <strong>{formatPercent(summary.averageLuminance * 100)}</strong>
        </div>
        <div className="summary-card">
          avg saturation
          <strong>{formatPercent(summary.averageSaturation)}</strong>
        </div>
        <div className="summary-card">
          dominant hue
          <strong>{summary.dominantHue} deg</strong>
        </div>
      </div>
    </div>
  );
}

function anchorSwatch(anchor: ColorAnchor) {
  return `rgb(${anchor.r}, ${anchor.g}, ${anchor.b})`;
}

export default function CustomPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('main');
  const [stars, setStars] = useState<StarRecord[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [appliedPreset, setAppliedPreset] = useState<ColorMappingPreset>(() => cloneColorMappingPreset(DEFAULT_COLOR_MAPPING_PRESET));
  const [draftPreset, setDraftPreset] = useState<ColorMappingPreset>(() => cloneColorMappingPreset(DEFAULT_COLOR_MAPPING_PRESET));
  const [presetSource, setPresetSource] = useState<ColorPresetSource>('default');
  const [selectedId, setSelectedId] = useState<number | string | null>(null);
  const [selectedAnchorId, setSelectedAnchorId] = useState<string>(DEFAULT_COLOR_MAPPING_PRESET.anchors[0].id);
  const [applyState, setApplyState] = useState<'idle' | 'applied' | 'failed'>('idle');
  const [omniscientZoom, setOmniscientZoom] = useState(OMNISCIENT_ZOOM_MIN);
  const [omniscientRotation, setOmniscientRotation] = useState(() => ({ ...OMNISCIENT_ROTATION_DEFAULT }));
  const [isMapDragging, setIsMapDragging] = useState(false);
  const mapDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startYaw: number;
    startPitch: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const starsUrl = `${import.meta.env.BASE_URL ?? '/'}stars.json`;

    Promise.all([
      ensureColorPresetLoaded(),
      fetch(starsUrl).then((response) => response.json()),
    ])
      .then(([detail, data]) => {
        if (cancelled) return;

        const normalizedPreset = cloneColorMappingPreset(detail.preset);
        const nextStars = Array.isArray(data)
          ? data
            .filter((entry) => typeof entry?.word === 'string')
            .map((entry, index) => ({
              id: typeof entry.id === 'number' || typeof entry.id === 'string' ? entry.id : index,
              word: entry.word,
              x: Number(entry.x) || 0,
              y: Number(entry.y) || 0,
              z: Number(entry.z) || 0,
            }))
          : [];

        setAppliedPreset(normalizedPreset);
        setDraftPreset(cloneColorMappingPreset(normalizedPreset));
        setPresetSource(detail.source);
        setStars(nextStars);
        setLoadError(null);
      })
      .catch((error) => {
        if (!cancelled) {
          console.error(error);
          setLoadError('Failed to load stars.json');
        }
      });

    const unsubscribe = subscribeToColorPreset((detail) => {
      if (cancelled) return;
      setAppliedPreset(cloneColorMappingPreset(detail.preset));
      setPresetSource(detail.source);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (draftPreset.anchors.length === 0) return;
    const exists = draftPreset.anchors.some((anchor) => anchor.id === selectedAnchorId);
    if (!exists) {
      setSelectedAnchorId(draftPreset.anchors[0].id);
    }
  }, [draftPreset.anchors, selectedAnchorId]);

  const analysis = useMemo(() => {
    const mapped: AnalyzedStar[] = stars.map((star) => {
      const params = SemanticMapper.mapCoordinatesToParams(star.x, star.y, star.z);
      const appliedColor = SemanticMapper.mapCoordinatesToColor(star.x, star.y, star.z, appliedPreset);
      const draftColor = SemanticMapper.mapCoordinatesToColor(star.x, star.y, star.z, draftPreset);

      return {
        ...star,
        params,
        appliedColor,
        draftColor,
        appliedMetrics: measureColor(appliedColor),
        draftMetrics: measureColor(draftColor),
      };
    });

    return {
      mapped,
      swatches: pickEvenly(mapped, SWATCH_LIMIT),
      previews: pickEvenly(mapped, PREVIEW_LIMIT),
      appliedSummary: buildSummary(mapped.map((entry) => entry.appliedMetrics)),
      draftSummary: buildSummary(mapped.map((entry) => entry.draftMetrics)),
    };
  }, [appliedPreset, draftPreset, stars]);

  useEffect(() => {
    if (analysis.swatches.length === 0) {
      setSelectedId(null);
      return;
    }

    const exists = analysis.mapped.some((entry) => entry.id === selectedId);
    if (!exists) {
      setSelectedId(analysis.swatches[0].id);
    }
  }, [analysis.mapped, analysis.swatches, selectedId]);

  const selectedEntry = analysis.mapped.find((entry) => entry.id === selectedId) ?? analysis.swatches[0] ?? null;
  const selectedAnchor = draftPreset.anchors.find((anchor) => anchor.id === selectedAnchorId) ?? draftPreset.anchors[0] ?? null;
  const appliedSignature = JSON.stringify(appliedPreset);
  const draftSignature = JSON.stringify(draftPreset);
  const hasPendingChanges = appliedSignature !== draftSignature;

  const updateDraftPreset = (recipe: (current: ColorMappingPreset) => ColorMappingPreset) => {
    setDraftPreset((current) => normalizeColorMappingPreset(recipe(cloneColorMappingPreset(current))));
    setApplyState('idle');
  };

  const updateTuning = (key: keyof ColorTuningSettings, value: number) => {
    updateDraftPreset((current) => ({
      ...current,
      tuning: {
        ...current.tuning,
        [key]: value,
      },
    }));
  };

  const nudgeAnchor = (anchorId: string, key: AnchorControlSpec['key'], delta: number) => {
    updateDraftPreset((current) => ({
      ...current,
      anchors: current.anchors.map((anchor) =>
        anchor.id === anchorId
          ? {
            ...anchor,
            [key]: Number(anchor[key]) + delta,
          }
          : anchor,
      ),
    }));
  };

  const resetToApplied = () => {
    setDraftPreset(cloneColorMappingPreset(appliedPreset));
    setApplyState('idle');
  };

  const loadDefaults = () => {
    setDraftPreset(cloneColorMappingPreset(DEFAULT_COLOR_MAPPING_PRESET));
    setApplyState('idle');
  };

  const handleApply = () => {
    try {
      const nextPreset = normalizeColorMappingPreset({
        ...draftPreset,
        updatedAt: new Date().toISOString(),
      });
      const detail = applyColorPreset(nextPreset, {
        persistToLocalStorage: true,
        source: 'localStorage',
      });
      downloadColorPresetFile(detail.preset, COLOR_PRESET_PUBLIC_FILENAME);
      setAppliedPreset(cloneColorMappingPreset(detail.preset));
      setDraftPreset(cloneColorMappingPreset(detail.preset));
      setPresetSource(detail.source);
      setApplyState('applied');
      window.setTimeout(() => setApplyState('idle'), 2200);
    } catch (error) {
      console.error(error);
      setApplyState('failed');
    }
  };

  const clampOmniscientZoom = (value: number) => Math.max(OMNISCIENT_ZOOM_MIN, Math.min(OMNISCIENT_ZOOM_MAX, value));
  const updateOmniscientZoom = (next: number) => {
    setOmniscientZoom(clampOmniscientZoom(Number(next.toFixed(2))));
  };
  const nudgeOmniscientZoom = (delta: number) => {
    updateOmniscientZoom(omniscientZoom + delta);
  };
  const handleMapPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button !== 0) {
      return;
    }

    mapDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startYaw: omniscientRotation.yaw,
      startPitch: omniscientRotation.pitch,
    };
    setIsMapDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const handleMapPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = mapDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    setOmniscientRotation({
      yaw: drag.startYaw + deltaX * OMNISCIENT_DRAG_ROTATION_SPEED * OMNISCIENT_YAW_DRAG_DIRECTION,
      pitch: clamp(
        drag.startPitch + deltaY * OMNISCIENT_DRAG_ROTATION_SPEED * OMNISCIENT_PITCH_DRAG_DIRECTION,
        OMNISCIENT_PITCH_MIN,
        OMNISCIENT_PITCH_MAX,
      ),
      roll: OMNISCIENT_ROTATION_DEFAULT.roll,
    });
  };
  const finishMapDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = mapDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    mapDragRef.current = null;
    setIsMapDragging(false);
  };

  const mapStarPoints = analysis.mapped.map((entry) => ({
    id: entry.id,
    x: entry.x,
    y: entry.y,
    z: entry.z,
    color: entry.draftColor,
    kind: 'star' as const,
    emphasis: false,
    size: 2.2,
    opacity: 0.82,
  }));

  const mapAnchorPoints = draftPreset.anchors.map((anchor) => ({
    id: anchor.id,
    x: anchor.x,
    y: anchor.y,
    z: anchor.z,
    color: anchorSwatch(anchor),
    normalized: true,
    kind: 'anchor' as const,
    emphasis: anchor.id === selectedAnchorId,
  }));

  const draftJson = JSON.stringify(draftPreset, null, 2);

  return (
    <main className="custom-page">
      <div className="custom-shell">
        <aside className="custom-sidebar">
          <section className="custom-panel">
            <div className="eyebrow">Developer page / custom</div>
            <h1 className="custom-title">Color Distribution Lab</h1>
            <p className="custom-copy">
              Main tab stays focused on distribution. The 3D tab exposes anchor positions, RGB edits, and noise controls
              against the same working preset.
            </p>

            <div className="tab-row">
              <button
                type="button"
                className={`tab-button${activeTab === 'main' ? ' is-active' : ''}`}
                onClick={() => setActiveTab('main')}
              >
                Main
              </button>
              <button
                type="button"
                className={`tab-button${activeTab === '3d' ? ' is-active' : ''}`}
                onClick={() => setActiveTab('3d')}
              >
                3D
              </button>
            </div>

            <div className="sidebar-stats">
              <div className="stat-card">
                <div className="stat-label">active source</div>
                <div className="stat-value">{SOURCE_LABELS[presetSource]}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">sampled stars</div>
                <div className="stat-value">{analysis.appliedSummary.count}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">anchors</div>
                <div className="stat-value">{draftPreset.anchors.length}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">status</div>
                <div className="stat-value">
                  {applyState === 'failed'
                    ? 'failed'
                    : hasPendingChanges
                      ? 'dirty'
                      : applyState === 'applied'
                        ? 'applied'
                        : 'synced'}
                </div>
              </div>
            </div>

            <div className="sidebar-actions">
              <button type="button" className="ghost-button" onClick={resetToApplied}>
                Reset to applied
              </button>
              <button type="button" className="solid-button" onClick={handleApply}>
                Apply + export
              </button>
            </div>

            <button type="button" className="link-button" onClick={loadDefaults}>
              Load defaults into draft
            </button>

            <div className="install-note">
              Apply writes localStorage, downloads <code>{COLOR_PRESET_PUBLIC_FILENAME}</code>, and the startup override
              file path is <code>{COLOR_PRESET_INSTALL_PATH}</code>.
            </div>

            <div className="settings-json">{draftJson}</div>
          </section>
        </aside>

        <section className="main-stack">
          {activeTab === 'main' && (
            <>
              <section className="custom-panel hero-panel">
                <div>
                  <div className="eyebrow">Distribution workbench</div>
                  <h2 className="hero-title">Actual stars, split swatches, immediate histogram drift.</h2>
                  <p className="hero-text">
                    Each square below uses the same star twice: left half is the currently applied preset, right half is
                    the draft preset. Apply is the only step that persists and exports.
                  </p>
                  <div className="hero-pills">
                    <div className="hero-pill">Source: /stars.json</div>
                    <div className="hero-pill">Comparison: applied vs draft</div>
                    <div className="hero-pill">Preset file: {COLOR_PRESET_PUBLIC_FILENAME}</div>
                  </div>
                </div>

                <div className="hero-meta">
                  <div className="meta-card">
                    <div className="meta-label">draft avg luminance</div>
                    <div className="meta-value">{formatPercent(analysis.draftSummary.averageLuminance * 100)}</div>
                  </div>
                  <div className="meta-card">
                    <div className="meta-label">draft avg saturation</div>
                    <div className="meta-value">{formatPercent(analysis.draftSummary.averageSaturation)}</div>
                  </div>
                  <div className="meta-card">
                    <div className="meta-label">dominant draft hue</div>
                    <div className="meta-value">{analysis.draftSummary.dominantHue} deg</div>
                  </div>
                </div>
              </section>

              <section className="custom-panel compare-grid">
                <HistogramPanel title="Applied preset" tag="current" tone="base" summary={analysis.appliedSummary} />
                <HistogramPanel title="Draft preset" tag="working copy" tone="tuned" summary={analysis.draftSummary} />
              </section>

              <section className="custom-panel control-surface">
                <div className="panel-head">
                  <div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>Distribution controls</div>
                    <div className="panel-note">These are the same draft values that the 3D tab will export.</div>
                  </div>
                </div>

                <div className="control-grid">
                  {MAIN_CONTROL_SPECS.map((control) => (
                    <label key={control.key} className="control-row">
                      <div className="control-head">
                        <span>{control.label}</span>
                        <span className="control-value">
                          {formatNumber(draftPreset.tuning[control.key], control.step < 1 ? 3 : 1)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={control.min}
                        max={control.max}
                        step={control.step}
                        value={draftPreset.tuning[control.key]}
                        onChange={(event) => updateTuning(control.key, Number(event.target.value))}
                      />
                    </label>
                  ))}
                </div>
              </section>

              <section className="custom-panel swatch-panel">
                <div className="panel-head">
                  <div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>Sample field</div>
                    <div className="panel-note">Left = applied, right = draft. Click any swatch to inspect a star.</div>
                  </div>
                  <div className="legend-text">
                    {loadError ?? `showing ${analysis.swatches.length} evenly-spaced samples`}
                  </div>
                </div>

                <div className="swatch-grid">
                  {analysis.swatches.map((entry) => (
                    <button
                      key={`swatch-${entry.id}`}
                      type="button"
                      className={`swatch${selectedEntry?.id === entry.id ? ' is-selected' : ''}`}
                      style={{
                        background: `linear-gradient(90deg, ${entry.appliedColor} 0 50%, ${entry.draftColor} 50% 100%)`,
                      }}
                      title={`${entry.word} | ${entry.appliedColor} -> ${entry.draftColor}`}
                      onClick={() => setSelectedId(entry.id)}
                    />
                  ))}
                </div>
              </section>

              {selectedEntry && (
                <section className="custom-panel preview-panel">
                  <div>
                    <div className="preview-compare">
                      <div className="flower-card">
                        <div className="compare-title">
                          <div style={{ fontWeight: 700 }}>Applied bloom</div>
                          <div className="compare-tag base">current</div>
                        </div>
                        <div className="flower-stage">
                          <FlowerPreview params={selectedEntry.params} color={selectedEntry.appliedColor} size={170} />
                        </div>
                        <div className="flower-meta">{selectedEntry.appliedColor}</div>
                      </div>

                      <div className="flower-card">
                        <div className="compare-title">
                          <div style={{ fontWeight: 700 }}>Draft bloom</div>
                          <div className="compare-tag tuned">draft</div>
                        </div>
                        <div className="flower-stage">
                          <FlowerPreview params={selectedEntry.params} color={selectedEntry.draftColor} size={170} />
                        </div>
                        <div className="flower-meta">{selectedEntry.draftColor}</div>
                      </div>
                    </div>

                    <div className="preview-strip">
                      {analysis.previews.map((entry) => (
                        <button
                          key={`preview-${entry.id}`}
                          type="button"
                          className="preview-chip"
                          onClick={() => setSelectedId(entry.id)}
                        >
                          <div className="flower-stage">
                            <FlowerPreview params={entry.params} color={entry.draftColor} size={120} />
                          </div>
                          <div className="preview-chip-label">{entry.word}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="inspector">
                    <h3 className="inspector-title">{selectedEntry.word}</h3>
                    <div className="panel-note">
                      The 3D tab uses the same draft preset that produced this color.
                    </div>

                    <div className="inspector-grid">
                      <div className="inspector-chip">x: {formatNumber(selectedEntry.x, 1)}</div>
                      <div className="inspector-chip">y: {formatNumber(selectedEntry.y, 1)}</div>
                      <div className="inspector-chip">z: {formatNumber(selectedEntry.z, 1)}</div>
                      <div className="inspector-chip">applied hue: {Math.round(selectedEntry.appliedMetrics.hue)} deg</div>
                      <div className="inspector-chip">draft hue: {Math.round(selectedEntry.draftMetrics.hue)} deg</div>
                      <div className="inspector-chip">applied sat: {formatPercent(selectedEntry.appliedMetrics.saturation)}</div>
                      <div className="inspector-chip">draft sat: {formatPercent(selectedEntry.draftMetrics.saturation)}</div>
                      <div className="inspector-chip">applied lum: {formatPercent(selectedEntry.appliedMetrics.luminance * 100)}</div>
                      <div className="inspector-chip">draft lum: {formatPercent(selectedEntry.draftMetrics.luminance * 100)}</div>
                      <div className="inspector-chip">shape m: {formatNumber(selectedEntry.params.m, 0)}</div>
                    </div>
                  </div>
                </section>
              )}
            </>
          )}

          {activeTab === '3d' && (
            <>
              <section className="custom-panel hero-panel">
                <div>
                  <div className="eyebrow">Anchor space editor</div>
                  <h2 className="hero-title">Move anchors, retint them, then export a startup preset.</h2>
                  <p className="hero-text">
                    The map uses the existing space HUD projection, but now it renders actual stars and the live draft
                    anchors from an omniscient viewpoint.
                  </p>
                  <div className="hero-pills">
                    <div className="hero-pill">Anchor edit: -- / - / + / ++</div>
                    <div className="hero-pill">Stars: draft colors</div>
                    <div className="hero-pill">Apply exports browser file</div>
                  </div>
                </div>

                <div className="hero-meta">
                  <div className="meta-card">
                    <div className="meta-label">selected anchor</div>
                    <div className="meta-value">{selectedAnchor?.label ?? '-'}</div>
                  </div>
                  <div className="meta-card">
                    <div className="meta-label">draft source after apply</div>
                    <div className="meta-value">local storage</div>
                  </div>
                  <div className="meta-card">
                    <div className="meta-label">install path</div>
                    <div className="meta-value">public file</div>
                  </div>
                </div>
              </section>

              <section className="custom-panel three-grid">
                <div className="map-stage">
                  <div className="panel-head">
                    <div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>Omniscient color space</div>
                      <div className="panel-note">Stars are colored with the draft preset. Anchors are the larger outlined points.</div>
                    </div>
                    <div className="zoom-panel">
                      <button type="button" className="zoom-button" onClick={() => nudgeOmniscientZoom(-OMNISCIENT_ZOOM_STEP)}>
                        -
                      </button>
                      <div className="zoom-readout">{formatNumber(omniscientZoom, 2)}x</div>
                      <button type="button" className="zoom-button" onClick={() => nudgeOmniscientZoom(OMNISCIENT_ZOOM_STEP)}>
                        +
                      </button>
                    </div>
                  </div>
                  <div
                    className={`map-shell${isMapDragging ? ' is-dragging' : ''}`}
                    onPointerDown={handleMapPointerDown}
                    onPointerMove={handleMapPointerMove}
                    onPointerUp={finishMapDrag}
                    onPointerCancel={finishMapDrag}
                    onLostPointerCapture={finishMapDrag}
                  >
                    <SpacePositionMap
                      position={{ x: 0, y: 0, z: 0 }}
                      velocity={{ x: 0, y: 0, z: 0 }}
                      size={540}
                      viewMode="omniscient"
                      zoom={omniscientZoom}
                      rotation={omniscientRotation}
                      showShip={false}
                      showSpawn={false}
                      starPoints={mapStarPoints}
                      anchorPoints={mapAnchorPoints}
                    />
                  </div>
                  <div className="zoom-slider-row">
                    <input
                      type="range"
                      min={OMNISCIENT_ZOOM_MIN}
                      max={OMNISCIENT_ZOOM_MAX}
                      step={OMNISCIENT_ZOOM_STEP}
                      value={omniscientZoom}
                      onChange={(event) => updateOmniscientZoom(Number(event.target.value))}
                    />
                    <div className="panel-note">1x is the widest view. Drag inside the map to orbit while keeping orthographic projection.</div>
                  </div>
                  <div className="map-legend">
                    <span className="legend-dot star" /> stars
                    <span className="legend-dot anchor" /> anchors
                  </div>
                </div>

                <div className="editor-stage">
                  <div className="anchor-stage">
                    <div className="panel-head">
                      <div>
                        <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>Anchor roster</div>
                        <div className="panel-note">Pick an anchor, then nudge x y z r g b in the inspector below.</div>
                      </div>
                    </div>

                    <div className="anchor-list">
                      {draftPreset.anchors.map((anchor) => (
                        <button
                          key={anchor.id}
                          type="button"
                          className={`anchor-card${anchor.id === selectedAnchorId ? ' is-selected' : ''}`}
                          onClick={() => setSelectedAnchorId(anchor.id)}
                        >
                          <span className="anchor-swatch" style={{ background: anchorSwatch(anchor) }} />
                          <span className="anchor-name">{anchor.label}</span>
                          <span className="anchor-coords">
                            {formatNumber(anchor.x, 2)}, {formatNumber(anchor.y, 2)}, {formatNumber(anchor.z, 2)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="noise-stage">
                    <div className="panel-head">
                      <div>
                        <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>Noise and phase controls</div>
                        <div className="panel-note">These are the draft-side procedural settings used by the 3D simulation.</div>
                      </div>
                    </div>

                    <div className="control-grid noise-grid">
                      {THREE_NOISE_SPECS.map((control) => (
                        <label key={control.key} className="control-row">
                          <div className="control-head">
                            <span>{control.label}</span>
                            <span className="control-value">
                              {formatNumber(draftPreset.tuning[control.key], control.step < 1 ? 3 : 1)}
                            </span>
                          </div>
                          <input
                            type="range"
                            min={control.min}
                            max={control.max}
                            step={control.step}
                            value={draftPreset.tuning[control.key]}
                            onChange={(event) => updateTuning(control.key, Number(event.target.value))}
                          />
                        </label>
                      ))}
                    </div>
                  </div>

                  {selectedAnchor && (
                    <div className="anchor-inspector editor-inspector">
                      <div className="anchor-inspector-head">
                        <div>
                          <div style={{ fontWeight: 700 }}>{selectedAnchor.label}</div>
                          <div className="panel-note">Use stepped buttons so edits stay coarse and intentional.</div>
                        </div>
                        <div className="anchor-badge" style={{ background: anchorSwatch(selectedAnchor) }} />
                      </div>

                      <div className="stepper-stack">
                        {ANCHOR_CONTROL_SPECS.map((control) => (
                          <div key={control.key} className="stepper-row">
                            <div className="stepper-label">{control.label}</div>
                            <div className="stepper-group">
                              <button type="button" className="stepper-button" onClick={() => nudgeAnchor(selectedAnchor.id, control.key, -control.large)}>
                                --
                              </button>
                              <button type="button" className="stepper-button" onClick={() => nudgeAnchor(selectedAnchor.id, control.key, -control.small)}>
                                -
                              </button>
                              <div className="stepper-value">
                                {formatNumber(Number(selectedAnchor[control.key]), control.digits)}
                              </div>
                              <button type="button" className="stepper-button" onClick={() => nudgeAnchor(selectedAnchor.id, control.key, control.small)}>
                                +
                              </button>
                              <button type="button" className="stepper-button" onClick={() => nudgeAnchor(selectedAnchor.id, control.key, control.large)}>
                                ++
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
