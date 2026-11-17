import * as THREE from 'three';
import {
  HUDDLE_TABLE_POS,
  ROOM_MAIN,
  WALL_HEIGHT,
  WALL_THICKNESS,
  WORKSPACE_WHITEBOARD_POS,
} from '../layout';
import type { WallFader } from '../camera/wallFade';
import {
  createCarpetFloor,
  enableShadow,
  mountAsset,
  type ModelLoader,
  std,
} from './assets';
import { buildSolidWallX, workspaceWallMats } from './walls';

/**
 * LAYER INDUK RUANGAN 1: Room_MainWorkspace (plan §4), pusat (0, 0).
 * Workstations, kursi, dan seat anchor diisi oleh panggung (terikat ke data agen).
 *
 * Tahap 1 (bus): sisi selatan kini dinding penuh dengan 2 pintu ke Jalan Utama, sisi timur
 * berbatasan langsung dengan dinding barat ruang rapat (sekat kaca tanpa pintu).
 * Tahap 2: pantry sementara (coffee bar, dispenser, tempat sampah) pindah ke Pantry / Café;
 * meja Raka pindah ke Ruang Manajer dan tempatnya diisi whiteboard scrum.
 */
export interface MainWorkspace {
  group: THREE.Group;
  workstations: THREE.Group;
  chairs: THREE.Group;
  seatAnchors: THREE.Group;
  setCarpetMaterial: (mat: THREE.MeshStandardMaterial) => void;
  /** Daftarkan dinding selatan ke Auto-Fade setelah ruangan dipasang di hierarki gedung. */
  bindWalls: () => void;
  update: (time: number) => void;
}

const NORTH_WALL_PARTS = ['Back_Wall', 'Back_Wall_Inset', 'Back_Baseboard', 'Back_Top_Cap', 'Transom_Window', 'Ceiling_Light_Strip'];
const WEST_WALL_PARTS = ['Left_Wall', 'Left_Wall_Inset', 'Left_Baseboard', 'Left_Top_Cap', 'Left_Wall_Accent'];
/**
 * Bagian GLB yang tidak dipakai lagi sejak Tahap 1:
 * - Front_Cutaway_Threshold: ambang cutaway selatan, digantikan dinding selatan berpintu.
 * - Partition_Bolt_*: baut dekoratif di garis Z = 5.0 yang kini jatuh di bukaan pintu.
 * - Sliding_Door_Handle: gagang pintu geser timur (celahnya ditutup kaca mati).
 */
const HIDDEN_SHELL_PARTS = /^(Timber_|Front_Cutaway_Threshold$|Partition_Bolt_|Sliding_Door_Handle$)/;

