import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { AvatarConfig } from '@office/shared';
import { BODY, CLOTH_PALETTE, HAIR_PALETTE, SHOE_PALETTE, SKIN_PALETTE, pick, type BuildExtras } from './config';

/**
 * F1 — geometri prosedural Avatar Rig v2 (rencana §3.2). Tanpa WebGL: bisa diuji di Vitest.
 *
 * Setiap bagian dibuat di ruang lokal tulangnya (titik asal = sendi), lalu digeser ke pose ikat
 * (semua rotasi tulang = 0, jadi matriks ikat hanya translasi) dan diberi `skinIndex`/`skinWeight`.
 * Warna disimpan di vertex color → semua avatar memakai SATU material.
 * Sumbu: +Z = depan (wajah), +Y = atas, titik asal = lantai di antara kedua kaki.
 * Sisi `L` = kiri pemakai = +X (avatar menghadap +Z), `R` = −X.
 */

export const BONE_NAMES = [
  'root', 'hips', 'spine', 'chest', 'neck', 'head', 'headMesh',
  'shoulderL', 'elbowL', 'handL', 'shoulderR', 'elbowR', 'handR',
  'hipL', 'kneeL', 'ankleL', 'hipR', 'kneeR', 'ankleR',
] as const;
export type BoneName = (typeof BONE_NAMES)[number];
export const BONE_INDEX: Record<BoneName, number> = Object.fromEntries(BONE_NAMES.map((n, i) => [n, i])) as Record<BoneName, number>;

export interface BoneSpec { name: BoneName; parent: BoneName | null; pos: [number, number, number] }

/** Faktor lebar bahu (sw) & pinggul (ww) per bentuk tubuh (label netral, §3.3). */
export function bodyFactors(body: AvatarConfig['body']) {
  return {
    sw: body === 'tegap' ? 1.08 : body === 'ramping' ? 0.94 : 1.0,
    ww: body === 'ramping' ? 0.92 : body === 'tegap' ? 1.03 : 1.0,
  };
}

/** Posisi tulang (lokal terhadap induk) untuk `height` 1,0. Tinggi lain = skala grup avatar. */
export function skeletonSpec(body: AvatarConfig['body']): BoneSpec[] {
  const { sw, ww } = bodyFactors(body);
  const hipsY = BODY.hipJoint + BODY.pelvisAbove; // 0,93
  const chestY = hipsY + 0.12 + 0.18; // 1,23
  return [
    { name: 'root', parent: null, pos: [0, 0, 0] },
    { name: 'hips', parent: 'root', pos: [0, hipsY, 0] },
    { name: 'spine', parent: 'hips', pos: [0, 0.12, 0] },
    { name: 'chest', parent: 'spine', pos: [0, 0.18, 0] },
    { name: 'neck', parent: 'chest', pos: [0, 0.19, 0] },
    { name: 'head', parent: 'neck', pos: [0, 0.09, 0] },
    { name: 'headMesh', parent: 'head', pos: [0, 0, 0] },
    { name: 'shoulderL', parent: 'chest', pos: [BODY.shoulderX * sw, BODY.shoulder - chestY, -0.01] },
    { name: 'elbowL', parent: 'shoulderL', pos: [0, -BODY.upperArm, 0] },
    { name: 'handL', parent: 'elbowL', pos: [0, -BODY.forearm, 0] },
    { name: 'shoulderR', parent: 'chest', pos: [-BODY.shoulderX * sw, BODY.shoulder - chestY, -0.01] },
    { name: 'elbowR', parent: 'shoulderR', pos: [0, -BODY.upperArm, 0] },
    { name: 'handR', parent: 'elbowR', pos: [0, -BODY.forearm, 0] },
    { name: 'hipL', parent: 'hips', pos: [BODY.hipX * ww, -BODY.pelvisAbove, 0] },
    { name: 'kneeL', parent: 'hipL', pos: [0, -BODY.thigh, 0] },
    { name: 'ankleL', parent: 'kneeL', pos: [0, -BODY.shin, 0] },
    { name: 'hipR', parent: 'hips', pos: [-BODY.hipX * ww, -BODY.pelvisAbove, 0] },
    { name: 'kneeR', parent: 'hipR', pos: [0, -BODY.thigh, 0] },
    { name: 'ankleR', parent: 'kneeR', pos: [0, -BODY.shin, 0] },
  ];
}

