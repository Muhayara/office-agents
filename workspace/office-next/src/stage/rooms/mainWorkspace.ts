import * as THREE from 'three';
import {
  COFFEE_BAR_POS,
  HUDDLE_TABLE_POS,
  ROOM_MAIN,
  TRASH_BIN_POS,
  WATER_DISPENSER_POS,
} from '../layout';
import type { WallFader } from '../camera/wallFade';
import { enableShadow, mountAsset, splitMeshAlongZ, std, type ModelLoader } from './assets';

/**
 * LAYER INDUK RUANGAN 1: Room_MainWorkspace (plan §4), pusat (0, 0).
 * Workstations, kursi, dan seat anchor diisi oleh panggung (terikat ke data agen).
 */
export interface MainWorkspace {
  group: THREE.Group;
  workstations: THREE.Group;
  chairs: THREE.Group;
  seatAnchors: THREE.Group;
  update: (time: number) => void;
}

const NORTH_WALL_PARTS = ['Back_Wall', 'Back_Wall_Inset', 'Back_Baseboard', 'Back_Top_Cap', 'Transom_Window', 'Ceiling_Light_Strip'];
const WEST_WALL_PARTS = ['Left_Wall', 'Left_Wall_Inset', 'Left_Baseboard', 'Left_Top_Cap', 'Left_Wall_Accent'];
/** Rel / ambang lantai yang melintang di celah pintu timur. */
const DOOR_CROSSING_PARTS = ['Partition_Bottom_Rail', 'Right_Cutaway_Threshold', 'Partition_Floor_Guide'];

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
  const pantry = sub('SubLayer_Pantry');
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

  // ---- Shell ruangan ----
  opts.load('/models/office_room_shell.glb', (shell) => {
    enableShadow(shell);
    architecture.add(shell);
    group.updateWorldMatrix(true, true);
    for (const name of DOOR_CROSSING_PARTS) {
      const mesh = shell.getObjectByName(name) as THREE.Mesh | undefined;
      if (mesh?.isMesh) splitMeshAlongZ(mesh, ROOM_MAIN.eastDoor.zMin, ROOM_MAIN.eastDoor.zMax, architecture);
    }
    const parts = (names: string[]) => names.map((n) => shell.getObjectByName(n)).filter((o): o is THREE.Object3D => !!o);
    fader.register('main_north', [...parts(NORTH_WALL_PARTS), ...acSlots], new THREE.Vector3(0, 0, 1), group.localToWorld(new THREE.Vector3(0, 0, -4.76)));
    fader.register('main_west', parts(WEST_WALL_PARTS), new THREE.Vector3(1, 0, 0), group.localToWorld(new THREE.Vector3(-6.76, 0, 0)));
    opts.onShellLoaded();
  }, opts.onShellError);

  // ---- Server rack + LED berdenyut ----
  const serverLeds: THREE.PointLight[] = [];
  [{ x: 1.8, z: 3.8 }, { x: 5.5, z: 3.8 }].forEach((p, i) => {
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
    { x: -6.0, z: 3.8, s: 0.95 },  // Sudut rehat / lounge
    { x: -6.0, z: -4.2, s: 0.90 }, // Sudut eksekutif Raka
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

  // ---- Pantry: coffee bar, dispenser air, tempat sampah, lampu barista ----
  {
    const bar = new THREE.Group();
    bar.name = 'Office_Coffee_Bar';
    bar.position.set(COFFEE_BAR_POS.x, 0, COFFEE_BAR_POS.z);
    bar.rotation.y = Math.PI;
    pantry.add(bar);
    mountAsset(bar, '/models/Office_Coffee_Bar.glb', new THREE.Group(), load);

    const dispenser = new THREE.Group();
    dispenser.name = 'Office_Water_Dispenser';
    dispenser.position.set(WATER_DISPENSER_POS.x, 0, WATER_DISPENSER_POS.z);
    dispenser.rotation.y = Math.PI; // menghadap ke dalam ruangan, searah coffee bar
    pantry.add(dispenser);
    mountAsset(dispenser, '/models/Office_Water_Dispenser.glb', new THREE.Group(), load);

    const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.52, 16), std(0x334155, 0.35, 0.8));
    bin.position.set(TRASH_BIN_POS.x, 0.26, TRASH_BIN_POS.z);
    bin.castShadow = true;
    bin.name = 'Trash_Bin';
    pantry.add(bin);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.03, 16), std(0x0f172a, 0.2, 0.9));
    lid.position.set(TRASH_BIN_POS.x, 0.53, TRASH_BIN_POS.z);
    pantry.add(lid);

    const baristaLight = new THREE.PointLight(0xffdfb8, 28, 5, 1.6);
    baristaLight.position.set(-3.8, 2.3, 3.8);
    pantry.add(baristaLight);
  }

  const update = (time: number) => {
    for (const led of serverLeds) led.intensity = 2.8 + Math.sin(time * 5 + (led.userData.offset as number)) * 1.8;
  };

  return { group, workstations, chairs, seatAnchors, update };
}
