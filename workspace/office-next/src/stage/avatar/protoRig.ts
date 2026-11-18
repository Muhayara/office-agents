import * as THREE from 'three';
import { AGENT_LOOKS, DEFAULT_LOOK, HAIR_PALETTE, SKIN_PALETTE, UNIFORMS, type AgentLook, type UniformVariant } from './looks';

/**
 * F0 — prototipe STATIS Avatar Rig v2 1,70 m (rencana-fpv-dan-kustomisasi-karakter.md §2.2).
 *
 * Hanya untuk membandingkan skala & seragam lewat screenshot (`rigCompare()`, `uniform()`):
 * bagian primitif low-poly yang ditempel ke grup sendi (belum mesh skinned gabungan; itu F1).
 * Sumbu lokal: +Z = depan (wajah), +Y = atas, titik asal = lantai di antara kedua kaki.
 */

/** Proporsi target §2.2 (`height` 1,0 = 1,70 m). */
export const V2 = {
  top: 1.70,
  eye: 1.58,
  shoulder: 1.38,
  hip: 0.87,
  knee: 0.47,
  ankle: 0.07,
  thigh: 0.40,
  shin: 0.40,
  upperArm: 0.29,
  forearm: 0.25,
  shoulderX: 0.19,
  hipX: 0.095,
  /** Sendi pinggul di atas permukaan dudukan saat duduk. */
  hipAboveSeat: 0.09,
} as const;

export interface ProtoJoints {
  root: THREE.Group;
  hips: THREE.Group;
  chest: THREE.Group;
  head: THREE.Group;
  eye: THREE.Object3D;
  shoulderL: THREE.Group; elbowL: THREE.Group;
  shoulderR: THREE.Group; elbowR: THREE.Group;
  hipL: THREE.Group; kneeL: THREE.Group; ankleL: THREE.Group;
  hipR: THREE.Group; kneeR: THREE.Group; ankleR: THREE.Group;
  beacon: THREE.Mesh;
}

const mat = (color: number, rough = 0.7, metal = 0.05) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });

function mesh(geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
  o.castShadow = true;
  return o;
}

/** Silinder dari y0 (jari-jari r0) ke y1 (jari-jari r1), elips di sumbu Z (skala kedalaman). */
function limb(r0: number, r1: number, y0: number, y1: number, m: THREE.Material, depth = 1, seg = 8): THREE.Mesh {
  const g = new THREE.CylinderGeometry(r1, r0, Math.abs(y1 - y0), seg);
  const o = mesh(g, m, 0, (y0 + y1) / 2, 0);
  o.scale.z = depth;
  return o;
}

function addHair(head: THREE.Group, look: AgentLook, hairMat: THREE.Material, hijabColor: number) {
  const S = 0.118;
  switch (look.hair) {
    case 'botak':
      return;
    case 'cepak': {
      const cap = mesh(new THREE.SphereGeometry(S * 1.04, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.42), hairMat, 0, 0.012, -0.004);
      cap.scale.set(0.86, 1.02, 0.95);
      head.add(cap);
      return;
    }
    case 'belah_samping': {
      const cap = mesh(new THREE.SphereGeometry(S * 1.07, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), hairMat, 0, 0.012, -0.008);
      cap.scale.set(0.88, 1.08, 1.0);
      head.add(cap);
      const sweep = mesh(new THREE.BoxGeometry(0.15, 0.035, 0.07), hairMat, 0.015, 0.105, 0.06);
      sweep.rotation.z = -0.25;
      head.add(sweep);
      return;
    }
    case 'ikal': {
      const cap = mesh(new THREE.SphereGeometry(S * 1.16, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.56), hairMat, 0, 0.01, -0.01);
      cap.scale.set(0.95, 1.12, 1.05);
      head.add(cap);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        head.add(mesh(new THREE.IcosahedronGeometry(0.035, 0), hairMat, Math.sin(a) * 0.1, 0.06 + (i % 2) * 0.03, Math.cos(a) * 0.09 - 0.01));
      }
      return;
    }
    case 'kuncir': {
      const cap = mesh(new THREE.SphereGeometry(S * 1.07, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.52), hairMat, 0, 0.01, -0.008);
      cap.scale.set(0.9, 1.06, 1.0);
      head.add(cap);
      const tail = limb(0.03, 0.045, -0.16, 0.0, hairMat);
      tail.position.set(0, 0.0, -0.13);
      tail.rotation.x = 0.35;
      head.add(tail);
      return;
    }
    case 'bob': {
      const cap = mesh(new THREE.SphereGeometry(S * 1.12, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.66), hairMat, 0, 0.0, -0.012);
      cap.scale.set(0.96, 1.08, 1.04);
      head.add(cap);
      return;
    }
    case 'hijab': {
      const hm = mat(hijabColor, 0.85);
      const hood = mesh(new THREE.SphereGeometry(S * 1.18, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.78), hm, 0, 0.0, -0.01);
      hood.scale.set(0.95, 1.08, 1.05);
      head.add(hood);
      head.add(limb(0.13, 0.1, -0.24, -0.08, hm, 0.85, 12));
      return;
    }
  }
}

