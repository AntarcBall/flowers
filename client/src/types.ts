export type FlowerRenderParams = {
  m: number;
  n1: number;
  n2: number;
  n3: number;
  rot: number;
  petalCount?: number;
  petalStretch?: number;
  petalCrest?: number;
  petalSpread?: number;
  coreRadius?: number;
  coreGlow?: number;
  rimWidth?: number;
  outlineWeight?: number;
};

export type StarSelectionData = {
  word: string;
  color: string;
  params: FlowerRenderParams;
};

export const SELECTED_STAR_SESSION_KEY = 'selectedStarData';
