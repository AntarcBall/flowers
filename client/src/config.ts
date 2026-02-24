export const CONFIG = {
  FLOWER_RANGES: {
    m: { min: 3.0, max: 16.0 },    // Petal count (more meaningful range)
    n1: { min: 0.1, max: 8.0 },    // Overall shape parameter
    n2: { min: 0.1, max: 8.0 },    // Horizontal shape parameter
    n3: { min: 0.1, max: 8.0 },    // Vertical shape parameter
    rot: { min: 0, max: Math.PI * 2 },
  },
  SEEDS: {
    m: { freq: [2.3, 7.1, 13.9], phase: [0.0, 2.1, 4.2] },    // Prime-like frequencies for petal count
    n1: { freq: [3.7, 11.3, 19.7], phase: [1.0, 3.1, 5.2] },  // Higher frequencies for shape
    n2: { freq: [5.9, 17.3, 23.1], phase: [2.0, 4.1, 6.2] },  // Distinct frequencies for independence
    n3: { freq: [4.1, 13.7, 29.3], phase: [3.0, 5.1, 7.2] },  // Prime-like frequencies for variation
    rot: { freq: [6.7, 15.1, 31.9], phase: [0.5, 2.6, 4.7] }, // High frequencies for rotation
  },
  
  CUBE_SIZE: 1000,
  get MAX_SPEED() { return this.CUBE_SIZE / 2; }, 
  ACCEL_SPEED: 0.05,
  ACCEL_ROT: 0.0002,
  DAMPING_ROT: 0.98,
  
  CAMERA_OFFSET: { x: 0, y: 5, z: -5 },
  CAMERA_LOOK_TARGET_DIST: 10,
  CAMERA_LERP_FACTOR: 1,

  GARDEN_SIZE: 1000,
  SCROLL_SPEED: 5.0,
  STORAGE_KEY: 'garden_flowers',

  CONE_ANGLE_THRESHOLD: Math.PI / 7, 
  TEXT_LOD_DISTANCE: 150, 
  TEXT_MIN_FONT_SIZE: 280,
  TEXT_SIZE_BREAKPOINT: 260,
  TEXT_LINEAR_FONT_SLOPE: 280 / 260,
  TEXT_MAX_FONT_SIZE: 460,

  TEXT_STYLE: {
    color: 'black',
    background: 'white',
    padding: '4px 6px',
    borderRadius: '4px',
    fontSize: '280px',
    fontWeight: 'bold',
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
