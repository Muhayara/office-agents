import * as THREE from 'three';
import { BOARDROOM, BOARDROOM_SEATS, ROOM_BOARDROOM, type BoardroomSeat, type Pt } from '../layout';
import type { WallFader } from '../camera/wallFade';
import { box, canvasTexture, enableShadow, mountAsset, std, type ModelLoader } from './assets';

/**
 * LAYER INDUK RUANGAN 2: Room_Boardroom_10p (plan §4–6), pusat dunia (13.5, 0).
 * Semua aset memakai placeholder prosedural dengan dimensi kontrak prompt, lalu otomatis
 * diganti GLB begitu file-nya ada di public/models.
 */

export interface SeatRig {
  seat: BoardroomSeat;
  /** Grup kursi: posisi z dianimasikan (tucked ↔ pulled), rotasi = arah hadap ke meja. */
  root: THREE.Group;
  /** Bagian atas kursi yang berputar (Chair_Swivel). */
  swivel: THREE.Object3D;
  pull: number;
  pullTarget: number;
  swivelAngle: number;
  swivelTarget: number;
}

export interface MeetingScreenInfo {
  phase: 'gathering' | 'session';
  topic: string;
  host: string;
  seated: number;
  total: number;
}

export interface Boardroom {
  group: THREE.Group;
  rigs: SeatRig[];
  /** Daftarkan dinding ke Auto-Fade setelah ruangan dipasang di hierarki gedung. */
  bindWalls: () => void;
  /** Posisi dunia pusat dudukan pada nilai tarik `pull` (0 = tucked, 1 = pulled). */
  seatWorld: (i: number, pull?: number) => THREE.Vector3;
  approachWorld: (i: number) => Pt;
  /** Yaw dunia saat duduk menghadap meja. */
  seatYaw: (i: number) => number;
  /** Sudut putar kursi (relatif) agar menghadap TV. */
  tvSwivel: (i: number) => number;
  focusPoint: () => THREE.Vector3;
  setScreen: (info: MeetingScreenInfo | null) => void;
  update: (dt: number) => void;
}

const SLAT_COUNT = 28;

