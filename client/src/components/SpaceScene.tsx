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

export const SpaceScene = ({ onSelectStar }: { onSelectStar: (data: any) => void }) => {
  const controller = useMemo(() => new SpaceshipController(), []);
  const tpsCamera = useMemo(() => new TPSCamera(), []);
  const inputRef = useInput();
  const shipRef = useRef<Mesh>(null);
  const { camera } = useThree();

  const [aimedStarId, setAimedStarId] = useState<number | null>(null);
  const [showConeDebug, setShowConeDebug] = useState(false);
  const [stars, setStars] = useState<any[]>([]);

  useEffect(() => {
    fetch('/stars.json')
        .then(res => res.json())
        .then(data => {
            const loadedStars = data.map((s: any) => ({
                ...s,
                position: new Vector3(s.x, s.y, s.z)
            }));
            setStars(loadedStars);
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

    const forward = controller.getForwardVector();
    const bestTarget = SelectionSystem.getBestTarget(controller.position, forward, stars);
    setAimedStarId(bestTarget);
  });

  const handleInteraction = () => {
    if (aimedStarId !== null) {
        const star = stars.find(s => s.id === aimedStarId);
        if (star) {
            const params = SemanticMapper.mapCoordinatesToParams(star.position.x, star.position.y, star.position.z);
            onSelectStar({ color: star.color, params, word: star.word }); 
        }
    }
  };

  return (
    <>
      <mesh visible={false} onClick={handleInteraction}>
          <boxGeometry args={[CONFIG.CUBE_SIZE*2, CONFIG.CUBE_SIZE*2, CONFIG.CUBE_SIZE*2]} />
      </mesh>

      <mesh ref={shipRef}>
        <coneGeometry args={[1, 4, 4]} />
        <meshStandardMaterial color="orange" />
        <axesHelper args={[5]} />
        
        {showConeDebug && (
             <line>
                <bufferGeometry>
                     <bufferAttribute attach="attributes-position" count={2} array={new Float32Array([0,0,0, 0,0,50])} itemSize={3} args={[new Float32Array([0,0,0, 0,0,50]), 3]} />
                </bufferGeometry>
                <lineBasicMaterial color="yellow" />
            </line>
        )}
      </mesh>
      
      {stars.map((star) => {
          const isAimed = star.id === aimedStarId;
          const dist = shipRef.current ? star.position.distanceTo(shipRef.current.position) : Infinity;
          const showText = dist < CONFIG.TEXT_LOD_DISTANCE;
          
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
                        <div style={{ color: 'black', background: 'white', padding: '2px', borderRadius: '4px', fontSize: '12px' }}>
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
      
      <Html position={[0, -10, 0]} fullscreen style={{ pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', pointerEvents: 'auto' }}>
              <button onClick={() => setShowConeDebug(prev => !prev)}>
                  Debug Cone: {showConeDebug ? 'ON' : 'OFF'}
              </button>
          </div>
      </Html>
    </>
  );
};
