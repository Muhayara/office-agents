import * as THREE from 'three';
import { ROOM_STUDIO, STUDIO, type Spot } from '../layout';
import type { WallFader } from '../camera/wallFade';
import {
  box,
  canvasTexture,
  enableShadow,
  meterBox,
  mountAsset,
  std,
  type ModelLoader,
} from './assets';
import { buildNorthTierShell } from './northWing';
import { boardroomWallMats } from './walls';

/**
 * LAYER RUANGAN TAHAP 6: Room_StudioContent, pusat dunia (18.0, -3.0), 6 × 4 m, baris utara kedua.
 *
 * Studio produksi konten: panggung cyclorama green screen + truss lampu, rig kamera sinema & softbox,
 * meja produksi / color-grading, lampu "ON AIR". Diakses lewat pintu utara barat Commons (dunia X 18).
 * - Utara : dinding luar gedung (solid dari kamera Tenggara) → green screen & meja produksi menempel di sini.
 * - Barat : dinding baru ke ruang rapat (gaya ruang rapat, selalu memudar; ruang rapat hanya punya curb).
 * - Timur : dinding barat Information Wall (milik InfoWall, kini selalu memudar).
 * - Selatan: ruas barat dinding utara Commons (milik Commons, selalu memudar).
 */
export interface StudioContent {
  group: THREE.Group;
  bindWalls: () => void;
  /** Titik tugas (dunia): talent di tanda ✕, sutradara di belakang kamera, editor di meja produksi. */
  spotsWorld: () => { talent: Spot; director: Spot; editor: { spot: Spot; approach: Spot } };
  /** Lampu "ON AIR" menyala saat ada talent di depan green screen. */
  setOnAir: (on: boolean) => void;
  focusPoint: () => THREE.Vector3;
}

export function buildStudioContent(load: ModelLoader, fader: WallFader): StudioContent {
  const shell = buildNorthTierShell({
    spec: ROOM_STUDIO,
    fader,
    fadeId: 'studio',
    interiorSides: ['west'],
    sides: { east: false },
    sideMats: { west: boardroomWallMats() },
  });
  const { group, sub, inner, walls } = shell;
  const floor = sub('SubLayer_Floor');
  const set = sub('SubLayer_Production_Set');
  const decor = sub('SubLayer_Decor');
  const slot = (parent: THREE.Object3D, name: string, x: number, y: number, z: number, rotY = 0) => {
    const g = new THREE.Group();
    g.name = name;
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    parent.add(g);
    return g;
  };

  // ---- Lantai vinyl studio charcoal matte + garis lakban kuning zona syuting ----
  {
    const W = inner.maxX - inner.minX, D = inner.maxZ - inner.minZ;
    floor.add(meterBox(W, 0.02, D, studioVinyl(), [(inner.minX + inner.maxX) / 2, -0.01, (inner.minZ + inner.maxZ) / 2], 'Studio_Vinyl_Floor'));
    const tape = std(0xe8b923, 0.7, 0, { emissive: 0x3a2a00, emissiveIntensity: 0.4 });
    const zone = { x0: -2.62, x1: 0.2, z0: inner.minZ + 0.04, z1: 1.02 };
    const line = (w: number, d: number, x: number, z: number) => {
      const m = box(w, 0.003, d, tape, [x, 0.0015, z], 'Shoot_Zone_Tape');
      m.castShadow = false;
      floor.add(m);
    };
    line(zone.x1 - zone.x0, 0.04, (zone.x0 + zone.x1) / 2, zone.z1);
    line(0.04, zone.z1 - zone.z0, zone.x0, (zone.z0 + zone.z1) / 2);
    line(0.04, zone.z1 - zone.z0, zone.x1, (zone.z0 + zone.z1) / 2);
  }

  // ---- Panggung cyclorama green screen (rata dinding utara) ----
  {
    const c = STUDIO.cyclorama;
    mountAsset(slot(set, 'Cyclorama_Stage', c.x, 0, c.z), '/models/Office_Studio_Cyclorama_Stage.glb', cycloramaPlaceholder(c.w, c.h, c.d), load);
  }

  // ---- Rig kamera sinema + softbox (menghadap green screen) ----
  {
    const r = STUDIO.rig;
    mountAsset(slot(set, 'Camera_Softbox_Rig', r.x, 0, r.z, r.rotY), '/models/Office_Studio_Camera_Softbox_Rig.glb', cameraRigPlaceholder(r.w, r.h, r.d), load);
  }

  // ---- Meja produksi & color-grading + kursi editor ----
  {
    const d = STUDIO.desk;
    mountAsset(slot(set, 'Production_Desk', d.x, 0, d.z), '/models/Office_Studio_Production_Desk.glb', productionDeskPlaceholder(d.w, d.h, d.d, d.top), load);
    const e = STUDIO.editor.spot;
    mountAsset(slot(set, 'Studio_Editor_Chair', e.x, 0, e.z, e.rotY), '/models/Office_Ergonomic_Chair.glb', new THREE.Group(), load);
  }

  // ---- Lampu "ON AIR" di dinding utara (anak dinding: ikut memudar bila kamera di utara) ----
  // Auto-Fade mengkloning material dinding saat didaftarkan: warnai lewat material mesh yang aktif.
  const onAirFace = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.14), new THREE.MeshBasicMaterial({ map: onAirTexture(), toneMapped: false, color: 0x3a3a3a }));
  {
    const o = STUDIO.onAir;
    const housing = box(0.5, 0.18, 0.05, std(0x15181c, 0.5, 0.4), [o.x, o.y, inner.minZ + 0.025], 'OnAir_Housing');
    onAirFace.name = 'OnAir_Face';
    onAirFace.position.set(o.x, o.y, inner.minZ + 0.052);
    walls.north.add(housing, onAirFace);
  }

  // ---- Snake plant + cahaya syuting (daylight) & editing (hangat) ----
  {
    mountAsset(slot(decor, 'Studio_SnakePlant', STUDIO.snakePlant.x, 0, STUDIO.snakePlant.z), '/models/Office_Indoor_Plant_SnakePlant.glb', new THREE.Group(), load);
    const shoot = new THREE.PointLight(0xf4f8ff, 8, 5.5, 1.6);
    shoot.name = 'Studio_Shoot_Light';
    shoot.position.set(STUDIO.lightShoot.x, STUDIO.lightShoot.y, STUDIO.lightShoot.z);
    const edit = new THREE.PointLight(0xffd9b0, 5, 4.5, 1.7);
    edit.name = 'Studio_Edit_Light';
    edit.position.set(STUDIO.lightEdit.x, STUDIO.lightEdit.y, STUDIO.lightEdit.z);
    decor.add(shoot, edit);
  }

  const toWorldSpot = (p: { x: number; z: number }, rotY = 0): Spot => {
    const v = shell.local(p.x, 0, p.z);
    return { x: v.x, z: v.z, rotY };
  };
  return {
    group,
    bindWalls: shell.bindWalls,
    spotsWorld: () => ({
      talent: toWorldSpot(STUDIO.talent, STUDIO.talent.rotY),
      director: toWorldSpot(STUDIO.director, STUDIO.director.rotY),
      editor: { spot: toWorldSpot(STUDIO.editor.spot, STUDIO.editor.spot.rotY), approach: toWorldSpot(STUDIO.editor.approach, STUDIO.editor.spot.rotY) },
    }),
    setOnAir: (on) => (onAirFace.material as THREE.MeshBasicMaterial).color.setHex(on ? 0xffffff : 0x3a3a3a),
    focusPoint: () => shell.local(0, 1.0, 0.1),
  };
}