export function buildBoardroom(load: ModelLoader, fader: WallFader): Boardroom {
  const group = new THREE.Group();
  group.name = ROOM_BOARDROOM.name;
  group.position.set(ROOM_BOARDROOM.origin.x, 0, ROOM_BOARDROOM.origin.z);

  const sub = (name: string) => {
    const g = new THREE.Group();
    g.name = name;
    group.add(g);
    return g;
  };
  const architecture = sub('SubLayer_Architecture');
  const av = sub('SubLayer_AV_Presentation');
  const props = sub('SubLayer_Furniture_Props');
  const lighting = sub('SubLayer_Lighting');
  const tableLayer = sub('SubLayer_ConferenceTable');
  const chairsLayer = sub('SubLayer_ConferenceChairs');
  const spots = sub('SubLayer_MeetingSpots');

  const slot = (parent: THREE.Group, name: string, x: number, y: number, z: number, rotY = 0) => {
    const g = new THREE.Group();
    g.name = name;
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    parent.add(g);
    return g;
  };

  // ---------------------------------------------------------------- AV & dinding
  const tvMount = slot(av, 'Presentation_Display_85', BOARDROOM.tv.x, BOARDROOM.tv.y, BOARDROOM.tv.z, Math.PI / 2);
  const acSlot = slot(props, 'Wall_AC_Boardroom', BOARDROOM.ac.x, BOARDROOM.ac.y, BOARDROOM.ac.z);
  const local = (x: number, z: number) => {
    group.updateWorldMatrix(true, false);
    return group.localToWorld(new THREE.Vector3(x, 0, z));
  };

  // Dinding penuh untuk Auto-Fade: North_Wall & West_Wall_Acoustic (nama grup sama di GLB).
  let wallNorth: THREE.Object3D | undefined;
  let wallWest: THREE.Object3D | undefined;
  let wallsBound = false;
  const registerWalls = () => {
    if (!wallsBound) return;
    group.updateWorldMatrix(true, true);
    const n = new THREE.Vector3(0, 0, 1).transformDirection(group.matrixWorld);
    const w = new THREE.Vector3(1, 0, 0).transformDirection(group.matrixWorld);
    fader.register('board_north', [wallNorth, acSlot].filter((o): o is THREE.Object3D => !!o), n, local(0, BOARDROOM.wallInner));
    fader.register('board_west', [wallWest, tvMount].filter((o): o is THREE.Object3D => !!o), w, local(BOARDROOM.wallInner, 0));
  };

  const shellPh = shellPlaceholder();
  wallNorth = shellPh.getObjectByName('North_Wall') ?? undefined;
  wallWest = shellPh.getObjectByName('West_Wall_Acoustic') ?? undefined;
  mountAsset(architecture, '/models/Office_Boardroom_Shell.glb', shellPh, load, (shell) => {
    wallNorth = shell.getObjectByName('North_Wall') ?? undefined;
    wallWest = shell.getObjectByName('West_Wall_Acoustic') ?? undefined;
    registerWalls();
  });

  // TV: layar overlay milik panggung (agenda rapat), di depan permukaan layar (z = +0.075).
  const screen = new TvScreen();
  const tvSlot = slot(tvMount, 'Display_Model', 0, 0, 0);
  let tvIsGlb = false;
  mountAsset(tvSlot, '/models/Office_Presentation_Display_85.glb', tvPlaceholder(), load, (model) => {
    tvIsGlb = true;
    // Pas-kan overlay agenda ke area layar aktif GLB (sedikit di depannya).
    let active: THREE.Object3D | undefined = model.getObjectByName('Screen_ActiveArea_4K');
    if (!active) model.traverse((o) => { if (!active && (o as THREE.Mesh).isMesh && /screen/i.test(o.name)) active = o; });
    if (active) {
      tvMount.updateWorldMatrix(true, true);
      const bb = new THREE.Box3().setFromObject(active);
      const lo = new THREE.Vector3(Infinity, Infinity, Infinity);
      const hi = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
      for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) {
        const p = tvMount.worldToLocal(new THREE.Vector3(x, y, z));
        lo.min(p);
        hi.max(p);
      }
      const w = hi.x - lo.x, h = hi.y - lo.y;
      if (w > 0.2 && h > 0.2) {
        screen.mesh.position.set((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, hi.z + 0.004);
        screen.mesh.scale.set(w / 1.86, h / 1.04, 1);
      }
    }
    screen.mesh.visible = screen.hasMeeting;
    fader.refresh('board_west');
  });
  tvMount.add(screen.mesh);

  mountAsset(acSlot, '/models/Office_Wall_AC_Unit.glb', new THREE.Group(), load, () => fader.refresh('board_north'));

  const wb = slot(av, 'Whiteboard_Scrum', BOARDROOM.whiteboard.x, 0, BOARDROOM.whiteboard.z);
  mountAsset(wb, '/models/Office_Whiteboard_Scrum.glb', new THREE.Group(), load);

  // ---------------------------------------------------------------- Props
  const credenza = slot(props, 'Boardroom_Credenza', BOARDROOM.credenza.x, 0, BOARDROOM.credenza.z);
  mountAsset(credenza, '/models/Office_Boardroom_Credenza.glb', credenzaPlaceholder(), load);
  const plantNW = slot(props, 'Plant_NW', BOARDROOM.plantNW.x, 0, BOARDROOM.plantNW.z);
  plantNW.scale.setScalar(0.9);
  mountAsset(plantNW, '/models/Office_Indoor_Plant.glb', new THREE.Group(), load);
  const plantNE = slot(props, 'Plant_NE', BOARDROOM.plantNE.x, 0, BOARDROOM.plantNE.z);
  plantNE.scale.setScalar(0.85);
  mountAsset(plantNE, '/models/Office_Indoor_Plant_SnakePlant.glb', new THREE.Group(), load);

  // ---------------------------------------------------------------- Lampu (emissive saja)
  const pendant = slot(lighting, 'Linear_Pendant_Light', BOARDROOM.pendant.x, 0, BOARDROOM.pendant.z);
  mountAsset(pendant, '/models/Office_Linear_Pendant_Light.glb', pendantPlaceholder(), load);

  // ---------------------------------------------------------------- Meja & kursi
  const table = slot(tableLayer, 'Conference_Table', BOARDROOM.tableCenter.x, 0, BOARDROOM.tableCenter.z);
  mountAsset(table, '/models/Office_Conference_Table.glb', tablePlaceholder(), load);

  const rigs: SeatRig[] = BOARDROOM_SEATS.map((seat) => {
    const root = slot(chairsLayer, `Conference_Chair_${seat.id}`, seat.x, 0, seat.zTucked, seat.rotY);
    const ph = chairPlaceholder();
    const rig: SeatRig = {
      seat, root,
      swivel: ph.getObjectByName('Chair_Swivel') ?? ph,
      pull: 0, pullTarget: 0, swivelAngle: 0, swivelTarget: 0,
    };
    mountAsset(root, '/models/Office_Conference_Chair.glb', ph, load, (model) => {
      rig.swivel = model.getObjectByName('Chair_Swivel') ?? model;
      rig.swivel.rotation.y = rig.swivelAngle;
    });
    const anchor = new THREE.Object3D();
    anchor.name = `MeetingSpot_${seat.id}`;
    anchor.position.set(seat.x, BOARDROOM.seatHeight, seat.zTucked);
    anchor.rotation.y = seat.rotY;
    anchor.userData = { seatId: seat.id };
    spots.add(anchor);
    return rig;
  });

  const yaw0 = () => {
    group.updateWorldMatrix(true, false);
    return new THREE.Euler().setFromRotationMatrix(group.matrixWorld, 'YXZ').y;
  };

  const seatWorld = (i: number, pull?: number) => {
    const rig = rigs[i]!;
    const p = pull ?? rig.pull;
    const z = rig.seat.zTucked + (rig.seat.zPulled - rig.seat.zTucked) * p;
    group.updateWorldMatrix(true, false);
    return group.localToWorld(new THREE.Vector3(rig.seat.x, BOARDROOM.seatHeight, z));
  };

  const approachWorld = (i: number): Pt => {
    const s = rigs[i]!.seat;
    const v = local(s.x, s.zApproach);
    return { x: v.x, z: v.z };
  };

  const tvSwivel = (i: number) => {
    const s = rigs[i]!.seat;
    const zMid = (s.zTucked + s.zPulled) / 2;
    const desired = Math.atan2(BOARDROOM.tv.x - s.x, BOARDROOM.tv.z - zMid);
    let d = desired - s.rotY;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d * 0.92;
  };

  const update = (dt: number) => {
    for (const rig of rigs) {
      const step = dt * 2.6;
      if (rig.pull !== rig.pullTarget) {
        rig.pull = rig.pull < rig.pullTarget
          ? Math.min(rig.pullTarget, rig.pull + step)
          : Math.max(rig.pullTarget, rig.pull - step);
        rig.root.position.z = rig.seat.zTucked + (rig.seat.zPulled - rig.seat.zTucked) * rig.pull;
      }
      if (rig.swivelAngle !== rig.swivelTarget) {
        const k = Math.min(1, dt * 3.2);
        rig.swivelAngle += (rig.swivelTarget - rig.swivelAngle) * k;
        if (Math.abs(rig.swivelAngle - rig.swivelTarget) < 0.002) rig.swivelAngle = rig.swivelTarget;
        rig.swivel.rotation.y = rig.swivelAngle;
      }
    }
  };

  const setScreen = (info: MeetingScreenInfo | null) => {
    screen.draw(info);
    screen.mesh.visible = !tvIsGlb || info !== null;
  };
  setScreen(null);

  return {
    group,
    rigs,
    bindWalls: () => { wallsBound = true; registerWalls(); },
    seatWorld,
    approachWorld,
    seatYaw: (i) => rigs[i]!.seat.rotY + yaw0(),
    tvSwivel,
    focusPoint: () => local(BOARDROOM.tableCenter.x - 0.6, BOARDROOM.tableCenter.z + 0.6).setY(1.05),
    setScreen,
    update,
  };
}

