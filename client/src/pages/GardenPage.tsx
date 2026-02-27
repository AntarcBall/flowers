import { Canvas } from '@react-three/fiber';
import { GardenScene } from '../components/GardenScene';

export default function GardenPage() {
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
    </div>
  );
}