/** Posisi ikat (ruang model) tiap tulang. */
export function bindPositions(spec: BoneSpec[]): Record<BoneName, THREE.Vector3> {
  const out = {} as Record<BoneName, THREE.Vector3>;
  for (const b of spec) {
    const p = new THREE.Vector3(...b.pos);
    if (b.parent) p.add(out[b.parent]);
    out[b.name] = p;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Primitif (ruang lokal tulang)
// ---------------------------------------------------------------------------
type Weights = (v: THREE.Vector3) => Array<[BoneName, number]>;
interface Part { geo: THREE.BufferGeometry; bone: BoneName; color: number; weights?: Weights }

/** Silinder dari y0 (jari-jari r0) ke y1 (jari-jari r1), elips di Z (`depth`). */
function cyl(r0: number, r1: number, y0: number, y1: number, seg = 8, depth = 1, x = 0, z = 0): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r1, r0, Math.abs(y1 - y0), seg, 1);
  g.scale(1, 1, depth);
  g.translate(x, (y0 + y1) / 2, z);
  return g;
}
function ell(rx: number, ry: number, rz: number, x: number, y: number, z: number, ws = 12, hs = 8, phiStart = 0, phiLen = Math.PI * 2, thStart = 0, thLen = Math.PI): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, ws, hs, phiStart, phiLen, thStart, thLen);
  g.scale(rx, ry, rz);
  g.translate(x, y, z);
  return g;
}
function box(w: number, h: number, d: number, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rx || ry || rz) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)));
  g.translate(x, y, z);
  return g;
}
function torus(r: number, tube: number, x: number, y: number, z: number, arc = Math.PI * 2, rx = 0, ry = 0, rz = 0, rs = 4, ts = 12): THREE.BufferGeometry {
  const g = new THREE.TorusGeometry(r, tube, rs, ts, arc);
  if (rx || ry || rz) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)));
  g.translate(x, y, z);
  return g;
}

