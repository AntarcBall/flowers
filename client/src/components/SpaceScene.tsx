import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { SpaceshipController } from '../modules/SpaceshipController';
import { TPSCamera } from '../modules/TPSCamera';
import { useInput } from '../hooks/useInput';
import { Vector3, Mesh, PerspectiveCamera } from 'three';
import { SemanticMapper } from '../modules/SemanticMapper';

export const SpaceScene = ({ onSelectStar }: { onSelectStar: (data: any) => void }) => {
  const controller = useMemo(() => new SpaceshipController(), []);
  const tpsCamera = useMemo(() => new TPSCamera(), []);
  const inputRef = useInput();
  const shipRef = useRef<Mesh>(null);
  const { camera } = useThree();

  const stars = useMemo(() => {
    const arr = [];
    for(let i=0; i<100; i++) {
        arr.push({
            position: new Vector3(
                (Math.random()-0.5)*1000,
                (Math.random()-0.5)*1000,
                (Math.random()-0.5)*1000
            ),
            color: 'white'
        });
    }
    return arr;
  }, []);

  useFrame((_, delta) => {
    controller.update(delta, inputRef.current);
    if (shipRef.current) {
        shipRef.current.position.copy(controller.position);
        shipRef.current.quaternion.copy(controller.quaternion);
    }
    tpsCamera.update(camera as PerspectiveCamera, controller);
  });

  return (
    <>
      <mesh ref={shipRef}>
        <coneGeometry args={[1, 4, 4]} />
        <meshStandardMaterial color="orange" />
        <axesHelper args={[5]} />
      </mesh>
      
      {stars.map((star, i) => (
          <mesh key={i} position={star.position} onClick={(e) => {
              e.stopPropagation();
              const params = SemanticMapper.mapCoordinatesToParams(star.position.x, star.position.y, star.position.z);
              onSelectStar({ color: 'red', params });
          }}>
              <sphereGeometry args={[2, 16, 16]} />
              <meshBasicMaterial color={star.color} />
          </mesh>
      ))}
      
      <gridHelper args={[2000, 20]} />
      <ambientLight />
      <pointLight position={[10, 10, 10]} />
    </>
  );
};
