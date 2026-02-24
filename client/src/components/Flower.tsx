import { useMemo } from 'react';
import { Vector3 } from 'three';

const TAU = Math.PI * 2;

function superR(phi: number, m: number, n1: number, n2: number, n3: number, a = 1, b = 1) {
    const t1 = Math.pow(Math.abs(Math.cos(m * phi / 4) / a), n2);
    const t2 = Math.pow(Math.abs(Math.sin(m * phi / 4) / b), n3);
    const base = t1 + t2;

    if (base <= 0 || !Number.isFinite(base)) return 0;
    const r = Math.pow(base, -1 / n1);
    if (!Number.isFinite(r)) return 0;
    return r;
}

export const Flower = ({ 
    params, 
    color, 
    scale = 1 
}: { 
    params: { m: number, n1: number, n2: number, n3: number, rot?: number }, 
    color: string, 
    scale?: number 
}) => {
    const points = useMemo(() => {
        const { m, n1, n2, n3, rot = 0 } = params;
        const mInteger = Math.max(1, Math.round(m));
        const N = Math.max(180, 360 * mInteger);
        const pts = [];

        for (let i = 0; i <= N; i++) {
            const phi = (i / N) * TAU;
            const r = superR(phi, m, n1, n2, n3);
            const x = r * Math.cos(phi + rot);
            const y = r * Math.sin(phi + rot);
            pts.push(new Vector3(x, y, 0));
        }
        return pts;
    }, [params]);

    return (
        <group scale={[scale, scale, scale]}>
             <line>
                <bufferGeometry>
                    <bufferAttribute 
                        attach="attributes-position" 
                        count={points.length} 
                        array={new Float32Array(points.flatMap(p => [p.x, p.y, p.z]))} 
                        itemSize={3} 
                        args={[new Float32Array(points.flatMap(p => [p.x, p.y, p.z])), 3]}
                    />
                </bufferGeometry>
                <lineBasicMaterial color={color} linewidth={2} />
             </line>
             
             <mesh>
                 <circleGeometry args={[0.08, 16]} />
                 <meshBasicMaterial color="#ffd700" />
             </mesh>
        </group>
    );
};
