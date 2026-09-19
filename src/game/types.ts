export type HudState = {
  face: string;
  hold: "PLANTED" | "AIR" | "REORIENT" | "IDLE";
  playing: boolean;
  captured: boolean;
};

export type ControlsProbe = {
  getYaw: () => number;
  getSpeed: () => number;
  getPos: () => { x: number; y: number; z: number };
  getUp?: () => { x: number; y: number; z: number };
  getLook?: () => { x: number; y: number; z: number; pitch: number };
  getCamQuat?: () => { x: number; y: number; z: number; w: number };
  getFrame?: () => {
    up: { x: number; y: number; z: number };
    look: { x: number; y: number; z: number };
    pitch: number;
    lookDotUp: number;
    reorient: number;
    aim?: { x: number; y: number; z: number };
    aimPoint?: { x: number; y: number; z: number };
    qx: number;
    qy: number;
    qz: number;
    qw: number;
    maxQuatStepDeg?: number;
    frameSpeed?: number;
    log?: { s: number; ang: number; pitch: number; udot: number }[];
  };
  setKeys: (codes: string[]) => void;
  setPlaying: (v: boolean) => void;
  lookAtCore?: () => void;
  lookAtPoint?: (x: number, y: number, z: number) => void;
};

declare global {
  interface Window {
    __controlsTest?: ControlsProbe;
  }
}

export {};
