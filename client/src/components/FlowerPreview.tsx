import { useEffect, useRef } from 'react';
import { buildFlowerProfile } from '../modules/FlowerShape';
import type { FlowerRenderParams } from '../types';

const TAU = Math.PI * 2;

type FlowerPreviewProps = {
  params: FlowerRenderParams;
  color: string;
  size?: number;
};

function drawShape(ctx: CanvasRenderingContext2D, points: Array<{ x: number; y: number }>, color: string, alpha: number, width: number, fill = false) {
  if (points.length === 0) return;
  ctx.beginPath();
  for (let i = 0; i < points.length; i += 1) {
    const p = points[i];
    if (i === 0) {
      ctx.moveTo(p.x, p.y);
    } else {
      ctx.lineTo(p.x, p.y);
    }
  }
  ctx.closePath();
  ctx.strokeStyle = color;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = Math.max(1, width);
  ctx.stroke();
  if (fill) {
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha * 0.25;
    ctx.fill();
  }
}

export const FlowerPreview = ({
  params,
  color,
  size = 150,
}: FlowerPreviewProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const profile = buildFlowerProfile(params, color);

    const s = size / 2;
    const scale = size * 0.16;

    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.translate(s, s);

    const pointsOuter = profile.outerPoints.map((point) => ({ x: point.x * scale, y: point.y * scale }));
    const pointsInner = profile.innerPoints.map((point) => ({ x: point.x * scale * 0.78, y: point.y * scale * 0.78 }));

    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowBlur = 12;
    ctx.shadowColor = profile.palette.outerGlow;

    drawShape(ctx, pointsOuter, profile.palette.outer, 0.45, 4.2, true);
    drawShape(ctx, pointsOuter, profile.palette.outerGlow, 0.72, 1.8, false);
    drawShape(ctx, pointsOuter, profile.palette.line, 0.9, 0.9, false);

    drawShape(ctx, pointsInner, profile.palette.inner, 0.7, 2.8, true);
    drawShape(ctx, pointsInner, profile.palette.innerGlow, 0.5, 1.2, false);
    drawShape(ctx, pointsInner, profile.palette.line, 0.35, 1.0, false);

    for (let i = 0; i < profile.outerPoints.length; i += 1) {
      const p = profile.outerPoints[i];
      const phi = (i / profile.outerPoints.length) * TAU;
      const cx = p.x * 0.18 * Math.cos(phi);
      const cy = p.y * 0.18 * Math.sin(phi);
      const t = (Math.sin(phi * 6 + size * 0.01) + 1) / 2;
      if (t > 0.74) {
        ctx.beginPath();
        ctx.fillStyle = i % 2 === 0 ? profile.palette.inner : profile.palette.innerGlow;
        ctx.globalAlpha = 0.35 + t * 0.2;
        ctx.arc(
          p.x * scale + cx * (scale / 100),
          p.y * scale + cy * (scale / 100),
          1.2 + t,
          0,
          TAU
        );
        ctx.fill();
      }
    }

    const pulse = 0.14 + 0.12 * ((new Date().getTime() % 900) / 900);
    const halo = profile.coreRadius * scale * 3.3;
    const core = profile.haloRadius * scale * 0.92;
    ctx.beginPath();
    ctx.arc(0, 0, halo * (1 + pulse), 0, TAU);
    ctx.strokeStyle = profile.palette.coreGlow;
    ctx.globalAlpha = 0.32;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, core, 0, TAU);
    ctx.fillStyle = profile.palette.core;
    ctx.globalAlpha = 0.95;
    ctx.fill();

    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
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
