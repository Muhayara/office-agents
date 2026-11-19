import * as THREE from 'three';
import { BODY } from './config';
import type { BoneName } from './parts';
import type { AvatarRig } from './rig';

/**
 * F1 — kosakata pose Rig v2 (rencana §3.2). Semua dalam ruang akar avatar TANPA skala
 * (titik asal = lantai, +Z = depan); pemanggil membagi tinggi dunia dengan `rig.scale`.
 *
 * Sisi `L` = kiri pemakai = +X.
 * Kaki: IK 2 tulang (pinggul → lutut → pergelangan) + abduksi, telapak tetap sejajar lantai.
 * Lengan: IK 2 tulang bahu → siku → pergelangan dengan vektor kutub (siku ke bawah-belakang-luar).
 */

export type Side = 'L' | 'R';
export interface FootTarget { fwd: number; y: number; lat: number }

const L1 = BODY.thigh, L2 = BODY.shin;
const A1 = BODY.upperArm, A2 = BODY.forearm;
const DOWN = new THREE.Vector3(0, -1, 0);
const _m = new THREE.Matrix4();
const _mi = new THREE.Matrix4();
const _t = new THREE.Vector3();
const _a = new THREE.Vector3();
const _d = new THREE.Vector3();
const _n = new THREE.Vector3();
const _u = new THREE.Vector3();
const _e = new THREE.Vector3();
const _f = new THREE.Vector3();
const _p = new THREE.Vector3();
const _qi = new THREE.Quaternion();
const clamp = THREE.MathUtils.clamp;

/** Tinggi sendi pinggul berdiri & tulang hips di atasnya. */
export const STAND_HIP = BODY.hipJoint;

/** Posisi tulang di ruang akar (rantai matriks lokal sampai `root`). */
export function rootPos(r: AvatarRig, bone: BoneName, out: THREE.Vector3): THREE.Vector3 {
  let o: THREE.Object3D | null = r.bones[bone];
  o.updateMatrix();
  _m.copy(o.matrix);
  o = o.parent;
  while (o && o !== r.bones.root) {
    o.updateMatrix();
    _m.premultiply(o.matrix);
    o = o.parent;
  }
  return out.setFromMatrixPosition(_m);
}

/** Matriks ruang-akar sebuah tulang (untuk mengubah target ke ruang lokalnya). */
function rootMatrix(r: AvatarRig, bone: BoneName, out: THREE.Matrix4): THREE.Matrix4 {
  let o: THREE.Object3D | null = r.bones[bone];
  o.updateMatrix();
  out.copy(o.matrix);
  o = o.parent;
  while (o && o !== r.bones.root) {
    o.updateMatrix();
    out.premultiply(o.matrix);
    o = o.parent;
  }
  return out;
}

/** Pinggul (sendi) di ruang akar = posisi tulang hips + offset sendi (hips tidak pernah diputar). */
function hipJoint(r: AvatarRig, side: Side, out: THREE.Vector3) {
  const hp = r.bones[side === 'L' ? 'hipL' : 'hipR'];
  return out.copy(r.bones.hips.position).add(hp.position);
}

/**
 * IK kaki ke target pergelangan (ruang akar). Mengembalikan sisa jarak bila tidak sampai (0 = menapak).
 */
export function solveLeg(r: AvatarRig, side: Side, ankle: THREE.Vector3): number {
  const b = r.bones;
  const hp = side === 'L' ? b.hipL : b.hipR, kn = side === 'L' ? b.kneeL : b.kneeR, an = side === 'L' ? b.ankleL : b.ankleR;
  hipJoint(r, side, _a);
  const dx = ankle.x - _a.x, dy = ankle.y - _a.y, dz = ankle.z - _a.z;
  const thetaZ = Math.atan2(dx, -dy);
  const v = Math.hypot(dx, dy);
  const raw = Math.hypot(dz, v);
  const reach = L1 + L2 - 1e-4;
  const D = Math.max(0.05, Math.min(raw, reach));
  const phi = Math.atan2(dz, v);
  const beta = Math.acos(clamp((L1 * L1 + D * D - L2 * L2) / (2 * L1 * D), -1, 1));
  const inner = Math.acos(clamp((L1 * L1 + L2 * L2 - D * D) / (2 * L1 * L2), -1, 1));
  const thighX = -(phi + beta);
  const kneeX = Math.PI - inner;
  hp.rotation.set(thighX, 0, thetaZ);
  kn.rotation.set(kneeX, 0, 0);
  an.rotation.set(-(thighX + kneeX), 0, -thetaZ);
  return Math.max(0, raw - reach);
}

