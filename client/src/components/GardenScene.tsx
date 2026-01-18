import { useMemo, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrthographicCamera } from '@react-three/drei';
import { GardenManager } from '../modules/GardenManager';
import { useInput } from '../hooks/useInput';
import { OrthographicCamera as ThreeOrthographicCamera } from 'three';
import { CONFIG } from '../config';

export const GardenScene = ({ selectedStarData }: { selectedStarData: any }) => {
    const manager = useMemo(() => new GardenManager(), []);
    const inputRef = useInput();
    const { camera } = useThree();
    const [flowers, setFlowers] = useState(manager.flowers);

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
           <OrthographicCamera makeDefault position={[CONFIG.GARDEN_SIZE/2, CONFIG.GARDEN_SIZE/2, 100]} zoom={1} near={0.1} far={1000} />
           
           <mesh position={[CONFIG.GARDEN_SIZE/2, CONFIG.GARDEN_SIZE/2, 0]} onClick={handlePlant}>
               <planeGeometry args={[CONFIG.GARDEN_SIZE, CONFIG.GARDEN_SIZE]} />
               <meshBasicMaterial color="#228822" />
           </mesh>

           {flowers.map(f => (
               <mesh key={f.id} position={[f.x, f.y, 1]}>
                   <sphereGeometry args={[10, 16, 16]} />
                   <meshStandardMaterial color={f.color} />
               </mesh>
           ))}
           
           <ambientLight />
        </>
    );
};
