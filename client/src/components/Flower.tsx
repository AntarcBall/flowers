import { memo, useMemo } from 'react';
import { DoubleSide, type MeshPhysicalMaterialProps } from 'three';
import { CONFIG } from '../config';
import type { FlowerRenderParams } from '../types';
import { buildFlowerProfile, normalizeFlowerParams } from '../modules/FlowerShape';

type FlowerProps = {
  params: FlowerRenderParams;
  color: string;
  scale?: number;
  growth?: number;
};

const clamp = (value: number, min: number, max: number) => {
  return Math.max(min, Math.min(max, value));
};

const FlowerCore = ({
  params,
  color,
  scale = 1,
  growth,
}: FlowerProps) => {
  const resolvedParams = useMemo(() => normalizeFlowerParams(params), [params]);
  const profile = useMemo(() => buildFlowerProfile(resolvedParams, color), [resolvedParams, color]);
  const normalizedGrowth = clamp(growth === undefined ? 1 : growth, 0, 1);
  const bloomT = 0.2 + Math.pow(normalizedGrowth, 0.85) * 0.8;

  const pulse = normalizedGrowth === 1 ? 1 : 0.35 + 0.65 * Math.sin((normalizedGrowth * Math.PI) / 2);

  const coreGlowProps: MeshPhysicalMaterialProps = {
    color: profile.palette.core,
    roughness: 0.15,
    metalness: 0.35,
    emissive: profile.palette.coreGlow,
    emissiveIntensity: 0.4 + resolvedParams.coreGlow * 0.7,
    clearcoat: 0.7,
    clearcoatRoughness: 0.2,
    opacity: 0.8 + 0.2 * bloomT,
    transparent: true,
  };

  return (
    <group scale={scale * (0.3 + 0.7 * bloomT)}>
      <group scale={[(1 + resolvedParams.rimWidth * 0.12) * (0.85 + 0.15 * normalizedGrowth), (1 + resolvedParams.rimWidth * 0.12) * (0.85 + 0.15 * normalizedGrowth), 1]}>
        <mesh position={[0, 0, 0.2 * normalizedGrowth]}>
          <extrudeGeometry
            args={[
              profile.outerShape,
              {
                depth: CONFIG.FLOWER_SHAPE.outerExtrudeDepth * normalizedGrowth,
                bevelEnabled: false,
              },
            ]}
          />
          <meshPhysicalMaterial
            color={profile.palette.outer}
            roughness={0.3}
            metalness={0.28}
            emissive={profile.palette.outerGlow}
            emissiveIntensity={0.28 + resolvedParams.coreGlow * 0.42}
            clearcoat={0.4}
            clearcoatRoughness={0.5}
            side={DoubleSide}
            transparent
            opacity={0.95}
          />
        </mesh>

        <mesh position={[0, 0, 0.34 * normalizedGrowth]}>
          <extrudeGeometry
            args={[
              profile.innerShape,
              {
                depth: CONFIG.FLOWER_SHAPE.innerExtrudeDepth * normalizedGrowth,
                bevelEnabled: false,
              },
            ]}
          />
          <meshStandardMaterial
            color={profile.palette.inner}
            roughness={0.62}
            metalness={0.05}
            emissive={profile.palette.innerGlow}
            emissiveIntensity={0.08 + resolvedParams.coreGlow * 0.25}
            side={DoubleSide}
          />
        </mesh>

        <mesh position={[0, 0, 0.44 * normalizedGrowth]}>
          <extrudeGeometry
            args={[
              profile.innerShape,
              {
                depth: CONFIG.FLOWER_SHAPE.innerExtrudeDepth * 0.55 * normalizedGrowth,
                bevelEnabled: false,
              },
            ]}
          />
          <meshStandardMaterial
            color={profile.palette.line}
            roughness={0.42}
            metalness={0.18}
            emissive={profile.palette.innerGlow}
            emissiveIntensity={0.16 + resolvedParams.coreGlow * 0.32}
            side={DoubleSide}
            transparent
            opacity={0.45}
          />
        </mesh>

        <mesh position={[0, 0, CONFIG.FLOWER_SHAPE.coreBaseScale * normalizedGrowth + 0.52]}>
          <sphereGeometry args={[profile.coreRadius * (1 + 0.5 * resolvedParams.coreGlow), 28, 28]}>
          </sphereGeometry>
          <meshPhysicalMaterial {...coreGlowProps} />
        </mesh>

        <mesh position={[0, 0, CONFIG.FLOWER_SHAPE.coreBaseScale * normalizedGrowth + 0.66]}>
          <sphereGeometry args={[Math.max(0.003, profile.coreRadius * 0.55), 24, 24]}>
          </sphereGeometry>
          <meshStandardMaterial
            color={profile.palette.inner}
            roughness={0.22}
            metalness={0.32}
            emissive={profile.palette.coreGlow}
            emissiveIntensity={0.5 + resolvedParams.coreGlow * 0.5}
          />
        </mesh>

        <line>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[profile.outerLine, 3]} />
          </bufferGeometry>
          <lineBasicMaterial color={profile.palette.edge} transparent opacity={0.95} linewidth={profile.strokeWeight * 1.2 * bloomT} />
        </line>

        <line>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[profile.innerLine, 3]} />
          </bufferGeometry>
          <lineBasicMaterial
            color={profile.palette.line}
            transparent
            opacity={0.3 + 0.2 * resolvedParams.coreGlow}
            linewidth={Math.max(0.8, profile.strokeWeight * 0.7)}
          />
        </line>
      </group>

      <mesh position={[0, 0, -0.45 * (1 - normalizedGrowth)]}>
        <sphereGeometry args={[profile.haloRadius * (0.45 + 0.55 * bloomT) * pulse, 18, 18]}>
        </sphereGeometry>
        <meshStandardMaterial
          color={profile.palette.outerGlow}
          roughness={1}
          metalness={0}
          transparent
          opacity={0.12 * normalizedGrowth * pulse}
          side={DoubleSide}
        />
      </mesh>
    </group>
  );
};

export const Flower = memo(FlowerCore);
