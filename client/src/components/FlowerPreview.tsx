import { useEffect, useRef } from 'react';
import { drawFlowerToCanvas } from '../modules/FlowerCanvas';
import type { FlowerRenderParams } from '../types';

type FlowerPreviewProps = {
  params: FlowerRenderParams;
  color: string;
  size?: number;
};

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
    canvas.width = size;
    canvas.height = size;
    drawFlowerToCanvas({
      ctx,
      params,
      color,
      size,
      growth: 1,
      time: Date.now(),
    });
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
