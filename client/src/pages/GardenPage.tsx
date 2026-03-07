import { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { GardenScene } from '../components/GardenScene';
import {
  loadGardenDisplaySettings,
  saveGardenDisplaySettings,
  type GardenDisplaySettings,
} from '../modules/GardenDisplaySettings';

export default function GardenPage() {
  const [dprMin, setDprMin] = useState(0.3);
  const [dprMax, setDprMax] = useState(1.4);
  const [showDebug, setShowDebug] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [displaySettings, setDisplaySettings] = useState<GardenDisplaySettings>(() => loadGardenDisplaySettings());

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey && event.code === 'KeyQ' && !event.repeat) {
        event.preventDefault();
        setShowDebug((current) => !current);
      }
    };

    const handleMouseMove = (event: MouseEvent) => {
      setMousePos({
        x: Math.round(event.clientX),
        y: Math.round(event.clientY),
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  useEffect(() => {
    saveGardenDisplaySettings(displaySettings);
  }, [displaySettings]);

  const onChangeDprMin = (value: number) => {
    const nextMin = Math.max(0.2, Math.min(value, dprMax));
    setDprMin(Number(nextMin.toFixed(2)));
  };

  const onChangeDprMax = (value: number) => {
    const nextMax = Math.min(2, Math.max(value, dprMin));
    setDprMax(Number(nextMax.toFixed(2)));
  };

  return (
    <div style={{ width: '100vw', height: '100vh', background: 'black', position: 'relative' }}>
      <Canvas
        dpr={[dprMin, dprMax]}
        gl={{
          antialias: false,
          powerPreference: 'high-performance',
          alpha: false,
        }}
      >
        <GardenScene displaySettings={displaySettings} />
      </Canvas>

      {showDebug && (
        <div
          style={{
            position: 'fixed',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: 360,
            maxWidth: '88vw',
            background: 'rgba(0, 0, 0, 0.82)',
            border: '1px solid rgba(255, 255, 255, 0.24)',
            borderRadius: 16,
            color: '#d8f0ff',
            padding: '16px 18px',
            zIndex: 40,
            fontSize: 12,
            pointerEvents: 'auto',
            boxShadow: '0 24px 80px rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <div style={{ marginBottom: 12, fontWeight: 700, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Garden Hidden Panel
          </div>
          <div style={{ marginBottom: 6 }}>dprMin ({dprMin})</div>
          <input
            type="range"
            min={0.2}
            max={2.0}
            step={0.05}
            value={dprMin}
            onChange={(event) => onChangeDprMin(Number(event.target.value))}
            style={{ width: '100%' }}
          />
          <div style={{ margin: '10px 0 6px' }}>dprMax ({dprMax})</div>
          <input
            type="range"
            min={0.2}
            max={2.0}
            step={0.05}
            value={dprMax}
            onChange={(event) => onChangeDprMax(Number(event.target.value))}
            style={{ width: '100%' }}
          />
          <div style={{ margin: '12px 0 6px' }}>
            flower size mean ({displaySettings.flowerScaleMeanMultiplier.toFixed(2)}x)
          </div>
          <input
            type="range"
            min={0.35}
            max={1.4}
            step={0.01}
            value={displaySettings.flowerScaleMeanMultiplier}
            onChange={(event) =>
              setDisplaySettings((current) => ({
                ...current,
                flowerScaleMeanMultiplier: Number(event.target.value),
              }))
            }
            style={{ width: '100%' }}
          />
          <div style={{ margin: '12px 0 6px' }}>
            label size ({displaySettings.labelScale.toFixed(2)}x)
          </div>
          <input
            type="range"
            min={0.25}
            max={1.5}
            step={0.01}
            value={displaySettings.labelScale}
            onChange={(event) =>
              setDisplaySettings((current) => ({
                ...current,
                labelScale: Number(event.target.value),
              }))
            }
            style={{ width: '100%' }}
          />
          <div style={{ marginTop: 8 }}>
            mouse x/y: {mousePos.x}, {mousePos.y}
          </div>
          <div style={{ marginTop: 10, opacity: 0.9 }}>Toggle with Alt+Q.</div>
        </div>
      )}
    </div>
  );
}
