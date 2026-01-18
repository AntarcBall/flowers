import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { SpaceScene } from './components/SpaceScene';
import { GardenScene } from './components/GardenScene';
import './App.css';

function App() {
  const [view, setView] = useState<'SPACE' | 'GARDEN'>('SPACE');
  const [selectedStar, setSelectedStar] = useState<any>(null);

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
          <SpaceScene onSelectStar={handleSelectStar} />
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
          <div style={{ position: 'absolute', top: 20, left: 20, color: 'white', pointerEvents: 'none' }}>
            <p>WASD to Rotate, QE to Speed up/down.</p>
            <p>Click a star to map params and enter Garden.</p>
          </div>
      )}
    </div>
  );
}

export default App;
