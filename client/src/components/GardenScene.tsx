import { useMemo, useState, useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrthographicCamera, Html } from '@react-three/drei';
import { GardenManager } from '../modules/GardenManager';
import { OrthographicCamera as ThreeOrthographicCamera, PointLight, DoubleSide } from 'three';
import { CONFIG } from '../config';
import { Flower } from './Flower';
import type { FlowerData } from '../modules/PersistenceService';

export const GardenScene = () => {
  const manager = useMemo(() => new GardenManager(), []);
  const { camera } = useThree();
  const [flowers, setFlowers] = useState<FlowerData[]>(manager.flowers);
  const [lifeClock, setLifeClock] = useState(() => Date.now());
  const ambientPulseRef = useRef<PointLight>(null);
  const rimPulseRef = useRef<PointLight>(null);
  const edgePulseRef = useRef<PointLight>(null);
  const lastLifeTickRef = useRef(0);

  useEffect(() => {
    manager.init();
    setFlowers([...manager.flowers]);
  }, [manager]);

  useEffect(() => {
    const syncGardenState = () => {
      if (manager.reloadFromStorage()) {
        setFlowers([...manager.flowers]);
      }
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === CONFIG.STORAGE_KEY) {
        syncGardenState();
      }
    };

    const pollId = window.setInterval(syncGardenState, 1200);
    window.addEventListener('storage', onStorage);
    syncGardenState();

    return () => {
      window.clearInterval(pollId);
      window.removeEventListener('storage', onStorage);
    };
  }, [manager]);

  useFrame((state, delta) => {
    const removed = manager.update(delta, camera as ThreeOrthographicCamera);
    if (removed) {
      setFlowers([...manager.flowers]);
    }

    const now = Date.now();
    if (now - lastLifeTickRef.current > 500) {
      lastLifeTickRef.current = now;
      setLifeClock(now);
    }

    const t = state.clock.getElapsedTime();
    if (ambientPulseRef.current) {
      ambientPulseRef.current.intensity = 0.55 + Math.sin(t * 0.2) * 0.08;
    }
    if (rimPulseRef.current) {
      rimPulseRef.current.intensity = 0.45 + Math.cos(t * 0.17) * 0.09;
    }
    if (edgePulseRef.current) {
      edgePulseRef.current.intensity = 0.38 + Math.sin(t * 0.23 + 1.5) * 0.11;
    }
  });

  return (
    <>
      <color attach="background" args={['black']} />

      <OrthographicCamera
        makeDefault
        position={[CONFIG.GARDEN_WIDTH / 2, CONFIG.GARDEN_HEIGHT / 2, 100]}
        zoom={1}
        near={0.1}
        far={1000}
      />

      <ambientLight ref={ambientPulseRef} intensity={0.55} color="#ffffff" />
      <directionalLight position={[760, 520, 220]} color="#91a7ff" intensity={0.36} />
      <pointLight ref={rimPulseRef} position={[250, 250, 260]} color="#8dd5ff" intensity={0.48} distance={1400} decay={1.8} />
      <pointLight ref={edgePulseRef} position={[760, 720, 240]} color="#ff8de6" intensity={0.35} distance={1400} decay={2} />

      <mesh position={[CONFIG.GARDEN_WIDTH / 2, CONFIG.GARDEN_HEIGHT / 2, -18]}>
        <planeGeometry args={[CONFIG.GARDEN_WIDTH * 1.65, CONFIG.GARDEN_HEIGHT * 1.65]} />
        <meshBasicMaterial color="black" side={DoubleSide} />
      </mesh>
      <mesh position={[CONFIG.GARDEN_WIDTH / 2, CONFIG.GARDEN_HEIGHT / 2, -15]}>
        <planeGeometry args={[CONFIG.GARDEN_WIDTH, CONFIG.GARDEN_HEIGHT]} />
        <meshStandardMaterial color="black" side={DoubleSide} roughness={1} metalness={0} />
      </mesh>

      {flowers.map((flower: FlowerData) => {
        const { growth, vitality } = manager.getFlowerState(flower, lifeClock);
        const labelOffsetX = flower.labelOffsetX ?? 0;
        const labelOffsetY = flower.labelOffsetY ?? 0;
        const labelOpacity = 0.2 + vitality * 0.8;

        return (
          <group key={flower.id} position={[flower.x, flower.y, CONFIG.FLOWER_ANCHOR_Z]}>
            <Flower params={flower.params} color={flower.color} scale={104} growth={growth} vitality={vitality} />
            {flower.word && (
              <Html position={[labelOffsetX, labelOffsetY, 0.35]} center distanceFactor={22} transform>
                <div
                  style={{
                    pointerEvents: 'none',
                    whiteSpace: 'nowrap',
                    padding: '67.5px 195px',
                    borderRadius: 999,
                    fontSize: 270,
                    color: 'rgba(234, 247, 255, 0.95)',
                    background: 'linear-gradient(115deg, rgba(3, 12, 34, 0.78), rgba(9, 28, 57, 0.72))',
                    border: '1px solid rgba(156, 214, 255, 0.45)',
                    boxShadow: '0 2px 10px rgba(2, 12, 32, 0.5)',
                    fontFamily: 'Georgia, "Times New Roman", serif',
                    letterSpacing: 0.25,
                    backdropFilter: 'blur(1.5px)',
                    opacity: Number(labelOpacity.toFixed(3)),
                  }}
                >
                  {flower.word}
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </>
  );
};