// ============================================================================
// Tekstur prosedural
// ============================================================================
function rnd(seed: number) { return () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }; }

/** Vinyl studio charcoal matte anti-pantul, canvas = 1 m. */
function studioVinyl() {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d')!, img = x.createImageData(S, S), d = img.data, r = rnd(97);
  for (let i = 0; i < S * S; i++) { const v = 0.92 + r() * 0.08; d[i * 4] = 46 * v; d[i * 4 + 1] = 49 * v; d[i * 4 + 2] = 53 * v; d[i * 4 + 3] = 255; }
  x.putImageData(img, 0, 0);
  const tex = canvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return std(0xffffff, 0.95, 0, { map: tex });
}

function onAirTexture() {
  const c = document.createElement('canvas'); c.width = 384; c.height = 116;
  const x = c.getContext('2d')!;
  x.fillStyle = '#d61f2c'; x.fillRect(0, 0, 384, 116);
  x.strokeStyle = '#ffd7d7'; x.lineWidth = 6; x.strokeRect(8, 8, 368, 100);
  x.fillStyle = '#fff4f4'; x.font = '800 66px "Inter", "Segoe UI", system-ui, sans-serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('ON AIR', 192, 60);
  return canvasTexture(c);
}

/** Layar color-grading: timeline, scope waveform, viewer. */
function gradingScreenTexture(seed: number) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 288;
  const x = c.getContext('2d')!, r = rnd(seed);
  x.fillStyle = '#0d1117'; x.fillRect(0, 0, 512, 288);
  const sky = x.createLinearGradient(0, 14, 0, 160);
  sky.addColorStop(0, '#f2a65a'); sky.addColorStop(1, '#3b6fa0');
  x.fillStyle = sky; x.fillRect(14, 14, 300, 150);
  x.fillStyle = '#1fa855'; x.fillRect(150, 70, 70, 94);
  x.fillStyle = '#e8d3b8'; x.beginPath(); x.arc(185, 62, 18, 0, Math.PI * 2); x.fill();
  x.strokeStyle = '#334155'; x.strokeRect(326, 14, 172, 150);
  x.strokeStyle = '#34d399'; x.beginPath();
  for (let i = 0; i < 170; i++) { const y = 90 + Math.sin(i * 0.11) * 30 + (r() - 0.5) * 30; if (i) x.lineTo(328 + i, y); else x.moveTo(328, y); }
  x.stroke();
  const tracks = ['#60a5fa', '#c084fc', '#f472b6', '#fbbf24'];
  tracks.forEach((col, t) => {
    let px = 14;
    while (px < 498) { const w = 30 + r() * 90; x.fillStyle = col; x.globalAlpha = 0.8; x.fillRect(px, 182 + t * 24, Math.min(w, 498 - px), 18); px += w + 6; }
  });
  x.globalAlpha = 1;
  x.fillStyle = '#ef4444'; x.fillRect(230, 176, 3, 104);
  return canvasTexture(c);
}

