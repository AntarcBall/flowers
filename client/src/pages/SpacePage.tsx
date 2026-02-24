import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { FlowerPreview } from '../components/FlowerPreview';
import { SpaceScene } from '../components/SpaceScene';
import { CONFIG } from '../config';
import { SELECTED_STAR_SESSION_KEY } from '../types';
import type { StarSelectionData } from '../types';
import type { CSSProperties } from 'react';
import '../App.css';

export default function SpacePage() {
  const [debugMode, setDebugMode] = useState(false);
  const [aimedStarData, setAimedStarData] = useState<StarSelectionData | null>(null);
  const [telemetry, setTelemetry] = useState({
    speed: 0,
    position: { x: 0, y: 0, z: 0 },
  });

  const handleSelectStar = (data: StarSelectionData) => {
    sessionStorage.setItem(SELECTED_STAR_SESSION_KEY, JSON.stringify(data));
    window.location.href = '/garden.html';
  };

  return (
    <div style={{ width: '100vw', height: '100vh', background: 'black' }}>
      <Canvas>
        <SpaceScene
          onSelectStar={handleSelectStar}
          debugMode={debugMode}
          onAimChange={setAimedStarData}
          onTelemetryChange={setTelemetry}
        />
      </Canvas>

      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      >
        <div style={{ position: 'absolute', top: 20, left: 20, color: 'white' }}>
          <p>WASD to Rotate, QE to Speed up/down.</p>
          <p>Aim at a star and Click to select.</p>
        </div>

        <div
          style={{
            position: 'absolute',
            bottom: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            pointerEvents: 'auto',
            display: 'flex',
            gap: '20px',
            alignItems: 'end',
          }}
        >
          <button onClick={() => setDebugMode((prev) => !prev)}>
            Debug Cone: {debugMode ? 'ON' : 'OFF'}
          </button>

          {aimedStarData && (
            <div style={CONFIG.PREVIEW as CSSProperties}>
              <div style={{ padding: '5px', textAlign: 'center', color: 'white', fontSize: '12px' }}>
                {aimedStarData.word}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: '5px' }}>
                <FlowerPreview params={aimedStarData.params} color={aimedStarData.color} size={120} />
              </div>
            </div>
          )}

          <div
            style={{
              ...(CONFIG.PREVIEW as CSSProperties),
              width: 220,
              height: 150,
              color: 'white',
              padding: '8px 10px',
              boxSizing: 'border-box',
              pointerEvents: 'none',
            }}
          >
            <div style={{ fontSize: 12, textAlign: 'center', marginBottom: 6 }}>Current Position</div>
            <div style={{ fontFamily: 'monospace', fontSize: 12, lineHeight: 1.5 }}>
              <div>X: {telemetry.position.x.toFixed(2)}</div>
              <div>Y: {telemetry.position.y.toFixed(2)}</div>
              <div>Z: {telemetry.position.z.toFixed(2)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
