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

export const SpaceScene = ({ onSelectStar, debugMode, onAimChange }: { onSelectStar: (data: any) => void, debugMode: boolean, onAimChange: (data: any) => void }) => {
  const controller = useMemo(() => new SpaceshipController(), []);
  const tpsCamera = useMemo(() => new TPSCamera(), []);
  const inputRef = useInput();
  const shipRef = useRef<Mesh>(null);
  const { camera, gl } = useThree();

  const [aimedStarId, setAimedStarId] = useState<number | null>(null);
  const aimedStarRef = useRef<number | null>(null);
  
  const [stars, setStars] = useState<any[]>([]);
  const starsRef = useRef<any[]>([]);

  useEffect(() => {
    fetch('/stars.json')
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

    const forward = controller.getForwardVector();
    const bestTarget = SelectionSystem.getBestTarget(controller.position, forward, stars);
    
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

  const coneHeight = 50;
  const coneRadius = Math.tan(CONFIG.CONE_ANGLE_THRESHOLD) * coneHeight;

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
          const showText = isAimed; 
          
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
                        <div style={CONFIG.TEXT_STYLE as any}>
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
