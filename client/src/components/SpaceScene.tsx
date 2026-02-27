import { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { SpaceshipController } from '../modules/SpaceshipController';
import { TPSCamera } from '../modules/TPSCamera';
import { useInput } from '../hooks/useInput';
import {
  Vector3,
  Group,
  PerspectiveCamera,
  AdditiveBlending,
  Color,
  SphereGeometry,
  MeshBasicMaterial,
} from 'three';
import { SemanticMapper } from '../modules/SemanticMapper';
import { Html } from '@react-three/drei';
import {
  DEFAULT_SPACE_PERFORMANCE_SETTINGS,
  type SpacePerformanceSettings,
  LABEL_FONT_MIN_MAX,
} from '../modules/PerformanceSettings';
import { CONFIG } from '../config';

type Telemetry = {
  speed: number;
  position: { x: number; y: number; z: number };
  velocity?: { x: number; y: number; z: number };
  headingDeg?: number;
  pitchDeg?: number;
};

type LaunchEffect = {
  id: string;
  target: Vector3;
  start: Vector3;
  elapsed: number;
  duration: number;
};

type AimCandidate = {
  id: number;
  dot: number;
  dist: number;
};

type AimPayload = {
  id?: number;
  word: string;
  color: string;
  params: ReturnType<typeof SemanticMapper.mapCoordinatesToParams>;
  distance?: number;
  headingOffsetDeg?: number;
};

type SpaceStar = {
  id: number;
  word: string;
  color: string;
  position: Vector3;
};
  
const getStarColor = (x: number, y: number, z: number) =>
  SemanticMapper.mapCoordinatesToColor(x, y, z);
const DEFAULT_STAR_COLOR = '#7a8cff';
const isValidHexColor = (value: string) => /^#([0-9a-f]{6})$/i.test(value);

const resolveStarColor = (coordColor: string, fallbackColor?: string) => {
  const probe = new Color();
  const parseToHex = (value?: string) => {
    if (typeof value !== 'string') {
      return null;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    probe.set(trimmed);
    const hex = `#${probe.getHexString()}`;
    return isValidHexColor(hex) && hex.toLowerCase() !== '#000000' ? hex : null;
  };

  return parseToHex(coordColor) ?? parseToHex(fallbackColor) ?? DEFAULT_STAR_COLOR;
};

const makeLaunchId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const easeOutCubic = (value: number) => 1 - Math.pow(1 - value, 3);

const BACKGROUND_STAR_COUNT = 1700;
const BACKGROUND_STAR_RADIUS_MIN = 900;
const BACKGROUND_STAR_RADIUS_MAX = 1800;
const STAR_MESH_RADIUS = 0.95 * 2.4;
const LABEL_CONE_LENGTH_BASE = 50 * 14;
const CONE_HEIGHT = 50 * 14;
const CONE_RADIUS = Math.tan(CONFIG.CONE_ANGLE_THRESHOLD * 1.2) * CONE_HEIGHT;

function insertCandidate(
  candidates: AimCandidate[],
  candidate: AimCandidate,
  maxItems: number,
) {
  let insertIndex = candidates.length;
  for (let i = 0; i < candidates.length; i += 1) {
    const item = candidates[i];
    if (candidate.dot > item.dot || (candidate.dot === item.dot && candidate.dist < item.dist)) {
      insertIndex = i;
      break;
    }
  }

  if (insertIndex >= maxItems) {
    return;
  }

  candidates.splice(insertIndex, 0, candidate);
  if (candidates.length > maxItems) {
    candidates.pop();
  }
}

function createStarLookup(list: SpaceStar[]) {
  const map = new Map<number, SpaceStar>();
  for (const star of list) {
    map.set(star.id, star);
  }
  return map;
}

export const SpaceScene = ({
  onSelectStar,
  debugMode,
  onAimChange,
  onTelemetryChange,
  performance,
}: {
  onSelectStar: (data: any) => void;
  debugMode: boolean;
  onAimChange: (data: AimPayload | null) => void;
  onTelemetryChange: (data: Telemetry) => void;
  performance?: SpacePerformanceSettings;
}) => {
  const settings = performance ?? DEFAULT_SPACE_PERFORMANCE_SETTINGS;
  const density = Math.max(0.2, Math.min(1, settings.backgroundStarDensity));
  const maxVisibleLabels = Math.max(0, Math.min(20, Math.round(settings.maxVisibleLabels || 0)));
  const labelsEnabled = maxVisibleLabels > 0;
  const showTargetMarker = settings.showHud && settings.hudTargetPanel;
  const labelConeScale = Math.max(0.55, Math.min(1.35, settings.labelConeScale || 0.9));
  const labelConeAngle = CONFIG.CONE_ANGLE_THRESHOLD * labelConeScale;
  const labelConeCos = Math.cos(labelConeAngle);
  const targetConeCos = Math.cos(labelConeAngle * 0.83);
  const labelConeLength = LABEL_CONE_LENGTH_BASE * labelConeScale;
  const starSegments = Math.max(4, Math.min(16, Math.round(settings.starGeometrySegments || 8)));
  const starScale = Math.max(0.2, Math.min(3, settings.starScale || 1));
  const shipScale = Math.max(0.2, Math.min(3, settings.shipScale || 1));
  const launchTrailLimit = Math.max(0, Math.round(settings.launchTrailLimit || 0));
  const useHighQualityShip = (settings.shipQuality || 0) >= 0.5;
  const showGrid = (settings.gridDensity || 1) >= 0.4;
  const gridLines = Math.max(6, Math.round(20 * (settings.gridDensity || 1)));
  const labelFontScale = Math.max(0.5, Math.min(30, settings.labelFontScale || 1));
  const labelFontMin = Math.max(1, Math.min(LABEL_FONT_MIN_MAX, Math.round(settings.labelFontMin || 10)));
  const baseLabelFontSize = Math.max(14, Math.round(14 + (labelConeScale - 0.55) * 18));
  const labelFontSize = Math.max(labelFontMin, Math.round(baseLabelFontSize * labelFontScale));
  const labelOffsetX = clamp(settings.labelOffsetX || 0, -1000, 100);
  const labelOffsetY = clamp(settings.labelOffsetY || 0, -300, 100);
  const debugEnabled = debugMode;

  const toHeadingDeg = (vector: Vector3) => {
    const rawDeg = (Math.atan2(vector.x, vector.z) * 180) / Math.PI;
    return (rawDeg + 360) % 360;
  };

  const toPitchDeg = (vector: Vector3) => {
    return (Math.asin(Math.max(-1, Math.min(1, vector.y))) * 180) / Math.PI;
  };
  const nowMs = () => (globalThis.performance?.now?.() ?? Date.now());

  const controller = useMemo(() => new SpaceshipController(), []);
  const tpsCamera = useMemo(() => new TPSCamera(), []);
  const inputRef = useInput();
  const shipRef = useRef<Group>(null);
  const backgroundStarRef = useRef<any>(null);
  const { camera } = useThree();

  const [aimedStarId, setAimedStarId] = useState<number | null>(null);
  const aimedStarRef = useRef<number | null>(null);
  const telemetryAccumRef = useRef(0);
  const debugAimLogAtRef = useRef(0);
  const [labelVisibleStarIds, setLabelVisibleStarIds] = useState<Set<number>>(new Set());
  const [launchEffects, setLaunchEffects] = useState<LaunchEffect[]>([]);
  const [stars, setStars] = useState<SpaceStar[]>([]);
  const starsRef = useRef<SpaceStar[]>([]);
  const starsByIdRef = useRef<Map<number, SpaceStar>>(new Map());
  const starGeometry = useMemo(
    () => new SphereGeometry(STAR_MESH_RADIUS * starScale, starSegments, starSegments),
    [starSegments, starScale],
  );

  const backgroundStars = useMemo(() => {
    const total = Math.max(180, Math.round(BACKGROUND_STAR_COUNT * density));
    const positions = new Float32Array(total * 3);
    const colors = new Float32Array(total * 3);

    for (let i = 0; i < total; i++) {
      const i3 = i * 3;

      const u = Math.random() * Math.PI * 2;
      const v = Math.random() * 2 - 1;
      const phi = Math.acos(v);
      const radius =
        BACKGROUND_STAR_RADIUS_MIN + Math.random() * (BACKGROUND_STAR_RADIUS_MAX - BACKGROUND_STAR_RADIUS_MIN);

      const sinPhi = Math.sin(phi);
      const x = radius * sinPhi * Math.cos(u);
      const y = radius * Math.cos(phi);
      const z = radius * sinPhi * Math.sin(u);

      positions[i3] = x;
      positions[i3 + 1] = y;
      positions[i3 + 2] = z;

      const glow = 0.55 + Math.random() * 0.45;
      colors[i3] = 0.75 + glow * 0.25;
      colors[i3 + 1] = 0.85 + glow * 0.15;
      colors[i3 + 2] = 1.0;
    }

    return { positions, colors };
  }, [density]);

  useEffect(() => {
    starsRef.current = stars;
    starsByIdRef.current = createStarLookup(stars);
  }, [stars]);

  useEffect(() => {
    const starsUrl = `${import.meta.env.BASE_URL ?? '/'}stars.json`;
    fetch(starsUrl)
      .then((res) => res.json())
      .then((data) => {
        const loadedStars = data.map(
          (s: { id: number; word: string; color: string; x: number; y: number; z: number }) => ({
            id: s.id,
            word: s.word,
            color: resolveStarColor(getStarColor(s.x, s.y, s.z), s.color),
            position: new Vector3(s.x, s.y, s.z),
          })
        );
        setStars(loadedStars);
        if (debugEnabled) {
          console.debug('[SpaceScene] loaded stars', { total: loadedStars.length });
        }
      })
      .catch((err) => console.error('Failed to load stars:', err));
  }, [debugEnabled]);

  useFrame((_, delta) => {
    controller.update(delta, inputRef.current);
    if (shipRef.current) {
      shipRef.current.position.copy(controller.position);
      shipRef.current.quaternion.copy(controller.quaternion);
    }
    if (backgroundStarRef.current) {
      backgroundStarRef.current.position.copy(camera.position);
    }
    tpsCamera.update(camera as PerspectiveCamera, controller, delta);
    const forward = controller.getForwardVector();
    const velocity = {
      x: forward.x * controller.speed,
      y: forward.y * controller.speed,
      z: forward.z * controller.speed,
    };

    telemetryAccumRef.current += delta;
    if (telemetryAccumRef.current >= 0.1) {
      const headingDeg = toHeadingDeg(forward);
      const pitchDeg = toPitchDeg(forward);
      onTelemetryChange({
        speed: controller.speed,
        position: {
          x: controller.position.x,
          y: controller.position.y,
          z: controller.position.z,
        },
        velocity,
        headingDeg,
        pitchDeg,
      });
      telemetryAccumRef.current = 0;
    }

    const candidates: AimCandidate[] = labelsEnabled ? [] : [];
    let bestTargetId: number | null = null;
    let bestDist = Infinity;
    let bestTargetDist = Infinity;
    let nearestId: number | null = null;
    let nearestDist = Infinity;
    const toStar = new Vector3();
    const visibleIds: number[] = [];
    const fullStars = starsRef.current;

    for (let i = 0; i < fullStars.length; i += 1) {
      const star = fullStars[i];
      toStar.subVectors(star.position, controller.position);
      const dist = toStar.length();
      if (dist === 0) {
        continue;
      }

      if (dist < nearestDist) {
        nearestDist = dist;
        nearestId = star.id;
      }

      const dir = toStar.normalize();
      const dot = forward.dot(dir);

      if (dot > targetConeCos && dist < bestDist) {
        bestDist = dist;
        bestTargetId = star.id;
        bestTargetDist = dist;
      }
      if (dot > labelConeCos && dist <= labelConeLength) {
        insertCandidate(candidates, { id: star.id, dot, dist }, maxVisibleLabels);
      }
    }

    if (labelsEnabled && candidates.length === 0 && nearestId !== null) {
      insertCandidate(candidates, { id: nearestId, dot: 1, dist: nearestDist }, maxVisibleLabels);
    }
    if (bestTargetId === null && nearestId !== null) {
      bestTargetId = nearestId;
      bestTargetDist = nearestDist;
    }

    for (const candidate of candidates) {
      visibleIds.push(candidate.id);
    }

    const nextVisibleIds = new Set<number>(visibleIds);
    if (labelsEnabled && bestTargetId !== null && !nextVisibleIds.has(bestTargetId)) {
      nextVisibleIds.add(bestTargetId);
    }

    let labelsChanged = false;
    if (nextVisibleIds.size !== labelVisibleStarIds.size) {
      labelsChanged = true;
    } else {
      for (const id of nextVisibleIds) {
        if (!labelVisibleStarIds.has(id)) {
          labelsChanged = true;
          break;
        }
      }
    }

    if (labelsEnabled) {
      if (labelsChanged) {
        setLabelVisibleStarIds(nextVisibleIds);
      }
    } else if (labelVisibleStarIds.size !== 0) {
      setLabelVisibleStarIds(new Set());
    }

    if (debugEnabled && nowMs() - debugAimLogAtRef.current >= 1000) {
      console.debug('[SpaceScene] aim/label state', {
        labelsEnabled,
        candidateCount: fullStars.length,
        totalStars: starsRef.current.length,
        labelVisibleTargetCount: visibleIds.length,
        aimedStarId: bestTargetId,
        bestTargetDist: Number.isFinite(bestTargetDist) ? Math.round(bestTargetDist * 1000) / 1000 : null,
        candidatesReady: candidates.length,
      });
      debugAimLogAtRef.current = nowMs();
    }

    if (bestTargetId !== aimedStarRef.current) {
      setAimedStarId(bestTargetId);
      aimedStarRef.current = bestTargetId;

      if (bestTargetId !== null) {
        const star = starsByIdRef.current.get(bestTargetId);
        if (star) {
          const params = SemanticMapper.mapCoordinatesToParams(star.position.x, star.position.y, star.position.z);
      const offset = star.position.clone().sub(controller.position);
          const headingOffsetDeg = toHeadingDeg(offset);
          onAimChange({
            id: star.id,
            color: star.color,
            params,
            word: star.word,
            distance: Number.isFinite(bestTargetDist) ? bestTargetDist : undefined,
            headingOffsetDeg,
          });
        }
      } else {
        onAimChange(null);
      }
    }
  });

  useEffect(() => {
    const selectAimedStar = () => {
      const currentAimedId = aimedStarRef.current;
      if (currentAimedId === null) return;

      const star = starsByIdRef.current.get(currentAimedId);
      if (!star) return;

      const params = SemanticMapper.mapCoordinatesToParams(star.position.x, star.position.y, star.position.z);
      onSelectStar({ color: star.color, params, word: star.word });
      if (launchTrailLimit <= 0) return;
      setLaunchEffects((prev) => {
        const keepFrom = Math.max(1, launchTrailLimit) - 1;
        return [...prev.slice(-keepFrom),
          {
            id: makeLaunchId(),
            start: new Vector3().copy(controller.position),
            target: new Vector3().copy(star.position),
            elapsed: 0,
            duration: 1.45,
          }
        ];
      });
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' && event.key !== ' ') return;
      if (event.repeat) return;
      event.preventDefault();
      selectAimedStar();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onSelectStar, controller, launchTrailLimit]);

  useFrame((_, delta) => {
    if (launchEffects.length === 0) return;

    setLaunchEffects((currentEffects) =>
      currentEffects
        .map((effect) => {
          const nextElapsed = effect.elapsed + delta;
          if (nextElapsed >= effect.duration) return null;
          return { ...effect, elapsed: nextElapsed };
        })
        .filter((effect): effect is LaunchEffect => effect !== null)
    );
  });

  const getLaunchPosition = (effect: LaunchEffect): Vector3 => {
    const progress = clamp01(effect.elapsed / effect.duration);
    const outboundRatio = 0.55;
    const shipPosition = shipRef.current?.position ?? new Vector3();

    if (progress <= outboundRatio) {
      const segmentT = easeOutCubic(clamp01(progress / outboundRatio));
      return effect.start.clone().lerp(effect.target, segmentT);
    }

    const segmentT = easeOutCubic(clamp01((progress - outboundRatio) / (1 - outboundRatio)));
    return effect.target.clone().lerp(shipPosition, segmentT);
  };

  const starLabels = useMemo(() => {
    if (!labelsEnabled) {
      return [];
    }

    const visibleIds = new Set(labelVisibleStarIds);
    if (aimedStarId !== null) {
      visibleIds.add(aimedStarId);
    }

    const labels = [...visibleIds]
      .map((id) => {
        const star = starsByIdRef.current.get(id);
        if (!star) return null;
        return (
          <Html
            key={star.id}
            position={star.position.toArray()}
            distanceFactor={18}
            occlude={false}
            zIndexRange={[0, 1000]}
          >
              <div
                style={{
                  ...(CONFIG.TEXT_STYLE as any),
                  fontSize: `${labelFontSize}px`,
                  transform: `translate(${labelOffsetX}px, ${labelOffsetY}px)`,
                  color: '#f8fcff',
                  background: 'rgba(5, 16, 26, 0.78)',
                  padding: '3px 8px',
                border: '1px solid rgba(136, 205, 255, 0.8)',
                borderRadius: '6px',
                boxShadow: '0 0 10px rgba(136, 205, 255, 0.45)',
              }}
            >
              {star.word}
            </div>
        </Html>
      );
      })
      .filter((label) => label !== null);
    return labels;
  }, [aimedStarId, labelVisibleStarIds, labelFontSize, labelOffsetX, labelOffsetY, labelsEnabled]);

  const aimedStar = aimedStarId === null ? null : starsByIdRef.current.get(aimedStarId);

  return (
    <>
      <group ref={shipRef} scale={shipScale}>
        <group>
          <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <capsuleGeometry args={[0.28, 1.6, 12, 22]} />
            {useHighQualityShip ? (
              <meshPhysicalMaterial
                color="#a3cfff"
                metalness={0.82}
                roughness={0.18}
                clearcoat={1}
                clearcoatRoughness={0.12}
                emissive="#0f3a5f"
                emissiveIntensity={0.16}
              />
            ) : (
              <meshBasicMaterial color="#a3cfff" />
            )}
          </mesh>

          <mesh position={[0, 0, 1.18]} rotation={[-Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.32, 0.7, 28]} />
            {useHighQualityShip ? (
              <meshPhysicalMaterial
                color="#f8ffff"
                metalness={0.2}
                roughness={0.1}
                emissive="#6bc8ff"
                emissiveIntensity={0.45}
                opacity={0.92}
                transparent
              />
            ) : (
              <meshBasicMaterial color="#f8ffff" />
            )}
          </mesh>

          <mesh position={[0, 0, -1.16]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.44, 1.0, 20]} />
            {useHighQualityShip ? (
              <meshPhysicalMaterial
                color="#1d2f6b"
                metalness={0.75}
                roughness={0.2}
                emissive="#1f104a"
                emissiveIntensity={0.25}
              />
            ) : (
              <meshBasicMaterial color="#1d2f6b" />
            )}
          </mesh>

          <mesh position={[0, -0.08, -1.08]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.16, 0.08, 0.5, 16]} />
            {useHighQualityShip ? (
              <meshStandardMaterial
                color="#ff9b2d"
                metalness={0.8}
                roughness={0.12}
                emissive="#7a2600"
                emissiveIntensity={0.65}
              />
            ) : (
              <meshBasicMaterial color="#ff9b2d" />
            )}
          </mesh>

          <mesh position={[-0.42, 0.1, -0.06]} rotation={[-0.25, 0.2, -0.1]}>
            <boxGeometry args={[0.42, 0.06, 0.72]} />
            {useHighQualityShip ? (
              <meshPhysicalMaterial
                color="#2f5f9e"
                metalness={0.9}
                roughness={0.2}
                emissive="#143e65"
                emissiveIntensity={0.35}
              />
            ) : (
              <meshBasicMaterial color="#2f5f9e" />
            )}
          </mesh>
          <mesh position={[0.42, 0.1, -0.06]} rotation={[-0.25, -0.2, 0.1]}>
            <boxGeometry args={[0.42, 0.06, 0.72]} />
            {useHighQualityShip ? (
              <meshPhysicalMaterial
                color="#2f5f9e"
                metalness={0.9}
                roughness={0.2}
                emissive="#143e65"
                emissiveIntensity={0.35}
              />
            ) : (
              <meshBasicMaterial color="#2f5f9e" />
            )}
          </mesh>

          <mesh position={[0, 0.08, 0.34]} rotation={[-0.65, 0, 0]}>
            <sphereGeometry args={[0.34, 26, 18]} />
            {useHighQualityShip ? (
              <meshPhysicalMaterial
                color="#d9f7ff"
                metalness={0.05}
                roughness={0.18}
                transmission={0.35}
                clearcoat={1}
              />
            ) : (
              <meshBasicMaterial color="#d9f7ff" />
            )}
          </mesh>

          <mesh position={[0, 0.17, 0.78]} rotation={[0, 0, 0]}>
            <ringGeometry args={[0.08, 0.23, 24]} />
            <meshBasicMaterial color="#79d5ff" transparent opacity={0.55} />
          </mesh>
          <mesh position={[0, 0.05, -1.62]} rotation={[0, 0, 0]}>
            <ringGeometry args={[0.1, 0.2, 24]} />
            <meshBasicMaterial color="#ffbf6e" transparent opacity={0.35} />
          </mesh>
        </group>

        {debugMode && (
          <mesh position={[0, 0, CONE_HEIGHT / 2]} rotation={[-Math.PI / 2, 0, 0]}>
            <coneGeometry args={[CONE_RADIUS, CONE_HEIGHT, 16, 1, true]} />
            <meshBasicMaterial color="yellow" wireframe={true} transparent={true} opacity={0.3} />
          </mesh>
        )}
      </group>

      <points ref={backgroundStarRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[backgroundStars.positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[backgroundStars.colors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={settings.backgroundPointSize}
          sizeAttenuation
          vertexColors
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
          opacity={0.9}
        />
      </points>

      {stars.map((star) => (
        <mesh
          key={star.id}
          position={star.position.toArray()}
          geometry={starGeometry}
          frustumCulled={false}
        >
          <meshBasicMaterial color={star.color} />
        </mesh>
      ))}
      {starLabels}

      {showTargetMarker && aimedStar && (
        <group position={aimedStar.position.toArray()}>
          <mesh position={[0, 4, 0]} rotation={[0, 0, Math.PI]}>
            <coneGeometry args={[1, 2, 4]} />
            <meshBasicMaterial color="white" />
          </mesh>
        </group>
      )}

      {launchEffects.map((effect) => {
        const position = getLaunchPosition(effect);
        return (
          <group key={effect.id} position={position.toArray()}>
            <mesh>
              <sphereGeometry args={[0.16, 12, 12]} />
              <meshStandardMaterial color="#ffef5f" emissive="#ffef5f" emissiveIntensity={1} />
            </mesh>
          </group>
        );
      })}

      {showGrid && <gridHelper args={[2000, gridLines]} />}
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
    </>
  );
};
