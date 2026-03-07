import { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import type { CSSProperties } from 'react';
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

type SeedState = { used: number; remaining: number; total: number };
type TelemetryState = {
  speed: number;
  position: { x: number; y: number; z: number };
  velocity?: { x: number; y: number; z: number };
  headingDeg?: number;
  pitchDeg?: number;
};

type SpacePageProps = {
  initialSeedLimit?: number;
  onSeedStateChange?: (state: SeedState) => void;
  onSeedCommit?: (entry: {
    id?: number | string;
    word: string;
    color: string;
    params: StarSelectionData['params'];
  }) => void;
  onPlantHoldState?: (state: SpacePlantHoldState) => void;
  onPlantHoldEvent?: (event: SpacePlantHoldEvent) => void;
  onAimChange?: (data: AimedStarData | null) => void;
  onPlantBlocked?: () => void;
  canPlant?: () => boolean;
};

const FIXED_START_SPEED = 12;
const FLOWER_RETENTION_HOURS = 8;
const FLOWER_RETENTION_MS = FLOWER_RETENTION_HOURS * 60 * 60 * 1000;
const FLOWER_SCREEN_CAPACITY_FOR_RETENTION = 15;
const SEED_INDICATOR_COUNT = 3;
const SEED_INDICATOR_Z_INDEX = 3001;
const normalizeSeedLimit = (value?: number) => {
  if (!Number.isFinite(value as number) || (value as number) <= 0) {
    return 3;
  }
  return Math.max(1, Math.floor(value as number));
};

const makeRandomPosition = () => ({
  x: Math.random() * CONFIG.GARDEN_WIDTH,
  y: Math.random() * CONFIG.GARDEN_HEIGHT,
});

const resolvePlantedAt = (flower: FlowerData, fallback: number) => {
  const plantedAt = Number(flower.plantedAt);
  if (Number.isFinite(plantedAt) && plantedAt > 0) return plantedAt;
  return Number.isFinite(flower.timestamp) ? flower.timestamp : fallback;
};

const removeAgedFlowersWhenOverCapacity = (flowers: FlowerData[], now: number) => {
  if (flowers.length < FLOWER_SCREEN_CAPACITY_FOR_RETENTION) return flowers;
  return flowers.filter((flower) => now - resolvePlantedAt(flower, now) < FLOWER_RETENTION_MS);
};
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

  const debugMode = false;
  const [telemetry, setTelemetry] = useState<TelemetryState>({
    speed: FIXED_START_SPEED,
    position: { x: 0, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: FIXED_START_SPEED },
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
  const plantedCommitGuardRef = useRef<Map<string, number>>(new Map());
  const toastSequenceRef = useRef(0);
  const PLANT_DUP_WINDOW_MS = 1200;
  const usedSeedsRef = useRef(0);
  const PLANT_LOCK_WINDOW_MS = 900;
  const globalPlantLockUntilRef = useRef(0);
  const committedWordGuardRef = useRef<Map<string, number>>(new Map());
  const COMMITTED_WORD_WINDOW_MS = 1200;

  const makePlantCommitKey = (data: StarSelectionData) =>
    data.id !== undefined
      ? `id:${String(data.id)}`
      : `word:${data.word}|${data.color}|m:${Math.round((data.params?.m ?? 0) * 1000)}`;

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
    usedSeedsRef.current = usedSeeds;
  }, [usedSeeds]);

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
    const now = Date.now();
    if (now < globalPlantLockUntilRef.current) return;
    if (usedSeedsRef.current >= seedLimit) return showSeedBlock();

    const wordGuardKey = `word:${data.word}`;
    const lastWordCommitAt = committedWordGuardRef.current.get(wordGuardKey) ?? 0;
    if (now - lastWordCommitAt < COMMITTED_WORD_WINDOW_MS) return;

    const commitKey = makePlantCommitKey(data);
    const lastCommitAt = plantedCommitGuardRef.current.get(commitKey) ?? 0;
    if (now - lastCommitAt < PLANT_DUP_WINDOW_MS) return;

    plantedCommitGuardRef.current.set(commitKey, now);
    committedWordGuardRef.current.set(wordGuardKey, now);
    for (const [key, timestamp] of plantedCommitGuardRef.current.entries()) {
      if (now - timestamp > PLANT_DUP_WINDOW_MS * 12) {
        plantedCommitGuardRef.current.delete(key);
      }
    }
    for (const [key, timestamp] of committedWordGuardRef.current.entries()) {
      if (now - timestamp > COMMITTED_WORD_WINDOW_MS * 12) {
        committedWordGuardRef.current.delete(key);
      }
    }

    if (!canPlantCurrent()) {
      showSeedBlock();
      return;
    }

    const { x, y } = makeRandomPosition();
    const nowAtPlant = Date.now();
    const existing = PersistenceService.load();
    const newFlower: FlowerData = {
      id: makeFlowerId(),
      x,
      y,
      color: data.color,
      params: data.params,
      word: data.word,
      timestamp: nowAtPlant,
      plantedAt: nowAtPlant,
      lifeSpanMs: Math.round(CONFIG.FLOWER_LIFESPAN_MS * (0.7 + 0.6 * Math.random())),
      witheringMs: Math.round(CONFIG.FLOWER_WITHERING_MS * (0.6 + 0.8 * Math.random())),
    };

    const merged = [...existing, newFlower];
    const nextFlowers = removeAgedFlowersWhenOverCapacity(merged, nowAtPlant);
    PersistenceService.save(nextFlowers);
    sessionStorage.setItem(SELECTED_STAR_SESSION_KEY, JSON.stringify(data));
    globalPlantLockUntilRef.current = now + PLANT_LOCK_WINDOW_MS;
    const nextUsedSeeds = usedSeedsRef.current + 1;
    usedSeedsRef.current = nextUsedSeeds;
    setUsedSeeds(nextUsedSeeds);

    const toastId = `${data.word}-${nextUsedSeeds}-${nowAtPlant}-${toastSequenceRef.current++}`;
    setToasts((currentToasts) => [...currentToasts, { id: toastId, word: data.word }]);
    const timerId = window.setTimeout(() => {
      setToasts((currentToasts) => currentToasts.filter((entry) => entry.id !== toastId));
      toastTimers.current.delete(toastId);
    }, 2800);
    toastTimers.current.set(toastId, timerId);

    onSeedCommit?.({
      id: data.id,
      word: data.word,
      color: data.color,
      params: data.params,
    });
  };

  const handleAimChange = (next: AimedStarData | null) => {
    onAimChange?.(next);
  };

  const handleTelemetryChange = (next: TelemetryState) => {
    setTelemetry(next);
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
  const showThrottle = showHud && perf.hudThrottleBar;
  const showPosition = showHud && perf.hudPositionPanel;
  const positionPanelScale = 2.5;
  const positionPanelMapSize = 170 * positionPanelScale;
  const spentIndicatorCount = Math.min(SEED_INDICATOR_COUNT, seedState.used);
  const hudPanelStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none' as const,
    opacity: Math.max(0.35, Math.min(1, perf.hudOpacity)),
    transform: `scale(${perf.hudScale})`,
    transformOrigin: '50% 50%',
  };
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
          onTelemetryChange={handleTelemetryChange}
          performance={perf}
          onPlantHold={handleHoldState}
          onPlantHoldEvent={handleHoldEvent}
          canPlant={canPlantCurrent}
        />
      </Canvas>

      <div
        style={hudPanelStyle}
      >
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

        {showHud && (
          <div
            style={{
              position: 'absolute',
              top: 20,
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              gap: 18,
              alignItems: 'center',
              justifyContent: 'center',
              // SpaceScene target HUD uses drei/Html zIndexRange up to 2000.
              zIndex: SEED_INDICATOR_Z_INDEX,
            }}
          >
            {Array.from({ length: SEED_INDICATOR_COUNT }, (_, index) => {
              const spent = index < spentIndicatorCount;
              return (
                <div
                  key={`seed-indicator-${index}`}
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    border: '2px solid rgba(255,255,255,0.96)',
                    background: spent ? 'transparent' : 'rgba(255,255,255,0.98)',
                    boxShadow: spent ? 'none' : '0 0 12px rgba(255,255,255,0.3)',
                  }}
                />
              );
            })}
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

        {showPosition && (
          <div
            style={{
              position: 'absolute',
              bottom: 20,
              right: 20,
              width: positionPanelMapSize,
              height: positionPanelMapSize,
              pointerEvents: 'none',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <SpacePositionMap
              position={telemetry.position}
              velocity={telemetry.velocity}
              size={positionPanelMapSize}
            />
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
              checked={perf.hudPositionPanel}
              onChange={(e) => updatePerf({ hudPositionPanel: e.target.checked })}
              style={{ marginRight: 6 }}
              disabled={!showHud}
            />
            Position panel
          </label>
          <label style={{ display: 'block', marginBottom: 6 }}>
            <input
              type="checkbox"
              checked={perf.hudHeadingCompass}
              onChange={(e) => updatePerf({ hudHeadingCompass: e.target.checked })}
              style={{ marginRight: 6 }}
              disabled={!showHud}
            />
            Compass
          </label>
          <label style={{ display: 'block', marginBottom: 6 }}>
            <input
              type="checkbox"
              checked={perf.hudTargetPanel}
              onChange={(e) => updatePerf({ hudTargetPanel: e.target.checked })}
              style={{ marginRight: 6 }}
              disabled={!showHud}
            />
            Target panel
          </label>
          <label style={{ display: 'block', marginBottom: 6 }}>
            <input
              type="checkbox"
              checked={perf.hudThrottleBar}
              onChange={(e) => updatePerf({ hudThrottleBar: e.target.checked })}
              style={{ marginRight: 6 }}
              disabled={!showHud}
            />
            Throttle bar
          </label>
          <label style={{ display: 'block', marginBottom: 6 }}>
            <input
              type="checkbox"
              checked={perf.hudCrosshair}
              onChange={(e) => updatePerf({ hudCrosshair: e.target.checked })}
              style={{ marginRight: 6 }}
              disabled={!showHud}
            />
            Crosshair
          </label>
          <label style={{ display: 'block', marginBottom: 6 }}>
            <input
              type="checkbox"
              checked={perf.hudSpeedometer}
              onChange={(e) => updatePerf({ hudSpeedometer: e.target.checked })}
              style={{ marginRight: 6 }}
              disabled={!showHud}
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
            HUD opacity ({perf.hudOpacity.toFixed(2)})
            <input
              type="range"
              min={0.35}
              max={1}
              step={0.01}
              value={perf.hudOpacity}
              onChange={(e) => updatePerf({ hudOpacity: Number(e.target.value) })}
              style={{ width: '100%' }}
            />
          </label>
          <label style={{ display: 'block', marginBottom: 8 }}>
            DPR min ({perf.dprMin.toFixed(2)})
            <input
              type="range"
              min={0.5}
              max={perf.dprMax}
              step={0.1}
              value={perf.dprMin}
              onChange={(e) => updatePerf({ dprMin: Number(e.target.value) })}
              style={{ width: '100%' }}
            />
          </label>
          <label style={{ display: 'block', marginBottom: 8 }}>
            DPR max ({perf.dprMax.toFixed(2)})
            <input
              type="range"
              min={perf.dprMin}
              max={2}
              step={0.1}
              value={perf.dprMax}
              onChange={(e) => updatePerf({ dprMax: Number(e.target.value) })}
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
            Background point size ({perf.backgroundPointSize.toFixed(1)})
            <input
              type="range"
              min={1}
              max={3.4}
              step={0.1}
              value={perf.backgroundPointSize}
              onChange={(e) => updatePerf({ backgroundPointSize: Number(e.target.value) })}
              style={{ width: '100%' }}
            />
          </label>
          <label style={{ display: 'block', marginBottom: 8 }}>
            Star geometry segments ({perf.starGeometrySegments})
            <input
              type="range"
              min={4}
              max={16}
              step={2}
              value={perf.starGeometrySegments}
              onChange={(e) => updatePerf({ starGeometrySegments: Number(e.target.value) })}
              style={{ width: '100%' }}
            />
          </label>
          <label style={{ display: 'block', marginBottom: 8 }}>
            Max visible labels ({perf.maxVisibleLabels})
            <input
              type="range"
              min={0}
              max={20}
              step={1}
              value={perf.maxVisibleLabels}
              onChange={(e) => updatePerf({ maxVisibleLabels: Number(e.target.value) })}
              style={{ width: '100%' }}
            />
          </label>
          <label style={{ display: 'block', marginBottom: 8 }}>
            Label update interval ({perf.labelUpdateIntervalMs}ms)
            <input
              type="range"
              min={24}
              max={220}
              step={1}
              value={perf.labelUpdateIntervalMs}
              onChange={(e) => updatePerf({ labelUpdateIntervalMs: Number(e.target.value) })}
              style={{ width: '100%' }}
            />
          </label>
          <label style={{ display: 'block', marginBottom: 8 }}>
            Label cone scale ({perf.labelConeScale.toFixed(2)})
            <input
              type="range"
              min={0.55}
              max={1.35}
              step={0.01}
              value={perf.labelConeScale}
              onChange={(e) => updatePerf({ labelConeScale: Number(e.target.value) })}
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
          <label style={{ display: 'block', marginBottom: 8 }}>
            ship quality ({perf.shipQuality.toFixed(2)})
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={perf.shipQuality}
              onChange={(e) => updatePerf({ shipQuality: Number(e.target.value) })}
              style={{ width: '100%' }}
            />
          </label>
          <label style={{ display: 'block', marginBottom: 8 }}>
            Grid density ({perf.gridDensity.toFixed(2)})
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={perf.gridDensity}
              onChange={(e) => updatePerf({ gridDensity: Number(e.target.value) })}
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
                  hudScale: 1,
                  hudOpacity: 0.95,
                  hudPositionPanel: true,
                  hudHeadingCompass: true,
                  hudTargetPanel: true,
                  hudThrottleBar: true,
                  hudRangeReadout: true,
                  backgroundStarDensity: 0.35,
                  backgroundPointSize: 1.2,
                  starGeometrySegments: 4,
                  maxVisibleLabels: 4,
                  labelUpdateIntervalMs: 120,
                  labelFontScale: 1,
                  labelFontMin: 10,
                  labelConeScale: 0.82,
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
