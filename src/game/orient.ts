import * as THREE from "three";

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
