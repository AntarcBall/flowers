import { useMemo, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrthographicCamera, Html } from '@react-three/drei';
import { GardenManager } from '../modules/GardenManager';
import { useInput } from '../hooks/useInput';
import { OrthographicCamera as ThreeOrthographicCamera } from 'three';
import { CONFIG } from '../config';
import { Flower } from './Flower';

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
               <meshBasicMaterial color="white" />
           </mesh>

           {flowers.map(f => (
               <group key={f.id} position={[f.x, f.y, 1]}>
                   <Flower params={f.params as any} color={f.color} scale={10} />
               </group>
           ))}
           
           <ambientLight />
           
           <Html position={[0,0,0]} fullscreen style={{ pointerEvents: 'none' }}>
               <div style={{
                   position: 'absolute',
                   bottom: '20px',
                   right: '20px',
                   width: '15vh',
                   height: '15vh',
                   background: 'rgba(255, 255, 255, 0.8)',
                   border: '2px solid black',
                   pointerEvents: 'auto',
                   display: 'flex',
                   alignItems: 'center',
                   justifyContent: 'center',
                   flexDirection: 'column'
               }}>
                   <div style={{ fontSize: '10px' }}>Preview</div>
                   <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{selectedStarData.word}</div>
                   <div style={{ width: '40px', height: '40px', background: selectedStarData.color, borderRadius: '50%', margin: '5px' }}></div>
               </div>
           </Html>
        </>
    );
};