/**
 * IK lengan: pergelangan ke `target` (ruang akar). `pole` = arah siku di ruang dada (dinormalisasi di sini).
 * Mengembalikan galat jangkauan (m, 0 = sampai).
 */
export function solveArm(r: AvatarRig, side: Side, target: THREE.Vector3, pole: THREE.Vector3): number {
  const b = r.bones;
  const sh = side === 'L' ? b.shoulderL : b.shoulderR, el = side === 'L' ? b.elbowL : b.elbowR;
  rootMatrix(r, 'chest', _m);
  _mi.copy(_m).invert();
  _t.copy(target).applyMatrix4(_mi);
  _a.copy(sh.position);
  _d.subVectors(_t, _a);
  const raw = _d.length();
  const reach = A1 + A2 - 1e-4;
  const D = clamp(raw, 0.06, reach);
  _d.normalize();
  const cosA = clamp((A1 * A1 + D * D - A2 * A2) / (2 * A1 * D), -1, 1);
  const alpha = Math.acos(cosA);
  _p.copy(pole).normalize();
  _n.crossVectors(_d, _p);
  if (_n.lengthSq() < 1e-6) _n.set(1, 0, 0);
  _n.normalize();
  _u.copy(_d).applyAxisAngle(_n, alpha); // lengan atas condong ke arah kutub
  _e.copy(_a).addScaledVector(_u, A1);
  _t.copy(_a).addScaledVector(_d, D); // target terjangkau
  _f.subVectors(_t, _e).normalize();
  sh.quaternion.setFromUnitVectors(DOWN, _u);
  _qi.copy(sh.quaternion).invert();
  _f.applyQuaternion(_qi);
  el.quaternion.setFromUnitVectors(DOWN, _f);
  return Math.max(0, raw - reach);
}

/** Pose dasar berdiri: kaki lurus sedikit terbuka, napas halus. */
export function poseStand(r: AvatarRig, breath = 0) {
  const b = r.bones;
  b.hips.position.y = STAND_HIP + BODY.pelvisAbove + breath;
  b.hips.position.z = 0;
  for (const s of [1, -1] as const) {
    // s = +1 kaki kiri (+X): abduksi ke luar = putar Z positif.
    const hp = s > 0 ? b.hipL : b.hipR, an = s > 0 ? b.ankleL : b.ankleR, kn = s > 0 ? b.kneeL : b.kneeR;
    hp.rotation.set(0, 0, s * 0.03);
    kn.rotation.set(0, 0, 0);
    an.rotation.set(0, 0, -s * 0.03);
  }
  // Sedikit turun bila kaki terbuka (cos 0,03 ≈ 1, abaikan).
}

/**
 * Berjalan: fase langkah (rad), amp 0..1. Pinggul diturunkan sampai telapak kaki penopang tepat di lantai.
 * Lengan berayun berlawanan dengan kaki (FK).
 */
export function poseWalk(r: AvatarRig, phase: number, amp = 1) {
  const b = r.bones;
  const A = 0.45 * amp;
  let drop = 0;
  for (const side of ['L', 'R'] as const) {
    const ph = phase + (side === 'R' ? Math.PI : 0);
    const s = Math.sin(ph), c = Math.cos(ph);
    const thigh = -A * s;
    const knee = 0.06 + 0.95 * amp * Math.pow(Math.max(0, c), 1.4) * (0.6 + 0.4 * Math.max(0, -s + 0.4));
    const hp = side === 'L' ? b.hipL : b.hipR, kn = side === 'L' ? b.kneeL : b.kneeR, an = side === 'L' ? b.ankleL : b.ankleR;
    hp.rotation.set(thigh, 0, side === 'L' ? 0.02 : -0.02);
    kn.rotation.set(knee, 0, 0);
    an.rotation.set(-(thigh + knee) * 0.85, 0, 0);
    drop = Math.max(drop, L1 * Math.cos(thigh) + L2 * Math.cos(thigh + knee));
    // Lengan sisi yang sama berayun berlawanan dengan kakinya.
    const sh = side === 'L' ? b.shoulderL : b.shoulderR, el = side === 'L' ? b.elbowL : b.elbowR;
    const armFwd = s; // kaki maju → lengan sisi ini mundur
    sh.rotation.set(0.5 * amp * armFwd, 0, side === 'L' ? 0.08 : -0.08);
    el.rotation.set(-0.22 - 0.35 * amp * Math.max(0, -armFwd), 0, 0);
  }
  b.hips.position.y = drop + BODY.ankle + BODY.pelvisAbove;
  b.hips.position.z = 0;
  b.spine.rotation.set(0.05 * amp, 0.07 * amp * Math.sin(phase), 0);
  b.chest.rotation.set(0, -0.05 * amp * Math.sin(phase), 0);
}

