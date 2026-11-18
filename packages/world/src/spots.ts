/**
 * Titik rutinitas Lantai 1 dalam koordinat DUNIA, dihitung murni dari `layout.ts` (F2).
 *
 * Setiap ruangan hanya digeser ke `origin`-nya (tidak diputar), jadi dunia = origin + lokal.
 * Panggung (Three.js) membandingkan hasil ini dengan scene graph saat dev (lihat `IsometricOfficeStage`).
 */
import {
  ACCESS,
  AGENT_3D_POSITIONS,
  BOARDROOM,
  BOARDROOM_SEATS,
  COLLABPODS,
  COMMONS,
  CORRIDOR_BUS,
  FOCUSPODS,
  GARDEN,
  INFOWALL,
  LOBBY,
  LOUNGE,
  PANTRY,
  ROOM_ACCESS,
  ROOM_BOARDROOM,
  ROOM_COLLABPODS,
  ROOM_COMMONS,
  ROOM_FOCUS,
  ROOM_FOYER,
  ROOM_GARDEN,
  ROOM_INFOWALL,
  ROOM_LOBBY,
  ROOM_LOUNGE,
  ROOM_MAIN,
  ROOM_MANAGER,
  ROOM_PANTRY,
  ROOM_SERVER,
  ROOM_STUDIO,
  ROOM_WORKSHOP,
  SERVER,
  STUDIO,
  WORKSHOP,
  sitLocal,
  type Pt,
  type Spot,
} from './layout';
import {
  BOARDROOM_DOOR_GATE,
  FLOOR1_PORTALS,
  accessHubPath,
  boardroomPath,
  busPath,
  collabPodsPath,
  commonsPath,
  createBuildingNav,
  focusPodsPath,
  foyerPath,
  gardenPath,
  infoWallPath,
  lobbyPath,
  loungePath,
  mainRoomPath,
  managerPath,
  pantryPath,
  serverPath,
  studioPath,
  visitSpotFor,
  workshopPath,
  type BuildingNav,
  type NavRoom,
} from './navigation';

type Origin = { origin: Pt };
const at = (room: Origin, p: Pt, rotY = 0): Spot => ({ x: room.origin.x + p.x, z: room.origin.z + p.z, rotY });

export interface SeatSpot { spot: Spot; approach: Spot }

export interface DeskSeat {
  x: number;
  y: number;
  z: number;
  rotY: number;
  /** Titik berdiri tamu di depan meja ini. */
  visit: Pt;
}

/** Kursi kerja agen (dunia) dari AGENT_3D_POSITIONS. */
export function deskSeat(agentId: string): DeskSeat | null {
  const p = AGENT_3D_POSITIONS[agentId];
  if (!p) return null;
  const room = p.room === 'manager' ? ROOM_MANAGER : ROOM_MAIN;
  const sp = sitLocal(p);
  const v = visitSpotFor(p);
  return {
    x: room.origin.x + sp.x, y: sp.y, z: room.origin.z + sp.z,
    rotY: p.rotY + Math.PI,
    visit: { x: room.origin.x + v.x, z: room.origin.z + v.z },
  };
}

const seats = (room: Origin, list: ReadonlyArray<{ spot: Pt & { rotY: number }; approach: Pt }>): SeatSpot[] =>
  list.map((s) => ({ spot: at(room, s.spot, s.spot.rotY), approach: at(room, s.approach, s.spot.rotY) }));

export interface Floor1Spots {
  lobbySpawn: Spot;
  coffeeQueue: Spot[];
  trashStand: Spot;
  stools: Array<{ seat: Spot; approach: Spot }>;
  sofa: SeatSpot[];
  serverInspect: Spot;
  serverConsole: SeatSpot;
  commons: SeatSpot[];
  garden: SeatSpot[];
  workshop: SeatSpot[];
  presenter: Spot;
  infoWall: Spot[];
  pods: SeatSpot[];
  studio: { talent: Spot; director: Spot; editor: SeatSpot };
  focus: SeatSpot[];
  access: { map: Spot; lift: Spot };
  boardDoorInside: Pt;
}