// ============================================================================
// Placeholder prosedural (otomatis diganti GLB bila file-nya ada di public/models)
// ============================================================================
/**
 * Cyclorama green screen, kontrak GLB `Office_Studio_Cyclorama_Stage`: W 2,60 × H 2,35 × D 1,75, origin
 * tengah sisi BELAKANG di lantai (z ≥ 0), menghadap +Z. Dinding hijau z 0,06 → lengkung r 0,49 → apron
 * datar z 0,55..1,75 setinggi 9 mm; tanda ✕ talent di (0, 1,04); truss di x ±1,26 (z 0,14) + 2 Fresnel.
 */
function cycloramaPlaceholder(W: number, H: number, D: number) {
  const g = new THREE.Group();
  g.name = 'Cyclorama_Placeholder';
  const frame = std(0x1b1f24, 0.6, 0.5);
  const green = std(0x1fa855, 0.9, 0, { side: THREE.DoubleSide });
  const R = 0.49, top = 0.009, w = W - 0.1;
  g.add(box(W, H - 0.13, 0.05, frame, [0, (H - 0.13) / 2, 0.025], 'Rear_Frame'));
  g.add(box(w, 2.22 - (R + top), 0.02, green, [0, (2.22 + R + top) / 2, 0.06], 'Green_Backdrop'));
  const cove = new THREE.Mesh(new THREE.CylinderGeometry(R, R, w, 18, 1, true, Math.PI, Math.PI / 2), green);
  cove.geometry.rotateZ(Math.PI / 2);
  cove.position.set(0, R + top, 0.06 + R);
  cove.name = 'Green_Cove';
  g.add(cove);
  g.add(box(w, top, D - 0.55, green, [0, top / 2, (0.55 + D) / 2], 'Green_Floor_Apron'));
  const tape = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
  [Math.PI / 4, -Math.PI / 4].forEach((a) => {
    const m = box(0.18, 0.002, 0.025, tape, [0, top + 0.001, 1.04], 'Talent_Cross_Mark');
    m.rotation.y = a;
    m.castShadow = false;
    g.add(m);
  });
  const steel = std(0x15171a, 0.45, 0.7);
  [-1.26, 1.26].forEach((x) => g.add(box(0.06, H, 0.06, steel, [x, H / 2, 0.14], 'Truss_Stanchion')));
  g.add(box(2.56, 0.15, 0.3, steel, [0, H - 0.075, 0.28], 'Lighting_Truss'));
  const lens = std(0xfff6e5, 0.3, 0, { emissive: 0xfff6e5, emissiveIntensity: 1.0 });
  [-0.68, 0.68].forEach((x) => {
    const lamp = new THREE.Group();
    lamp.name = 'Fresnel_Spot';
    lamp.position.set(x, H - 0.3, 0.36);
    lamp.lookAt(0, 0.9, 1.04);   // belum punya parent: lookAt bekerja di ruang lokal cyclorama
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.24, 14), std(0x111317, 0.5, 0.6));
    body.rotation.x = Math.PI / 2;
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.08, 18), lens);
    face.position.z = 0.121;
    lamp.add(body, face);
    g.add(lamp);
  });
  enableShadow(g);
  return g;
}

/**
 * Rig kamera sinema + softbox, kontrak GLB `Office_Studio_Camera_Softbox_Rig`: W 1,30 × H 1,68 × D 0,80,
 * origin lantai tengah. Lensa & muka softbox ke +Z, viewfinder / monitor sutradara ke −Z (scene memutar 180°).
 */
