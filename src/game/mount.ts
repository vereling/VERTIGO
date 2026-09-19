import * as THREE from "three";
import type { ControlsProbe, HudState } from "./types";
import { extractPitch, orthonormalFrame, rotationBetween } from "./orient";

const ROOM = 24;
const HALF = ROOM / 2;
const EYE = 1.65;
const RADIUS = 0.38;
const WALK = 9.2;
const JUMP = 8.2;
const GRAV_ACCEL = 24;
const BEVEL = 2.35;
const RAMP_LEN = BEVEL * Math.SQRT2;

const OUTS = [
  new THREE.Vector3(1, 0, 0),
  new THREE.Vector3(-1, 0, 0),
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(0, -1, 0),
  new THREE.Vector3(0, 0, 1),
  new THREE.Vector3(0, 0, -1),
];

const FACES: { out: THREE.Vector3; name: string; col: number; mark: number }[] = [
  { out: new THREE.Vector3(0, 1, 0), name: "+Y  CEILING", col: 0x1c252c, mark: 0x7ec8c4 },
  { out: new THREE.Vector3(0, -1, 0), name: "−Y  FLOOR", col: 0x14181c, mark: 0xc45c4a },
  { out: new THREE.Vector3(1, 0, 0), name: "+X  WALL", col: 0x181e24, mark: 0xc8ccd4 },
  { out: new THREE.Vector3(-1, 0, 0), name: "−X  WALL", col: 0x181e24, mark: 0x8aa0a8 },
  { out: new THREE.Vector3(0, 0, 1), name: "+Z  WALL", col: 0x161c20, mark: 0x7ec8c4 },
  { out: new THREE.Vector3(0, 0, -1), name: "−Z  WALL", col: 0x161c20, mark: 0xc45c4a },
];

export type MountHandle = {
  dispose: () => void;
  start: () => void;
  requestLock: () => void;
  setLookDelta: (dx: number, dy: number) => void;
  setMoveStick: (x: number, y: number) => void;
  setJump: (down: boolean) => void;
};

