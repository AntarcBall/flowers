import { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { SpaceScene } from './components/SpaceScene';
import { GardenScene } from './components/GardenScene';
import { FlowerPreview } from './components/FlowerPreview';
import { SpacePositionMap } from './components/SpacePositionMap';
import { CONFIG } from './config';
import {
  DEFAULT_SPACE_PERFORMANCE_SETTINGS,
  loadSpacePerformanceSettings,
  normalizeSpacePerformanceSettings,
  saveSpacePerformanceSettings,
  type SpacePerformanceSettings,
} from './modules/PerformanceSettings';
import './App.css';

type Telemetry = {
  speed: number;
  position: { x: number; y: number; z: number };
  velocity?: {
    x: number;
    y: number;
    z: number;
  };
  headingDeg?: number;
  pitchDeg?: number;
};

type AimedStarHudData = {
  word: string;
  color: string;
  params: any;
  distance?: number;
  headingOffsetDeg?: number;
  id?: number;
};

function App() {
  const [view, setView] = useState<'SPACE' | 'GARDEN'>('SPACE');
  const [debugMode, setDebugMode] = useState(false);
  const [aimedStarData, setAimedStarData] = useState<AimedStarHudData | null>(null);
  const [telemetry, setTelemetry] = useState<Telemetry>({
    speed: 0,
    position: { x: 0, y: 0, z: 0 },
    headingDeg: 0,
    pitchDeg: 0,
  });
  const [performanceSettings, setPerformanceSettings] = useState<SpacePerformanceSettings>(() =>
    loadSpacePerformanceSettings(),
  );
  const [showPerfPanel, setShowPerfPanel] = useState(false);

  const formatCoordinate = (value: number) => {
    const trunc = Math.trunc(value * 100) / 100;
    return trunc.toFixed(2);
  };

  const formatHeading = (value?: number) => {
    if (typeof value !== 'number' || Number.isNaN(value)) return '000°';
    return `${Math.round(((value % 360) + 360) % 360).toString().padStart(3, '0')}°`;
  };

  const handleSelectStar = () => {
    setView('GARDEN');
  };

  const handleBack = () => {
    setView('SPACE');
  };

  const updatePerformance = (next: Partial<SpacePerformanceSettings>) => {
    setPerformanceSettings((prev) => normalizeSpacePerformanceSettings({ ...prev, ...next }));
  };

  useEffect(() => {
    saveSpacePerformanceSettings(performanceSettings);
  }, [performanceSettings]);

  return (
    <div style={{ width: '100vw', height: '100vh', background: 'black' }}>
      <Canvas
        dpr={[performanceSettings.dprMin, performanceSettings.dprMax]}
        gl={{
          antialias: performanceSettings.antialias,
          powerPreference: performanceSettings.shipQuality >= 0.8 ? 'high-performance' : 'default',
          alpha: false,
        }}
      >
        {view === 'SPACE' ? (
          <SpaceScene
            onSelectStar={handleSelectStar}
            debugMode={debugMode}
            onAimChange={setAimedStarData}
            onTelemetryChange={setTelemetry}
            performance={performanceSettings}
          />
        ) : (
          <GardenScene />
        )}
      </Canvas>

      {view === 'GARDEN' && (
        <div style={{ position: 'absolute', top: 20, left: 20, color: 'white', pointerEvents: 'none' }}>
          <button style={{ pointerEvents: 'auto' }} onClick={handleBack}>
            Back to Space
          </button>
          <p>Garden is synchronized from star-selection events in Space.</p>
          <p>Garden controls are intentionally read-only.</p>
        </div>
      )}

      {view === 'SPACE' && (
        <>
          {performanceSettings.showHud && performanceSettings.hudCrosshair && (
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                pointerEvents: 'none',
                transform: `translate(-50%, -50%) scale(${performanceSettings.hudScale.toFixed(2)})`,
                opacity: performanceSettings.hudOpacity,
                color: '#d7ecff',
                zIndex: 4,
              }}
            >
              <div
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: '50%',
                  border: '1px solid rgba(215, 236, 255, 0.6)',
                  position: 'relative',
                  boxShadow: '0 0 14px rgba(120, 190, 255, 0.35)',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    width: 2,
                    height: 2,
                    background: '#dff9ff',
                    transform: 'translate(-50%, -50%)',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: 0,
                    width: 1,
                    height: 56,
                    background: 'rgba(223, 249, 255, 0.75)',
                    transform: 'translateX(-50%)',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: '50%',
                    width: 56,
                    height: 1,
                    background: 'rgba(223, 249, 255, 0.75)',
                    transform: 'translateY(-50%)',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    right: 14,
                    top: 20,
                    width: 0,
                    height: 0,
                    borderTop: '6px solid transparent',
                    borderBottom: '6px solid transparent',
                    borderLeft: '10px solid rgba(223, 249, 255, 0.62)',
                  }}
                />
              </div>
            </div>
          )}

          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 2 }}>
            <div style={{ position: 'absolute', top: 20, left: 20, color: 'white' }}>
              <p>W/S(Inverted) + A/D to Rotate, Q/E to Speed up/down.</p>
              <p>Aim at a star and Click to select.</p>
            </div>

            {performanceSettings.showHud && performanceSettings.hudHeadingCompass && (
              <div
                style={{
                  position: 'absolute',
                  top: 16,
                  right: 16,
                  color: 'white',
                  width: 190,
                  opacity: performanceSettings.hudOpacity,
                  transform: `scale(${performanceSettings.hudScale})`,
                  transformOrigin: 'top right',
                  pointerEvents: 'none',
                }}
              >
                <div
                  style={{
                    ...(CONFIG.PREVIEW as any),
                    marginBottom: 8,
                    height: 84,
                    color: 'white',
                    padding: 8,
                    boxSizing: 'border-box',
                    position: 'relative',
                  }}
                >
                  <div style={{ textAlign: 'center', fontSize: 12, marginBottom: 3 }}>Heading</div>
                  <div
                    style={{
                      position: 'relative',
                      width: '100%',
                      height: 52,
                      background: 'linear-gradient(90deg, rgba(28, 39, 73, 0.65), rgba(8, 12, 23, 0.85))',
                      borderRadius: 6,
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        left: '50%',
                        top: 0,
                        width: 1,
                        height: 52,
                        background: 'rgba(255,255,255,0.35)',
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        left: '50%',
                        top: 6,
                        width: 0,
                        height: 0,
                        borderLeft: '8px solid transparent',
                        borderRight: '8px solid transparent',
                        borderBottom: '12px solid #ffd166',
                        transform: `translateX(-50%) rotate(${telemetry.headingDeg ?? 0}deg)`,
                        transformOrigin: '50% 100%',
                      }}
                    />
                    <div style={{ position: 'absolute', top: 36, left: 8, fontSize: 11, color: '#eee' }}>
                      {formatHeading(telemetry.headingDeg)}
                    </div>
                    <div style={{ position: 'absolute', top: 36, right: 8, fontSize: 11, color: '#eee' }}>
                      {typeof telemetry.pitchDeg === 'number' ? `${Math.round(telemetry.pitchDeg)}°` : '0°'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div
              style={{
                position: 'absolute',
                bottom: 22,
                left: 20,
                right: 20,
                pointerEvents: 'auto',
                display: 'flex',
                justifyContent: 'space-between',
                gap: 14,
                alignItems: 'flex-end',
                opacity: performanceSettings.showHud ? performanceSettings.hudOpacity : 1,
                transform: `scale(${performanceSettings.hudScale})`,
                transformOrigin: 'left bottom',
              }}
            >
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                <button
                  style={{ pointerEvents: 'auto' }}
                  onClick={() => setDebugMode((prev) => !prev)}
                >
                  Debug Cone: {debugMode ? 'ON' : 'OFF'}
                </button>

                {performanceSettings.showHud && performanceSettings.hudSpeedometer && (
                  <div
                    style={{
                      ...(CONFIG.PREVIEW as any),
                      width: 220,
                      height: 190,
                      color: 'white',
                      padding: '8px 10px',
                      boxSizing: 'border-box',
                    }}
                  >
                    <div style={{ fontSize: 12, textAlign: 'center', marginBottom: 4 }}>Speedometer</div>
                    <div style={{ position: 'relative', width: '100%', height: 112, overflow: 'hidden' }}>
                      <div
                        style={{
                          position: 'absolute',
                          left: '50%',
                          bottom: 0,
                          width: 150,
                          height: 150,
                          transform: 'translateX(-50%)',
                          border: '2px solid #9a9a9a',
                          borderRadius: '150px 150px 0 0',
                          borderBottom: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          left: '50%',
                          bottom: 0,
                          width: 3,
                          height: 68,
                          background: '#ffd166',
                          transform: `translateX(-50%) rotate(${(-120 + (Math.min(telemetry.speed / CONFIG.MAX_SPEED, 1) * 240)).toFixed(1)}deg)`,
                          transformOrigin: '50% 100%',
                          borderRadius: 2,
                        }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          left: '50%',
                          bottom: -3,
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          background: '#ffd166',
                          transform: 'translateX(-50%)',
                        }}
                      />
                    </div>
                    <div style={{ fontSize: 12, textAlign: 'center', marginTop: -4 }}>
                      {telemetry.speed.toFixed(1)} / {Math.round(CONFIG.MAX_SPEED)}
                    </div>
                  </div>
                )}

                {performanceSettings.showHud && performanceSettings.hudThrottleBar && (
                  <div
                    style={{
                      ...(CONFIG.PREVIEW as any),
                      width: 70,
                      height: 120,
                      color: 'white',
                      padding: '8px 10px',
                      boxSizing: 'border-box',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'flex-end',
                    }}
                  >
                    <div style={{ fontSize: 10, textAlign: 'center', marginBottom: 4 }}>Throttle</div>
                    <div
                      style={{
                        height: 82,
                        border: '1px solid rgba(255,255,255,0.4)',
                        borderRadius: 6,
                        position: 'relative',
                        overflow: 'hidden',
                        background: 'rgba(255,255,255,0.06)',
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          left: 0,
                          bottom: 0,
                          width: '100%',
                          height: `${Math.round(Math.min(1, telemetry.speed / CONFIG.MAX_SPEED) * 100)}%`,
                          background: 'linear-gradient(0deg, rgba(126, 227, 255, 0.85), rgba(255, 214, 102, 0.85))',
                        }}
                      />
                    </div>
                  </div>
                )}

                {performanceSettings.showHud && performanceSettings.hudRangeReadout && aimedStarData && (
                  <div
                    style={{
                      ...(CONFIG.PREVIEW as any),
                      width: 190,
                      height: 126,
                      color: 'white',
                      padding: '8px 10px',
                      boxSizing: 'border-box',
                    }}
                  >
                    <div style={{ textAlign: 'center', marginBottom: 4, fontSize: 12 }}>Target Readout</div>
                    <div style={{ fontSize: 12, fontFamily: 'monospace', lineHeight: 1.45 }}>
                      <div>{aimedStarData.word}</div>
                      <div>
                        distance:{' '}
                        {typeof aimedStarData.distance === 'number'
                          ? `${Math.round(aimedStarData.distance)}`
                          : 'N/A'}
                      </div>
                      <div>bearing: {formatHeading(aimedStarData.headingOffsetDeg)}</div>
                    </div>
                  </div>
                )}
              </div>

              {performanceSettings.showHud && performanceSettings.hudTargetPanel && aimedStarData && (
                <div style={CONFIG.PREVIEW as any}>
                  <div style={{ padding: '5px', textAlign: 'center', color: 'white', fontSize: '12px' }}>
                    {aimedStarData.word}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: '5px' }}>
                    <FlowerPreview params={aimedStarData.params} color={aimedStarData.color} size={120} />
                  </div>
                </div>
              )}

              {performanceSettings.showHud && performanceSettings.hudPositionPanel && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    color: 'white',
                  }}
                >
                  <div
                    style={{
                      ...(CONFIG.PREVIEW as any),
                      width: 190,
                      height: 190,
                      padding: '8px 10px',
                      boxSizing: 'border-box',
                    }}
                  >
                    <div style={{ fontSize: 12, textAlign: 'center', marginBottom: 6 }}>Current Position</div>
                    <div style={{ fontFamily: 'monospace', fontSize: 12, lineHeight: 1.5 }}>
                      <div>X: {formatCoordinate(telemetry.position.x)}</div>
                      <div>Y: {formatCoordinate(telemetry.position.y)}</div>
                      <div>Z: {formatCoordinate(telemetry.position.z)}</div>
                      <div>H: {formatHeading(telemetry.headingDeg)}</div>
                      <div>P: {typeof telemetry.pitchDeg === 'number' ? `${Math.round(telemetry.pitchDeg)}°` : '0°'}</div>
                    </div>
                  </div>
                  <SpacePositionMap position={telemetry.position} velocity={telemetry.velocity} size={190} />
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {view === 'SPACE' && (
        <>
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
                width: 300,
                maxWidth: '86vw',
                padding: '12px',
                background: 'rgba(0, 0, 0, 0.72)',
                border: '1px solid rgba(255,255,255,0.35)',
                borderRadius: 12,
                color: 'white',
                zIndex: 29,
                backdropFilter: 'blur(8px)',
                boxSizing: 'border-box',
              }}
            >
              <div style={{ marginBottom: 10, fontWeight: 700 }}>Performance Tuning</div>

              <details style={{ marginBottom: 10 }}>
                <summary style={{ cursor: 'pointer' }}>HUD</summary>
                <div style={{ marginTop: 10 }}>
                  <label style={{ display: 'block', marginBottom: 8 }}>
                    <input
                      type="checkbox"
                      checked={performanceSettings.showHud}
                      onChange={(e) => updatePerformance({ showHud: e.target.checked })}
                      style={{ marginRight: 6 }}
                    />
                    Show HUD
                  </label>
                  <label style={{ display: 'block', marginBottom: 8 }}>
                    <input
                      type="checkbox"
                      checked={performanceSettings.hudCrosshair}
                      onChange={(e) => updatePerformance({ hudCrosshair: e.target.checked })}
                      style={{ marginRight: 6 }}
                    />
                    Crosshair
                  </label>
                  <label style={{ display: 'block', marginBottom: 8 }}>
                    <input
                      type="checkbox"
                      checked={performanceSettings.hudSpeedometer}
                      onChange={(e) => updatePerformance({ hudSpeedometer: e.target.checked })}
                      style={{ marginRight: 6 }}
                    />
                    Speedometer
                  </label>
                  <label style={{ display: 'block', marginBottom: 8 }}>
                    <input
                      type="checkbox"
                      checked={performanceSettings.hudThrottleBar}
                      onChange={(e) => updatePerformance({ hudThrottleBar: e.target.checked })}
                      style={{ marginRight: 6 }}
                    />
                    Throttle Bar
                  </label>
                  <label style={{ display: 'block', marginBottom: 8 }}>
                    <input
                      type="checkbox"
                      checked={performanceSettings.hudPositionPanel}
                      onChange={(e) => updatePerformance({ hudPositionPanel: e.target.checked })}
                      style={{ marginRight: 6 }}
                    />
                    Position Panel
                  </label>
                  <label style={{ display: 'block', marginBottom: 8 }}>
                    <input
                      type="checkbox"
                      checked={performanceSettings.hudHeadingCompass}
                      onChange={(e) => updatePerformance({ hudHeadingCompass: e.target.checked })}
                      style={{ marginRight: 6 }}
                    />
                    Heading Compass
                  </label>
                  <label style={{ display: 'block', marginBottom: 8 }}>
                    <input
                      type="checkbox"
                      checked={performanceSettings.hudTargetPanel}
                      onChange={(e) => updatePerformance({ hudTargetPanel: e.target.checked })}
                      style={{ marginRight: 6 }}
                    />
                    Target Panel
                  </label>
                  <label style={{ display: 'block', marginBottom: 8 }}>
                    <input
                      type="checkbox"
                      checked={performanceSettings.hudRangeReadout}
                      onChange={(e) => updatePerformance({ hudRangeReadout: e.target.checked })}
                      style={{ marginRight: 6 }}
                    />
                    Target Readout
                  </label>
                  <label style={{ display: 'block', marginBottom: 10 }}>
                    HUD scale ({performanceSettings.hudScale.toFixed(2)})
                    <input
                      type="range"
                      min={0.6}
                      max={1.4}
                      step={0.05}
                      value={performanceSettings.hudScale}
                      onChange={(e) => updatePerformance({ hudScale: Number(e.target.value) })}
                      style={{ width: '100%' }}
                    />
                  </label>
                  <label style={{ display: 'block', marginBottom: 10 }}>
                    HUD opacity ({Math.round(performanceSettings.hudOpacity * 100)}%)
                    <input
                      type="range"
                      min={35}
                      max={100}
                      step={1}
                      value={Math.round(performanceSettings.hudOpacity * 100)}
                      onChange={(e) => updatePerformance({ hudOpacity: Number(e.target.value) / 100 })}
                      style={{ width: '100%' }}
                    />
                  </label>
                </div>
              </details>

              <details style={{ marginBottom: 10 }}>
                <summary style={{ cursor: 'pointer' }}>Labels</summary>
                <div style={{ marginTop: 10 }}>
                  <label style={{ display: 'block', marginBottom: 8 }}>
                    Max labels ({performanceSettings.maxVisibleLabels})
                    <input
                      type="range"
                      min={2}
                      max={20}
                      step={1}
                      value={performanceSettings.maxVisibleLabels}
                      onChange={(e) => updatePerformance({ maxVisibleLabels: Number(e.target.value) })}
                      style={{ width: '100%' }}
                    />
                  </label>
                  <label style={{ display: 'block', marginBottom: 8 }}>
                    Label update interval ({performanceSettings.labelUpdateIntervalMs}ms)
                    <input
                      type="range"
                      min={24}
                      max={220}
                      step={8}
                      value={performanceSettings.labelUpdateIntervalMs}
                      onChange={(e) => updatePerformance({ labelUpdateIntervalMs: Number(e.target.value) })}
                      style={{ width: '100%' }}
                    />
                  </label>
                  <label style={{ display: 'block', marginBottom: 8 }}>
                    Label cone scale ({performanceSettings.labelConeScale.toFixed(2)})
                    <input
                      type="range"
                      min={55}
                      max={135}
                      step={5}
                      value={Math.round(performanceSettings.labelConeScale * 100)}
                      onChange={(e) => updatePerformance({ labelConeScale: Number(e.target.value) / 100 })}
                      style={{ width: '100%' }}
                    />
                  </label>
              <label style={{ display: 'block', marginBottom: 8 }}>
                Label font scale ({performanceSettings.labelFontScale.toFixed(2)})
                <input
                  type="range"
                  min={0.5}
                  max={30}
                  step={0.01}
                  value={performanceSettings.labelFontScale}
                  onChange={(e) => updatePerformance({ labelFontScale: Number(e.target.value) })}
                  style={{ width: '100%' }}
                />
              </label>
              <label style={{ display: 'block', marginBottom: 8 }}>
                Label minimum font size ({performanceSettings.labelFontMin}px)
                <input
                  type="range"
                  min={1}
                  max={30}
                  step={1}
                  value={performanceSettings.labelFontMin}
                  onChange={(e) => updatePerformance({ labelFontMin: Number(e.target.value) })}
                  style={{ width: '100%' }}
                />
              </label>
                <label style={{ display: 'block', marginBottom: 8 }}>
                  Label X offset ({performanceSettings.labelOffsetX})
                    <input
                      type="range"
                      min={-1000}
                      max={100}
                      step={1}
                    value={performanceSettings.labelOffsetX}
                    onChange={(e) => updatePerformance({ labelOffsetX: Number(e.target.value) })}
                    style={{ width: '100%' }}
                  />
                </label>
                <label style={{ display: 'block', marginBottom: 10 }}>
                  Label Y offset ({performanceSettings.labelOffsetY})
                  <input
                    type="range"
                    min={-300}
                    max={100}
                    step={1}
                    value={performanceSettings.labelOffsetY}
                    onChange={(e) => updatePerformance({ labelOffsetY: Number(e.target.value) })}
                  style={{ width: '100%' }}
                />
              </label>
              <label style={{ display: 'block', marginBottom: 10 }}>
                Aim sample step ({performanceSettings.aimSampleStep})
                <input
                  type="range"
                  min={1}
                  max={8}
                      step={1}
                      value={performanceSettings.aimSampleStep}
                      onChange={(e) => updatePerformance({ aimSampleStep: Number(e.target.value) })}
                      style={{ width: '100%' }}
                    />
                  </label>
                </div>
              </details>

              <details style={{ marginBottom: 10 }} open>
                <summary style={{ cursor: 'pointer' }}>Graphics / GPU</summary>
                <div style={{ marginTop: 10 }}>
                  <label style={{ display: 'block', marginBottom: 8 }}>
                    <input
                      type="checkbox"
                      checked={performanceSettings.antialias}
                      onChange={(e) => updatePerformance({ antialias: e.target.checked })}
                      style={{ marginRight: 6 }}
                    />
                    Antialias
                  </label>
                  <label style={{ display: 'block', marginBottom: 8 }}>
                    DPR ({performanceSettings.dprMin.toFixed(1)} - {performanceSettings.dprMax.toFixed(1)})
                    <input
                      type="range"
                      min={0.5}
                      max={2}
                      step={0.1}
                      value={performanceSettings.dprMax}
                      onChange={(e) => {
                        const next = Number(e.target.value);
                        updatePerformance({
                          dprMax: next,
                          dprMin: Math.min(performanceSettings.dprMin, next),
                        });
                      }}
                      style={{ width: '100%' }}
                    />
                  </label>
                  <label style={{ display: 'block', marginBottom: 8 }}>
                    Background stars ({Math.round(performanceSettings.backgroundStarDensity * 100)}%)
                    <input
                      type="range"
                      min={20}
                      max={100}
                      step={5}
                      value={Math.round(performanceSettings.backgroundStarDensity * 100)}
                      onChange={(e) => updatePerformance({ backgroundStarDensity: Number(e.target.value) / 100 })}
                      style={{ width: '100%' }}
                    />
                  </label>
                  <label style={{ display: 'block', marginBottom: 8 }}>
                    Point size ({performanceSettings.backgroundPointSize.toFixed(1)})
                    <input
                      type="range"
                      min={1}
                      max={3.4}
                      step={0.1}
                      value={performanceSettings.backgroundPointSize}
                      onChange={(e) => updatePerformance({ backgroundPointSize: Number(e.target.value) })}
                      style={{ width: '100%' }}
                    />
                  </label>
                  <label style={{ display: 'block', marginBottom: 8 }}>
                    Star segments ({performanceSettings.starGeometrySegments})
                    <input
                      type="range"
                      min={4}
                      max={16}
                      step={2}
                      value={performanceSettings.starGeometrySegments}
                      onChange={(e) => updatePerformance({ starGeometrySegments: Number(e.target.value) })}
                      style={{ width: '100%' }}
                    />
                  </label>
                  <label style={{ display: 'block', marginBottom: 8 }}>
                    Star scale ({performanceSettings.starScale.toFixed(2)})
                    <input
                      type="range"
                      min={0.2}
                      max={3}
                      step={0.05}
                      value={performanceSettings.starScale}
                      onChange={(e) => updatePerformance({ starScale: Number(e.target.value) })}
                      style={{ width: '100%' }}
                    />
                  </label>
                  <label style={{ display: 'block', marginBottom: 8 }}>
                    Grid density ({Math.round((performanceSettings.gridDensity || 0) * 100)}%)
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={10}
                      value={Math.round((performanceSettings.gridDensity || 0) * 100)}
                      onChange={(e) => updatePerformance({ gridDensity: Number(e.target.value) / 100 })}
                      style={{ width: '100%' }}
                    />
                  </label>
                </div>
              </details>

              <details style={{ marginBottom: 10 }}>
                <summary style={{ cursor: 'pointer' }}>Performance</summary>
                <div style={{ marginTop: 10 }}>
                  <label style={{ display: 'block', marginBottom: 8 }}>
                    Launch trail ({performanceSettings.launchTrailLimit})
                    <input
                      type="range"
                      min={0}
                      max={10}
                      step={1}
                      value={performanceSettings.launchTrailLimit}
                      onChange={(e) => updatePerformance({ launchTrailLimit: Number(e.target.value) })}
                      style={{ width: '100%' }}
                    />
                  </label>
                  <label style={{ display: 'block', marginBottom: 8 }}>
                    Ship scale ({performanceSettings.shipScale.toFixed(2)})
                    <input
                      type="range"
                      min={0.2}
                      max={3}
                      step={0.05}
                      value={performanceSettings.shipScale}
                      onChange={(e) => updatePerformance({ shipScale: Number(e.target.value) })}
                      style={{ width: '100%' }}
                    />
                  </label>
                  <label style={{ display: 'block', marginBottom: 8 }}>
                    Ship quality ({performanceSettings.shipQuality.toFixed(1)})
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.1}
                      value={performanceSettings.shipQuality}
                      onChange={(e) => updatePerformance({ shipQuality: Number(e.target.value) })}
                      style={{ width: '100%' }}
                    />
                  </label>
                </div>
              </details>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setPerformanceSettings(DEFAULT_SPACE_PERFORMANCE_SETTINGS)}
                  style={{ padding: '6px 8px' }}
                >
                  Reset
                </button>
                <button
                  onClick={() =>
                    updatePerformance({
                      dprMin: 0.7,
                      dprMax: 1.1,
                      backgroundStarDensity: 0.35,
                      backgroundPointSize: 1.2,
                      starGeometrySegments: 4,
                      starScale: 1,
                      maxVisibleLabels: 4,
                      labelUpdateIntervalMs: 160,
                      labelConeScale: 0.7,
                      labelFontScale: 1,
                      labelFontMin: 10,
                      shipScale: 1,
                      aimSampleStep: 3,
                      launchTrailLimit: 2,
                      shipQuality: 0,
                      gridDensity: 0.2,
                      antialias: false,
                      showHud: true,
                      hudScale: 0.9,
                      hudOpacity: 0.8,
                      hudCrosshair: true,
                      hudSpeedometer: true,
                      hudPositionPanel: false,
                      hudHeadingCompass: true,
                      hudTargetPanel: true,
                      hudThrottleBar: true,
                      hudRangeReadout: false,
                    })
                  }
                  style={{ padding: '6px 8px' }}
                >
                  Low power preset
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default App;
