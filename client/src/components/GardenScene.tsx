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
      ambientPulseRef.current.intensity = 0.55 + Math.sin(t * 0.20) * 0.08;
    }
    if (rimPulseRef.current) {
      rimPulseRef.current.intensity = 0.45 + Math.cos(t * 0.17) * 0.09;
    }
    if (edgePulseRef.current) {
      edgePulseRef.current.intensity = 0.38 + Math.sin(t * 0.23 + 1.5) * 0.11;
    }
  });

  const gardenDust = useMemo(() => {
    const total = 680;
    const positions = new Float32Array(total * 3);
    const colors = new Float32Array(total * 3);

    for (let i = 0; i < total; i += 1) {
      const i3 = i * 3;
      const radius = 160 + Math.random() * (CONFIG.GARDEN_SIZE * 0.82);
      const angle = Math.random() * Math.PI * 2;
      const swirl = Math.random() * Math.PI * 2;
      const x = CONFIG.GARDEN_SIZE / 2 + Math.cos(angle) * radius * Math.cos(swirl);
      const y = CONFIG.GARDEN_SIZE / 2 + Math.sin(angle) * radius * Math.sin(swirl);
      const z = -14 - Math.random() * 8;
      positions[i3] = x;
      positions[i3 + 1] = y;
      positions[i3 + 2] = z;
      const haze = 0.8 + Math.random() * 0.2;
      colors[i3] = 0.11 * haze;
      colors[i3 + 1] = 0.22 * haze;
      colors[i3 + 2] = 0.48 * haze;
    }

    return { positions, colors };
  }, []);

  return (
    <>
      <color attach="background" args={['#050910']} />
      <fog attach="fog" args={['#071124', CONFIG.GARDEN_SIZE * 0.18, CONFIG.GARDEN_SIZE * 1.35]} />

      <OrthographicCamera
        makeDefault
        position={[CONFIG.GARDEN_SIZE / 2, CONFIG.GARDEN_SIZE / 2, 100]}
        zoom={1}
        near={0.1}
        far={1000}
      />

      <ambientLight ref={ambientPulseRef} intensity={0.55} color="#d4d4ff" />
      <directionalLight position={[760, 520, 220]} color="#91a7ff" intensity={0.36} />
      <pointLight ref={rimPulseRef} position={[250, 250, 260]} color="#8dd5ff" intensity={0.72} distance={1400} decay={1.8} />
      <pointLight ref={edgePulseRef} position={[760, 720, 240]} color="#ff8de6" intensity={0.62} distance={1400} decay={2} />

      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[gardenDust.positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[gardenDust.colors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.45}
          sizeAttenuation
          vertexColors
          transparent
          opacity={0.32}
          depthWrite={false}
        />
      </points>

      <mesh position={[CONFIG.GARDEN_SIZE / 2, CONFIG.GARDEN_SIZE / 2, -18]}>
        <planeGeometry args={[CONFIG.GARDEN_SIZE * 1.65, CONFIG.GARDEN_SIZE * 1.65]} />
        <meshStandardMaterial
          color="#070f1a"
          roughness={1}
          metalness={0}
          side={DoubleSide}
          envMapIntensity={0.25}
          emissive="#090f1a"
          emissiveIntensity={0.05}
        />
      </mesh>
      <mesh position={[CONFIG.GARDEN_SIZE / 2, CONFIG.GARDEN_SIZE / 2, -17.3]}>
        <planeGeometry args={[CONFIG.GARDEN_SIZE * 1.65, CONFIG.GARDEN_SIZE * 1.65]} />
        <meshStandardMaterial
          color="#101b35"
          transparent
          opacity={0.42}
          roughness={0.2}
          metalness={0.75}
          side={DoubleSide}
          emissive="#1a2a54"
          emissiveIntensity={0.18}
        />
      </mesh>
      <mesh position={[CONFIG.GARDEN_SIZE / 2, CONFIG.GARDEN_SIZE / 2, -15]}> 
        <planeGeometry args={[CONFIG.GARDEN_SIZE, CONFIG.GARDEN_SIZE]} />
        <meshStandardMaterial
          color="#050d19"
          side={DoubleSide}
          roughness={0.95}
          metalness={0.15}
          envMapIntensity={0.4}
        />
      </mesh>

      <mesh
        position={[CONFIG.GARDEN_SIZE / 2, CONFIG.GARDEN_SIZE / 2, 0.1]}
        rotation={[0, 0, 0]}
      >
        <planeGeometry args={[CONFIG.GARDEN_SIZE, CONFIG.GARDEN_SIZE]} />
        <meshStandardMaterial color="#0b1121" roughness={0.95} metalness={0.05} />
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