export function mountGunWraith(
  canvas: HTMLCanvasElement,
  onHud: (s: HudState) => void,
): MountHandle {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07080a);
  scene.fog = new THREE.Fog(0x07080a, 28, 56);

  const camera = new THREE.PerspectiveCamera(78, 1, 0.05, 80);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x07080a, 1);

  scene.add(new THREE.AmbientLight(0x6a7a82, 1.4));
  scene.add(new THREE.HemisphereLight(0x7ec8c4, 0x1a1512, 0.55));
  const key = new THREE.DirectionalLight(0xc8ccd4, 0.85);
  key.position.set(6, 10, 4);
  scene.add(key);
  const teal = new THREE.PointLight(0x7ec8c4, 40, 48);
  scene.add(teal);
  const fill = new THREE.PointLight(0xc45c4a, 18, 36);
  fill.position.set(-6, -4, 5);
  scene.add(fill);

  const roomGroup = new THREE.Group();
  scene.add(roomGroup);
  const faceSpan = ROOM - 2 * BEVEL;
  const bevelMat = new THREE.MeshStandardMaterial({
    color: 0x1e2a30,
    roughness: 0.72,
    metalness: 0.18,
    side: THREE.FrontSide,
  });
  const bevelEdgeMat = new THREE.LineBasicMaterial({
    color: 0x7ec8c4,
    transparent: true,
    opacity: 0.55,
  });
  const cornerMat = new THREE.MeshStandardMaterial({
    color: 0x2a1816,
    roughness: 0.7,
    metalness: 0.12,
    side: THREE.FrontSide,
  });

  for (const f of FACES) {
    const geo = new THREE.PlaneGeometry(faceSpan, faceSpan);
    const mat = new THREE.MeshStandardMaterial({
      color: f.col,
      roughness: 0.82,
      metalness: 0.12,
      side: THREE.FrontSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    const inward = f.out.clone().negate();
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), inward);
    mesh.quaternion.copy(quat);
    mesh.position.copy(f.out).multiplyScalar(HALF);
    roomGroup.add(mesh);

    const grid = new THREE.GridHelper(faceSpan, 10, f.mark, 0x243038);
    grid.quaternion.copy(quat);
    grid.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2));
    grid.position.copy(mesh.position).add(inward.clone().multiplyScalar(0.03));
    roomGroup.add(grid);

    const glyph = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 2.6),
      new THREE.MeshBasicMaterial({
        color: f.mark,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
      }),
    );
    glyph.quaternion.copy(mesh.quaternion);
    glyph.position.copy(mesh.position).add(inward.clone().multiplyScalar(0.04));
    roomGroup.add(glyph);
  }

  const eAx = new THREE.Vector3();
  const stripDir = new THREE.Vector3();
  const inward45 = new THREE.Vector3();
  const bevelBasis = new THREE.Matrix4();
  for (let i = 0; i < OUTS.length; i++) {
    for (let j = i + 1; j < OUTS.length; j++) {
      const a = OUTS[i];
      const b = OUTS[j];
      if (Math.abs(a.dot(b)) > 0.5) continue;
      eAx.crossVectors(a, b).normalize();
      inward45.copy(a).add(b).multiplyScalar(-1).normalize();
      stripDir.crossVectors(inward45, eAx).normalize();
      bevelBasis.makeBasis(eAx, stripDir, inward45);
      const strip = new THREE.Mesh(
        new THREE.PlaneGeometry(faceSpan, BEVEL * Math.SQRT2),
        bevelMat,
      );
      strip.quaternion.setFromRotationMatrix(bevelBasis);
      strip.position.copy(a).add(b).multiplyScalar(HALF);
      strip.position.addScaledVector(inward45, BEVEL / Math.SQRT2);
      roomGroup.add(strip);
      const stripEdge = new THREE.LineSegments(new THREE.EdgesGeometry(strip.geometry), bevelEdgeMat);
      stripEdge.quaternion.copy(strip.quaternion);
      stripEdge.position.copy(strip.position);
      roomGroup.add(stripEdge);
    }
  }

  const cv0 = new THREE.Vector3();
  const cv1 = new THREE.Vector3();
  const cv2 = new THREE.Vector3();
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        cv0.set(sx * (HALF - BEVEL), sy * HALF, sz * HALF);
        cv1.set(sx * HALF, sy * (HALF - BEVEL), sz * HALF);
        cv2.set(sx * HALF, sy * HALF, sz * (HALF - BEVEL));
        const inward = new THREE.Vector3(-sx, -sy, -sz);
        const n = new THREE.Vector3().subVectors(cv1, cv0).cross(new THREE.Vector3().subVectors(cv2, cv0));
        const geo = new THREE.BufferGeometry();
        if (n.dot(inward) < 0) geo.setFromPoints([cv0.clone(), cv2.clone(), cv1.clone()]);
        else geo.setFromPoints([cv0.clone(), cv1.clone(), cv2.clone()]);
        geo.computeVertexNormals();
        roomGroup.add(new THREE.Mesh(geo, cornerMat));
      }
    }
  }

  const core = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.32, 0),
    new THREE.MeshBasicMaterial({ color: 0x7ec8c4, wireframe: true }),
  );
  scene.add(core);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.28, 0.38, 24),
    new THREE.MeshBasicMaterial({
      color: 0x7ec8c4,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
    }),
  );
  scene.add(ring);

  const up = new THREE.Vector3(0, 1, 0);
  const targetUp = new THREE.Vector3(0, 1, 0);
  const fromUp = new THREE.Vector3(0, 1, 0);
  const fromLookF = new THREE.Vector3();
  const fromLookR = new THREE.Vector3();
  const fromLookFull = new THREE.Vector3();
  const slideFromOut = new THREE.Vector3();
  const slideToOut = new THREE.Vector3();
  const slideEdge = new THREE.Vector3();
  let slideCoord = 0;
  let slideU = 0;
  let slideLatVel = 0;
  let slideLock = 0;
  let captured = false;
  let skipLook = 0;
  const qId = new THREE.Quaternion();
  const qFull = new THREE.Quaternion();
  const qNow = new THREE.Quaternion();
  let reorientT = 1;
  const pos = new THREE.Vector3(0, -HALF + EYE, 0);
  let pitch = 0;
  let upSpeed = 0;
  let grounded = true;
  let playing = false;
  let lastHud = "";

  const held = new Set<string>();
  const injected = new Set<string>();
  const stick = { x: 0, y: 0 };
  let jumpHeld = false;
  let lookMuteUntil = 0;

  const lookF = new THREE.Vector3();
  const lookR = new THREE.Vector3();
  const wish = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const lookFull = new THREE.Vector3();
  const camRight = new THREE.Vector3();
  const camFwd = new THREE.Vector3();
  const camMat = new THREE.Matrix4();
  const aimPoint = new THREE.Vector3();
  let holdAim = false;
  const prevCamQ = new THREE.Quaternion();
  let havePrevCam = false;
  let maxQuatStep = 0;
  const reorientLog: { s: number; ang: number; pitch: number; udot: number }[] = [];
  let planarSpeed = 0;
  let frameSpeed = 0;
  const prevPos = new THREE.Vector3(0, -HALF + EYE, 0);

  {
    const yaw0 = Math.PI * 0.78;
    lookF.set(-Math.sin(yaw0), 0, -Math.cos(yaw0));
    lookR.crossVectors(lookF, up).normalize();
    orthonormalFrame(up, lookF, lookR);
  }

  function lookDirTo(out: THREE.Vector3) {
    out.copy(lookF).multiplyScalar(Math.cos(pitch)).addScaledVector(up, Math.sin(pitch));
    if (out.lengthSq() < 1e-8) out.copy(lookF);
    else out.normalize();
    return out;
  }

  function hitInterior(origin: THREE.Vector3, dir: THREE.Vector3, out: THREE.Vector3) {
    const lim = HALF - 0.02;
    let tHit = 64;
    for (let i = 0; i < 3; i++) {
      const d = dir.getComponent(i);
      const o = origin.getComponent(i);
      let t = -1;
      if (d > 1e-6) t = (lim - o) / d;
      else if (d < -1e-6) t = (-lim - o) / d;
      if (t > 0.15 && t < tHit) tHit = t;
    }
    out.copy(origin).addScaledVector(dir, tHit);
    return out;
  }

  function adoptAimAsFps() {
    camFwd.subVectors(aimPoint, pos);
    if (camFwd.lengthSq() < 1e-8) lookDirTo(camFwd);
    else camFwd.normalize();
    pitch = extractPitch(camFwd, up);
    tmp.copy(camFwd).addScaledVector(up, -camFwd.dot(up));
    if (tmp.lengthSq() > 1e-5) {
      lookF.copy(tmp).normalize();
      lookR.crossVectors(lookF, up).normalize();
      lookF.crossVectors(up, lookR).normalize();
    } else {
      orthonormalFrame(up, lookF, lookR);
    }
  }

  function faceForUp(u: THREE.Vector3) {
    let best = FACES[1];
    let d = -2;
    for (const f of FACES) {
      const dot = -f.out.dot(u);
      if (dot > d) {
        d = dot;
        best = f;
      }
    }
    return best;
  }

  function applyLookDelta(dx: number, dy: number) {
    if (reorientT < 1) return;
    if (performance.now() < lookMuteUntil) return;
    qNow.setFromAxisAngle(up, -dx * 0.0022);
    lookF.applyQuaternion(qNow);
    lookR.applyQuaternion(qNow);
    orthonormalFrame(up, lookF, lookR);
    pitch -= dy * 0.0022;
    pitch = Math.max(-1.45, Math.min(1.45, pitch));
  }

  function snapAxis(v: THREE.Vector3, out: THREE.Vector3) {
    const ax = Math.abs(v.x);
    const ay = Math.abs(v.y);
    const az = Math.abs(v.z);
    if (ax >= ay && ax >= az) out.set(Math.sign(v.x) || 1, 0, 0);
    else if (ay >= az) out.set(0, Math.sign(v.y) || 1, 0);
    else out.set(0, 0, Math.sign(v.z) || 1);
    return out;
  }

  function plantOnSlide(u: number) {
    tmp.copy(slideToOut).multiplyScalar(HALF - (1 - u) * BEVEL);
    tmp2.copy(slideFromOut).multiplyScalar(HALF - u * BEVEL);
    tmp.add(tmp2).addScaledVector(slideEdge, slideCoord);
    pos.copy(tmp).addScaledVector(up, EYE);
  }

  function applyReorientPose(s: number) {
    qNow.slerpQuaternions(qId, qFull, s);
    up.copy(fromUp).applyQuaternion(qNow).normalize();
    if (s >= 1) up.copy(targetUp).normalize();
    lookF.copy(fromLookF).applyQuaternion(qNow);
    lookR.copy(fromLookR).applyQuaternion(qNow);
    orthonormalFrame(up, lookF, lookR);
  }

  function gatherWish() {
    wish.set(0, 0, 0);
    if (!(playing || injected.size)) return;
    if (isDown("KeyW") || isDown("ArrowUp")) wish.add(lookF);
    if (isDown("KeyS") || isDown("ArrowDown")) wish.sub(lookF);
    if (isDown("KeyD") || isDown("ArrowRight")) wish.add(lookR);
    if (isDown("KeyA") || isDown("ArrowLeft")) wish.sub(lookR);
    if (stick.x || stick.y) {
      wish.addScaledVector(lookF, -stick.y);
      wish.addScaledVector(lookR, stick.x);
    }
  }

  function tryReorient(wishDir: THREE.Vector3) {
    if (reorientT < 1) return;
    if (slideLock > 0) return;
    tmp.copy(pos).addScaledVector(up, -EYE);
    snapAxis(up, fromUp);
    slideFromOut.copy(fromUp).negate();
    let bestOut: THREE.Vector3 | null = null;
    let bestReach = HALF - BEVEL + 0.12;
    for (const e of OUTS) {
      if (Math.abs(e.dot(fromUp)) > 0.5) continue;
      const reach = tmp.dot(e);
      if (reach > bestReach) {
        bestReach = reach;
        bestOut = e;
      }
    }
    if (!bestOut) return;
    const toward = wishDir.lengthSq() > 0 ? wishDir : lookF;
    if (bestOut.dot(toward) < -0.15) return;
    slideToOut.copy(bestOut);
    targetUp.copy(bestOut).negate();
    slideEdge.crossVectors(slideFromOut, slideToOut).normalize();
    slideCoord = THREE.MathUtils.clamp(
      tmp.dot(slideEdge),
      -(HALF - BEVEL - RADIUS),
      HALF - BEVEL - RADIUS,
    );
    fromLookF.copy(lookF);
    fromLookR.copy(lookR);
    lookDirTo(fromLookFull);
    hitInterior(pos, fromLookFull, aimPoint);
    holdAim = true;
    rotationBetween(fromUp, targetUp, qFull);
    slideU = THREE.MathUtils.clamp((tmp.dot(slideToOut) - (HALF - BEVEL)) / BEVEL, 0, 0.4);
    slideLatVel = toward.dot(slideEdge) * WALK;
    reorientT = slideU;
    upSpeed = 0;
    planarSpeed = WALK;
    maxQuatStep = 0;
    havePrevCam = false;
    reorientLog.length = 0;
  }

  function isDown(code: string) {
    return held.has(code) || injected.has(code);
  }

  function pushHud() {
    const face = faceForUp(up).name;
    const hold: HudState["hold"] = !playing
      ? "IDLE"
      : reorientT < 1
        ? "REORIENT"
        : grounded
          ? "PLANTED"
          : "AIR";
    const key = `${face}|${hold}|${playing}|${captured}`;
    if (key === lastHud) return;
    lastHud = key;
    onHud({ face, hold, playing, captured });
  }

  function resize() {
    const w = canvas.clientWidth || canvas.parentElement?.clientWidth || 1;
    const h = canvas.clientHeight || canvas.parentElement?.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas.parentElement ?? canvas);

  const onKeyDown = (e: KeyboardEvent) => {
    held.add(e.code);
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
      e.preventDefault();
    }
  };
  function isLocked() {
    const el = document.pointerLockElement;
    return el === canvas || el === canvas.parentElement;
  }

  function requestLock() {
    skipLook = 2;
    lookMuteUntil = performance.now() + 180;
    const req = canvas.requestPointerLock as (opts?: { unadjustedMovement?: boolean }) => Promise<void> | void;
    try {
      const p = req.call(canvas, { unadjustedMovement: true });
      if (p && typeof (p as Promise<void>).catch === "function") {
        (p as Promise<void>).catch(() => {
          try {
            canvas.requestPointerLock();
          } catch {
            /* iframe may deny */
          }
        });
      }
    } catch {
      try {
        canvas.requestPointerLock();
      } catch {
        /* iframe may deny */
      }
    }
  }

  const onLockChange = () => {
    const next = isLocked();
    if (next && !captured) skipLook = 2;
    captured = next;
    lastHud = "";
    pushHud();
  };
  const onKeyUp = (e: KeyboardEvent) => held.delete(e.code);
  const onBlur = () => held.clear();
  const onMouseMove = (e: MouseEvent) => {
    if (!playing && injected.size === 0) return;
    if (!isLocked()) return;
    if (skipLook > 0) {
      skipLook -= 1;
      return;
    }
    applyLookDelta(e.movementX, e.movementY);
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("pointerlockchange", onLockChange);

  let last = performance.now();
  let raf = 0;

  function tick(now: number) {
    raf = requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (reorientT < 1) {
      slideU += (WALK * dt) / RAMP_LEN;
      const s = Math.min(1, slideU);
      applyReorientPose(s);
      pos.addScaledVector(up, EYE - (pos.dot(up) + HALF));
      gatherWish();
      if (wish.lengthSq() < 1e-8) wish.copy(lookF);
      wish.normalize();
      pos.addScaledVector(wish, WALK * dt);
      planarSpeed = WALK;
      grounded = true;
      upSpeed = 0;
      reorientT = s;
      holdAim = true;
      if (s >= 1) {
        slideLock = 0.22;
        adoptAimAsFps();
      }
    } else {
      holdAim = false;
      if (slideLock > 0) slideLock = Math.max(0, slideLock - dt);
      gatherWish();
      if (wish.lengthSq() > 0) {
        wish.normalize();
        planarSpeed = WALK;
        pos.addScaledVector(wish, WALK * dt);
      } else {
        planarSpeed = 0;
      }

      if (playing || injected.size) {
        if (grounded && (isDown("Space") || jumpHeld)) {
          upSpeed = JUMP;
          grounded = false;
        }
        upSpeed -= GRAV_ACCEL * dt;
        pos.addScaledVector(up, upSpeed * dt);
      }

      const inner = HALF - RADIUS;
      pos.x = THREE.MathUtils.clamp(pos.x, -inner, inner);
      pos.y = THREE.MathUtils.clamp(pos.y, -inner, inner);
      pos.z = THREE.MathUtils.clamp(pos.z, -inner, inner);

      const heightAboveFloor = pos.dot(up) + HALF;
      if (heightAboveFloor <= EYE + 0.02 && upSpeed <= 0) {
        pos.addScaledVector(up, EYE - heightAboveFloor);
        upSpeed = 0;
        grounded = true;
      } else {
        grounded = heightAboveFloor <= EYE + 0.1 && upSpeed <= 0.25;
      }

      if (playing || injected.size) tryReorient(wish);
    }

    camera.position.copy(pos);
    frameSpeed = prevPos.distanceTo(pos) / Math.max(dt, 1e-4);
    prevPos.copy(pos);
    if (holdAim) {
      camFwd.subVectors(aimPoint, pos);
      if (camFwd.lengthSq() < 1e-8) lookDirTo(camFwd);
      else camFwd.normalize();
    } else {
      lookDirTo(camFwd);
    }
    tmp.copy(camFwd).negate();
    camRight.crossVectors(up, tmp);
    if (camRight.lengthSq() < 1e-8) {
      camRight.copy(lookR).addScaledVector(camFwd, -lookR.dot(camFwd));
      if (camRight.lengthSq() < 1e-8) {
        camRight.set(1, 0, 0);
        if (Math.abs(camFwd.x) > 0.9) camRight.set(0, 0, 1);
        camRight.addScaledVector(camFwd, -camRight.dot(camFwd));
      }
    }
    camRight.normalize();
    lookFull.crossVectors(tmp, camRight).normalize();
    camMat.makeBasis(camRight, lookFull, tmp);
    camera.quaternion.setFromRotationMatrix(camMat);
    camera.up.copy(up);
    if (havePrevCam) {
      const d = Math.abs(prevCamQ.dot(camera.quaternion));
      const ang = 2 * Math.acos(Math.min(1, d));
      if (reorientT < 1) {
        if (ang > maxQuatStep) maxQuatStep = ang;
        if (reorientLog.length < 80) {
          reorientLog.push({ s: reorientT, ang: (ang * 180) / Math.PI, pitch, udot: lookF.dot(up) });
        }
      }
    }
    prevCamQ.copy(camera.quaternion);
    havePrevCam = true;

    ring.position.copy(pos).addScaledVector(up, -EYE + 0.04);
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), up);

    core.rotation.x += dt * 0.4;
    core.rotation.y += dt * 0.7;

    renderer.render(scene, camera);
    pushHud();
  }
  raf = requestAnimationFrame(tick);

  const probe: ControlsProbe = {
    getYaw: () => Math.atan2(-lookF.x, -lookF.z),
    getSpeed: () => planarSpeed,
    getPos: () => ({ x: pos.x, y: pos.y, z: pos.z }),
    getUp: () => ({ x: up.x, y: up.y, z: up.z }),
    getLook: () => ({ x: lookF.x, y: lookF.y, z: lookF.z, pitch }),
    getCamQuat: () => {
      const e = camera.quaternion;
      return { x: e.x, y: e.y, z: e.z, w: e.w };
    },
    getFrame: () => ({
      up: { x: up.x, y: up.y, z: up.z },
      look: { x: lookF.x, y: lookF.y, z: lookF.z },
      pitch,
      lookDotUp: lookF.dot(up),
      reorient: reorientT,
      aim: { x: camFwd.x, y: camFwd.y, z: camFwd.z },
      aimPoint: { x: aimPoint.x, y: aimPoint.y, z: aimPoint.z },
      qx: camera.quaternion.x,
      qy: camera.quaternion.y,
      qz: camera.quaternion.z,
      qw: camera.quaternion.w,
      maxQuatStepDeg: (maxQuatStep * 180) / Math.PI,
      frameSpeed,
      log: reorientLog,
    }),
    setKeys: (codes) => {
      injected.clear();
      for (const c of codes) injected.add(c);
    },
    setPlaying: (v) => {
      playing = v;
      if (v) {
        lookMuteUntil = performance.now() + 200;
        requestLock();
      }
      lastHud = "";
      pushHud();
    },
    lookAtCore: () => {
      tmp.set(0, 0, 0).sub(pos);
      if (tmp.lengthSq() < 1e-8) tmp.set(0, 1, 0);
      else tmp.normalize();
      pitch = extractPitch(tmp, up);
      camFwd.copy(tmp).addScaledVector(up, -tmp.dot(up));
      if (camFwd.lengthSq() > 1e-6) {
        lookF.copy(camFwd).normalize();
        lookR.crossVectors(lookF, up).normalize();
        lookF.crossVectors(up, lookR).normalize();
      }
    },
    lookAtPoint: (x, y, z) => {
      tmp.set(x, y, z).sub(pos);
      if (tmp.lengthSq() < 1e-8) return;
      tmp.normalize();
      pitch = extractPitch(tmp, up);
      camFwd.copy(tmp).addScaledVector(up, -tmp.dot(up));
      if (camFwd.lengthSq() > 1e-6) {
        lookF.copy(camFwd).normalize();
        lookR.crossVectors(lookF, up).normalize();
        lookF.crossVectors(up, lookR).normalize();
      }
    },
  };
  window.__controlsTest = probe;

  return {
    start() {
      playing = true;
      lookMuteUntil = performance.now() + 200;
      requestLock();
      lastHud = "";
      pushHud();
    },
    requestLock() {
      requestLock();
    },
    setLookDelta(dx, dy) {
      if (!playing && injected.size === 0) return;
      if (isLocked()) return;
      applyLookDelta(dx, dy);
    },
    setMoveStick(x, y) {
      stick.x = x;
      stick.y = y;
    },
    setJump(down) {
      jumpHeld = down;
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("pointerlockchange", onLockChange);
      if (window.__controlsTest === probe) delete window.__controlsTest;
      renderer.dispose();
      scene.traverse((obj) => {
        const m = obj as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else if (mat) mat.dispose();
      });
    },
  };
}