// ============================================================================
// Layar TV: agenda rapat dari server (tanpa API key), standby saat kosong
// ============================================================================
class TvScreen {
  readonly mesh: THREE.Mesh;
  hasMeeting = false;
  private canvas = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D;
  private tex: THREE.CanvasTexture;
  private lastKey = '';

  constructor() {
    this.canvas.width = 1024;
    this.canvas.height = 576;
    this.ctx = this.canvas.getContext('2d')!;
    this.tex = canvasTexture(this.canvas);
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.86, 1.04),
      new THREE.MeshBasicMaterial({ map: this.tex, toneMapped: false }),
    );
    this.mesh.name = 'Display_Agenda_Overlay';
    this.mesh.position.set(0, 0, 0.078);
  }

  draw(info: MeetingScreenInfo | null) {
    const key = info ? `${info.phase}|${info.topic}|${info.host}|${info.seated}|${info.total}` : 'standby';
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.hasMeeting = info !== null;
    const c = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    const bg = c.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#06121a');
    bg.addColorStop(1, '#0d2230');
    c.fillStyle = bg;
    c.fillRect(0, 0, W, H);

    c.fillStyle = '#0f2a38';
    c.fillRect(0, 0, W, 64);
    c.fillStyle = '#38bdf8';
    c.font = '600 26px "Inter", system-ui, sans-serif';
    c.textBaseline = 'middle';
    c.fillText('OFFICE AGENTS · RUANG RAPAT', 40, 33);

    if (!info) {
      c.fillStyle = '#e2e8f0';
      c.font = '700 64px "Inter", system-ui, sans-serif';
      c.fillText('Ruang Rapat Siap', 40, 200);
      c.fillStyle = '#94a3b8';
      c.font = '400 32px "Inter", system-ui, sans-serif';
      c.fillText('Kirim /rapat <topik> untuk memanggil 10 agen.', 40, 270);
      const cards: Array<[string, string]> = [['#38bdf8', 'Agenda'], ['#34d399', 'Keputusan'], ['#fbbf24', 'Tindak lanjut']];
      cards.forEach(([color, label], i) => {
        const x = 40 + i * 320;
        c.fillStyle = '#10283a';
        c.fillRect(x, 340, 290, 170);
        c.fillStyle = color;
        c.fillRect(x, 340, 290, 6);
        c.font = '600 30px "Inter", system-ui, sans-serif';
        c.fillText(label, x + 24, 400);
        c.fillStyle = '#1e3a4f';
        for (let r = 0; r < 3; r++) c.fillRect(x + 24, 440 + r * 22, 200 - r * 40, 10);
      });
    } else {
      const live = info.phase === 'session';
      c.fillStyle = live ? '#34d399' : '#fbbf24';
      c.fillRect(40, 100, live ? 250 : 220, 44);
      c.fillStyle = '#06121a';
      c.font = '700 24px "Inter", system-ui, sans-serif';
      c.fillText(live ? 'SEDANG BERLANGSUNG' : 'MENUNGGU PESERTA', 54, 123);

      c.fillStyle = '#f8fafc';
      c.font = '700 54px "Inter", system-ui, sans-serif';
      const lines = wrapText(c, info.topic, W - 80, 3);
      lines.forEach((line, i) => c.fillText(line, 40, 210 + i * 66));

      c.fillStyle = '#94a3b8';
      c.font = '400 30px "Inter", system-ui, sans-serif';
      c.fillText(`Dipimpin oleh ${info.host}`, 40, 430);

      c.fillText(`Peserta hadir: ${info.seated}/${info.total}`, 40, 500);
      for (let i = 0; i < info.total; i++) {
        c.beginPath();
        c.arc(400 + i * 34, 500, 11, 0, Math.PI * 2);
        c.fillStyle = i < info.seated ? '#34d399' : '#1e3a4f';
        c.fill();
      }
    }
    this.tex.needsUpdate = true;
  }
}