export function floor1Spots(): Floor1Spots {
  const o = COLLABPODS.seatOffsetX;
  const fr = FOCUSPODS.pod.rotY, fdx = Math.sin(fr), fdz = Math.cos(fr), face = fr + Math.PI;
  return {
    lobbySpawn: at(ROOM_LOBBY, LOBBY.spawn, LOBBY.spawn.rotY),
    coffeeQueue: PANTRY.queue.map((p) => at(ROOM_PANTRY, p, (p as { rotY?: number }).rotY ?? 0)),
    trashStand: at(ROOM_PANTRY, PANTRY.trashStand, (PANTRY.trashStand as { rotY?: number }).rotY ?? 0),
    stools: PANTRY.stoolZ.map((z) => ({
      seat: at(ROOM_PANTRY, { x: PANTRY.stoolX, z }, PANTRY.stoolRotY),
      approach: at(ROOM_PANTRY, { x: PANTRY.spineX, z }),
    })),
    sofa: seats(ROOM_LOUNGE, LOUNGE.seats),
    serverInspect: at(ROOM_SERVER, SERVER.inspect, SERVER.inspect.rotY),
    serverConsole: { spot: at(ROOM_SERVER, SERVER.consoleSeat.spot, SERVER.consoleSeat.spot.rotY), approach: at(ROOM_SERVER, SERVER.consoleSeat.approach, SERVER.consoleSeat.spot.rotY) },
    commons: seats(ROOM_COMMONS, COMMONS.seats),
    garden: seats(ROOM_GARDEN, GARDEN.seats),
    workshop: seats(ROOM_WORKSHOP, WORKSHOP.seats),
    presenter: at(ROOM_WORKSHOP, WORKSHOP.presenter, WORKSHOP.presenter.rotY),
    infoWall: INFOWALL.observers.map((p) => at(ROOM_INFOWALL, p, p.rotY)),
    pods: COLLABPODS.pods.flatMap((p) => [
      { spot: at(ROOM_COLLABPODS, { x: p.x - o, z: p.z }, Math.PI / 2), approach: at(ROOM_COLLABPODS, { x: p.x - o, z: COLLABPODS.approachZ }, Math.PI / 2) },
      { spot: at(ROOM_COLLABPODS, { x: p.x + o, z: p.z }, -Math.PI / 2), approach: at(ROOM_COLLABPODS, { x: p.x + o, z: COLLABPODS.approachZ }, -Math.PI / 2) },
    ]),
    studio: {
      talent: at(ROOM_STUDIO, STUDIO.talent, STUDIO.talent.rotY),
      director: at(ROOM_STUDIO, STUDIO.director, STUDIO.director.rotY),
      editor: { spot: at(ROOM_STUDIO, STUDIO.editor.spot, STUDIO.editor.spot.rotY), approach: at(ROOM_STUDIO, STUDIO.editor.approach, STUDIO.editor.spot.rotY) },
    },
    focus: FOCUSPODS.pods.map((p) => ({
      spot: at(ROOM_FOCUS, { x: p.x + fdx * FOCUSPODS.seatDZ, z: p.z + fdz * FOCUSPODS.seatDZ }, face),
      approach: at(ROOM_FOCUS, { x: p.x + fdx * FOCUSPODS.approachDZ, z: p.z + fdz * FOCUSPODS.approachDZ }, face),
    })),
    access: { map: at(ROOM_ACCESS, ACCESS.mapSpot, ACCESS.mapSpot.rotY), lift: at(ROOM_ACCESS, ACCESS.liftSpot, ACCESS.liftSpot.rotY) },
    boardDoorInside: at(ROOM_BOARDROOM, BOARDROOM.doorInside),
  };
}

/* ---------------- Kursi rapat Boardroom (tanpa Three.js) ---------------- */

export interface ChairRig {
  /** 0 = rapat ke meja, 1 = ditarik keluar. */
  pull: number;
  pullTarget: number;
  swivelAngle: number;
  swivelTarget: number;
}

