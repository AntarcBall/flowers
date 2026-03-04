import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useThree } from '@react-three/fiber';
import { OrthographicCamera, Html } from '@react-three/drei';
import { GardenManager } from '../modules/GardenManager';
import { useInput } from '../hooks/useInput';
import { OrthographicCamera as ThreeOrthographicCamera } from 'three';
import { CONFIG } from '../config';
import { Flower } from './Flower';
import { PersistenceService } from '../modules/PersistenceService';

const MOVEMENT_KEYS = new Set(['w', 'W', 'a', 'A', 's', 'S', 'd', 'D']);

export const GardenScene = ({ selectedStarData }: { selectedStarData: any }) => {
    const manager = useMemo(() => new GardenManager(), []);
    const inputRef = useInput();
    const { camera, invalidate } = useThree();
    const [flowers, setFlowers] = useState(manager.flowers);
    const rafRef = useRef<number | null>(null);

    const stepGarden = useCallback(() => {
        manager.update(inputRef.current, camera as ThreeOrthographicCamera);
        invalidate();
    }, [camera, invalidate, inputRef, manager]);

    useEffect(() => {
        manager.init();
        manager.selectedStarData = selectedStarData;
        setFlowers([...manager.flowers]);
        stepGarden();

        const handleStorageChange = (event: StorageEvent) => {
            if (event.key && event.key !== CONFIG.STORAGE_KEY) return;
            manager.init();
            setFlowers([...manager.flowers]);
            invalidate();
        };

        const handleCustomStorageUpdate = () => {
            manager.init();
            setFlowers([...manager.flowers]);
            invalidate();
        };

        window.addEventListener('storage', handleStorageChange);
        window.addEventListener(PersistenceService.STORAGE_UPDATED_EVENT, handleCustomStorageUpdate);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener(PersistenceService.STORAGE_UPDATED_EVENT, handleCustomStorageUpdate);
        };
    }, [invalidate, manager, selectedStarData, stepGarden]);

    useEffect(() => {
        const run = () => {
            stepGarden();
            rafRef.current = window.requestAnimationFrame(run);
        };

        const startLoop = () => {
            if (rafRef.current !== null) return;
            rafRef.current = window.requestAnimationFrame(run);
        };

        const stopLoop = () => {
            if (rafRef.current === null) return;
            window.cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
            stepGarden();
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (!MOVEMENT_KEYS.has(event.key)) return;
            startLoop();
        };

        const handleKeyUp = (event: KeyboardEvent) => {
            if (!MOVEMENT_KEYS.has(event.key)) return;
            const isAnyMovementKeyHeld = ['w', 'W', 'a', 'A', 's', 'S', 'd', 'D'].some((key) => inputRef.current[key]);
            if (!isAnyMovementKeyHeld) {
                stopLoop();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            if (rafRef.current !== null) {
                window.cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
        };
    }, [inputRef, stepGarden]);

    const handlePlant = (e: any) => {
        const point = e.point;
        const newFlower = manager.plantFlower(point.x, point.y);
        if (newFlower) {
            setFlowers([...manager.flowers]);
            invalidate();
        }
    };

    return (
        <>
           <OrthographicCamera makeDefault position={[CONFIG.GARDEN_SIZE/2, CONFIG.GARDEN_SIZE/2, 100]} zoom={1} near={0.1} far={1000} />
           <color attach="background" args={['black']} />
           
           <mesh position={[CONFIG.GARDEN_SIZE/2, CONFIG.GARDEN_SIZE/2, 0]} onClick={handlePlant}>
               <planeGeometry args={[CONFIG.GARDEN_SIZE, CONFIG.GARDEN_SIZE]} />
               <meshBasicMaterial color="black" />
           </mesh>

           {flowers.map(f => (
               <group key={f.id} position={[f.x, f.y, 1]}>
                   <Flower params={f.params as any} color={f.color} scale={13} />
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
                    border: 'none',
                    pointerEvents: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'column',
                    boxShadow: '0 0 12px rgba(255, 255, 255, 0.45)',
                    color: 'white',
                    overflow: 'hidden',
                }}>
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        background: selectedStarData.color,
                        opacity: 0.35,
                    }} />
                    <div style={{ fontSize: '10px' }}>Preview</div>
                    <div style={{ position: 'relative', fontSize: '14px', fontWeight: 'bold' }}>{selectedStarData.word}</div>
                    <div style={{ position: 'relative', width: '40px', height: '40px', background: selectedStarData.color, borderRadius: '50%', margin: '5px', border: '2px solid rgba(255,255,255,0.8)' }}></div>
                </div>
           </Html>
        </>
    );
};
