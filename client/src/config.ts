export const CONFIG = {
  FLOWER_RANGES: {
    m: { min: 2.0, max: 12.0 },
    n1: { min: 0.5, max: 10.0 },
    n2: { min: 0.5, max: 10.0 },
    n3: { min: 0.5, max: 10.0 },
    rot: { min: 0, max: Math.PI * 2 },
  },
  SEEDS: {
    m: { freq: [1.3, 2.7, 3.1], phase: [0.1, 0.5, 0.8] },
    n1: { freq: [2.1, 1.4, 4.2], phase: [0.3, 0.2, 0.9] },
    n2: { freq: [1.7, 3.3, 1.1], phase: [0.7, 0.4, 0.2] },
    n3: { freq: [3.9, 2.5, 1.9], phase: [0.5, 0.8, 0.1] },
    rot: { freq: [0.8, 4.1, 2.3], phase: [0.2, 0.6, 0.4] },
  },
  
  CUBE_SIZE: 1000,
  get MAX_SPEED() { return this.CUBE_SIZE / 20; }, // V_max defined by 20s to cross Cube L
  ACCEL_SPEED: 0.5,
  ACCEL_ROT: 0.02,
  DAMPING_ROT: 0.98,
  
  CAMERA_OFFSET: { x: 0, y: 5, z: -15 },
  CAMERA_LOOK_TARGET_DIST: 10,
  CAMERA_LERP_FACTOR: 0.1,

  GARDEN_SIZE: 1000,
  SCROLL_SPEED: 5.0,
  STORAGE_KEY: 'garden_flowers',

  CONE_ANGLE_THRESHOLD: Math.PI / 12, // 15 degrees cone
  TEXT_LOD_DISTANCE: 150, 
};
