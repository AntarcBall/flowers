import { useMemo, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrthographicCamera, Html } from '@react-three/drei';
import { GardenManager } from '../modules/GardenManager';
import { useInput } from '../hooks/useInput';
import { OrthographicCamera as ThreeOrthographicCamera } from 'three';
import { CONFIG } from '../config';
import { Flower } from './Flower';
import type { FlowerData } from '../modules/PersistenceService';
import type { StarSelectionData } from '../types';

export const GardenScene = ({ selectedStarData }: { selectedStarData: StarSelectionData }) => {
  const manager = useMemo(() => new GardenManager(), []);
  const inputRef = useInput();
  const { camera } = useThree();
  const [flowers, setFlowers] = useState<FlowerData[]>(manager.flowers);

  useEffect(() => {
    manager.init();
    manager.selectedStarData = selectedStarData;
    setFlowers([...manager.flowers]);
  }, [manager, selectedStarData]);

  useFrame(() => {
    manager.update(inputRef.current, camera as ThreeOrthographicCamera);
  });

  const handlePlant = (e: any) => {
    const point = e.point;
    const newFlower = manager.plantFlower(point.x, point.y);
    if (newFlower) {
      setFlowers([...manager.flowers]);
    }
  };

  return (
    <>
      <color attach="background" args={['#040910']} />
      <fog attach="fog" args={['#071124', CONFIG.GARDEN_SIZE * 0.18, CONFIG.GARDEN_SIZE * 1.35]} />

      <OrthographicCamera
        makeDefault
        position={[CONFIG.GARDEN_SIZE / 2, CONFIG.GARDEN_SIZE / 2, 100]}
        zoom={1}
        near={0.1}
        far={1000}
      />

      <ambientLight intensity={0.48} color="#d4d4ff" />
      <directionalLight position={[760, 520, 220]} color="#91a7ff" intensity={0.35} />
      <pointLight position={[250, 250, 260]} color="#8dd5ff" intensity={0.85} distance={1400} decay={1.8} />
      <pointLight position={[760, 720, 240]} color="#ff8de6" intensity={0.6} distance={1400} decay={2} />

      <mesh position={[CONFIG.GARDEN_SIZE / 2, CONFIG.GARDEN_SIZE / 2, -18]}>
        <planeGeometry args={[CONFIG.GARDEN_SIZE * 1.65, CONFIG.GARDEN_SIZE * 1.65]} />
        <meshBasicMaterial color="#04070d" />
      </mesh>
      <mesh position={[CONFIG.GARDEN_SIZE / 2, CONFIG.GARDEN_SIZE / 2, -17.3]}>
        <planeGeometry args={[CONFIG.GARDEN_SIZE * 1.65, CONFIG.GARDEN_SIZE * 1.65]} />
        <meshBasicMaterial color="#151c39" transparent opacity={0.4} />
      </mesh>
      <mesh position={[CONFIG.GARDEN_SIZE / 2, CONFIG.GARDEN_SIZE / 2, -15]}> 
        <planeGeometry args={[CONFIG.GARDEN_SIZE, CONFIG.GARDEN_SIZE]} />
        <meshStandardMaterial color="#03070f" side={2} roughness={1} metalness={0} />
      </mesh>

      <mesh
        position={[CONFIG.GARDEN_SIZE / 2, CONFIG.GARDEN_SIZE / 2, 0.1]}
        rotation={[0, 0, 0]}
        onClick={handlePlant}
      >
        <planeGeometry args={[CONFIG.GARDEN_SIZE, CONFIG.GARDEN_SIZE]} />
        <meshStandardMaterial color="#0b1121" roughness={0.95} metalness={0.05} />
      </mesh>

      {flowers.map((flower: FlowerData) => {
        const plantedAt = flower.plantedAt ?? flower.timestamp;
        const progress = Math.min(1, Math.max(0, (Date.now() - plantedAt) / CONFIG.FLOWER_GROWTH_MS));
        return (
          <group key={flower.id} position={[flower.x, flower.y, CONFIG.FLOWER_ANCHOR_Z]}>
            <Flower params={flower.params} color={flower.color} scale={104} growth={progress} />
          </group>
        );
      })}

      <mesh>
        <ringGeometry args={[420, 430, 180]} />
        <meshBasicMaterial color="#101a36" transparent opacity={0.25} side={2} />
      </mesh>

      <Html position={[0, 0, 0]} fullscreen style={{ pointerEvents: 'none' }}>
        <div
          style={{
            width: '100%',
            height: '100%',
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(circle at 50% 48%, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 45%), radial-gradient(circle at 14% 84%, rgba(255,220,180,0.07) 0%, rgba(255,220,180,0) 40%), radial-gradient(circle at 86% 16%, rgba(170,220,255,0.07) 0%, rgba(170,220,255,0) 40%)',
            mixBlendMode: 'screen',
            pointerEvents: 'none',
          }}
        />
      </Html>
    </>
  );
};