export const boardroom = {
  approach(i: number): Pt {
    const s = BOARDROOM_SEATS[i]!;
    return { x: ROOM_BOARDROOM.origin.x + s.x, z: ROOM_BOARDROOM.origin.z + s.zApproach };
  },
  seat(i: number, pull: number): { x: number; y: number; z: number } {
    const s = BOARDROOM_SEATS[i]!;
    const z = s.zTucked + (s.zPulled - s.zTucked) * pull;
    return { x: ROOM_BOARDROOM.origin.x + s.x, y: BOARDROOM.seatHeight, z: ROOM_BOARDROOM.origin.z + z };
  },
  yaw(i: number): number {
    return BOARDROOM_SEATS[i]!.rotY;
  },
  tvSwivel(i: number): number {
    const s = BOARDROOM_SEATS[i]!;
    const zMid = (s.zTucked + s.zPulled) / 2;
    const desired = Math.atan2(BOARDROOM.tv.x - s.x, BOARDROOM.tv.z - zMid);
    let d = desired - s.rotY;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d * 0.92;
  },
  /** Sama dengan animasi kursi di `rooms/boardroom.ts` sebelum F2 (2,6 /dtk tarik, peredaman 3,2 /dtk putar). */
  stepRigs(rigs: ChairRig[], dt: number) {
    for (const rig of rigs) {
      const step = dt * 2.6;
      if (rig.pull !== rig.pullTarget) {
        rig.pull = rig.pull < rig.pullTarget ? Math.min(rig.pullTarget, rig.pull + step) : Math.max(rig.pullTarget, rig.pull - step);
      }
      if (rig.swivelAngle !== rig.swivelTarget) {
        const k = Math.min(1, dt * 3.2);
        rig.swivelAngle += (rig.swivelTarget - rig.swivelAngle) * k;
        if (Math.abs(rig.swivelAngle - rig.swivelTarget) < 0.002) rig.swivelAngle = rig.swivelTarget;
      }
    }
  },
};

/* ---------------- Router gedung Lantai 1 (murni) ---------------- */

const navRoom = (id: string, room: Origin, half: { minX: number; maxX: number; minZ: number; maxZ: number }, pathLocal: NavRoom['pathLocal']): NavRoom => ({
  id,
  bounds: half,
  pathLocal,
  toWorld: (p) => ({ x: p.x + room.origin.x, z: p.z + room.origin.z }),
  toLocal: (p) => ({ x: p.x - room.origin.x, z: p.z - room.origin.z }),
});
const box = (hx: number, hz: number) => ({ minX: -hx, maxX: hx, minZ: -hz, maxZ: hz });

