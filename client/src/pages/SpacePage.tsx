import { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { FlowerPreview } from '../components/FlowerPreview';
import { SpacePositionMap } from '../components/SpacePositionMap';
import {
  SpaceScene,
  type SpacePlantHoldEvent,
  type SpacePlantHoldState,
} from '../components/SpaceScene';
import { CONFIG } from '../config';
import { PersistenceService } from '../modules/PersistenceService';
import type { FlowerData } from '../modules/PersistenceService';
import type { StarSelectionData } from '../types';
import { SELECTED_STAR_SESSION_KEY } from '../types';
import {
  DEFAULT_SPACE_PERFORMANCE_SETTINGS,
  LABEL_FONT_MIN_MAX,
  loadSpacePerformanceSettings,
  normalizeSpacePerformanceSettings,
  saveSpacePerformanceSettings,
  type SpacePerformanceSettings,
} from '../modules/PerformanceSettings';
import '../App.css';

type AimedStarData = StarSelectionData & {
  distance?: number;
  headingOffsetDeg?: number;
  embedding?: number[];
};
type AimEmbeddingPalette = { value: number; color: string };

type SeedState = { used: number; remaining: number; total: number };

type SpacePageProps = {
  initialSeedLimit?: number;
  onSeedStateChange?: (state: SeedState) => void;
  onSeedCommit?: (entry: { word: string; color: string; params: StarSelectionData['params'] }) => void;
  onPlantHoldState?: (state: SpacePlantHoldState) => void;
  onPlantHoldEvent?: (event: SpacePlantHoldEvent) => void;
  onAimChange?: (data: AimedStarData | null) => void;
  onPlantBlocked?: () => void;
  canPlant?: () => boolean;
};

const formatCoord = (value: number) => value.toFixed(2);
const normalizeSeedLimit = (value?: number) => {
  if (!Number.isFinite(value as number) || (value as number) <= 0) {
    return 3;
  }
  return Math.max(1, Math.floor(value as number));
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const buildEmbeddingBars = (embedding?: number[] | null): AimEmbeddingPalette[] => {
  const source = embedding ?? [];
  return source.length === 0
    ? []
    : source.map((value, index) => {
    const sample = Number.isFinite(value) ? value : 0.5;
    const normalized = clamp01(sample);
    const hue = 110 + (index / source.length) * 20;
    const saturation = 28 + value * 60;
    const lightness = 14 + normalized * 56;
    return {
      value: normalized,
      color: `hsl(${hue}, ${saturation.toFixed(1)}%, ${lightness.toFixed(1)}%)`,
    };
  });
};

const makeRandomPosition = () => ({ x: Math.random() * CONFIG.GARDEN_SIZE, y: Math.random() * CONFIG.GARDEN_SIZE });
const makeFlowerId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? (crypto as Crypto).randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export default function SpacePage({
  initialSeedLimit,
  onSeedStateChange,
  onSeedCommit,
  onPlantHoldState,
  onPlantHoldEvent,
  onAimChange,
  onPlantBlocked,
  canPlant,
}: SpacePageProps) {
  const seedLimit = normalizeSeedLimit(initialSeedLimit);

  const [debugMode, setDebugMode] = useState(false);
  const [aimedStarData, setAimedStarData] = useState<AimedStarData | null>(null);
  const [telemetry, setTelemetry] = useState({
    speed: 0,
    position: { x: 0, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    headingDeg: 0,
    pitchDeg: 0,
  });
  const [usedSeeds, setUsedSeeds] = useState(0);
  const [toasts, setToasts] = useState<{ id: string; word: string }[]>([]);
  const [holdState, setHoldState] = useState<SpacePlantHoldState>({
    active: false,
    progress: 0,
    target: null,
  });
  const [perf, setPerf] = useState<SpacePerformanceSettings>(() => loadSpacePerformanceSettings());
  const [showPerfPanel, setShowPerfPanel] = useState(false);
  const [seedBlocked, setSeedBlocked] = useState(false);

  const toastTimers = useRef<Map<string, number>>(new Map());
  const seedBlockTimer = useRef<number | null>(null);

  const seedState: SeedState = {
    used: usedSeeds,
    remaining: Math.max(0, seedLimit - usedSeeds),
    total: seedLimit,
  };
  useEffect(() => {
    onSeedStateChange?.(seedState);
  }, [seedState.used, seedState.remaining, seedState.total, onSeedStateChange]);

  useEffect(() => {
    return () => {
      toastTimers.current.forEach((timerId) => window.clearTimeout(timerId));
      toastTimers.current.clear();
      if (seedBlockTimer.current) {
        window.clearTimeout(seedBlockTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    saveSpacePerformanceSettings(perf);
  }, [perf]);

  const canPlantCurrent = canPlant ?? (() => seedState.remaining > 0);

  const showSeedBlock = () => {
    setSeedBlocked(true);
    onPlantBlocked?.();
    if (seedBlockTimer.current) window.clearTimeout(seedBlockTimer.current);
    seedBlockTimer.current = window.setTimeout(() => {
      setSeedBlocked(false);
      seedBlockTimer.current = null;
    }, 1500);
  };

  const handleSelectStar = (data: StarSelectionData) => {
    if (!canPlantCurrent()) {
      showSeedBlock();
      return;
    }

    const { x, y } = makeRandomPosition();
    const now = Date.now();
    const existing = PersistenceService.load();
    const newFlower: FlowerData = {
      id: makeFlowerId(),
      x,
      y,
      color: data.color,
      params: data.params,
      word: data.word,
      timestamp: now,
      plantedAt: now,
      lifeSpanMs: Math.round(CONFIG.FLOWER_LIFESPAN_MS * (0.7 + 0.6 * Math.random())),
      witheringMs: Math.round(CONFIG.FLOWER_WITHERING_MS * (0.6 + 0.8 * Math.random())),
    };

    existing.push(newFlower);
    PersistenceService.save(existing);
    sessionStorage.setItem(SELECTED_STAR_SESSION_KEY, JSON.stringify(data));

    setUsedSeeds((current) => {
      const next = current + 1;
      const toastId = `${data.word}-${next}-${now}`;
      setToasts((currentToasts) => [...currentToasts, { id: toastId, word: data.word }]);
      const timerId = window.setTimeout(() => {
        setToasts((currentToasts) => currentToasts.filter((entry) => entry.id !== toastId));
      }, 2800);
      toastTimers.current.set(toastId, timerId);
      onSeedCommit?.({ word: data.word, color: data.color, params: data.params });
      return next;
    });
  };

  const handleAimChange = (next: AimedStarData | null) => {
    setAimedStarData(next);
    onAimChange?.(next);
  };

  const handleHoldState = (next: SpacePlantHoldState) => {
    setHoldState(next);
    onPlantHoldState?.(next);
  };

  const handleHoldEvent = (event: SpacePlantHoldEvent) => {
    onPlantHoldEvent?.(event);
  };

  const updatePerf = (next: Partial<SpacePerformanceSettings>) => {
    setPerf((prev) => normalizeSpacePerformanceSettings({ ...prev, ...next }));
  };

  const speedRatio = Math.max(0, Math.min(1, telemetry.speed / CONFIG.MAX_SPEED));
  const speedNeedleDeg = speedRatio * 180 - 90;
  const speedReadoutDeg = 180 - Math.round(speedRatio * 180);

  const showHud = perf.showHud;
  const showCrosshair = showHud && perf.hudCrosshair;
  const showSpeedometer = showHud && perf.hudSpeedometer;
  const showTargetPanel = showHud && perf.hudTargetPanel;
  const showRangeReadout = showHud && perf.hudRangeReadout;
  const showThrottle = showHud && perf.hudThrottleBar;
  const showPosition = showHud && perf.hudPositionPanel;
  const showCompass = showHud && perf.hudHeadingCompass;
  return (
    <div style={{ width: '100vw', height: '100vh', background: 'black' }}>
      <Canvas
        dpr={[perf.dprMin, perf.dprMax]}
        gl={{
          antialias: perf.antialias,
          powerPreference: perf.shipQuality >= 0.8 ? 'high-performance' : 'default',
          alpha: false,
        }}
      >
        <SpaceScene
          onSelectStar={handleSelectStar}
          debugMode={debugMode}
          onAimChange={handleAimChange}
          onTelemetryChange={setTelemetry}
          performance={perf}
          onPlantHold={handleHoldState}
          onPlantHoldEvent={handleHoldEvent}
          canPlant={canPlantCurrent}
        />
      </Canvas>

      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
        }}
      >
        {showHud && (
          <div style={{ position: 'absolute', top: 20, left: 20, color: 'white', fontSize: 12, lineHeight: 1.4 }}>
            <div>WASD/마우스: 항해 조작</div>
            <div>남은 심기: {seedState.remaining}/{seedState.total}</div>
          </div>
        )}

        {seedBlocked && (
          <div
            style={{
              position: 'absolute',
              top: 74,
              left: 20,
              color: '#ffe4a5',
              background: 'rgba(20, 26, 44, 0.82)',
              padding: '7px 10px',
              border: '1px solid rgba(255, 205, 120, 0.75)',
              borderRadius: 8,
              fontSize: 12,
            }}
          >
            심을 수 있는 여지가 없습니다.
          </div>
        )}

        {showCrosshair && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: 22,
              height: 22,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: 0,
                  bottom: 0,
                  width: 1,
                  background: 'rgba(255,255,255,0.6)',
                  transform: 'translateX(-50%)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: 0,
                  right: 0,
                  height: 1,
                  background: 'rgba(255,255,255,0.6)',
                  transform: 'translateY(-50%)',
                }}
              />
            </div>
          </div>
        )}

        {holdState.active && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              marginTop: 48,
              color: '#cde9ff',
              textAlign: 'center',
              pointerEvents: 'none',
              fontFamily: 'NanumGothicCustom, sans-serif',
            }}
          >
            <div style={{ width: 72, height: 72, margin: '0 auto 6px', display: 'grid', placeItems: 'center' }}>
              <svg width={72} height={72} viewBox="0 0 72 72" role="presentation">
                <circle cx={36} cy={36} r={29} stroke="rgba(255,255,255,0.2)" strokeWidth={2} fill="none" />
                <circle
                  cx={36}
                  cy={36}
                  r={29}
                  fill="none"
                  stroke="#8df1ff"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeDasharray={182}
                  strokeDashoffset={182 * (1 - holdState.progress)}
                  transform="rotate(-90 36 36)"
                />
              </svg>
            </div>
            <div style={{ fontSize: 12 }}>plant {Math.round(holdState.progress * 100)}%</div>
          </div>
        )}

        {showHud && (
          <>
            {showSpeedometer && (
              <div style={{ position: 'absolute', top: 20, right: 20, width: 170, color: 'white', pointerEvents: 'none' }}>
                <div
                  style={{
                    position: 'relative',
                    width: 150,
                    height: 80,
                    border: '2px solid rgba(255,255,255,0.6)',
                    borderBottom: 'none',
                    borderRadius: '150px 150px 0 0 / 80px 80px 0 0',
                    overflow: 'hidden',
                    background: 'rgba(0,0,0,0.35)',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      left: '50%',
                      bottom: 0,
                      width: 2,
                      height: 64,
                      transformOrigin: '50% 100%',
                      background: '#7fffbf',
                      transform: `translateX(-50%) rotate(${speedNeedleDeg}deg)`,
                      transition: 'transform 100ms linear',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      left: '50%',
                      bottom: -2,
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: '#7fffbf',
                      transform: 'translateX(-50%)',
                    }}
                  />
                  <div style={{ position: 'absolute', top: 6, left: 10, fontSize: 11, color: '#ddd' }}>180</div>
                  <div style={{ position: 'absolute', top: 6, right: 10, fontSize: 11, color: '#ddd' }}>0</div>
                </div>
                <div style={{ marginTop: 4, textAlign: 'center', fontSize: 12, color: '#ddd' }}>Speedometer {speedReadoutDeg}</div>
                <div style={{ textAlign: 'center', fontSize: 12, color: '#9bd7ff' }}>
                  {telemetry.speed.toFixed(2)} / {Math.round(CONFIG.MAX_SPEED)}
                </div>
                {showThrottle && (
                  <div style={{ marginTop: 6, padding: '0 12px' }}>
                    <div
                      style={{
                        width: '100%',
                        height: 6,
                        background: 'rgba(255,255,255,0.22)',
                        borderRadius: 999,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.round(speedRatio * 100)}%`,
                          height: '100%',
                          background: 'linear-gradient(90deg, #3ef3ff, #76f7b0)',
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div style={{ position: 'absolute', bottom: 20, left: 20, color: 'white', pointerEvents: 'none' }}>
              {toasts.map((toast) => (
                <div
                  key={toast.id}
                  style={{
                    minWidth: 220,
                    padding: '8px 10px',
                    border: '1px solid rgba(255,255,255,0.65)',
                    borderRadius: 8,
                    background: 'rgba(12, 20, 42, 0.75)',
                    fontSize: 12,
                    marginBottom: 6,
                    boxShadow: '0 0 12px rgba(0,0,0,0.35)',
                  }}
                >
                  planted: {toast.word}
                </div>
              ))}
            </div>
          </>
        )}

        {showTargetPanel && aimedStarData && (
          <div
            style={{
              position: 'absolute',
              left: 20,
              top: 96,
              ...CONFIG.PREVIEW,
              color: 'white',
              pointerEvents: 'none',
            }}
          >
            <div style={{ padding: '5px', textAlign: 'center', fontSize: 12 }}>{aimedStarData.word}</div>
            <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: '5px' }}>
              <FlowerPreview params={aimedStarData.params} color={aimedStarData.color} size={120} />
            </div>
            <div style={{ padding: '0 5px 6px' }}>
              <div style={{ marginBottom: 4, fontSize: 10, color: '#c6e3ff', opacity: 0.9 }}>임베딩 스펙트럼</div>
              <div
                style={{
                  display: 'grid',
                gridTemplateColumns: `repeat(${EMBEDDING_PALETTE_SEGMENTS}, minmax(0, 1fr))`,
                gridTemplateColumns: `repeat(${Math.max(1, buildEmbeddingBars(aimedStarData.embedding).length)}, minmax(0, 1fr))`,
                  gap: 2,
                  height: 12,
                  alignItems: 'stretch',
                }}
              >
                {buildEmbeddingBars(aimedStarData.embedding).map((segment, segmentIndex) => (
                  <div
                    key={`${aimedStarData.word}-${segmentIndex}`}
                    style={{
                      height: 12,
                      background: segment.color,
                      opacity: 0.55 + segment.value * 0.45,
                      borderRadius: 2,
                      boxShadow: `inset 0 0 0 1px rgba(255,255,255,${0.18 + segment.value * 0.4})`,
                    }}
                    title={`embedding ${segmentIndex + 1}: ${segment.value.toFixed(3)}`}
                  />
                ))}
              </div>
            </div>
            {showRangeReadout && aimedStarData.distance !== undefined && (
              <div style={{ padding: '4px 8px', fontSize: 12, borderTop: '1px solid rgba(255,255,255,0.22)' }}>
                distance: {aimedStarData.distance.toFixed(2)}
              </div>
            )}
          </div>
        )}

        {showPosition && (
          <div
            style={{
              position: 'absolute',
              bottom: 20,
              right: 20,
              width: 190,
              color: 'white',
              pointerEvents: 'none',
              ...CONFIG.PREVIEW,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: 8 }}>
              <div>
                <div>X: {formatCoord(telemetry.position.x)}</div>
                <div>Y: {formatCoord(telemetry.position.y)}</div>
                <div>Z: {formatCoord(telemetry.position.z)}</div>
              </div>
            </div>
            <SpacePositionMap position={telemetry.position} velocity={telemetry.velocity} size={170} />
          </div>
        )}

        {showCompass && (
          <div
            style={{
              position: 'absolute',
              top: 20,
              left: 20,
              width: 170,
              pointerEvents: 'none',
              color: '#d8f6ff',
              fontSize: 11,
              lineHeight: 1.4,
              zIndex: 5,
            }}
          >
            <div>HDG {telemetry.headingDeg.toFixed(1)} deg</div>
            <div>PIT {telemetry.pitchDeg.toFixed(1)} deg</div>
          </div>
        )}
      </div>

      <button
        onClick={() => setShowPerfPanel((prev) => !prev)}
        style={{
          position: 'fixed',
          left: 14,
          bottom: 14,
          width: 46,
          height: 46,
          borderRadius: 16,
          border: '1px solid rgba(255,255,255,0.45)',
          background: 'rgba(0,0,0,0.32)',
          color: 'white',
          backdropFilter: 'blur(6px)',
          zIndex: 30,
          cursor: 'pointer',
          pointerEvents: 'auto',
        }}
      >
        OPT
      </button>

      {showPerfPanel && (
        <div
          style={{
            position: 'fixed',
            left: 14,
            bottom: 72,
            width: 280,
            maxWidth: '86vw',
            padding: '12px',
            background: 'rgba(0, 0, 0, 0.72)',
            border: '1px solid rgba(255,255,255,0.35)',
            borderRadius: 12,
            color: 'white',
            zIndex: 29,
            backdropFilter: 'blur(8px)',
            boxSizing: 'border-box',
            maxHeight: '75vh',
            overflow: 'auto',
          }}
        >
          <div style={{ marginBottom: 10, fontWeight: 700 }}>Performance Tuning</div>
          <label style={{ display: 'block', marginBottom: 6 }}>
            <input
              type="checkbox"
              checked={perf.showHud}
              onChange={(e) => updatePerf({ showHud: e.target.checked })}
              style={{ marginRight: 6 }}
            />
            Show HUD
          </label>
          <label style={{ display: 'block', marginBottom: 6 }}>
            <input
              type="checkbox"
              checked={perf.hudCrosshair}
              onChange={(e) => updatePerf({ hudCrosshair: e.target.checked })}
              style={{ marginRight: 6 }}
            />
            Crosshair
          </label>
          <label style={{ display: 'block', marginBottom: 6 }}>
            <input
              type="checkbox"
              checked={perf.hudSpeedometer}
              onChange={(e) => updatePerf({ hudSpeedometer: e.target.checked })}
              style={{ marginRight: 6 }}
            />
            Speedometer
          </label>
          <label style={{ display: 'block', marginBottom: 8 }}>
            HUD scale ({perf.hudScale.toFixed(2)})
            <input
              type="range"
              min={0.6}
              max={1.4}
              step={0.05}
              value={perf.hudScale}
              onChange={(e) => updatePerf({ hudScale: Number(e.target.value) })}
              style={{ width: '100%' }}
            />
          </label>
          <label style={{ display: 'block', marginBottom: 8 }}>
            Antialias
            <input
              type="checkbox"
              checked={perf.antialias}
              onChange={(e) => updatePerf({ antialias: e.target.checked })}
              style={{ marginLeft: 8 }}
            />
          </label>
          <label style={{ display: 'block', marginBottom: 8 }}>
            Background stars ({Math.round(perf.backgroundStarDensity * 100)}%)
            <input
              type="range"
              min={20}
              max={100}
              step={5}
              value={Math.round(perf.backgroundStarDensity * 100)}
              onChange={(e) => updatePerf({ backgroundStarDensity: Number(e.target.value) / 100 })}
              style={{ width: '100%' }}
            />
          </label>
          <label style={{ display: 'block', marginBottom: 8 }}>
            label sample step ({perf.aimSampleStep})
            <input
              type="range"
              min={1}
              max={8}
              step={1}
              value={perf.aimSampleStep}
              onChange={(e) => updatePerf({ aimSampleStep: Number(e.target.value) })}
              style={{ width: '100%' }}
            />
          </label>
          <label style={{ display: 'block', marginBottom: 8 }}>
            label font scale ({perf.labelFontScale.toFixed(2)})
            <input
              type="range"
              min={0.5}
              max={30}
              step={0.01}
              value={perf.labelFontScale}
              onChange={(e) => updatePerf({ labelFontScale: Number(e.target.value) })}
              style={{ width: '100%' }}
            />
          </label>
          <label style={{ display: 'block', marginBottom: 8 }}>
            label min size ({perf.labelFontMin}px)
            <input
              type="range"
              min={1}
              max={LABEL_FONT_MIN_MAX}
              step={1}
              value={perf.labelFontMin}
              onChange={(e) => updatePerf({ labelFontMin: Number(e.target.value) })}
              style={{ width: '100%' }}
            />
          </label>
          <label style={{ display: 'block', marginBottom: 8 }}>
            launch trail ({perf.launchTrailLimit})
            <input
              type="range"
              min={0}
              max={10}
              step={1}
              value={perf.launchTrailLimit}
              onChange={(e) => updatePerf({ launchTrailLimit: Number(e.target.value) })}
              style={{ width: '100%' }}
            />
          </label>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              onClick={() => setPerf(DEFAULT_SPACE_PERFORMANCE_SETTINGS)}
              style={{ padding: '6px 8px', fontSize: 12 }}
            >
              Reset
            </button>
            <button
              onClick={() =>
                updatePerf({
                  dprMin: 0.7,
                  dprMax: 1.1,
                  backgroundStarDensity: 0.35,
                  backgroundPointSize: 1.2,
                  starGeometrySegments: 4,
                  maxVisibleLabels: 4,
                  labelFontScale: 1,
                  labelFontMin: 10,
                  shipScale: 1,
                  launchTrailLimit: 2,
                  shipQuality: 0,
                  gridDensity: 0.2,
                  antialias: false,
                  aimSampleStep: 3,
                })
              }
              style={{ padding: '6px 8px', fontSize: 12 }}
            >
              Low power preset
            </button>
          </div>
        </div>
      )}
    </div>
  );
}