/**
 * Bangun prototipe v2 untuk satu agen. `variant` = seragam §3.3; `look` dari AGENT_LOOKS.
 * Kartu ID memakai garis tipis warna agen (identitas tetap di beacon & kartu, K7).
 */
export function buildProtoAvatar(agentId: string, agentColor: string, variant: UniformVariant = 1, lookOverride?: AgentLook): ProtoJoints {
  const look = lookOverride ?? AGENT_LOOKS[agentId] ?? DEFAULT_LOOK;
  const U = UNIFORMS[variant];
  const skin = mat(SKIN_PALETTE[look.skin] ?? SKIN_PALETTE[3], 0.6);
  const hairMat = mat(HAIR_PALETTE[look.hairColor] ?? HAIR_PALETTE[0], 0.9);
  const outer = mat(U.outer, 0.62);
  const inner = mat(U.inner, 0.55);
  const bottom = mat(U.bottom, 0.75);
  const shoes = mat(U.shoes, 0.35, 0.2);
  const accent = mat(U.accentColor, 0.45, 0.1);
  const agent = new THREE.Color(agentColor);

  const sw = look.body === 'tegap' ? 1.08 : look.body === 'ramping' ? 0.94 : 1.0;
  const ww = look.body === 'ramping' ? 0.92 : 1.0;

  const root = new THREE.Group();
  root.name = `ProtoV2_${agentId}`;

  // ---- Pinggul (sendi akar tubuh) ----
  const hips = new THREE.Group();
  hips.position.y = V2.hip + 0.06;
  root.add(hips);
  hips.add(limb(0.15 * ww, 0.155 * ww, -0.12, 0.04, bottom, 0.72, 10)); // panggul (celana)

  // ---- Dada (tubuh atas, blazer) ----
  const chest = new THREE.Group();
  hips.add(chest);
  chest.add(limb(0.155 * ww, 0.2 * sw, -0.02, V2.shoulder + 0.04 - hips.position.y, outer, 0.6, 10));
  chest.add(limb(0.165 * ww, 0.158 * ww, -0.1, 0.0, outer, 0.66, 10)); // ujung blazer
  const yShoulder = V2.shoulder - hips.position.y;
  chest.add(mesh(new THREE.BoxGeometry(0.11, 0.24, 0.02), inner, 0, yShoulder - 0.13, 0.115)); // kemeja dalam
  for (const s of [-1, 1]) {
    const lapel = mesh(new THREE.BoxGeometry(0.05, 0.22, 0.02), outer, s * 0.06, yShoulder - 0.12, 0.124);
    lapel.rotation.z = s * 0.22;
    chest.add(lapel);
  }
  if (U.accent === 'tie') {
    chest.add(mesh(new THREE.BoxGeometry(0.035, 0.26, 0.012), accent, 0, yShoulder - 0.16, 0.128));
  } else if (U.accent === 'piping') {
    for (const s of [-1, 1]) {
      const p = mesh(new THREE.BoxGeometry(0.008, 0.22, 0.008), accent, s * 0.085, yShoulder - 0.12, 0.136);
      p.rotation.z = s * 0.22;
      chest.add(p);
      chest.add(mesh(new THREE.BoxGeometry(0.09, 0.008, 0.008), accent, s * 0.1, yShoulder - 0.34, 0.118));
    }
  } else {
    // Lanyard biru elektrik + kartu ID putih bergaris warna agen.
    for (const s of [-1, 1]) {
      const strap = mesh(new THREE.BoxGeometry(0.012, 0.24, 0.008), accent, s * 0.045, yShoulder - 0.1, 0.133);
      strap.rotation.z = -s * 0.2;
      chest.add(strap);
    }
    chest.add(mesh(new THREE.BoxGeometry(0.065, 0.09, 0.006), mat(0xf8fafc, 0.4), 0, yShoulder - 0.27, 0.137));
    chest.add(mesh(new THREE.BoxGeometry(0.065, 0.014, 0.008), new THREE.MeshStandardMaterial({ color: agent, emissive: agent, emissiveIntensity: 0.6 }), 0, yShoulder - 0.235, 0.138));
  }

  // ---- Leher & kepala ----
  chest.add(limb(0.05, 0.048, yShoulder + 0.02, yShoulder + 0.1, skin));
  const head = new THREE.Group();
  head.position.y = 1.585 - hips.position.y;
  chest.add(head);
  const skull = mesh(new THREE.SphereGeometry(0.118, 16, 12), skin);
  skull.scale.set(0.82, 1.0, 0.92);
  head.add(skull);
  head.add(mesh(new THREE.BoxGeometry(0.03, 0.045, 0.03), skin, 0, -0.02, 0.105)); // hidung
  for (const s of [-1, 1]) head.add(mesh(new THREE.SphereGeometry(0.012, 6, 4), mat(0x101418, 0.3), s * 0.038, 0.0, 0.1)); // mata
  if (look.glasses) {
    const gm = mat(0x0f172a, 0.3, 0.6);
    for (const s of [-1, 1]) head.add(mesh(new THREE.TorusGeometry(0.026, 0.004, 4, 12), gm, s * 0.04, 0.0, 0.108));
    head.add(mesh(new THREE.BoxGeometry(0.03, 0.005, 0.005), gm, 0, 0.004, 0.11));
  }
  addHair(head, look, hairMat, 0x13233f);
  const eye = new THREE.Object3D();
  eye.name = 'eye';
  eye.position.set(0, V2.eye - 1.585, 0.09);
  head.add(eye);

  // ---- Lengan (bahu → siku → tangan) ----
  const arm = (s: -1 | 1) => {
    const sh = new THREE.Group();
    sh.position.set(s * V2.shoulderX * sw, yShoulder, 0);
    chest.add(sh);
    sh.add(limb(0.044, 0.052, -V2.upperArm, 0.02, outer));
    const el = new THREE.Group();
    el.position.y = -V2.upperArm;
    sh.add(el);
    el.add(limb(0.037, 0.045, -V2.forearm, 0, outer));
    el.add(mesh(new THREE.BoxGeometry(0.07, 0.035, 0.045), inner, 0, -V2.forearm + 0.01, 0)); // manset kemeja
    el.add(mesh(new THREE.BoxGeometry(0.05, 0.09, 0.03), skin, 0, -V2.forearm - 0.05, 0)); // tangan
    return { sh, el };
  };
  const aL = arm(-1), aR = arm(1);

  // ---- Kaki (pinggul → lutut → pergelangan) ----
  const leg = (s: -1 | 1) => {
    const hp = new THREE.Group();
    hp.position.set(s * V2.hipX * ww, V2.hip - hips.position.y, 0);
    hips.add(hp);
    hp.add(limb(0.064, 0.08, -V2.thigh, 0.02, bottom));
    const kn = new THREE.Group();
    kn.position.y = -V2.thigh;
    hp.add(kn);
    kn.add(limb(0.048, 0.062, -V2.shin, 0, bottom));
    const an = new THREE.Group();
    an.position.y = -V2.shin;
    kn.add(an);
    an.add(mesh(new THREE.BoxGeometry(0.1, 0.075, 0.27), shoes, 0, -0.035, 0.06));
    return { hp, kn, an };
  };
  const lL = leg(-1), lR = leg(1);

  // ---- Beacon status di atas kepala (Y ±1,95) ----
  const beacon = mesh(new THREE.OctahedronGeometry(0.11, 0), new THREE.MeshStandardMaterial({
    color: agent, emissive: agent, emissiveIntensity: 0.9, roughness: 0.15, metalness: 0.85,
  }), 0, 1.95, 0);
  beacon.castShadow = false;
  root.add(beacon);

  return {
    root, hips, chest, head, eye,
    shoulderL: aL.sh, elbowL: aL.el, shoulderR: aR.sh, elbowR: aR.el,
    hipL: lL.hp, kneeL: lL.kn, ankleL: lL.an, hipR: lR.hp, kneeR: lR.kn, ankleR: lR.an,
    beacon,
  };
}