// ---------------------------------------------------------------------------
// Bagian tubuh
// ---------------------------------------------------------------------------
export function buildParts(cfg: AvatarConfig, extras: BuildExtras = {}): Part[] {
  const { sw, ww } = bodyFactors(cfg.body);
  const skin = pick(SKIN_PALETTE, cfg.skin);
  const hair = pick(HAIR_PALETTE, cfg.hairColor);
  const top = pick(CLOTH_PALETTE, cfg.topColor);
  const inner = pick(CLOTH_PALETTE, cfg.innerColor);
  const bottom = pick(CLOTH_PALETTE, cfg.bottomColor);
  const shoe = pick(SHOE_PALETTE, cfg.shoesColor);
  const sole = cfg.shoes === 'sneaker' ? 0xf1f5f9 : 0x050506;
  const dark = 0x101418;
  const parts: Part[] = [];
  const add = (bone: BoneName, color: number, geo: THREE.BufferGeometry, weights?: Weights) => parts.push({ bone, color, geo, weights });

  const skirt = cfg.bottom === 'rok';
  const legColor = skirt ? skin : bottom;
  const narrow = cfg.bottom === 'jeans' ? 0.94 : 1;

  // ---- Panggul (tulang hips, pusat 0,93 m) ----
  add('hips', bottom, cyl(0.145 * ww, 0.15 * ww, -0.12, 0.06, 10, 0.72));
  add('hips', 0x1b1d22, cyl(0.152 * ww, 0.152 * ww, 0.035, 0.06, 10, 0.73)); // ikat pinggang

  // ---- Rok: 2 tulang (panggul + paha) supaya ikut paha saat duduk ----
  if (skirt) {
    const hipJointY = BODY.hipJoint;
    add('hips', bottom, cyl(0.21 * ww, 0.155 * ww, -0.5, 0.0, 14, 0.78), (v) => {
      const t = THREE.MathUtils.clamp((hipJointY - v.y) / 0.42, 0, 1) * 0.75;
      return [['hips', 1 - t], [v.x > 0 ? 'hipL' : 'hipR', t]];
    });
  }

  // ---- Tubuh bawah (tulang spine, 1,05 m) & atas (chest, 1,23 m) ----
  const isBlazer = cfg.top === 'blazer';
  add('spine', top, cyl(0.15 * ww, 0.165 * (sw + ww) / 2, -0.08, 0.19, 10, 0.66));
  if (isBlazer) {
    // Ujung blazer menutupi pangkal panggul (ikut badan saat condong).
    add('spine', top, cyl(0.163 * ww, 0.158 * ww, -0.2, -0.06, 10, 0.72));
    for (const y of [0.0, -0.08]) add('spine', 0x0a0b0d, box(0.014, 0.014, 0.01, 0, y, 0.104)); // kancing
  }
  if (cfg.top === 'hoodie') add('spine', top, box(0.17, 0.09, 0.02, 0, -0.02, 0.098)); // saku kanguru
  add('chest', top, cyl(0.165 * (sw + ww) / 2, 0.198 * sw, -0.02, 0.17, 10, 0.6));
  add('chest', top, ell(0.215 * sw, 0.07, 0.125, 0, 0.145, -0.005, 12, 6)); // bahu membulat
  const front = 0.104;
  if (isBlazer) {
    add('chest', inner, box(0.1, 0.2, 0.02, 0, 0.05, front)); // kemeja dalam (V)
    add('chest', inner, cyl(0.062, 0.058, 0.16, 0.215, 10, 0.95)); // kerah kemeja
    for (const s of [-1, 1]) {
      add('chest', top, box(0.052, 0.21, 0.02, s * 0.058, 0.06, front + 0.008, 0, 0, s * 0.24)); // lapel
      if (extras.trim !== undefined) {
        add('chest', extras.trim, box(0.008, 0.21, 0.008, s * 0.086, 0.06, front + 0.016, 0, 0, s * 0.24)); // piping kerah
        add('spine', extras.trim, box(0.07, 0.008, 0.008, s * 0.085, 0.07, 0.09, 0, s * 0.45, 0)); // piping saku
      }
    }
  } else if (cfg.top === 'kemeja') {
    add('chest', top, cyl(0.064, 0.06, 0.16, 0.22, 10, 0.95)); // kerah
    add('chest', 0xe5e7eb, box(0.008, 0.26, 0.006, 0, 0.0, front + 0.006)); // lajur kancing
  } else if (cfg.top === 'kaos') {
    add('chest', top, cyl(0.06, 0.058, 0.165, 0.2, 10, 0.95)); // leher bulat
  } else {
    add('chest', top, ell(0.13, 0.085, 0.07, 0, 0.19, -0.085, 10, 6)); // tudung hoodie terlipat
    for (const s of [-1, 1]) add('chest', 0xe5e7eb, box(0.006, 0.09, 0.006, s * 0.025, 0.06, front + 0.008)); // tali
  }
  if (cfg.acc.tie && (isBlazer || cfg.top === 'kemeja')) {
    const tie = cfg.innerColor === 3 ? CLOTH_PALETTE[2] : CLOTH_PALETTE[3];
    add('chest', tie, box(0.034, 0.24, 0.012, 0, 0.03, front + 0.014));
    add('chest', tie, box(0.042, 0.03, 0.016, 0, 0.16, front + 0.012));
  }
  if (extras.idColor !== undefined) {
    // Kartu ID jepit di dada kiri pemakai (+X), garis warna agen di atasnya.
    add('chest', 0xf8fafc, box(0.046, 0.064, 0.006, 0.105, -0.03, 0.084, 0, 0.55, 0));
    add('chest', extras.idColor, box(0.046, 0.014, 0.008, 0.105, -0.004, 0.085, 0, 0.55, 0));
  }
  if (cfg.acc.lanyard) {
    for (const s of [-1, 1]) add('chest', 0x3b82f6, box(0.012, 0.22, 0.008, s * 0.045, 0.09, front + 0.02, 0, 0, -s * 0.2));
    add('chest', 0xf8fafc, box(0.06, 0.085, 0.006, 0, -0.06, front + 0.022));
  }

  // ---- Leher & kepala (headMesh: disembunyikan di FPV dengan skala 0) ----
  if (cfg.hair === 'hijab') {
    const hm = pick(CLOTH_PALETTE, cfg.hairColor);
    add('neck', hm, cyl(0.17 * sw, 0.085, -0.1, 0.12, 14, 0.85));
  } else {
    add('neck', skin, cyl(0.05, 0.047, -0.02, 0.11, 8));
  }
  const H = 0.075; // pusat tengkorak di atas sendi kepala (1,585 m)
  add('headMesh', skin, ell(0.097, 0.118, 0.109, 0, H, 0, 14, 10));
  add('headMesh', skin, box(0.026, 0.042, 0.03, 0, H - 0.015, 0.102)); // hidung
  for (const s of [-1, 1]) {
    add('headMesh', dark, ell(0.012, 0.012, 0.008, s * 0.036, H + 0.005, 0.098, 6, 4)); // mata
    add('headMesh', skin, ell(0.016, 0.026, 0.012, s * 0.096, H, 0.0, 6, 4)); // telinga
    if (cfg.hair !== 'hijab' && cfg.hair !== 'botak') add('headMesh', hair, box(0.034, 0.008, 0.01, s * 0.037, H + 0.03, 0.1, 0, 0, -s * 0.08)); // alis
  }
  add('headMesh', 0x8a4b3a, box(0.03, 0.006, 0.006, 0, H - 0.05, 0.098)); // mulut
  addHair(add, cfg, hair, H);
  if (cfg.acc.glasses) {
    const gm = 0x0f172a;
    for (const s of [-1, 1]) add('headMesh', gm, torus(0.025, 0.004, s * 0.04, H + 0.005, 0.106, Math.PI * 2, 0, 0, 0, 4, 12));
    add('headMesh', gm, box(0.03, 0.005, 0.005, 0, H + 0.009, 0.108));
    for (const s of [-1, 1]) add('headMesh', gm, box(0.004, 0.004, 0.09, s * 0.068, H + 0.009, 0.06));
  }
  if (cfg.acc.headphones) {
    add('headMesh', 0x1f2937, torus(0.118, 0.012, 0, H + 0.02, 0, Math.PI, 0, 0, 0, 5, 14));
    for (const s of [-1, 1]) add('headMesh', 0x111827, cyl(0.042, 0.042, -0.02, 0.02, 10, 1, 0, 0).rotateZ(Math.PI / 2).translate(s * 0.104, H, 0));
  }

  // ---- Lengan (bahu → siku → pergelangan) ----
  const shortSleeve = cfg.top === 'kaos';
  for (const side of ['L', 'R'] as const) {
    const sh = `shoulder${side}` as BoneName, el = `elbow${side}` as BoneName, ha = `hand${side}` as BoneName;
    if (shortSleeve) {
      add(sh, top, cyl(0.054, 0.058, -0.13, 0.03, 8));
      add(sh, skin, cyl(0.04, 0.045, -BODY.upperArm, -0.12, 8));
      add(el, skin, cyl(0.032, 0.039, -BODY.forearm, 0.01, 8));
    } else {
      add(sh, top, cyl(0.045, 0.052, -BODY.upperArm - 0.01, 0.03, 8));
      add(el, top, cyl(0.037, 0.045, -BODY.forearm + 0.015, 0.01, 8));
      add(el, isBlazer ? inner : top, cyl(0.039, 0.039, -BODY.forearm, -BODY.forearm + 0.02, 8)); // manset
    }
    add(ha, skin, ell(0.026, 0.05, 0.017, 0, -0.045, 0.004, 8, 6)); // telapak + jari
    add(ha, skin, ell(0.01, 0.024, 0.01, side === 'L' ? -0.022 : 0.022, -0.028, 0.016, 5, 4)); // jempol (sisi dalam)
  }

  // ---- Kaki (pinggul → lutut → pergelangan) ----
  for (const side of ['L', 'R'] as const) {
    const hp = `hip${side}` as BoneName, kn = `knee${side}` as BoneName, an = `ankle${side}` as BoneName;
    add(hp, legColor, cyl(0.066 * narrow, 0.084 * ww, -BODY.thigh - 0.01, 0.03, 8));
    add(kn, legColor, cyl(0.05 * narrow, 0.064 * narrow, -BODY.shin + 0.01, 0.01, 8));
    if (cfg.bottom === 'chino') add(kn, bottom, cyl(0.055, 0.055, -BODY.shin + 0.015, -BODY.shin + 0.045, 8)); // lipatan
    // Sepatu: sol di −0,07 (lantai) saat pergelangan di 0,07 m.
    if (cfg.shoes === 'sneaker') {
      add(an, shoe, box(0.1, 0.07, 0.26, 0, -0.03, 0.055));
      add(an, sole, box(0.104, 0.022, 0.27, 0, -0.059, 0.055));
    } else if (cfg.shoes === 'loafer') {
      add(an, shoe, box(0.092, 0.055, 0.25, 0, -0.042, 0.055));
      add(an, sole, box(0.094, 0.015, 0.255, 0, -0.0625, 0.055));
      add(an, 0x1b1d22, box(0.06, 0.008, 0.04, 0, -0.012, 0.1));
    } else {
      add(an, shoe, box(0.092, 0.06, 0.22, 0, -0.04, 0.035));
      add(an, shoe, ell(0.046, 0.03, 0.06, 0, -0.045, 0.14, 8, 5)); // ujung runcing
      add(an, sole, box(0.094, 0.012, 0.25, 0, -0.064, 0.05));
    }
  }
  return parts;
}

