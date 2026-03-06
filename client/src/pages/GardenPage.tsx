import { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { GardenScene } from '../components/GardenScene';

export default function GardenPage() {
  const [dprMin, setDprMin] = useState(0.3);
  const [dprMax, setDprMax] = useState(1.4);
  const [showDebug, setShowDebug] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'KeyQ') {
        setShowDebug(true);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'KeyQ') {
        setShowDebug(false);
      }
    };

    const handleMouseMove = (event: MouseEvent) => {
      setMousePos({
        x: Math.round(event.clientX),
        y: Math.round(event.clientY),
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      setShowDebug(false);
    };
  }, []);

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
        <GardenScene />
      </Canvas>
      <div
        style={{
          position: 'fixed',
          left: 14,
          top: 14,
          width: 320,
          maxWidth: '88vw',
          background: 'rgba(0, 0, 0, 0.72)',
          border: '1px solid rgba(255, 255, 255, 0.32)',
          borderRadius: 12,
          color: '#d8f0ff',
          padding: '10px 12px',
          zIndex: 30,
          fontSize: 12,
          pointerEvents: 'none',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
          backdropFilter: 'blur(6px)',
          lineHeight: 1.45,
        }}
      >
        <div style={{ marginBottom: 6, fontWeight: 700 }}>Garden 모니터</div>
        <div>우주페이지(노트북)에서 SPACE로 심은 단어가 여기서 꽃으로 즉시 나타납니다.</div>
        <div style={{ marginTop: 4 }}>큰 모니터에서 단어의 생성·성장 과정을 오래 바라보세요.</div>
      </div>

      {showDebug && (
        <div
          style={{
            position: 'fixed',
            left: 12,
            bottom: 12,
            width: 320,
            maxWidth: '88vw',
            background: 'rgba(0, 0, 0, 0.78)',
            border: '1px solid rgba(255, 255, 255, 0.32)',
            borderRadius: 12,
            color: '#d8f0ff',
            padding: '10px',
            zIndex: 40,
            fontSize: 12,
            pointerEvents: 'auto',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(6px)',
          }}
        >
          <div style={{ marginBottom: 8, fontWeight: 700 }}>Garden Debug</div>
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
          <div style={{ marginTop: 8 }}>
            mouse x/y: {mousePos.x}, {mousePos.y}
          </div>
          <div style={{ marginTop: 8, opacity: 0.9 }}>Keep Q pressed to keep this panel visible.</div>
        </div>
      )}
    </div>
  );
}
