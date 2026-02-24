import { useEffect, useState, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { FlowerPreview } from '../components/FlowerPreview';
import { SpaceScene } from '../components/SpaceScene';
import { CONFIG } from '../config';
import { PersistenceService } from '../modules/PersistenceService';
import type { FlowerData } from '../modules/PersistenceService';
import type { StarSelectionData } from '../types';
import { SELECTED_STAR_SESSION_KEY } from '../types';
import type { CSSProperties } from 'react';
import '../App.css';

export default function SpacePage() {
  const [debugMode, setDebugMode] = useState(false);
  const [aimedStarData, setAimedStarData] = useState<StarSelectionData | null>(null);
  const [telemetry, setTelemetry] = useState({
    speed: 0,
    position: { x: 0, y: 0, z: 0 },
  });
  const [toastQueue, setToastQueue] = useState<{ id: string; word: string }[]>([]);
  const toastTimersRef = useRef(new Map<string, number>());
  const makeRandomPosition = () => ({
    x: Math.random() * CONFIG.GARDEN_SIZE,
    y: Math.random() * CONFIG.GARDEN_SIZE,
  });
  const makeFlowerId = () =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? (crypto as Crypto).randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const handleSelectStar = (data: StarSelectionData) => {
    sessionStorage.setItem(SELECTED_STAR_SESSION_KEY, JSON.stringify(data));
    const savedFlowers = PersistenceService.load();
    const { x, y } = makeRandomPosition();
    const newFlower: FlowerData = {
      id: makeFlowerId(),
      x,
      y,
      color: data.color,
      params: data.params,
      word: data.word,
      timestamp: Date.now(),
    };

    savedFlowers.push(newFlower);
    PersistenceService.save(savedFlowers);

    const toastId = makeFlowerId();
    setToastQueue((current) => [...current, { id: toastId, word: data.word }]);
    const timerId = window.setTimeout(() => {
      setToastQueue((current) => current.filter((entry) => entry.id !== toastId));
      toastTimersRef.current.delete(toastId);
    }, 2800);
    toastTimersRef.current.set(toastId, timerId);
  };

  useEffect(() => {
    return () => {
      toastTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      toastTimersRef.current.clear();
    };
  }, []);

  const speedRatio = Math.max(0, Math.min(1, telemetry.speed / CONFIG.MAX_SPEED));
  const speedAngle = speedRatio * 180;
  const speedNeedleDeg = speedAngle - 90;
  const speedReadoutDeg = 180 - Math.round(speedAngle);
  const formatCoordinate = (value: number) => {
    const trunc = Math.trunc(value * 100) / 100;
    return trunc.toFixed(2);
  };

  return (
    <div style={{ width: '100vw', height: '100vh', background: 'black' }}>
      <Canvas
        dpr={[1, 1.5]}
        gl={{
          antialias: false,
          powerPreference: 'high-performance',
          alpha: false,
        }}
      >
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
          <p>Aim at a star and press Space to plant.</p>
        </div>

        <div style={{ position: 'absolute', top: 56, left: 20, color: 'white', display: 'flex', flexDirection: 'column', gap: '8px', pointerEvents: 'none' }}>
          {toastQueue.map((toast) => (
            <div
              key={toast.id}
              style={{
                minWidth: 220,
                padding: '8px 10px',
                border: '1px solid rgba(255, 255, 255, 0.65)',
                borderRadius: '8px',
                background: 'rgba(12, 20, 42, 0.75)',
                fontSize: 12,
                boxShadow: '0 0 12px rgba(0, 0, 0, 0.35)',
              }}
            >
              {toast.word} - 새로운 꽃이 심겨졌습니다
            </div>
          ))}
        </div>

        <div
          style={{
            position: 'absolute',
            top: 20,
            right: 20,
            width: 170,
            color: 'white',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              position: 'relative',
              width: 150,
              height: 80,
              border: '2px solid rgba(255, 255, 255, 0.6)',
              borderBottom: 'none',
              borderRadius: '150px 150px 0 0 / 80px 80px 0 0',
              overflow: 'hidden',
              background: 'rgba(0, 0, 0, 0.35)',
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
          <div style={{ marginTop: 4, textAlign: 'center', fontSize: 12, color: '#ddd' }}>
            Speedometer {speedReadoutDeg}°
          </div>
          <div style={{ textAlign: 'center', fontSize: 12, color: '#9bd7ff' }}>
            {telemetry.speed.toFixed(2)} / {Math.round(CONFIG.MAX_SPEED)}
          </div>
        </div>

        <div
          style={{
            position: 'absolute',
            bottom: 20,
            left: 20,
            right: 20,
            pointerEvents: 'auto',
            display: 'flex',
            justifyContent: 'space-between',
            gap: '20px',
            alignItems: 'flex-end',
          }}
        >
          <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-end' }}>
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
          </div>

          <div
            style={{
              ...(CONFIG.PREVIEW as CSSProperties),
              width: 220,
              height: 190,
              color: 'white',
              padding: '8px 10px',
              boxSizing: 'border-box',
              pointerEvents: 'none',
            }}
          >
            <div style={{ fontSize: 12, textAlign: 'center', marginBottom: 6 }}>Current Position</div>
            <div style={{ fontFamily: 'monospace', fontSize: 12, lineHeight: 1.5 }}>
              <div>X: {formatCoordinate(telemetry.position.x)}</div>
              <div>Y: {formatCoordinate(telemetry.position.y)}</div>
              <div>Z: {formatCoordinate(telemetry.position.z)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
