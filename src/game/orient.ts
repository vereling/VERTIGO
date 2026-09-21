import * as THREE from "three";

const tmp = new THREE.Vector3();

/** Shortest rotation taking unit vector `a` onto unit vector `b`. */
export function rotationBetween(
  a: THREE.Vector3,
  b: THREE.Vector3,
  out: THREE.Quaternion,
): THREE.Quaternion {
  const d = THREE.MathUtils.clamp(a.dot(b), -1, 1);
  if (d > 0.999999) return out.identity();
  if (d < -0.999999) {
    const axis = new THREE.Vector3();
    axis.crossVectors(a, new THREE.Vector3(0, 1, 0));
    if (axis.lengthSq() < 1e-8) axis.crossVectors(a, new THREE.Vector3(1, 0, 0));
    axis.normalize();
    return out.setFromAxisAngle(axis, Math.PI);
  }
  return out.setFromUnitVectors(a, b);
}

export function orthonormalFrame(
  up: THREE.Vector3,
  lookF: THREE.Vector3,
  lookR: THREE.Vector3,
) {
  up.normalize();
  lookF.addScaledVector(up, -lookF.dot(up));
  if (lookF.lengthSq() < 1e-10) {
    lookF.crossVectors(up, lookR);
  }
  lookF.normalize();
  lookR.crossVectors(lookF, up).normalize();
  lookF.crossVectors(up, lookR).normalize();
}

export function extractPitch(lookFull: THREE.Vector3, up: THREE.Vector3) {
  return Math.asin(THREE.MathUtils.clamp(lookFull.dot(up), -1, 1));
}

export function fpsForward(
  lookF: THREE.Vector3,
  up: THREE.Vector3,
  pitch: number,
  out: THREE.Vector3,
) {
  out.copy(lookF).multiplyScalar(Math.cos(pitch)).addScaledVector(up, Math.sin(pitch));
  if (out.lengthSq() < 1e-8) out.copy(lookF);
  else out.normalize();
  return out;
}

/** Rebuild FPS yaw/pitch so the camera still faces `worldLook` after gravity moved. */
export function adoptWorldLook(
  worldLook: THREE.Vector3,
  up: THREE.Vector3,
  lookF: THREE.Vector3,
  lookR: THREE.Vector3,
  rightHint: THREE.Vector3,
): number {
  const pitch = extractPitch(worldLook, up);
  tmp.copy(worldLook).addScaledVector(up, -worldLook.dot(up));
  if (tmp.lengthSq() > 1e-6) {
    lookF.copy(tmp).normalize();
    lookR.crossVectors(lookF, up);
    if (lookR.dot(rightHint) < 0) lookR.negate();
    if (lookR.lengthSq() < 1e-10) lookR.copy(rightHint);
    lookR.normalize();
    lookF.crossVectors(up, lookR).normalize();
  } else {
    lookR.copy(rightHint).addScaledVector(up, -rightHint.dot(up));
    if (lookR.lengthSq() < 1e-10) lookR.crossVectors(up, worldLook);
    lookR.normalize();
    lookF.crossVectors(up, lookR).normalize();
    lookR.crossVectors(lookF, up).normalize();
  }
  return pitch;
}

/** Same hemisphere as `ref` so slerp does not take the long way. */
export function ensureQuatContinuity(q: THREE.Quaternion, ref: THREE.Quaternion) {
  if (q.dot(ref) < 0) q.set(-q.x, -q.y, -q.z, -q.w);
  return q;
}

/**
 * FPS camera: yaw from lookF/lookR (always horizontal), pitch around lookR.
 * Never uses up × forward, so looking straight up/down does not gimbal.
 */
export function quatFromFps(
  lookF: THREE.Vector3,
  lookR: THREE.Vector3,
  up: THREE.Vector3,
  pitch: number,
  fwd: THREE.Vector3,
  z: THREE.Vector3,
  y: THREE.Vector3,
  mat: THREE.Matrix4,
  out: THREE.Quaternion,
) {
  fpsForward(lookF, up, pitch, fwd);
  z.copy(fwd).negate();
  y.crossVectors(z, lookR);
  if (y.lengthSq() < 1e-10) y.copy(up);
  else y.normalize();
  mat.makeBasis(lookR, y, z);
  return out.setFromRotationMatrix(mat);
}
