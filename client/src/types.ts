export type StarSelectionData = {
  word: string;
  color: string;
  params: {
    m: number;
    n1: number;
    n2: number;
    n3: number;
    rot: number;
  };
};

export const SELECTED_STAR_SESSION_KEY = 'selectedStarData';