function wrapText(c: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number) {
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (c.measureText(test).width <= maxW) {
      line = test;
      continue;
    }
    if (line) lines.push(line);
    line = w;
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    let last = lines[maxLines - 1]!;
    while (last.length > 1 && c.measureText(`${last}…`).width > maxW) last = last.slice(0, -1);
    lines[maxLines - 1] = `${last}…`;
  }
  return lines;
}

// ============================================================================
// Placeholder prosedural (dimensi sesuai kontrak prompt di plan §6–10)
// ============================================================================
function shellPlaceholder() {
  const g = new THREE.Group();
  g.name = 'Office_Boardroom_Shell_Placeholder';
  const slate = std(0x18252b, 0.9, 0.05);
  const panel = std(0x1e2b33, 0.85, 0.05);
  const timber = std(0x241a14, 0.7, 0.05);
  const alu = std(0x2a3a42, 0.35, 0.75);
  const felt = std(0x14181c, 0.95, 0.0);
  const walnut = std(0x4a2c19, 0.55, 0.05);
  const curb = std(0x0c171b, 0.5, 0.6);
  const cove = std(0x1a1410, 0.5, 0.0, { emissive: 0xffdfb8, emissiveIntensity: 1.1 });

  // Floor_Group: sub-slab + karpet akustik charcoal bermotif tile
  const floor = new THREE.Group();
  floor.name = 'Floor_Group';
  floor.add(box(8.0, 0.28, 8.0, slate, [0, -0.16, 0], 'Boardroom_SubSlab'));
  const carpetCanvas = document.createElement('canvas');
  carpetCanvas.width = carpetCanvas.height = 128;
  const cc = carpetCanvas.getContext('2d')!;
  cc.fillStyle = '#1d242b';
  cc.fillRect(0, 0, 128, 128);
  cc.fillStyle = '#242d35';
  cc.fillRect(0, 0, 64, 64);
  cc.fillRect(64, 64, 64, 64);
  cc.strokeStyle = '#161c22';
  cc.lineWidth = 2;
  cc.strokeRect(1, 1, 126, 126);
  const carpetTex = canvasTexture(carpetCanvas);
  carpetTex.wrapS = carpetTex.wrapT = THREE.RepeatWrapping;
  carpetTex.repeat.set(8, 8);
  const carpet = box(7.76, 0.02, 7.76, std(0xffffff, 0.92, 0.02, { map: carpetTex }), [0, -0.01, 0], 'Acoustic_Carpet');
  carpet.castShadow = false;
  floor.add(carpet);
  g.add(floor);

  // North_Wall (Z = -3.88, tebal 0.24)
  const north = new THREE.Group();
  north.name = 'North_Wall';
  north.add(box(8.0, 3.2, 0.24, slate, [0, 1.6, -3.88], 'North_Wall_Body'));
  for (const x of [-2.55, 0, 2.55]) north.add(box(2.3, 2.45, 0.012, panel, [x, 1.6, -3.754]));
  north.add(box(7.52, 0.28, 0.03, timber, [0.12, 0.14, -3.745], 'North_Baseboard'));
  north.add(box(8.04, 0.06, 0.3, alu, [0, 3.2, -3.88], 'North_Top_Cap'));
  const coveStrip = box(7.4, 0.03, 0.04, cove, [0, 3.06, -3.73], 'North_Cove_Light');
  coveStrip.castShadow = false;
  north.add(coveStrip);
  g.add(north);

  // West_Wall_Acoustic (X = -3.88) dengan portal pintu Z 1.65..3.05 + dinding slat walnut
  const west = new THREE.Group();
  west.name = 'West_Wall_Acoustic';
  const { zMin, zMax } = BOARDROOM.door;
  const segN0 = BOARDROOM.wallInner, segN1 = zMin;
  west.add(box(0.24, 3.2, segN1 - segN0, slate, [-3.88, 1.6, (segN0 + segN1) / 2], 'West_Wall_North'));
  west.add(box(0.24, 3.2, 4.0 - zMax, slate, [-3.88, 1.6, (zMax + 4.0) / 2], 'West_Wall_South_Pier'));
  west.add(box(0.24, 0.65, zMax - zMin, slate, [-3.88, 2.875, (zMin + zMax) / 2], 'Door_Lintel'));
  for (const z of [zMin + 0.025, zMax - 0.025]) west.add(box(0.28, 2.55, 0.05, alu, [-3.88, 1.275, z], 'Door_Jamb'));
  west.add(box(0.28, 0.06, 0.3, alu, [-3.88, 3.2, 0], 'West_Top_Cap'));
  west.add(box(0.02, 2.9, 5.26, felt, [-3.75, 1.5, -1.13], 'Acoustic_Felt'));
  const slats = new THREE.InstancedMesh(new THREE.BoxGeometry(0.025, 2.86, 0.07), walnut, SLAT_COUNT);
  slats.name = 'Walnut_Slats';
  const m = new THREE.Matrix4();
  for (let i = 0; i < SLAT_COUNT; i++) {
    m.makeTranslation(-3.727, 1.5, -3.62 + i * (4.98 / (SLAT_COUNT - 1)));
    slats.setMatrixAt(i, m);
  }
  slats.castShadow = true;
  slats.receiveShadow = true;
  west.add(slats);
  g.add(west);

  // Cutaway_Curbs: sisi Selatan & Timur terbuka untuk kamera
  const curbs = new THREE.Group();
  curbs.name = 'Cutaway_Curbs';
  curbs.add(box(8.0, 0.13, 0.24, curb, [0, 0.065, 3.88], 'Curb_South'));
  curbs.add(box(0.24, 0.13, 7.76, curb, [3.88, 0.065, -0.12], 'Curb_East'));
  curbs.add(box(0.26, 0.5, 0.26, curb, [3.88, 0.25, -3.88], 'Corner_Cap_NE'));
  curbs.add(box(0.26, 0.5, 0.26, curb, [-3.88, 0.25, 3.88], 'Corner_Cap_SW'));
  g.add(curbs);
  return g;
}