function cameraRigPlaceholder(W: number, H: number, D: number) {
  const g = new THREE.Group();
  g.name = 'Camera_Rig_Placeholder';
  const black = std(0x1c2026, 0.45, 0.55);
  const tx = -0.18;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
    const leg = box(0.03, 1.22, 0.03, black, [tx + Math.cos(a) * 0.2, 0.6, Math.sin(a) * 0.2], 'Tripod_Leg');
    leg.rotation.set(Math.sin(a) * 0.17, 0, -Math.cos(a) * 0.17);
    g.add(leg);
  }
  g.add(box(0.2, 0.18, 0.32, black, [tx, 1.32, 0.02], 'Cinema_Camera_Body'));
  const lensM = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.2, 16), std(0x0b0d10, 0.35, 0.5));
  lensM.rotation.x = Math.PI / 2;
  lensM.position.set(tx, 1.32, 0.27);
  g.add(lensM, box(0.18, 0.13, 0.03, black, [tx, 1.32, 0.38], 'Matte_Box'));
  g.add(box(0.03, 0.03, 0.02, std(0x3a0d0d, 0.4, 0, { emissive: 0xef4444, emissiveIntensity: 1.0 }), [tx, 1.43, 0.1], 'Tally_LED'));
  g.add(box(0.18, 0.11, 0.02, std(0x0b1d2a, 0.2, 0.3, { emissive: 0x2c6e4a, emissiveIntensity: 0.8 }), [tx, 1.52, -0.14], 'Director_Monitor'));
  // C-stand + softbox oktagonal
  const sx = 0.34;
  g.add(box(0.025, 1.4, 0.025, black, [sx, 0.7, 0.02], 'CStand_Pole'));
  [0, 2.1, 4.2].forEach((a) => {
    const leg = box(0.5, 0.02, 0.025, black, [sx + Math.cos(a) * 0.14, 0.04, 0.02 + Math.sin(a) * 0.14], 'CStand_Leg');
    leg.rotation.y = -a;
    g.add(leg);
  });
  const soft = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.12, 0.26, 8), std(0x15171a, 0.7, 0.1));
  soft.rotation.x = Math.PI / 2;
  soft.position.set(sx, H - 0.28, 0.04);
  const diff = new THREE.Mesh(new THREE.CircleGeometry(0.27, 8), std(0xffffff, 0.6, 0, { emissive: 0xfff7ea, emissiveIntensity: 0.9 }));
  diff.position.set(sx, H - 0.28, 0.172);
  g.add(soft, diff);
  void W; void D;
  enableShadow(g);
  return g;
}

/**
 * Meja produksi, kontrak GLB `Office_Studio_Production_Desk`: W 1,65 × H 1,18 × D 0,72, origin tengah sisi
 * BELAKANG di lantai (z ≥ 0). Permukaan 0,75, rak monitor 0,86 (z 0,03..0,27), 2 monitor menghadap +Z,
 * ruang lutut x ±0,48, z 0,28..0,72 bebas.
 */
function productionDeskPlaceholder(W: number, H: number, D: number, top: number) {
  const g = new THREE.Group();
  g.name = 'Production_Desk_Placeholder';
  const walnut = std(0x5a3d29, 0.5, 0.05);
  const steel = std(0x15181c, 0.45, 0.6);
  g.add(box(W, 0.04, D, walnut, [0, top - 0.02, D / 2], 'Desk_Top'));
  [-0.66, 0.66].forEach((x) => g.add(box(0.2, top - 0.04, D - 0.12, steel, [x, (top - 0.04) / 2, D / 2 - 0.02], 'Rack_Leg')));
  g.add(box(W - 0.3, 0.12, 0.02, steel, [0, 0.55, 0.11], 'Modesty_Tray'));
  g.add(box(1.3, 0.03, 0.24, walnut, [0, 0.86, 0.15], 'Monitor_Bridge'));
  [-0.33, 0.33].forEach((x, i) => {
    const scr = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: gradingScreenTexture(31 + i * 17), emissiveIntensity: 0.9, roughness: 0.3 });
    g.add(box(0.64, 0.38, 0.03, steel, [x, H - 0.2, 0.12], 'Reference_Monitor'));
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.34), scr);
    s.name = 'Grading_Screen';
    s.position.set(x, H - 0.2, 0.136);
    g.add(s, box(0.04, 0.12, 0.04, steel, [x, 0.92, 0.1], 'Monitor_Post'));
  });
  [-0.74, 0.74].forEach((x) => g.add(box(0.13, 0.22, 0.15, std(0x101215, 0.6, 0.2), [x, 0.98, 0.15], 'Studio_Speaker')));
  g.add(box(0.42, 0.03, 0.16, std(0x22262c, 0.5, 0.3), [-0.32, top + 0.015, 0.48], 'Colorist_Panel'));
  g.add(box(0.36, 0.02, 0.12, std(0x1a1d22, 0.6, 0.2), [0.08, top + 0.01, 0.46], 'Edit_Keyboard'));
  enableShadow(g);
  return g;
}