export interface SitParams {
  /** Tinggi permukaan dudukan (ruang akar, sudah dibagi skala). */
  top: number;
  /** Sendi pinggul di depan titik dudukan (m, sepanjang arah hadap). */
  hipFwd: number;
  /** Condong badan (rad, + ke depan). */
  lean: number;
  footL: FootTarget;
  footR: FootTarget;
}

const _ank = new THREE.Vector3();
/**
 * Duduk dengan bobot k (0 = berdiri di titik yang sama, 1 = duduk penuh). Mengembalikan celah kaki
 * terbesar (m) — 0 berarti kedua telapak menapak lantai / pijakan.
 */
export function poseSit(r: AvatarRig, p: SitParams, k: number): number {
  const b = r.bones;
  const kk = clamp(k, 0, 1);
  const seatHip = p.top + BODY.hipAboveSeat;
  const hipY = STAND_HIP + (seatHip - STAND_HIP) * kk;
  b.hips.position.set(0, hipY + BODY.pelvisAbove, p.hipFwd * kk);
  let gap = 0;
  for (const side of ['L', 'R'] as const) {
    const ft = side === 'L' ? p.footL : p.footR;
    const sx = side === 'L' ? 1 : -1;
    const hx = sx * BODY.hipX;
    // Dari bawah pinggul (berdiri) ke target duduk.
    _ank.set(
      hx + (sx * ft.lat - hx) * kk,
      BODY.ankle + (ft.y - BODY.ankle) * kk,
      p.hipFwd * kk + (ft.fwd - p.hipFwd) * kk * Math.min(1, kk * 1.4),
    );
    gap = Math.max(gap, solveLeg(r, side, _ank));
  }
  const trans = Math.sin(Math.PI * kk) * 0.32 * (1 - kk * 0.3);
  b.spine.rotation.set(p.lean * kk * 0.7 + trans, 0, 0);
  b.chest.rotation.set(p.lean * kk * 0.3, 0, 0);
  return gap;
}

/** Tolehan kepala: yaw (+ ke kiri avatar = +X), pitch (+ menunduk), dibagi leher 40% & kepala 60%. */
export function poseHead(r: AvatarRig, yaw: number, pitch: number) {
  r.bones.neck.rotation.set(pitch * 0.35, yaw * 0.4, 0);
  r.bones.head.rotation.set(pitch * 0.65, yaw * 0.6, 0);
}

/** FK lengan sederhana (gestur): bahu (x maju-negatif, z abduksi) & tekuk siku. */
export function armFK(r: AvatarRig, side: Side, sx: number, sz: number, elbow: number) {
  const sh = side === 'L' ? r.bones.shoulderL : r.bones.shoulderR, el = side === 'L' ? r.bones.elbowL : r.bones.elbowR;
  sh.rotation.set(sx, 0, side === 'L' ? sz : -sz);
  el.rotation.set(elbow, 0, 0);
}

/** Pergelangan (tekuk telapak): + = jari ke bawah/depan. */
export function wrist(r: AvatarRig, side: Side, pitch: number, roll = 0) {
  (side === 'L' ? r.bones.handL : r.bones.handR).rotation.set(pitch, 0, roll);
}

export const POLE = {
  L: new THREE.Vector3(0.55, -0.75, -0.4),
  R: new THREE.Vector3(-0.55, -0.75, -0.4),
  /** Lengan terangkat (melambai / garuk kepala): siku ke samping-belakang. */
  upL: new THREE.Vector3(1, -0.2, -0.5),
  upR: new THREE.Vector3(-1, -0.2, -0.5),
} as const;

/** Arah hadap terbatas laju (rad/dtk) — belok badan halus (rencana §3.2, ±7 rad/dtk). */
export function approachAngle(cur: number, target: number, maxStep: number): number {
  let d = target - cur;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  if (Math.abs(d) <= maxStep) return target;
  return cur + Math.sign(d) * maxStep;
}

export const wrapAngle = (a: number) => {
  let d = a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
};