function tvPlaceholder() {
  const g = new THREE.Group();
  g.name = 'Office_Presentation_Display_85_Placeholder';
  const dark = std(0x101418, 0.3, 0.85);
  g.add(box(0.6, 0.4, 0.03, std(0x1c2128, 0.5, 0.7), [0, 0, 0.015], 'VESA_Bracket'));
  g.add(box(1.9, 1.08, 0.045, dark, [0, 0, 0.0525], 'Display_Chassis'));
  const bar = box(0.72, 0.09, 0.08, std(0x1b1e23, 0.88, 0.05), [0, -0.63, 0.04], 'Video_Soundbar');
  g.add(bar);
  const ledDot = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 8), std(0x0, 0.3, 0, { emissive: 0x34d399, emissiveIntensity: 2 }));
  ledDot.position.set(0.05, -0.6, 0.081);
  g.add(ledDot);
  return g;
}

function credenzaPlaceholder() {
  const g = new THREE.Group();
  g.name = 'Office_Boardroom_Credenza_Placeholder';
  const steel = std(0x14181c, 0.35, 0.8);
  const walnut = std(0x3d2314, 0.45, 0.05);
  const marble = std(0x15171a, 0.25, 0.05);
  const brass = std(0xc5a880, 0.28, 0.88);
  for (const x of [-0.85, 0.85]) for (const z of [-0.19, 0.19]) g.add(box(0.03, 0.14, 0.03, steel, [x, 0.07, z]));
  g.add(box(1.8, 0.65, 0.45, walnut, [0, 0.465, 0], 'Cabinet_Body'));
  g.add(box(1.8, 0.03, 0.45, marble, [0, 0.805, 0], 'Marble_Top'));
  for (const x of [-0.3, 0.3]) g.add(box(0.004, 0.6, 0.006, steel, [x, 0.465, 0.226]));
  for (const x of [-0.6, 0, 0.6]) g.add(box(0.2, 0.01, 0.012, brass, [x, 0.77, 0.228]));
  const glass = new THREE.MeshStandardMaterial({ color: 0xcfe8ee, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.45 });
  g.add(box(0.42, 0.015, 0.28, std(0xaab2b8, 0.3, 0.85), [-0.5, 0.8275, 0], 'Serving_Tray'));
  const carafe = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.24, 16), glass);
  carafe.position.set(-0.6, 0.955, 0);
  g.add(carafe);
  for (let i = 0; i < 4; i++) {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.026, 0.09, 12), glass);
    cup.position.set(-0.48 + (i % 2) * 0.08, 0.88, -0.06 + Math.floor(i / 2) * 0.1);
    g.add(cup);
  }
  g.add(box(0.18, 0.26, 0.26, std(0x2a2d31, 0.4, 0.6), [0.55, 0.95, -0.02], 'Pod_Espresso_Machine'));
  return g;
}

