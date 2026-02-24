import { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { SpaceshipController } from '../modules/SpaceshipController';
import { TPSCamera } from '../modules/TPSCamera';
import { SelectionSystem } from '../modules/SelectionSystem';
import { useInput } from '../hooks/useInput';
import { Vector3, Mesh, PerspectiveCamera } from 'three';
import { SemanticMapper } from '../modules/SemanticMapper';
import { Html } from '@react-three/drei';
import { CONFIG } from '../config';

type Telemetry = {
  speed: number;
  position: { x: number; y: number; z: number };
};

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
  const shipRef = useRef<Mesh>(null);
  const { camera, gl } = useThree();

  const [aimedStarId, setAimedStarId] = useState<number | null>(null);
  const aimedStarRef = useRef<number | null>(null);
  const telemetryAccumRef = useRef(0);
  const [labelVisibleStarIds, setLabelVisibleStarIds] = useState<Set<number>>(new Set());
  const labelVisibleKeyRef = useRef('');
  const MAX_VISIBLE_LABELS = 12;
  
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
      const handleClick = () => {
          const currentAimedId = aimedStarRef.current;
          if (currentAimedId !== null) {
              const star = starsRef.current.find(s => s.id === currentAimedId);
              if (star) {
                  const params = SemanticMapper.mapCoordinatesToParams(star.position.x, star.position.y, star.position.z);
                  onSelectStar({ color: star.color, params, word: star.word });
              }
          }
      };

      const canvas = gl.domElement;
      canvas.addEventListener('click', handleClick);
      return () => {
          canvas.removeEventListener('click', handleClick);
      };
  }, [gl.domElement, onSelectStar]); 

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
      <mesh ref={shipRef}>
        <coneGeometry args={[1, 4, 4]} />
        <meshStandardMaterial color="orange" />
        <axesHelper args={[5]} />
        
        {debugMode && (
             <mesh position={[0, 0, coneHeight / 2]} rotation={[-Math.PI / 2, 0, 0]}>
                 <coneGeometry args={[coneRadius, coneHeight, 16, 1, true]} />
                 <meshBasicMaterial color="yellow" wireframe={true} transparent={true} opacity={0.3} />
             </mesh>
        )}
      </mesh>
      
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
      
      <gridHelper args={[2000, 20]} />
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
    </>
  );
};
