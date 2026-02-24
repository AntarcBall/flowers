import { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { SpaceshipController } from '../modules/SpaceshipController';
import { TPSCamera } from '../modules/TPSCamera';
import { SelectionSystem } from '../modules/SelectionSystem';
import { useInput } from '../hooks/useInput';
import { Vector3, Group, PerspectiveCamera, AdditiveBlending } from 'three';
import { SemanticMapper } from '../modules/SemanticMapper';
import { Html } from '@react-three/drei';
import { CONFIG } from '../config';

type Telemetry = {
  speed: number;
  position: { x: number; y: number; z: number };
};

type LaunchEffect = {
  id: string;
  target: Vector3;
  start: Vector3;
  elapsed: number;
  duration: number;
  selectedStarData: {
    color: string;
    params: ReturnType<typeof SemanticMapper.mapCoordinatesToParams>;
    word: string;
  };
};

const makeLaunchId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const easeOutCubic = (value: number) => 1 - Math.pow(1 - value, 3);

export const SpaceScene = ({
  onSelectStar,
  debugMode,
  onAimChange,
  onTelemetryChange
}: {
  onSelectStar: (data: any) => void;
  debugMode: boolean;
  onAimChange: (data: any) => void;
  onTelemetryChange: (data: Telemetry) => void;
}) => {
  const controller = useMemo(() => new SpaceshipController(), []);
  const tpsCamera = useMemo(() => new TPSCamera(), []);
  const inputRef = useInput();
  const shipRef = useRef<Group>(null);
  const backgroundStarRef = useRef<any>(null);
  const { camera } = useThree();

  const BACKGROUND_CELESTIAL_STAR_COUNT = 1800;
  const BACKGROUND_GRAIN_STAR_COUNT = 600;
  const BACKGROUND_STAR_RADIUS_MIN = 1500;
  const BACKGROUND_STAR_RADIUS_MAX = 2400;

  const backgroundStars = useMemo(() => {
    const makeShellStars = (
      count: number,
      radiusMin: number,
      radiusMax: number,
      tint: 'icy' | 'golden',
    ) => {
      const total = count * 3;
      const positions = new Float32Array(total);
      const colors = new Float32Array(total);

      for (let i = 0; i < count; i++) {
        const i3 = i * 3;

        const theta = Math.random() * Math.PI * 2;
        const z = Math.random() * 2 - 1;
        const sinPhi = Math.sqrt(1 - Math.min(1, z * z));
        const radius = radiusMin + Math.pow(Math.random(), 1.2) * (radiusMax - radiusMin);

        const x = radius * sinPhi * Math.cos(theta);
        const y = radius * z;
        const w = radius * sinPhi * Math.sin(theta);

        positions[i3] = x;
        positions[i3 + 1] = y;
        positions[i3 + 2] = w;

        const glow = 0.45 + Math.random() * 0.55;
        if (tint === 'icy') {
          colors[i3] = 0.62 + glow * 0.28;
          colors[i3 + 1] = 0.75 + glow * 0.2;
          colors[i3 + 2] = 0.95 + glow * 0.05;
        } else {
          colors[i3] = 0.9 + glow * 0.08;
          colors[i3 + 1] = 0.82 + glow * 0.15;
          colors[i3 + 2] = 0.75 + glow * 0.2;
        }
      }

      return { positions, colors };
    };

    return {
      celestial: makeShellStars(BACKGROUND_CELESTIAL_STAR_COUNT, BACKGROUND_STAR_RADIUS_MIN, BACKGROUND_STAR_RADIUS_MAX, 'icy'),
      grain: makeShellStars(BACKGROUND_GRAIN_STAR_COUNT, BACKGROUND_STAR_RADIUS_MIN * 0.8, BACKGROUND_STAR_RADIUS_MAX * 0.8, 'golden'),
    };
  }, []);

  const [aimedStarId, setAimedStarId] = useState<number | null>(null);
  const aimedStarRef = useRef<number | null>(null);
  const telemetryAccumRef = useRef(0);
  const [labelVisibleStarIds, setLabelVisibleStarIds] = useState<Set<number>>(new Set());
  const labelVisibleKeyRef = useRef('');
  const MAX_VISIBLE_LABELS = 12;
  const [launchEffects, setLaunchEffects] = useState<LaunchEffect[]>([]);
  
  const [stars, setStars] = useState<any[]>([]);
  const starsRef = useRef<any[]>([]);

  useEffect(() => {
    const starsUrl = `${import.meta.env.BASE_URL ?? '/'}stars.json`;
    fetch(starsUrl)
        .then(res => res.json())
        .then(data => {
            const loadedStars = data.map((s: any) => ({
                ...s,
                position: new Vector3(s.x, s.y, s.z)
            }));
            setStars(loadedStars);
            starsRef.current = loadedStars;
        })
        .catch(err => console.error("Failed to load stars:", err));
  }, []);

  useFrame((_, delta) => {
    controller.update(delta, inputRef.current);
    if (shipRef.current) {
        shipRef.current.position.copy(controller.position);
        shipRef.current.quaternion.copy(controller.quaternion);
    }
    if (backgroundStarRef.current) {
        backgroundStarRef.current.position.copy(camera.position);
    }
    tpsCamera.update(camera as PerspectiveCamera, controller);

    telemetryAccumRef.current += delta;
    if (telemetryAccumRef.current >= 0.1) {
      onTelemetryChange({
        speed: controller.speed,
        position: {
          x: controller.position.x,
          y: controller.position.y,
          z: controller.position.z
        }
      });
      telemetryAccumRef.current = 0;
    }

    const forward = controller.getForwardVector();
    const bestTarget = SelectionSystem.getBestTarget(controller.position, forward, stars);

    const labelConeAngle = CONFIG.CONE_ANGLE_THRESHOLD * 1.2;
    const labelConeCosThreshold = Math.cos(labelConeAngle);
    const labelConeLength = 50 * 14;
    const visibleCandidates: Array<{ id: number; dot: number; dist: number }> = [];
    for (const star of starsRef.current) {
      const toStar = new Vector3().subVectors(star.position, controller.position);
      const dist = toStar.length();
      if (dist === 0 || dist > labelConeLength) continue;
      toStar.normalize();
      const dot = forward.dot(toStar);
      if (dot > labelConeCosThreshold) {
        visibleCandidates.push({ id: star.id, dot, dist });
      }
    }
    visibleCandidates.sort((a, b) => {
      if (b.dot !== a.dot) return b.dot - a.dot;
      return a.dist - b.dist;
    });
    const visibleIds = visibleCandidates.slice(0, MAX_VISIBLE_LABELS).map((v) => v.id);
    const visibleKey = visibleIds.join(',');
    if (visibleKey !== labelVisibleKeyRef.current) {
      setLabelVisibleStarIds(new Set(visibleIds));
      labelVisibleKeyRef.current = visibleKey;
    }
    
    if (bestTarget !== aimedStarRef.current) {
        setAimedStarId(bestTarget);
        aimedStarRef.current = bestTarget;
        
        if (bestTarget !== null) {
            const star = starsRef.current.find(s => s.id === bestTarget);
            if (star) {
                const params = SemanticMapper.mapCoordinatesToParams(star.position.x, star.position.y, star.position.z);
                onAimChange({ color: star.color, params, word: star.word });
            }
        } else {
            onAimChange(null);
        }
    }
  });

  useEffect(() => {
      const selectAimedStar = () => {
          const currentAimedId = aimedStarRef.current;
          if (currentAimedId === null) return;

          const star = starsRef.current.find(s => s.id === currentAimedId);
          if (!star) return;

          const params = SemanticMapper.mapCoordinatesToParams(star.position.x, star.position.y, star.position.z);
          const selectedStarData = { color: star.color, params, word: star.word };
          setLaunchEffects((prev) => [
              ...prev.slice(-6),
              {
                  id: makeLaunchId(),
                  start: new Vector3().copy(controller.position),
                  target: new Vector3().copy(star.position),
                  elapsed: 0,
                  duration: 1.45,
                  selectedStarData,
              }
          ]);
      };

      const handleKeyDown = (event: KeyboardEvent) => {
          if (event.code !== 'Space' && event.key !== ' ') return;
          if (event.repeat) return;
          event.preventDefault();
          selectAimedStar();
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => {
          window.removeEventListener('keydown', handleKeyDown);
      };
  }, [onSelectStar, controller]);

  useFrame((_, delta) => {
    if (launchEffects.length === 0) return;

    const landed: typeof launchEffects = [];

    setLaunchEffects((currentEffects) =>
      currentEffects
        .map((effect) => {
          const nextElapsed = effect.elapsed + delta;
          if (nextElapsed >= effect.duration) {
            landed.push(effect);
            return null;
          }
          return { ...effect, elapsed: nextElapsed };
        })
        .filter((effect): effect is LaunchEffect => effect !== null)
    );

    landed.forEach((effect) => onSelectStar(effect.selectedStarData));
  });

  const getLaunchPosition = (effect: LaunchEffect): Vector3 => {
      const progress = clamp01(effect.elapsed / effect.duration);
      const outboundRatio = 0.55;
      const shipPosition = shipRef.current?.position ?? new Vector3();

      if (progress <= outboundRatio) {
          const segmentT = easeOutCubic(clamp01(progress / outboundRatio));
          return effect.start.clone().lerp(effect.target, segmentT);
      }

      const segmentT = easeOutCubic(clamp01((progress - outboundRatio) / (1 - outboundRatio)));
      return effect.target.clone().lerp(shipPosition, segmentT);
  };

  const coneHeight = 50 * 14;
  const coneRadius = Math.tan(CONFIG.CONE_ANGLE_THRESHOLD * 1.2) * coneHeight;
  const getLabelFontSize = (distance: number) => {
    const c = CONFIG.TEXT_MIN_FONT_SIZE;
    const d1 = CONFIG.TEXT_SIZE_BREAKPOINT;
    const a = CONFIG.TEXT_LINEAR_FONT_SLOPE;
    const raw = distance < d1 ? c : a * distance;
    return Math.min(CONFIG.TEXT_MAX_FONT_SIZE, Math.max(c, raw));
  };

  return (
    <>
      <group ref={shipRef}>
        <mesh position={[0, 0, 1.05]} rotation={[Math.PI / 2, 0, Math.PI / 4]}>
          <coneGeometry args={[0.6, 1.1, 16]} />
          <meshStandardMaterial color="#ffffff" metalness={0.8} roughness={0.15} emissive="#ffb35a" emissiveIntensity={0.35} />
        </mesh>

        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.45, 0.7, 2.4, 24]} />
          <meshStandardMaterial color="#2cffea" metalness={0.55} roughness={0.2} emissive="#005f87" emissiveIntensity={0.5} />
        </mesh>

        <mesh position={[0, 0, -1.75]} rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.5, 1.0, 16]} />
          <meshStandardMaterial color="#7b5bff" metalness={0.4} roughness={0.25} emissive="#260033" emissiveIntensity={0.35} />
        </mesh>

        <mesh position={[0.9, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <boxGeometry args={[1.2, 0.13, 0.25]} />
          <meshStandardMaterial color="#ffea00" metalness={0.35} roughness={0.2} emissive="#5a4a00" emissiveIntensity={0.35} />
        </mesh>
        <mesh position={[-0.9, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <boxGeometry args={[1.2, 0.13, 0.25]} />
          <meshStandardMaterial color="#ffea00" metalness={0.35} roughness={0.2} emissive="#5a4a00" emissiveIntensity={0.35} />
        </mesh>

        <mesh position={[0, 0.32, 0]} rotation={[0, Math.PI / 4, 0]}>
          <cylinderGeometry args={[0.09, 0.09, 0.85, 12]} />
          <meshStandardMaterial color="#4be6ff" metalness={0.15} roughness={0.2} emissive="#0d4458" emissiveIntensity={0.8} />
        </mesh>

        <mesh position={[0, -0.24, 0.1]} rotation={[0, 0, Math.PI]}>
          <sphereGeometry args={[0.22, 16, 16]} />
          <meshStandardMaterial color="#f4fdff" metalness={0.25} roughness={0.15} emissive="#103a60" emissiveIntensity={0.4} />
        </mesh>


        {debugMode && (
          <mesh position={[0, 0, coneHeight / 2]} rotation={[-Math.PI / 2, 0, 0]}>
            <coneGeometry args={[coneRadius, coneHeight, 16, 1, true]} />
            <meshBasicMaterial color="yellow" wireframe={true} transparent={true} opacity={0.3} />
          </mesh>
        )}
      </group>

      <group ref={backgroundStarRef} frustumCulled={false}>
        <points>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes.position"
              args={[backgroundStars.celestial.positions, 3]}
            />
            <bufferAttribute
              attach="attributes.color"
              args={[backgroundStars.celestial.colors, 3]}
            />
          </bufferGeometry>
          <pointsMaterial
            size={1.7}
            sizeAttenuation
            vertexColors
            transparent
            depthWrite={false}
            blending={AdditiveBlending}
            opacity={0.75}
          />
        </points>

        <points>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes.position"
              args={[backgroundStars.grain.positions, 3]}
            />
            <bufferAttribute
              attach="attributes.color"
              args={[backgroundStars.grain.colors, 3]}
            />
          </bufferGeometry>
          <pointsMaterial
            size={2.8}
            sizeAttenuation
            vertexColors
            transparent
            depthWrite={false}
            blending={AdditiveBlending}
            opacity={0.92}
          />
        </points>
      </group>

      {stars.map((star) => {
          const isAimed = star.id === aimedStarId;
          const showText = labelVisibleStarIds.has(star.id) || isAimed;
          const distanceToCamera = camera.position.distanceTo(star.position);
          const labelFontSize = Math.round(getLabelFontSize(distanceToCamera));
          
          return (
            <group key={star.id} position={star.position}>
                <mesh>
                    <sphereGeometry args={[1, 8, 8]} />
                    <meshBasicMaterial color={star.color} />
                </mesh>
                
                {isAimed && (
                    <mesh position={[0, 4, 0]} rotation={[0, 0, Math.PI]}>
                        <coneGeometry args={[1, 2, 4]} />
                        <meshBasicMaterial color="white" />
                    </mesh>
                )}

        {showText && (
          <Html distanceFactor={10}>
            <div style={{ ...(CONFIG.TEXT_STYLE as any), fontSize: `${labelFontSize}px` }}>
              {star.word}
            </div>
          </Html>
        )}
      </group>
    );
      })}

      {launchEffects.map((effect) => {
        const position = getLaunchPosition(effect);
        return (
          <group key={effect.id} position={position.toArray()}>
            <mesh>
              <sphereGeometry args={[0.16, 12, 12]} />
              <meshStandardMaterial color="#ffef5f" emissive="#ffef5f" emissiveIntensity={1} />
            </mesh>
          </group>
        );
      })}
      
      <gridHelper args={[2000, 20]} />
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
    </>
  );
};