function pendantPlaceholder() {
  const g = new THREE.Group();
  g.name = 'Office_Linear_Pendant_Light_Placeholder';
  const body = std(0x12161b, 0.32, 0.85);
  const glow = std(0x2a261f, 0.5, 0, { emissive: 0xfff1d6, emissiveIntensity: 1.4 });
  g.add(box(2.6, 0.06, 0.11, body, [0, 2.28, 0], 'Pendant_Body'));
  const lens = box(2.54, 0.01, 0.08, glow, [0, 2.247, 0], 'Pendant_Diffuser');
  lens.castShadow = false;
  g.add(lens);
  const cable = std(0xb8bcc0, 0.3, 0.9);
  for (const x of [-0.95, 0.95]) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.89, 6), cable);
    c.position.set(x, 2.755, 0);
    g.add(c);
    const canopy = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.018, 20), body);
    canopy.position.set(x, 3.19, 0);
    g.add(canopy);
  }
  return g;
}

function tablePlaceholder() {
  const g = new THREE.Group();
  g.name = 'Office_Conference_Table_Placeholder';
  const half = (BOARDROOM.tableLength - BOARDROOM.tableWidth) / 2; // 1.40
  const r = BOARDROOM.tableWidth / 2; // 0.60
  const shape = new THREE.Shape();
  shape.moveTo(-half, -r);
  shape.lineTo(half, -r);
  shape.absarc(half, 0, r, -Math.PI / 2, Math.PI / 2, false);
  shape.lineTo(-half, r);
  shape.absarc(-half, 0, r, Math.PI / 2, Math.PI * 1.5, false);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: false, curveSegments: 24 });
  geo.rotateX(-Math.PI / 2);
  const top = new THREE.Mesh(geo, std(0x3d2314, 0.4, 0.05));
  top.name = 'Table_Top';
  top.position.y = 0.71;
  g.add(top);
  const steel = std(0x1a1a1c, 0.35, 0.85);
  const alu = std(0xc8ccd0, 0.3, 0.85);
  for (const x of [-1.05, 1.05]) {
    for (const z of [-0.22, 0.22]) g.add(box(0.06, 0.71, 0.06, steel, [x, 0.355, z]));
    g.add(box(0.06, 0.06, 0.5, steel, [x, 0.03, 0]));
    g.add(box(0.06, 0.06, 0.5, steel, [x, 0.68, 0]));
    g.add(box(0.3, 0.006, 0.12, alu, [x, 0.753, 0], 'Table_Grommet'));
  }
  g.add(box(2.1, 0.06, 0.06, steel, [0, 0.68, 0], 'Table_Beam'));
  enableShadow(g);
  return g;
}

