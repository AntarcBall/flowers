import { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { SpaceScene } from './components/SpaceScene';
import { GardenScene } from './components/GardenScene';
import { FlowerPreview } from './components/FlowerPreview';
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
};

function App() {
  const [view, setView] = useState<'SPACE' | 'GARDEN'>('SPACE');
  const [debugMode, setDebugMode] = useState(false);
  
  const [aimedStarData, setAimedStarData] = useState<any>(null);
  const [telemetry, setTelemetry] = useState<Telemetry>({
    speed: 0,
    position: { x: 0, y: 0, z: 0 },
  });
  const [performanceSettings, setPerformanceSettings] = useState<SpacePerformanceSettings>(() =>
    loadSpacePerformanceSettings(),
  );
  const [showPerfPanel, setShowPerfPanel] = useState(false);

  const formatCoordinate = (value: number) => {
    const trunc = Math.trunc(value * 100) / 100;
    return trunc.toFixed(2);
  };

  const handleSelectStar = (_data: any) => {
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
          <button style={{ pointerEvents: 'auto' }} onClick={handleBack}>Back to Space</button>
          <p>Garden is synchronized from star-selection events in Space.</p>
          <p>Garden controls are intentionally read-only.</p>
        </div>
      )}
      {view === 'SPACE' && (
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
            <div style={{ position: 'absolute', top: 20, left: 20, color: 'white' }}>
                <p>W/S(Inverted) + A/D to Rotate, Q/E to Speed up/down.</p>
                <p>Aim at a star and Click to select.</p>
            </div>
            
            <div style={{ 
                position: 'absolute', 
                bottom: 20, 
                left: '50%', 
                transform: 'translateX(-50%)',
                pointerEvents: 'auto',
                display: 'flex',
                gap: '20px',
                alignItems: 'end'
            }}>
                <button onClick={() => setDebugMode(prev => !prev)}>
                    Debug Cone: {debugMode ? 'ON' : 'OFF'}
                </button>

                <div style={{
                    ...CONFIG.PREVIEW,
                    width: 220,
                    height: 200,
                    color: 'white',
                    padding: '8px 10px',
                    boxSizing: 'border-box'
                } as any}>
                    <div style={{ fontSize: 12, textAlign: 'center', marginBottom: 4 }}>Speedometer</div>
                    <div style={{ position: 'relative', width: '100%', height: 110, overflow: 'hidden' }}>
                        <div style={{
                            position: 'absolute',
                            left: '50%',
                            bottom: 0,
                            width: 150,
                            height: 150,
                            transform: 'translateX(-50%)',
                            border: '2px solid #9a9a9a',
                            borderRadius: '150px 150px 0 0',
                            borderBottom: 'none',
                            boxSizing: 'border-box'
                        }} />
                        <div style={{
                            position: 'absolute',
                            left: '50%',
                            bottom: 0,
                            width: 3,
                            height: 68,
                            background: '#ffd166',
                            transform: `translateX(-50%) rotate(${(-120 + (Math.min(telemetry.speed / CONFIG.MAX_SPEED, 1) * 240)).toFixed(1)}deg)`,
                            transformOrigin: '50% 100%',
                            borderRadius: 2
                        }} />
                        <div style={{
                            position: 'absolute',
                            left: '50%',
                            bottom: -3,
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            background: '#ffd166',
                            transform: 'translateX(-50%)'
                        }} />
                    </div>
                    <div style={{ fontSize: 12, textAlign: 'center', marginTop: -4 }}>
                        {telemetry.speed.toFixed(1)} / {CONFIG.MAX_SPEED.toFixed(0)}
                    </div>
                </div>

                <div style={{
                    ...CONFIG.PREVIEW,
                    width: 220,
                    height: 190,
                    color: 'white',
                    padding: '8px 10px',
                    boxSizing: 'border-box'
                } as any}>
                    <div style={{ fontSize: 12, textAlign: 'center', marginBottom: 6 }}>Current Position</div>
                    <div style={{ fontFamily: 'monospace', fontSize: 12, lineHeight: 1.5 }}>
                        <div>X: {formatCoordinate(telemetry.position.x)}</div>
                        <div>Y: {formatCoordinate(telemetry.position.y)}</div>
                        <div>Z: {formatCoordinate(telemetry.position.z)}</div>
                    </div>
                </div>

                {aimedStarData && (
                    <div style={CONFIG.PREVIEW as any}>
                        <div style={{ padding: '5px', textAlign: 'center', color: 'white', fontSize: '12px' }}>
                            {aimedStarData.word}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: '5px' }}>
                            <FlowerPreview 
                                params={aimedStarData.params} 
                                color={aimedStarData.color} 
                                size={120} 
                            />
                        </div>
                    </div>
                )}
            </div>
          </div>
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

              <label style={{ display: 'block', marginBottom: 10 }}>
                DPR 최대 ({performanceSettings.dprMin.toFixed(1)} - {performanceSettings.dprMax.toFixed(1)})
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

              <label style={{ display: 'block', marginBottom: 10 }}>
                배경 별 밀도 ({Math.round(performanceSettings.backgroundStarDensity * 100)}%)
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

              <label style={{ display: 'block', marginBottom: 10 }}>
                배경 별 크기 ({performanceSettings.backgroundPointSize.toFixed(1)})
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

              <label style={{ display: 'block', marginBottom: 10 }}>
                별 메시 정밀도 ({performanceSettings.starGeometrySegments})
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

              <label style={{ display: 'block', marginBottom: 10 }}>
                라벨 최대 수 ({performanceSettings.maxVisibleLabels})
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

              <label style={{ display: 'block', marginBottom: 10 }}>
                라벨 갱신 주기 ({performanceSettings.labelUpdateIntervalMs}ms)
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

              <label style={{ display: 'block', marginBottom: 10 }}>
                라벨 탐색 폭 ({performanceSettings.labelConeScale.toFixed(2)})
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

              <label style={{ display: 'block', marginBottom: 10 }}>
                조준 샘플 간격 ({performanceSettings.aimSampleStep})
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

              <label style={{ display: 'block', marginBottom: 10 }}>
                발사 궤적 수 ({performanceSettings.launchTrailLimit})
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

              <label style={{ display: 'block', marginBottom: 10 }}>
                우주선 품질 ({performanceSettings.shipQuality.toFixed(1)})
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

              <label style={{ display: 'block', marginBottom: 6 }}>
                <input
                  type="checkbox"
                  checked={performanceSettings.antialias}
                  onChange={(e) => updatePerformance({ antialias: e.target.checked })}
                />
                <span style={{ marginLeft: 8 }}>Antialias 사용</span>
              </label>

              <label style={{ display: 'block', marginBottom: 12 }}>
                그리드 밀도 ({Math.round((performanceSettings.gridDensity || 0) * 100)}%)
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

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setPerformanceSettings(DEFAULT_SPACE_PERFORMANCE_SETTINGS)}
                  style={{ padding: '6px 8px' }}
                >
                  기본값
                </button>
                <button
                  onClick={() =>
                    updatePerformance({
                      backgroundStarDensity: 0.3,
                      backgroundPointSize: 1.2,
                      starGeometrySegments: 4,
                      maxVisibleLabels: 4,
                      labelUpdateIntervalMs: 160,
                      labelConeScale: 0.7,
                      aimSampleStep: 3,
                      launchTrailLimit: 2,
                      shipQuality: 0,
                      gridDensity: 0.2,
                      antialias: false,
                      dprMin: 0.7,
                      dprMax: 1.1,
                    })
                  }
                  style={{ padding: '6px 8px' }}
                >
                  저사양 모드
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
