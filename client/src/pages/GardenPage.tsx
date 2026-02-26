import { useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { FlowerPreview } from '../components/FlowerPreview';
import { GardenScene } from '../components/GardenScene';
import { SELECTED_STAR_SESSION_KEY } from '../types';
import type { StarSelectionData } from '../types';
import { CONFIG } from '../config';

const FALLBACK_STAR: StarSelectionData = {
  word: 'No selected word',
  color: '#ffffff',
  params: { m: 3, n1: 1, n2: 1, n3: 1, rot: 0, petalCount: 8 },
};

export default function GardenPage() {
  const [selectedStarData, setSelectedStarData] = useState<StarSelectionData>(FALLBACK_STAR);

  useEffect(() => {
    const raw = sessionStorage.getItem(SELECTED_STAR_SESSION_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as StarSelectionData;
      if (parsed && typeof parsed === 'object' && parsed.params) {
        setSelectedStarData(parsed);
      }
    } catch {
      return;
    }
  }, []);

  const stats = useMemo(() => {
    const params = selectedStarData.params;
    const safePetals = Math.round(params.petalCount ?? 8);
    return [
      `petals ${safePetals}`,
      `stretch ${Number(params.petalStretch ?? 1).toFixed(2)}`,
      `crest ${Number(params.petalCrest ?? 1).toFixed(2)}`,
      `core ${Number(params.coreGlow ?? 0.5).toFixed(2)}`,
    ];
  }, [selectedStarData]);

  const backToSpace = () => {
    window.location.href = '/';
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
        <GardenScene />
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
          <p>Garden is live; flowers are projected only when the space side plants a new star.</p>
          <p>Keyboard controls are disabled in this view.</p>
        </div>

        <div
          style={{
            position: 'absolute',
            top: 56,
            left: 20,
            color: 'white',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            pointerEvents: 'none',
          }}
        >
          {/*
            Reserved layer to keep overlay DOM parity with the Space scene HUD structure.
            This empty slot intentionally occupies the second HUD lane for a stable target path.
          */}
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
              width: 150,
              height: 100,
              border: '2px solid rgba(255, 255, 255, 0.45)',
              borderBottom: 'none',
              borderRadius: '150px 150px 0 0 / 80px 80px 0 0',
              overflow: 'hidden',
              background: 'rgba(0, 0, 0, 0.35)',
              boxShadow: '0 0 20px rgba(0, 0, 0, 0.4)',
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
                background: '#9bd7ff',
                transform: 'translateX(-50%)',
              }}
            />
          </div>
          <div style={{ marginTop: 4, textAlign: 'center', fontSize: 12, color: '#9bd7ff' }}>Garden Scan</div>
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
            <button onClick={backToSpace}>Back to Space</button>

            <div
              style={{
                ...(CONFIG.PREVIEW as any),
                width: 190,
                height: 200,
                color: 'white',
                padding: '8px 10px',
                boxSizing: 'border-box',
              }}
            >
              <div style={{ fontSize: 12, textAlign: 'center', marginBottom: 4 }}>
                {selectedStarData.word}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: '5px' }}>
                <FlowerPreview params={selectedStarData.params} color={selectedStarData.color} size={120} />
              </div>
            </div>
          </div>

          <div
            style={{
              ...(CONFIG.PREVIEW as any),
              width: 240,
              height: 190,
              color: 'white',
              padding: '8px 10px',
              boxSizing: 'border-box',
              pointerEvents: 'none',
            }}
          >
            <div style={{ fontSize: 12, textAlign: 'center', marginBottom: 6 }}>Selected Seed Detail</div>
            <div
              style={{
                marginTop: 8,
                display: 'flex',
                gap: 6,
                flexWrap: 'wrap',
                fontSize: 11,
                opacity: 0.95,
              }}
            >
              {stats.map((item) => (
                <span
                  key={item}
                  style={{
                    border: '1px solid rgba(255,255,255,0.25)',
                    borderRadius: 999,
                    padding: '3px 8px',
                    color: '#fff',
                    background: 'rgba(255,255,255,0.05)',
                  }}
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