export function buildMainWorkspace(opts: {
  load: ModelLoader;
  fader: WallFader;
  onShellLoaded: () => void;
  onShellError: (e: unknown) => void;
}): MainWorkspace {
  const { load, fader } = opts;
  const group = new THREE.Group();
  group.name = ROOM_MAIN.name;
  group.position.set(ROOM_MAIN.origin.x, 0, ROOM_MAIN.origin.z);

  const sub = (name: string) => {
    const g = new THREE.Group();
    g.name = name;
    group.add(g);
    return g;
  };
  const architecture = sub('SubLayer_Architecture');
  const workstations = sub('SubLayer_Workstations');
  const chairs = sub('SubLayer_Chairs');
  const appliances = sub('SubLayer_Appliances');
  const decor = sub('SubLayer_Decor');
  const seatAnchors = sub('SubLayer_SeatAnchors');

  // ---- AC dinding utara (dipasang di bawah transom & lampu plafon) ----
  const acSlots = [-1.5, 4.5].map((x, i) => {
    const slot = new THREE.Group();
    slot.name = `Wall_AC_${i}`;
    slot.position.set(x, 2.45, -4.73);
    appliances.add(slot);
    mountAsset(slot, '/models/Office_Wall_AC_Unit.glb', new THREE.Group(), load, () => fader.refresh('main_north'));
    return slot;
  });

  // ---- Lantai karpet seragam (disamakan dengan karpet ruang rapat) ----
  const carpet = createCarpetFloor(13.5, 9.5, [-0.01, -0.01, -0.01], 'Main_Acoustic_Carpet');
  architecture.add(carpet.mesh);
  const setCarpetMaterial = carpet.applyMaterial;

  // ---- Dinding selatan penuh + 2 pintu berkusen ke Jalan Utama (Tahap 1) ----
  // Badan dinding mulai dari muka dalam dinding barat (X = -6.76) supaya tidak menumpuk
  // dengan Left_Wall bawaan GLB; pojok barat daya ditutup tiang sudut tersendiri.
  const southZ = ROOM_MAIN.southWallZ;
  const wallMats = workspaceWallMats();
  const southWall = buildSolidWallX({
    name: 'South_Wall',
    xMin: -6.76,
    xMax: ROOM_MAIN.halfX,
    z: southZ,
    doors: ROOM_MAIN.southDoors,
    mats: wallMats,
    cap: { width: 0.16, yMin: WALL_HEIGHT - 0.085, yMax: WALL_HEIGHT + 0.015, xMin: -6.92 },
    base: { height: 0.34, north: 0.1, south: 0.04 },
    inset: { north: true },
    // Menutup celah slab antara tepi karpet ruang kerja (Z 4.74) dan karpet Jalan Utama (Z 5.0).
    threshold: { zMin: 4.74, zMax: ROOM_MAIN.halfZ, yMin: -0.02, yMax: 0.003 },
  });
  {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, WALL_HEIGHT, ROOM_MAIN.halfZ - 4.86),
      wallMats.body,
    );
    post.name = 'South_Wall_Corner_SW';
    post.position.set(-6.88, WALL_HEIGHT / 2, (4.86 + ROOM_MAIN.halfZ) / 2);
    post.receiveShadow = true;
    southWall.add(post);
  }
  architecture.add(southWall);
  const bindWalls = () => {
    group.updateWorldMatrix(true, true);
    fader.register(
      'main_south',
      [southWall],
      new THREE.Vector3(0, 0, -1),
      group.localToWorld(new THREE.Vector3(0, 0, southZ - WALL_THICKNESS / 2)),
      { interior: true },
    );
  };

  // ---- Shell ruangan ----
  opts.load('/models/office_room_shell.glb', (shell) => {
    enableShadow(shell);
    // Sembunyikan zona kayu bawaan GLB yang berlebih keluar dinding barat (-6.97 ± 3.48 m)
    // serta sub-slab tetap berada tepat di bawah karpet utama (Y -0.30..-0.02).
    shell.traverse((obj) => {
      if (HIDDEN_SHELL_PARTS.test(obj.name)) obj.visible = false;
      if (obj.name === 'Floor_Slab') obj.castShadow = false;
    });
    architecture.add(shell);
    group.updateWorldMatrix(true, true);

    // Celah pintu timur lama: sisi timur kini dinding ruang rapat, jadi ditutup kaca mati
    // (material sama dengan panel kaca di kiri-kanannya).
    const glassRef = shell.getObjectByName('Partition_Left_Glass') as THREE.Mesh | undefined;
    if (glassRef?.isMesh) {
      const bb = new THREE.Box3().setFromObject(glassRef);
      const { zMin, zMax } = ROOM_MAIN.eastGap;
      const pane = new THREE.Mesh(
        new THREE.BoxGeometry(bb.max.x - bb.min.x, bb.max.y - bb.min.y, zMax - zMin),
        glassRef.material,
      );
      pane.name = 'Partition_Gap_Glass';
      const zMid = group.localToWorld(new THREE.Vector3(0, 0, (zMin + zMax) / 2)).z;
      pane.position.copy(architecture.worldToLocal(new THREE.Vector3(
        (bb.min.x + bb.max.x) / 2, (bb.min.y + bb.max.y) / 2, zMid,
      )));
      pane.castShadow = glassRef.castShadow;
      pane.receiveShadow = glassRef.receiveShadow;
      architecture.add(pane);
    }
    const parts = (names: string[]) => names.map((n) => shell.getObjectByName(n)).filter((o): o is THREE.Object3D => !!o);
    fader.register('main_north', [...parts(NORTH_WALL_PARTS), ...acSlots], new THREE.Vector3(0, 0, 1), group.localToWorld(new THREE.Vector3(0, 0, -4.76)));
    fader.register('main_west', parts(WEST_WALL_PARTS), new THREE.Vector3(1, 0, 0), group.localToWorld(new THREE.Vector3(-6.76, 0, 0)));
    opts.onShellLoaded();
  }, opts.onShellError);

  // ---- Server rack + LED berdenyut ----
  const serverLeds: THREE.PointLight[] = [];
  // Merapat ke dinding selatan baru, di kiri-kanan pintu selatan-timur (X 2.8..4.2).
  [{ x: 1.8, z: 4.17 }, { x: 5.5, z: 4.17 }].forEach((p, i) => {
    const slot = new THREE.Group();
    slot.name = `ServerRack_${i}`;
    slot.position.set(p.x, 0, p.z);
    decor.add(slot);
    mountAsset(slot, '/models/Server_Rack_42U.glb', new THREE.Group(), load);
    const led = new THREE.PointLight(i === 0 ? 0x5dbb8a : 0x4da8da, 4.5, 3.5, 2);
    led.position.set(p.x, 1.2, p.z - 0.45);
    led.userData = { offset: i * 2.5 };
    decor.add(led);
    serverLeds.push(led);
  });

  // ---- Tanaman ----
  const plant = (url: string, name: string, p: { x: number; z: number; s: number }) => {
    const slot = new THREE.Group();
    slot.name = name;
    slot.position.set(p.x, 0, p.z);
    slot.scale.setScalar(p.s);
    decor.add(slot);
    mountAsset(slot, url, new THREE.Group(), load);
  };
  [
    { x: -6.3, z: 0.15, s: 0.9 },  // Sudut barat daya (dulu ujung antrean kopi)
    { x: -6.0, z: -4.2, s: 0.90 }, // Sudut barat laut (dulu sudut eksekutif Raka)
    { x: -6.0, z: -1.6, s: 0.85 }, // Pembatas pod barat
  ].forEach((p, i) => plant('/models/Office_Indoor_Plant.glb', `Monstera_${i}`, p));
  [
    { x: 0.0, z: -4.0, s: 0.90 }, // Dinding tengah utara
    { x: 5.8, z: -4.0, s: 0.90 }, // Sudut kanan atas
    { x: 5.8, z: 0.0, s: 0.85 },  // Pembatas samping pod timur
  ].forEach((p, i) => plant('/models/Office_Indoor_Plant_SnakePlant.glb', `SnakePlant_${i}`, p));

  // ---- Rak buku oak menempel dinding barat (menghadap Timur) ----
  {
    const slot = new THREE.Group();
    slot.name = 'Bookshelf_Cabinet';
    slot.position.set(-6.56, 0, -2.9);
    slot.rotation.y = Math.PI / 2;
    decor.add(slot);
    mountAsset(slot, '/models/Office_Bookshelf_Cabinet.glb', new THREE.Group(), load);
  }

  // ---- Meja diskusi bundar (huddle). Placeholder diganti GLB bila sudah dibuat. ----
  {
    const slot = new THREE.Group();
    slot.name = 'Huddle_Table_Round';
    slot.position.set(HUDDLE_TABLE_POS.x, 0, HUDDLE_TABLE_POS.z);
    decor.add(slot);
    const ph = new THREE.Group();
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.04, 40), std(0x6b4a32, 0.45, 0.05));
    top.position.y = 0.74;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.72, 16), std(0x334155, 0.35, 0.8));
    stem.position.y = 0.36;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.03, 24), std(0x1e293b, 0.4, 0.8));
    base.position.y = 0.015;
    ph.add(top, stem, base);
    enableShadow(ph);
    mountAsset(slot, '/models/Office_Meeting_Table_Round.glb', ph, load);
  }

  // ---- Whiteboard scrum tim di bekas meja Raka (dinding utara, menghadap Selatan) ----
  {
    const slot = new THREE.Group();
    slot.name = 'Whiteboard_Scrum_Team';
    slot.position.set(WORKSPACE_WHITEBOARD_POS.x, 0, WORKSPACE_WHITEBOARD_POS.z);
    decor.add(slot);
    mountAsset(slot, '/models/Office_Whiteboard_Scrum.glb', new THREE.Group(), load);
  }

  const update = (time: number) => {
    for (const led of serverLeds) led.intensity = 2.8 + Math.sin(time * 5 + (led.userData.offset as number)) * 1.8;
  };

  return { group, workstations, chairs, seatAnchors, setCarpetMaterial, bindWalls, update };
}