function addHair(add: (b: BoneName, c: number, g: THREE.BufferGeometry) => void, cfg: AvatarConfig, hair: number, H: number) {
  const S = 0.118;
  switch (cfg.hair) {
    case 'botak':
      return;
    case 'cepak':
      add('headMesh', hair, ell(S * 0.9, S * 1.06, S * 0.98, 0, H + 0.012, -0.004, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.42));
      return;
    case 'belah_samping':
      add('headMesh', hair, ell(S * 0.94, S * 1.15, S * 1.07, 0, H + 0.012, -0.008, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5));
      add('headMesh', hair, box(0.15, 0.035, 0.07, 0.015, H + 0.105, 0.06, 0, 0, -0.25));
      return;
    case 'ikal': {
      add('headMesh', hair, ell(S * 1.1, S * 1.3, S * 1.2, 0, H + 0.01, -0.01, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.56));
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        add('headMesh', hair, ell(0.035, 0.035, 0.035, Math.sin(a) * 0.1, H + 0.06 + (i % 2) * 0.03, Math.cos(a) * 0.09 - 0.01, 5, 4));
      }
      return;
    }
    case 'kuncir':
      add('headMesh', hair, ell(S * 0.96, S * 1.13, S * 1.07, 0, H + 0.01, -0.008, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.52));
      add('headMesh', hair, cyl(0.03, 0.045, -0.16, 0, 6).rotateX(0.35).translate(0, H + 0.0, -0.13));
      return;
    case 'bob':
      add('headMesh', hair, ell(S * 1.08, S * 1.21, S * 1.16, 0, H, -0.012, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.66));
      add('headMesh', hair, box(0.16, 0.03, 0.05, 0, H + 0.085, 0.085, -0.4, 0, 0)); // poni
      return;
    case 'hijab': {
      const hm = pick(CLOTH_PALETTE, cfg.hairColor);
      // Tudung menutupi kepala kecuali wajah (bukaan ±50° di depan, sumbu +Z = phi π/2).
      const open = 0.95;
      add('headMesh', hm, ell(S * 0.98, S * 1.18, S * 1.08, 0, H + 0.004, -0.008, 16, 10, Math.PI / 2 + open, Math.PI * 2 - open * 2, 0, Math.PI * 0.8));
      add('headMesh', hm, ell(S * 0.99, S * 0.5, S * 1.0, 0, H + 0.055, 0.0, 14, 6, 0, Math.PI * 2, 0, Math.PI * 0.5)); // dahi
      return;
    }
  }
}

