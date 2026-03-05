import { memo, useMemo } from 'react';
import { AdditiveBlending, CanvasTexture, Color, DoubleSide, SRGBColorSpace } from 'three';
import type { FlowerRenderParams } from '../types';
import { normalizeFlowerParams } from '../modules/FlowerShape';
import { buildFlowerCanvas } from '../modules/FlowerCanvas';

type FlowerProps = {
  params: FlowerRenderParams;
  color: string;
  scale?: number;
  growth?: number;
  vitality?: number;
};

const clamp = (value: number, min: number, max: number) => {
  return Math.max(min, Math.min(max, value));
};

const FLOWER_CANVAS_SIZE = 120;
const TEXTURE_CACHE = new Map<string, CanvasTexture>();

function makeTextureKey(params: FlowerRenderParams, color: string, growth: number) {
  return JSON.stringify({
    color,
    growth: Number(clamp(growth, 0, 1).toFixed(3)),
    m: params.m,
    n1: params.n1,
    n2: params.n2,
    n3: params.n3,
    rot: params.rot,
    petalCount: params.petalCount,
    petalStretch: params.petalStretch,
    petalCrest: params.petalCrest,
    petalSpread: params.petalSpread,
    coreRadius: params.coreRadius,
    coreGlow: params.coreGlow,
    rimWidth: params.rimWidth,
    outlineWeight: params.outlineWeight,
    symmetry: params.symmetry,
    mandalaDepth: params.mandalaDepth,
    ringBands: params.ringBands,
    radialTwist: params.radialTwist,
    innerVoid: params.innerVoid,
    fractalIntensity: params.fractalIntensity,
    sectorWarp: params.sectorWarp,
    ringContrast: params.ringContrast,
    depthEcho: params.depthEcho,
  });
}

function getFlowerTexture(params: FlowerRenderParams, color: string, growth: number) {
  const key = makeTextureKey(params, color, growth);
  const cached = TEXTURE_CACHE.get(key);
  if (cached) {
    return cached;
  }

  const canvas = buildFlowerCanvas(params, color, FLOWER_CANVAS_SIZE, growth);
  const texture = new CanvasTexture(canvas);
  texture.flipY = false;
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  TEXTURE_CACHE.set(key, texture);
  return texture;
}

function getVitalityColor(color: string, vitality: number) {
  const parsed = new Color(color);
  parsed.multiplyScalar(Math.max(0, Math.min(1, vitality)));
  return `#${parsed.getHexString()}`;
}

const FlowerCore = ({ params, color, scale = 1, growth, vitality = 1 }: FlowerProps) => {
  const resolvedParams = useMemo(() => normalizeFlowerParams(params), [params]);
  const normalizedGrowth = clamp(growth === undefined ? 1 : growth, 0, 1);
  const normalizedVitality = clamp(vitality, 0, 1);
  const vigor = normalizedVitality;
  const vitalityColor = useMemo(() => getVitalityColor(color, normalizedVitality), [color, normalizedVitality]);
  const texture = useMemo(
    () => getFlowerTexture(resolvedParams, color, normalizedGrowth),
    [resolvedParams, color, normalizedGrowth],
  );
  const groupScale = scale * (0.25 + 0.75 * normalizedGrowth);
  const alpha = (0.35 + 0.65 * normalizedGrowth) * (0.25 + 0.75 * vigor);
  const rim = 1 + resolvedParams.rimWidth * 0.12;
  const witheringOverlay = Math.min(1, (1 - normalizedVitality) * 1.15);
  const witherOpacity = Math.max(0, Math.min(1, witheringOverlay));

  return (
    <group scale={[groupScale, groupScale, 1]}>
      <mesh position={[0, 0, 0.02]}>
        <planeGeometry args={[rim * 1.16, rim * 1.16]} />
        <meshBasicMaterial
          map={texture}
          color={vitalityColor}
          side={DoubleSide}
          transparent
          opacity={0.22 * alpha}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <mesh>
        <planeGeometry args={[rim, rim]} />
        <meshBasicMaterial map={texture} side={DoubleSide} color={vitalityColor} transparent opacity={alpha} toneMapped={false} />
      </mesh>

      <mesh position={[0, 0, 0.01]}>
        <planeGeometry args={[rim, rim]} />
        <meshBasicMaterial
          map={texture}
          color="#000000"
          side={DoubleSide}
          transparent
          opacity={witherOpacity * 0.65 * alpha}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
};

export const Flower = memo(FlowerCore);
