import { useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { GardenScene } from '../components/GardenScene';
import { SELECTED_STAR_SESSION_KEY } from '../types';
import type { StarSelectionData } from '../types';
import '../App.css';

const FALLBACK_STAR: StarSelectionData = {
  word: 'No selected word',
  color: '#ffffff',
  params: { m: 3, n1: 1, n2: 1, n3: 1, rot: 0 },
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

  const backToSpace = () => {
    window.location.href = '/';
  };

  const preview = useMemo(() => selectedStarData, [selectedStarData]);

  return (
    <div style={{ width: '100vw', height: '100vh', background: 'black' }}>
      <Canvas>
        <GardenScene selectedStarData={preview} />
      </Canvas>

      <div
        style={{ position: 'absolute', top: 20, left: 20, color: 'white', pointerEvents: 'none' }}
      >
        <button style={{ pointerEvents: 'auto' }} onClick={backToSpace}>
          Back to Space
        </button>
        <p>Click on ground to plant flower.</p>
        <p>WASD to Scroll.</p>
      </div>
    </div>
  );
}
