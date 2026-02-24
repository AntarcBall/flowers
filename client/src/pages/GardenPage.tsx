import { useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { FlowerPreview } from '../components/FlowerPreview';
import { GardenScene } from '../components/GardenScene';
import { SELECTED_STAR_SESSION_KEY } from '../types';
import type { StarSelectionData } from '../types';
import '../App.css';

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
      const parsed = JSON.parse(raw);
      setSelectedStarData(parsed as StarSelectionData);
    } catch {
      // keep fallback
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

  const preview = useMemo(() => selectedStarData, [selectedStarData]);

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
        <GardenScene selectedStarData={preview} />
      </Canvas>

      <div
        style={{
          position: 'absolute',
          top: 20,
          left: 20,
          color: '#f8f8ff',
          pointerEvents: 'none',
            fontFamily: 'Georgia, "Times New Roman", serif',
          zIndex: 2,
          width: 'calc(100% - 40px)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 16,
        }}
      >
        <div
          style={{
            pointerEvents: 'none',
            background: 'rgba(6, 12, 26, 0.7)',
            border: '1px solid rgba(255,255,255,0.22)',
            borderRadius: 12,
            padding: '10px 12px',
            backdropFilter: 'blur(5px)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.45)',
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>Garden Garden</div>
          <button style={{ pointerEvents: 'auto' }} onClick={backToSpace}>
            Back to Space
          </button>
          <p style={{ margin: '10px 0 4px', fontWeight: 700, fontSize: 18 }}>{preview.word}</p>
          <p style={{ margin: 0, fontSize: 12, opacity: 0.8 }}>WASD to Scroll. Click ground to plant.</p>
          <div
            style={{
              marginTop: 8,
              display: 'flex',
              gap: 6,
              flexWrap: 'wrap',
              maxWidth: 260,
              fontSize: 11,
              opacity: 0.9,
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

          <div
            style={{
              marginTop: 'auto',
              alignSelf: 'flex-end',
              background: 'rgba(255,255,255,0.9)',
            borderRadius: 12,
            padding: 12,
            color: '#122',
            minWidth: 150,
            pointerEvents: 'auto',
            boxShadow: '0 12px 40px rgba(4, 10, 22, 0.45)',
          }}
        >
          <div
            style={{
              position: 'relative',
              width: 120,
              height: 120,
              margin: '0 auto 6px',
              borderRadius: 12,
              overflow: 'hidden',
              border: `1px solid ${preview.color}`,
              background: `linear-gradient(140deg, ${preview.color}44, rgba(255,255,255,0.2))`,
            }}
          >
            <FlowerPreview params={preview.params} color={preview.color} size={120} />
          </div>
          <div
            style={{
              fontSize: 11,
              textAlign: 'center',
              fontWeight: 700,
              color: '#121b31',
            }}
          >
            Preview seed
          </div>
        </div>
      </div>
    </div>
  );
}