function chairPlaceholder() {
  const root = new THREE.Group();
  root.name = 'Office_Conference_Chair_Placeholder';
  const alu = std(0xb0b5ba, 0.2, 0.9);
  const leather = std(0x222225, 0.85, 0);
  const pad = std(0x2a2a2d, 0.7, 0);

  const base = new THREE.Group();
  base.name = 'Chair_Base';
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    const leg = box(0.29, 0.025, 0.04, alu, [Math.sin(a) * 0.15, 0.04, Math.cos(a) * 0.15]);
    leg.rotation.y = a + Math.PI / 2;
    base.add(leg);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.06, 12), alu);
  hub.position.y = 0.06;
  base.add(hub);
  const lift = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.22, 10), std(0x1f2226, 0.4, 0.7));
  lift.position.y = 0.2;
  base.add(lift);
  root.add(base);

  const swivel = new THREE.Group();
  swivel.name = 'Chair_Swivel';
  swivel.add(box(0.2, 0.04, 0.2, std(0x1f2226, 0.4, 0.7), [0, 0.37, 0], 'Chair_Mechanism'));
  swivel.add(box(0.5, 0.07, 0.5, leather, [0, 0.425, 0], 'Chair_Seat'));
  const back = box(0.48, 0.4, 0.07, leather, [0, 0.68, -0.27], 'Chair_Backrest');
  back.rotation.x = -0.15;
  swivel.add(back);
  for (const x of [-0.27, 0.27]) {
    swivel.add(box(0.025, 0.18, 0.025, alu, [x, 0.55, -0.04]));
    swivel.add(box(0.05, 0.025, 0.3, pad, [x, 0.645, -0.02], 'Chair_Armrest'));
  }
  root.add(swivel);
  enableShadow(root);
  return root;
}
