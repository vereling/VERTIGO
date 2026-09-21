import * as THREE from "three";

/** Interior rounded-cube: flat faces, quarter-pipe edges, spherical corners. */
export const ROOM = 24;
export const HALF = ROOM / 2;
export const FILLET = 3.55;
export const FACE = HALF - FILLET;

export type Zone = "face" | "edge" | "corner";

/**
 * Closest point on the interior surface and the walkable up (into the room).
 * `p` is a world point, typically the feet.
 */
export function sampleSurface(
  p: THREE.Vector3,
  outP: THREE.Vector3,
  outN: THREE.Vector3,
): Zone {
  const ax = Math.abs(p.x);
  const ay = Math.abs(p.y);
  const az = Math.abs(p.z);
  const sx = p.x < 0 ? -1 : 1;
  const sy = p.y < 0 ? -1 : 1;
  const sz = p.z < 0 ? -1 : 1;
  const ex = ax > FACE;
  const ey = ay > FACE;
  const ez = az > FACE;
  const n = (ex ? 1 : 0) + (ey ? 1 : 0) + (ez ? 1 : 0);

  if (n >= 3) {
    const cx = sx * FACE;
    const cy = sy * FACE;
    const cz = sz * FACE;
    outN.set(cx - p.x, cy - p.y, cz - p.z);
    if (outN.lengthSq() < 1e-12) outN.set(-sx, -sy, -sz);
    else outN.normalize();
    outP.set(cx, cy, cz).addScaledVector(outN, -FILLET);
    return "corner";
  }

  if (n === 2) {
    const cx = ex ? sx * FACE : p.x;
    const cy = ey ? sy * FACE : p.y;
    const cz = ez ? sz * FACE : p.z;
    tmpR.set(p.x - cx, p.y - cy, p.z - cz);
    if (ex && sx * tmpR.x < 0) tmpR.x = 0;
    if (ey && sy * tmpR.y < 0) tmpR.y = 0;
    if (ez && sz * tmpR.z < 0) tmpR.z = 0;
    if (tmpR.lengthSq() < 1e-12) {
      tmpR.set(ex ? sx : 0, ey ? sy : 0, ez ? sz : 0);
    }
    tmpR.normalize();
    outP.set(cx, cy, cz).addScaledVector(tmpR, FILLET);
    outN.copy(tmpR).negate();
    return "edge";
  }

  let axis = 1;
  let mag = ay;
  let sgn = sy;
  if (ax >= mag) {
    axis = 0;
    mag = ax;
    sgn = sx;
  }
  if (az >= mag) {
    axis = 2;
    mag = az;
    sgn = sz;
  }
  outP.copy(p);
  outP.setComponent(axis, sgn * HALF);
  outN.set(0, 0, 0);
  outN.setComponent(axis, -sgn);
  return "face";
}

const tmpR = new THREE.Vector3();