/** Graf navigasi gedung yang sama dengan panggung (17 ruangan + 17 konektor pintu). */
export function createFloor1Nav(): BuildingNav {
  return createBuildingNav(
    [
      navRoom('boardroom', ROOM_BOARDROOM, box(4, 4), boardroomPath),
      navRoom('foyer', ROOM_FOYER, box(ROOM_FOYER.halfX, ROOM_FOYER.halfZ), foyerPath),
      navRoom('bus', CORRIDOR_BUS, box(CORRIDOR_BUS.halfLength, CORRIDOR_BUS.halfWidth), busPath),
      navRoom('main', ROOM_MAIN, { minX: -ROOM_MAIN.halfX, maxX: ROOM_MAIN.eastPartitionX, minZ: -ROOM_MAIN.halfZ, maxZ: ROOM_MAIN.halfZ }, mainRoomPath),
      navRoom('manager', ROOM_MANAGER, box(ROOM_MANAGER.halfX, ROOM_MANAGER.halfZ), managerPath),
      navRoom('pantry', ROOM_PANTRY, box(ROOM_PANTRY.halfX, ROOM_PANTRY.halfZ), pantryPath),
      navRoom('lobby', ROOM_LOBBY, box(ROOM_LOBBY.halfX, ROOM_LOBBY.halfZ), lobbyPath),
      navRoom('lounge', ROOM_LOUNGE, box(ROOM_LOUNGE.halfX, ROOM_LOUNGE.halfZ), loungePath),
      navRoom('server', ROOM_SERVER, box(ROOM_SERVER.halfX, ROOM_SERVER.halfZ), serverPath),
      navRoom('commons', ROOM_COMMONS, box(ROOM_COMMONS.halfX, ROOM_COMMONS.halfZ), commonsPath),
      navRoom('garden', ROOM_GARDEN, box(ROOM_GARDEN.halfX, ROOM_GARDEN.halfZ), gardenPath),
      navRoom('workshop', ROOM_WORKSHOP, box(ROOM_WORKSHOP.halfX, ROOM_WORKSHOP.halfZ), workshopPath),
      navRoom('infowall', ROOM_INFOWALL, box(ROOM_INFOWALL.halfX, ROOM_INFOWALL.halfZ), infoWallPath),
      navRoom('collabpods', ROOM_COLLABPODS, box(ROOM_COLLABPODS.halfX, ROOM_COLLABPODS.halfZ), collabPodsPath),
      navRoom('studio', ROOM_STUDIO, box(ROOM_STUDIO.halfX, ROOM_STUDIO.halfZ), studioPath),
      navRoom('focus', ROOM_FOCUS, box(ROOM_FOCUS.halfX, ROOM_FOCUS.halfZ), focusPodsPath),
      navRoom('access', ROOM_ACCESS, box(ROOM_ACCESS.halfX, ROOM_ACCESS.halfZ), accessHubPath),
    ],
    [
      // Ruang kerja punya 2 pintu ke Jalan Utama: router memilih rute total terpendek.
      { id: 'main-bus-west', a: { room: 'main', portal: FLOOR1_PORTALS.mainSouthWest }, b: { room: 'bus', portal: FLOOR1_PORTALS.busWestDoor } },
      { id: 'main-bus-east', a: { room: 'main', portal: FLOOR1_PORTALS.mainSouthEast }, b: { room: 'bus', portal: FLOOR1_PORTALS.busEastDoor } },
      { id: 'bus-foyer', a: { room: 'bus', portal: FLOOR1_PORTALS.busFoyerDoor }, b: { room: 'foyer', portal: FLOOR1_PORTALS.foyerSouth } },
      { id: 'foyer-boardroom', a: { room: 'foyer', portal: FLOOR1_PORTALS.foyerNorth }, b: { room: 'boardroom', portal: FLOOR1_PORTALS.boardroomDoorInside }, gate: BOARDROOM_DOOR_GATE },
      { id: 'bus-manager', a: { room: 'bus', portal: FLOOR1_PORTALS.busManagerDoor }, b: { room: 'manager', portal: FLOOR1_PORTALS.managerNorth } },
      { id: 'bus-pantry', a: { room: 'bus', portal: FLOOR1_PORTALS.busPantryDoor }, b: { room: 'pantry', portal: FLOOR1_PORTALS.pantryNorth } },
      { id: 'bus-lobby', a: { room: 'bus', portal: FLOOR1_PORTALS.busLobbyDoor }, b: { room: 'lobby', portal: FLOOR1_PORTALS.lobbyNorth } },
      { id: 'bus-lounge', a: { room: 'bus', portal: FLOOR1_PORTALS.busLoungeDoor }, b: { room: 'lounge', portal: FLOOR1_PORTALS.loungeNorth } },
      { id: 'bus-server', a: { room: 'bus', portal: FLOOR1_PORTALS.busServerDoor }, b: { room: 'server', portal: FLOOR1_PORTALS.serverNorth } },
      { id: 'bus-commons', a: { room: 'bus', portal: FLOOR1_PORTALS.busCommonsDoor }, b: { room: 'commons', portal: FLOOR1_PORTALS.commonsSouth } },
      { id: 'bus-garden', a: { room: 'bus', portal: FLOOR1_PORTALS.busGardenDoor }, b: { room: 'garden', portal: FLOOR1_PORTALS.gardenNorth } },
      { id: 'bus-workshop', a: { room: 'bus', portal: FLOOR1_PORTALS.busWorkshopDoor }, b: { room: 'workshop', portal: FLOOR1_PORTALS.workshopSouth } },
      { id: 'commons-infowall', a: { room: 'commons', portal: FLOOR1_PORTALS.commonsNorthInfo }, b: { room: 'infowall', portal: FLOOR1_PORTALS.infoWallSouth } },
      { id: 'workshop-collabpods', a: { room: 'workshop', portal: FLOOR1_PORTALS.workshopNorthPods }, b: { room: 'collabpods', portal: FLOOR1_PORTALS.collabPodsSouth } },
      { id: 'commons-studio', a: { room: 'commons', portal: FLOOR1_PORTALS.commonsNorthStudio }, b: { room: 'studio', portal: FLOOR1_PORTALS.studioSouth } },
      { id: 'bus-focus', a: { room: 'bus', portal: FLOOR1_PORTALS.busFocusDoor }, b: { room: 'focus', portal: FLOOR1_PORTALS.focusNorth } },
      { id: 'bus-access', a: { room: 'bus', portal: FLOOR1_PORTALS.busAccessDoor }, b: { room: 'access', portal: FLOOR1_PORTALS.accessNorth } },
    ],
  );
}
