export const CONFIG = {
  FLOWER_RANGES: {
    m: { min: 2.0, max: 24.0 },    // Superformula base frequency
    n1: { min: 0.1, max: 8.0 },    // Overall shape parameter
    n2: { min: 0.1, max: 8.0 },    // Horizontal shape parameter
    n3: { min: 0.1, max: 8.0 },    // Vertical shape parameter
    rot: { min: 0, max: Math.PI * 2 },
    petalCount: { min: 4.0, max: 13.0 },
    petalStretch: { min: 0.45, max: 1.55 },
    petalCrest: { min: 0.4, max: 1.7 },
    petalSpread: { min: 0.85, max: 1.35 },
    coreRadius: { min: 0.10, max: 0.55 },
    coreGlow: { min: 0.08, max: 1.0 },
    rimWidth: { min: 0.2, max: 1.0 },
    outlineWeight: { min: 0.8, max: 2.4 },
    symmetry: { min: 3.0, max: 20.0 },
    mandalaDepth: { min: 0.0, max: 1.0 },
    ringBands: { min: 1.0, max: 8.0 },
    radialTwist: { min: 0.0, max: 1.8 },
    innerVoid: { min: 0.0, max: 0.72 },
    fractalIntensity: { min: 0.0, max: 2.2 },
    sectorWarp: { min: 0.0, max: 1.2 },
    ringContrast: { min: 0.0, max: 1.0 },
    depthEcho: { min: 0.0, max: 1.0 },
  },
  SEEDS: {
    m: { freq: [2.3, 7.1, 13.9], phase: [0.0, 2.1, 4.2] },    // Prime-like frequencies for petal count
    n1: { freq: [3.7, 11.3, 19.7], phase: [1.0, 3.1, 5.2] },  // Higher frequencies for shape
    n2: { freq: [5.9, 17.3, 23.1], phase: [2.0, 4.1, 6.2] },  // Distinct frequencies for independence
    n3: { freq: [4.1, 13.7, 29.3], phase: [3.0, 5.1, 7.2] },  // Prime-like frequencies for variation
    rot: { freq: [6.7, 15.1, 31.9], phase: [0.5, 2.6, 4.7] }, // High frequencies for rotation
    petalCount: { freq: [8.3, 12.9, 21.1], phase: [0.1, 2.3, 5.4] },
    petalStretch: { freq: [1.7, 3.9, 8.1], phase: [2.7, 4.2, 1.6] },
    petalCrest: { freq: [4.3, 9.7, 18.2], phase: [0.9, 2.9, 6.4] },
    petalSpread: { freq: [2.4, 6.6, 10.8], phase: [3.5, 5.1, 1.3] },
    coreRadius: { freq: [5.1, 7.7, 19.1], phase: [1.7, 4.0, 6.8] },
    coreGlow: { freq: [1.9, 9.4, 22.4], phase: [4.1, 5.5, 0.7] },
    rimWidth: { freq: [3.2, 6.8, 14.4], phase: [2.1, 5.0, 7.4] },
    outlineWeight: { freq: [2.8, 11.2, 17.6], phase: [0.7, 3.3, 6.1] },
    symmetry: { freq: [2.9, 7.7, 15.4], phase: [1.1, 3.2, 5.8] },
    mandalaDepth: { freq: [3.1, 10.2, 22.3], phase: [0.6, 4.1, 7.9] },
    ringBands: { freq: [1.7, 6.6, 13.2], phase: [2.3, 5.0, 1.4] },
    radialTwist: { freq: [4.9, 8.3, 19.1], phase: [0.9, 3.4, 5.5] },
    innerVoid: { freq: [2.2, 9.6, 24.7], phase: [3.1, 5.7, 0.8] },
    fractalIntensity: { freq: [1.8, 14.9, 26.1], phase: [4.4, 6.6, 1.2] },
    sectorWarp: { freq: [6.2, 16.9, 28.8], phase: [1.5, 4.4, 0.7] },
    ringContrast: { freq: [3.9, 11.4, 21.7], phase: [0.8, 5.5, 7.2] },
    depthEcho: { freq: [4.8, 13.6, 23.4], phase: [2.2, 4.7, 6.1] },
  },
  
  CUBE_SIZE: 1000,
  MAX_SPEED: 25,
  ACCEL_SPEED: 0.05,
  ACCEL_ROT: 0.0002,
  DAMPING_ROT: 0.98,
  
  CAMERA_OFFSET: { x: 0, y: 5, z: -5 },
  CAMERA_LOOK_TARGET_DIST: 10,
  CAMERA_LERP_FACTOR: 0.15,

  GARDEN_SIZE: 1000,
  SCROLL_SPEED: 5.0,
  STORAGE_KEY: 'garden_flowers',

  FLOWER_GROWTH_MS: 700,
  FLOWER_ANCHOR_Z: 0.9,
  FLOWER_SHAPE: {
    segments: { min: 140, max: 420 },
    innerScale: { min: 0.44, max: 0.96 },
    outerExtrudeDepth: 0.55,
    innerExtrudeDepth: 0.32,
    coreBaseScale: 0.18,
    corePulse: 0.14,
    glowSpread: 1.65,
    lineSmoothingScale: 1,
  },

  CONE_ANGLE_THRESHOLD: Math.PI / 7,
  TEXT_LOD_DISTANCE: 150,
  TEXT_MIN_FONT_SIZE: 392,
  TEXT_SIZE_BREAKPOINT: 260,
  TEXT_LINEAR_FONT_SLOPE: 392 / 260,
  TEXT_MAX_FONT_SIZE: 460,

  TEXT_STYLE: {
    color: 'black',
    background: 'white',
    padding: '4px 6px',
    borderRadius: '4px',
    fontSize: '280px',
    fontWeight: 'bold',
    fontFamily: 'NanumGothicCustom, sans-serif',
    writingMode: 'horizontal-tb',
    whiteSpace: 'nowrap',
    opacity: 1,
  },

  PREVIEW: {
    width: 150,
    height: 150,
    background: 'rgba(0, 0, 0, 0.7)',
    border: '1px solid #444',
    borderRadius: '8px',
  },
};
