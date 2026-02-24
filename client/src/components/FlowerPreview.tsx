import { useRef, useEffect } from 'react';

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

export const FlowerPreview = ({ 
    params, 
    color, 
    size = 150 
}: { 
    params: { m: number, n1: number, n2: number, n3: number, rot?: number }, 
    color: string, 
    size?: number 
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const { m, n1, n2, n3, rot = 0 } = params;
        const mInteger = Math.max(1, Math.round(m));
        const N = Math.max(180, 180 * mInteger);
        const scale = size * 0.3; 
        
        ctx.clearRect(0, 0, size, size);
        ctx.save();
        ctx.translate(size / 2, size / 2);

        ctx.beginPath();
        for (let i = 0; i <= N; i++) {
            const phi = (i / N) * TAU;
            const r = superR(phi, m, n1, n2, n3) * scale;
            const x = r * Math.cos(phi + rot);
            const y = r * Math.sin(phi + rot);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = color.replace('hsl', 'hsla').replace(')', ', 0.3)'); 
        ctx.fill();

        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, TAU);
        ctx.fillStyle = '#ffd700';
        ctx.fill();

        ctx.restore();
    }, [params, color, size]);

    return (
        <canvas 
            ref={canvasRef} 
            width={size} 
            height={size} 
            style={{ width: size, height: size }} 
        />
    );
};