/** Berdiri tegak, lengan sedikit menjauh dari badan. */
export function poseStand(j: ProtoJoints) {
  j.root.position.y = 0;
  for (const g of [j.hipL, j.hipR, j.kneeL, j.kneeR, j.ankleL, j.ankleR]) g.rotation.set(0, 0, 0);
  j.shoulderL.rotation.set(0.05, 0, -0.08);
  j.shoulderR.rotation.set(0.05, 0, 0.08);
  j.elbowL.rotation.set(-0.15, 0, 0);
  j.elbowR.rotation.set(-0.15, 0, 0);
}

/** Lengan ke depan setinggi meja (mengetik / bertumpu di podium). */
export function poseArmsForward(j: ProtoJoints, shoulderPitch = -0.55, elbowPitch = -1.0) {
  j.shoulderL.rotation.set(shoulderPitch, 0, 0.12);
  j.shoulderR.rotation.set(shoulderPitch, 0, -0.12);
  j.elbowL.rotation.set(elbowPitch, 0, 0);
  j.elbowR.rotation.set(elbowPitch, 0, 0);
}

/**
 * Duduk: sendi pinggul `V2.hipAboveSeat` di atas dudukan, telapak kaki di `footY`
 * (lantai 0 atau pijakan stool). IK 2 tulang di bidang sagital (lutut menekuk ke depan-atas).
 * Mengembalikan jarak sisa (m) bila kaki tidak sampai ke pijakan (0 = menapak).
 */
