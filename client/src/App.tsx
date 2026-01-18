import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { SpaceScene } from './components/SpaceScene';
import { GardenScene } from './components/GardenScene';
import { FlowerPreview } from './components/FlowerPreview';
import { CONFIG } from './config';
import './App.css';

function App() {
  const [view, setView] = useState<'SPACE' | 'GARDEN'>('SPACE');
  const [selectedStar, setSelectedStar] = useState<any>(null);
  const [debugMode, setDebugMode] = useState(false);
  
  const [aimedStarData, setAimedStarData] = useState<any>(null);

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
                <p>WASD to Rotate, QE to Speed up/down.</p>
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