// ---------------------------------------------------------------------------
// Penggabungan → satu BufferGeometry skinned
// ---------------------------------------------------------------------------
const _c = new THREE.Color();
const _v = new THREE.Vector3();

/**
 * Gabungkan semua bagian ke ruang model (pose ikat) dengan atribut position, normal, color,
 * skinIndex, skinWeight. Target < 5 ms (dibangun ulang hanya saat config berubah).
 */
export function buildAvatarGeometry(cfg: AvatarConfig, extras: BuildExtras = {}): THREE.BufferGeometry {
  const bind = bindPositions(skeletonSpec(cfg.body));
  const geos: THREE.BufferGeometry[] = [];
  for (const p of buildParts(cfg, extras)) {
    const g = p.geo; // semua primitif di atas ber-index (syarat mergeGeometries)
    g.deleteAttribute('uv');
    g.translate(bind[p.bone].x, bind[p.bone].y, bind[p.bone].z);
    const n = g.getAttribute('position').count;
    const col = new Float32Array(n * 3);
    const si = new Uint16Array(n * 4);
    const sw = new Float32Array(n * 4);
    _c.setHex(p.color);
    const pos = g.getAttribute('position');
    for (let i = 0; i < n; i++) {
      col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b;
      if (p.weights) {
        _v.fromBufferAttribute(pos, i);
        const w = p.weights(_v);
        for (let k = 0; k < Math.min(4, w.length); k++) { si[i * 4 + k] = BONE_INDEX[w[k]![0]]; sw[i * 4 + k] = w[k]![1]; }
      } else {
        si[i * 4] = BONE_INDEX[p.bone];
        sw[i * 4] = 1;
      }
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    geos.push(g);
  }
  const merged = mergeGeometries(geos, false);
  for (const g of geos) g.dispose();
  if (!merged) throw new Error('avatar: mergeGeometries gagal (atribut bagian tidak seragam)');
  merged.computeBoundingSphere();
  return merged;
}