export function poseSit(j: ProtoJoints, seatTop: number, footY = 0, footForward = 0.42): number {
  const hipY = seatTop + V2.hipAboveSeat;
  j.root.position.y = hipY - V2.hip;
  const ankleY = footY + V2.ankle;
  const dz = footForward, dy = ankleY - hipY;
  const L1 = V2.thigh, L2 = V2.shin;
  let D = Math.hypot(dz, dy);
  const reach = L1 + L2 - 1e-4;
  const gap = Math.max(0, D - reach);
  D = Math.min(D, reach);
  const phi = Math.atan2(dz, -dy);
  const beta = Math.acos(THREE.MathUtils.clamp((L1 * L1 + D * D - L2 * L2) / (2 * L1 * D), -1, 1));
  const kneeInner = Math.acos(THREE.MathUtils.clamp((L1 * L1 + L2 * L2 - D * D) / (2 * L1 * L2), -1, 1));
  const thighRot = -(phi + beta);
  const kneeRot = Math.PI - kneeInner;
  for (const [hp, kn, an] of [[j.hipL, j.kneeL, j.ankleL], [j.hipR, j.kneeR, j.ankleR]] as const) {
    hp.rotation.set(thighRot, 0, 0);
    kn.rotation.set(kneeRot, 0, 0);
    an.rotation.set(-(thighRot + kneeRot), 0, 0); // telapak sejajar lantai
  }
  return gap;
}

/** Posisi soket mata (dunia) untuk screenshot FPV. */
export function eyeWorld(j: ProtoJoints): THREE.Vector3 {
  j.root.updateWorldMatrix(true, true);
  return j.eye.getWorldPosition(new THREE.Vector3());
}

export function disposeProto(j: ProtoJoints) {
  j.root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.geometry.dispose();
      (Array.isArray(m.material) ? m.material : [m.material]).forEach((mm) => mm.dispose());
    }
  });
  j.root.removeFromParent();
}
