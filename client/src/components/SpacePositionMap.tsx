import { CONFIG } from '../config';

type SpacePositionLike = {
  x: number;
  y: number;
  z: number;
};

type SpacePositionMapProps = {
  position: SpacePositionLike;
  velocity?: SpacePositionLike;
  size?: number;
  title?: string;
};

type Point3D = { x: number; y: number; z: number };
type Point2D = { x: number; y: number };

const SPAWN_POINT = { x: 0, y: 0, z: 0 };
const CUBE_HALF = 1;
const TRACKING_SPAN_TARGET = 1200;
const MIN_MAP_SPAN = 220;

const CUBE_VERTICES: Point3D[] = [
  { x: -CUBE_HALF, y: -CUBE_HALF, z: -CUBE_HALF },
  { x: CUBE_HALF, y: -CUBE_HALF, z: -CUBE_HALF },
  { x: CUBE_HALF, y: -CUBE_HALF, z: CUBE_HALF },
  { x: -CUBE_HALF, y: -CUBE_HALF, z: CUBE_HALF },
  { x: -CUBE_HALF, y: CUBE_HALF, z: -CUBE_HALF },
  { x: CUBE_HALF, y: CUBE_HALF, z: -CUBE_HALF },
  { x: CUBE_HALF, y: CUBE_HALF, z: CUBE_HALF },
  { x: -CUBE_HALF, y: CUBE_HALF, z: CUBE_HALF },
];

const CUBE_EDGES: Array<[number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 0],
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 4],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7],
];

const CUBE_ORTHO_EDGE_FACES: Array<[number, number]> = [
  [0, 3],
  [1, 2],
  [4, 7],
  [5, 6],
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function rotateAroundY(point: Point3D, angle: number): Point3D {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: point.x * cos - point.z * sin,
    y: point.y,
    z: point.x * sin + point.z * cos,
  };
}

function rotateAroundX(point: Point3D, angle: number): Point3D {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: point.x,
    y: point.y * cos - point.z * sin,
    z: point.y * sin + point.z * cos,
  };
}

function rotateAroundZ(point: Point3D, angle: number): Point3D {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
    z: point.z,
  };
}

function rotateCubeForMap(point: Point3D): Point3D {
  const y = rotateAroundY(point, -0.86);
  const x = rotateAroundX(y, -0.64);
  return rotateAroundZ(x, -0.28);
}

function toOrthographicProjection(point: Point3D, cx: number, cy: number, scale: number): Point2D {
  const x = (point.x - point.z) * 0.66 * scale;
  const y = point.y * 0.82 * scale - (point.x + point.z) * 0.34 * scale;
  return {
    x: cx + x,
    y: cy + y,
  };
}

function toPoints(points: Point2D[]) {
  return points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');
}

const SPEED_ARROW_SCALE = 0.9;

