import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { SpaceScene } from './components/SpaceScene';
import { GardenScene } from './components/GardenScene';
import { FlowerPreview } from './components/FlowerPreview';
import { CONFIG } from './config';
import './App.css';

type Telemetry = {
  speed: number;
  position: { x: number; y: number; z: number };
};

function App() {
  const [view, setView] = useState<'SPACE' | 'GARDEN'>('SPACE');
  const [selectedStar, setSelectedStar] = useState<any>(null);
  const [debugMode, setDebugMode] = useState(false);
  
  const [aimedStarData, setAimedStarData] = useState<any>(null);
  const [telemetry, setTelemetry] = useState<Telemetry>({
    speed: 0,
    position: { x: 0, y: 0, z: 0 },
  });
  const formatCoordinate = (value: number) => {
    const trunc = Math.trunc(value * 100) / 100;
    return trunc.toFixed(2);
  };

  const handleSelectStar = (data: any) => {
    setSelectedStar(data);
    setView('GARDEN');
  };

  const handleBack = () => {
    setView('SPACE');
  };

  return (
    <div style={{ width: '100vw', height: '100vh', background: 'black' }}>
      <Canvas>
        {view === 'SPACE' ? (
          <SpaceScene 
            onSelectStar={handleSelectStar} 
            debugMode={debugMode}
            onAimChange={setAimedStarData}
            onTelemetryChange={setTelemetry}
          />
        ) : (
          <GardenScene selectedStarData={selectedStar} />
        )}
      </Canvas>
      {view === 'GARDEN' && (
        <div style={{ position: 'absolute', top: 20, left: 20, color: 'white', pointerEvents: 'none' }}>
          <button style={{ pointerEvents: 'auto' }} onClick={handleBack}>Back to Space</button>
          <p>Click on ground to plant flower.</p>
          <p>WASD to Scroll.</p>
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
    </div>
  );
}

export default App;