export function SpacePositionMap({
  position,
  velocity = { x: 0, y: 0, z: 0 },
  size = 190,
}: SpacePositionMapProps) {
  const cx = size / 2;
  const cy = size / 2;
  const margin = size * 0.09;
  const mapSpan = Math.max(
    TRACKING_SPAN_TARGET,
    MIN_MAP_SPAN,
    Math.abs(position.x - SPAWN_POINT.x),
    Math.abs(position.y - SPAWN_POINT.y),
    Math.abs(position.z - SPAWN_POINT.z),
  );

  const worldToCube = {
    x: clamp((position.x - SPAWN_POINT.x) / mapSpan, -1, 1),
    y: clamp((position.y - SPAWN_POINT.y) / mapSpan, -1, 1),
    z: clamp((position.z - SPAWN_POINT.z) / mapSpan, -1, 1),
  };

  const cubeScale = (size - margin * 2) * 0.27;
  const toModel = (point: Point3D) => ({
    x: point.x * cubeScale,
    y: point.y * cubeScale,
    z: point.z * cubeScale,
  });
  const rotatedVertices = CUBE_VERTICES.map((vertex) => rotateCubeForMap(toModel(vertex)));
  const projectedVertices = rotatedVertices.map((vertex) => toOrthographicProjection(vertex, cx, cy, 1));
  const ship = toOrthographicProjection(
    rotateCubeForMap(
      toModel({
        x: worldToCube.x * CUBE_HALF,
        y: worldToCube.y * CUBE_HALF,
        z: worldToCube.z * CUBE_HALF,
      }),
    ),
    cx,
    cy,
    1,
  );
  const mappedVelocity = {
    x: clamp(
      (velocity.x / CONFIG.MAX_SPEED) * CUBE_HALF * SPEED_ARROW_SCALE,
      -CUBE_HALF * SPEED_ARROW_SCALE,
      CUBE_HALF * SPEED_ARROW_SCALE,
    ),
    y: clamp(
      (velocity.y / CONFIG.MAX_SPEED) * CUBE_HALF * SPEED_ARROW_SCALE,
      -CUBE_HALF * SPEED_ARROW_SCALE,
      CUBE_HALF * SPEED_ARROW_SCALE,
    ),
    z: clamp(
      (velocity.z / CONFIG.MAX_SPEED) * CUBE_HALF * SPEED_ARROW_SCALE,
      -CUBE_HALF * SPEED_ARROW_SCALE,
      CUBE_HALF * SPEED_ARROW_SCALE,
    ),
  };
  const velocityTip3D = {
    x: clamp((worldToCube.x * CUBE_HALF) + mappedVelocity.x, -CUBE_HALF, CUBE_HALF),
    y: clamp((worldToCube.y * CUBE_HALF) + mappedVelocity.y, -CUBE_HALF, CUBE_HALF),
    z: clamp((worldToCube.z * CUBE_HALF) + mappedVelocity.z, -CUBE_HALF, CUBE_HALF),
  };
  const velocityTip = toOrthographicProjection(
    rotateCubeForMap(toModel(velocityTip3D)),
    cx,
    cy,
    1,
  );
  const velocityMagnitude = Math.sqrt(
    Math.pow(velocity.x, 2) + Math.pow(velocity.y, 2) + Math.pow(velocity.z, 2),
  );
  const hasVelocity = velocityMagnitude > 0.0001;
  const spawn = toOrthographicProjection(rotateCubeForMap(toModel({ x: 0, y: 0, z: 0 })), cx, cy, 1);

  const contour = [
    projectedVertices[0],
    projectedVertices[1],
    projectedVertices[2],
    projectedVertices[3],
    projectedVertices[7],
    projectedVertices[4],
  ];

  return (
    <div
      style={{
        width: size,
        color: '#e3f3ff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id="gpsOutlineGlow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(170, 232, 255, 0.22)" />
            <stop offset="100%" stopColor="rgba(120, 200, 255, 0.08)" />
          </linearGradient>
          <filter id="gpsVelocityGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="1.5" floodColor="#7fffb0" floodOpacity="0.8" />
          </filter>
        </defs>

        <polygon
          points={toPoints(contour)}
          fill="rgba(8, 23, 43, 0.18)"
          stroke="url(#gpsOutlineGlow)"
          strokeWidth="1.4"
          strokeLinejoin="round"
          strokeOpacity="0.9"
        />

        <line
          x1={projectedVertices[0].x}
          y1={projectedVertices[0].y}
          x2={projectedVertices[1].x}
          y2={projectedVertices[1].y}
          stroke="rgba(170, 236, 255, 0.92)"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <line
          x1={projectedVertices[1].x}
          y1={projectedVertices[1].y}
          x2={projectedVertices[2].x}
          y2={projectedVertices[2].y}
          stroke="rgba(170, 236, 255, 0.92)"
          strokeWidth="1.4"
        />
        <line
          x1={projectedVertices[2].x}
          y1={projectedVertices[2].y}
          x2={projectedVertices[3].x}
          y2={projectedVertices[3].y}
          stroke="rgba(170, 236, 255, 0.92)"
          strokeWidth="1.4"
        />
        <line
          x1={projectedVertices[3].x}
          y1={projectedVertices[3].y}
          x2={projectedVertices[0].x}
          y2={projectedVertices[0].y}
          stroke="rgba(170, 236, 255, 0.92)"
          strokeWidth="1.4"
        />

        <line
          x1={projectedVertices[5].x}
          y1={projectedVertices[5].y}
          x2={projectedVertices[6].x}
          y2={projectedVertices[6].y}
          stroke="rgba(170, 236, 255, 0.92)"
          strokeWidth="1.4"
        />
        <line
          x1={projectedVertices[6].x}
          y1={projectedVertices[6].y}
          x2={projectedVertices[7].x}
          y2={projectedVertices[7].y}
          stroke="rgba(170, 236, 255, 0.92)"
          strokeWidth="1.4"
        />
        <line
          x1={projectedVertices[7].x}
          y1={projectedVertices[7].y}
          x2={projectedVertices[4].x}
          y2={projectedVertices[4].y}
          stroke="rgba(170, 236, 255, 0.92)"
          strokeWidth="1.4"
        />
        <line
          x1={projectedVertices[4].x}
          y1={projectedVertices[4].y}
          x2={projectedVertices[5].x}
          y2={projectedVertices[5].y}
          stroke="rgba(170, 236, 255, 0.92)"
          strokeWidth="1.4"
        />

        {CUBE_EDGES.map(([a, b]) => {
          const isFront = (rotatedVertices[a].z + rotatedVertices[b].z) / 2 >= 0;
          return (
            <line
              key={`cube-edge-${a}-${b}`}
              x1={projectedVertices[a].x}
              y1={projectedVertices[a].y}
              x2={projectedVertices[b].x}
              y2={projectedVertices[b].y}
              stroke={isFront ? 'rgba(215, 244, 255, 0.9)' : 'rgba(120, 180, 230, 0.22)'}
              strokeWidth={isFront ? 1.05 : 0.82}
              strokeDasharray={isFront ? undefined : '3 4'}
              strokeLinecap="round"
            />
          );
        })}

        {CUBE_ORTHO_EDGE_FACES.map(([a, b], i) => (
          <line
            key={`front-slice-${i}`}
            x1={projectedVertices[a].x}
            y1={projectedVertices[a].y}
            x2={projectedVertices[b].x}
            y2={projectedVertices[b].y}
            stroke="rgba(255, 255, 255, 0.4)"
            strokeWidth="0.7"
            strokeDasharray="2 3"
          />
        ))}

        <line
          x1={spawn.x}
          y1={spawn.y}
          x2={ship.x}
          y2={ship.y}
          stroke="rgba(255, 214, 116, 0.35)"
          strokeWidth={1}
          strokeDasharray="4 2"
        />

        <circle cx={spawn.x} cy={spawn.y} r={2.7} fill="#f5fdff" />
        <text x={spawn.x + 6} y={spawn.y + 4} fill="#f5fdff" fontSize="8" opacity={0.95}>
          SP
        </text>

        {hasVelocity && (
          <>
            {(() => {
              const dx = velocityTip.x - ship.x;
              const dy = velocityTip.y - ship.y;
              const head = Math.max(6, Math.min(12, Math.hypot(dx, dy) * 0.42));
              const inv = Math.hypot(dx, dy) > 0.0001 ? 1 / Math.hypot(dx, dy) : 0;
              const ux = dx * inv;
              const uy = dy * inv;
              const leftX = velocityTip.x - ux * head - uy * 0.45 * head;
              const leftY = velocityTip.y - uy * head + ux * 0.45 * head;
              const rightX = velocityTip.x - ux * head + uy * 0.45 * head;
              const rightY = velocityTip.y - uy * head - ux * 0.45 * head;

              return (
                <>
                  <line
                    x1={ship.x}
                    y1={ship.y}
                    x2={velocityTip.x}
                    y2={velocityTip.y}
                    stroke="#7fffb0"
                    strokeWidth={1.6}
                    filter="url(#gpsVelocityGlow)"
                  />
                  <line
                    x1={velocityTip.x}
                    y1={velocityTip.y}
                    x2={leftX}
                    y2={leftY}
                    stroke="#7fffb0"
                    strokeWidth={1.4}
                  />
                  <line
                    x1={velocityTip.x}
                    y1={velocityTip.y}
                    x2={rightX}
                    y2={rightY}
                    stroke="#7fffb0"
                    strokeWidth={1.4}
                  />
                </>
              );
            })()}
          </>
        )}

        <line
          x1={ship.x - 2}
          y1={ship.y - 2}
          x2={ship.x + 2}
          y2={ship.y + 2}
          stroke="#fff8c0"
          strokeWidth={1}
        />
        <line
          x1={ship.x + 2}
          y1={ship.y - 2}
          x2={ship.x - 2}
          y2={ship.y + 2}
          stroke="#fff8c0"
          strokeWidth={1}
        />
        <circle cx={ship.x} cy={ship.y} r={3.4} fill="#ffd36a" />
      </svg>

    </div>
  );
}

export default SpacePositionMap;
