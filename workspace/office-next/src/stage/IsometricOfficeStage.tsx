import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { type AgentStatus, type AgentView, type Lang, roleLabel } from '@office/shared';
import { OFFICE_ZONES } from '../isometric/coords';
import type { StageEvent } from '../state/liveOffice';
import {
  COFFEE_ROUTINE_DIALOGUES,
  OFFICE_CONVERSATIONS,
  AGENT_SOLO_THOUGHTS,
  LIVE_STATUS_LINES,
  MEETING_CALL_LINES,
  MEETING_ON_THE_WAY,
  MEETING_REPLIES,
  VISIT_ACKS,
} from './officeDialogues';
import {
  AGENT_3D_POSITIONS,
  BOARDROOM,
  BOARDROOM_SEATS,
  COFFEE_QUEUE_SPOTS,
  CORRIDOR_EAST,
  DOOR_MUTEX_GAP_S,
  MEETING_DEPART_GAP_S,
  MEETING_GATHER_TIMEOUT_S,
  MEETING_PRESENT_S,
  MEETING_SEAT_ASSIGNMENT,
  MEETING_SESSION_S,
  ROOM_MAIN,
  TRASH_STAND,
  WALK_SPEED,
  sitWorld,
  type Pt,
} from './layout';
import {
  BOARDROOM_DOOR_GATE,
  FLOOR1_PORTALS,
  boardroomPath,
  corridorPath,
  createBuildingNav,
  mainRoomPath,
  pathLength,
  segLen,
  visitSpotFor,
  type NavPt,
} from './navigation';
import { CameraRig, ISO_FOCUS_HEIGHT, type CameraMode } from './camera/cameraRig';
import { WallFader } from './camera/wallFade';
import { disposeObject, enableShadow, type ModelLoader } from './rooms/assets';
import { buildMainWorkspace } from './rooms/mainWorkspace';
import { buildCorridorEast } from './rooms/corridorEast';
import { buildBoardroom } from './rooms/boardroom';

// ============================================================================
// Tipe & konstanta panggung
// ============================================================================

interface IsometricOfficeStageProps {
  agents: AgentView[];
  selectedAgentId: string;
  language: Lang;
  onSelectAgent: (agentId: string) => void;
  /** true = terhubung ke server: pose & rutinitas mengikuti status agen sebenarnya. */
  live?: boolean;
  /** Event bicara / kunjungan meja / rapat dari server (bertambah, dengan seq naik). */
  stageEvents?: StageEvent[];
}

const COFFEE_MIN_S   = 10;
const COFFEE_MAX_S   = 22;
const CONVO_MIN_S    = 12;
const CONVO_MAX_S    = 24;
const THOUGHT_MIN_S  = 8;
const THOUGHT_MAX_S  = 18;
const VISIT_STAY_S   = 3.5;
/** Pusat bayangan matahari: tengah gedung (ruang kerja + koridor + ruang rapat). */
const SUN_TARGET = new THREE.Vector3(5.25, 0, 0);
const SUN_OFFSET = new THREE.Vector3(12, 24, 16);
const SEATED_LEG = Math.PI / 2.2;

type AnimState =
  | 'working'
  | 'walk_to_coffee'
  | 'waiting_in_queue'
  | 'brewing'
  | 'walk_to_desk'
  | 'drinking'
  | 'walk_to_trash'
  | 'disposing'
  | 'walk_from_trash'
  | 'walk_to_visit'
  | 'visiting'
  | 'walk_from_visit'
  /** Dipanggil rapat, masih di meja menunggu giliran berangkat (jeda 0.9 s). */
  | 'meeting_called'
  | 'walk_to_meeting'
  /** Tarik kursi, duduk, dorong kursi ke meja. */
  | 'meeting_sitting'
  | 'in_meeting'
  /** Tarik kursi, berdiri, mundur ke belakang kursi. */
  | 'meeting_standing'
  | 'walk_from_meeting'
  /** Dipanggil balik ke meja dari rutinitas santai karena ada pekerjaan nyata. */
  | 'walk_back_to_desk';

/** State saat agen sedang dalam perjalanan pulang ke kursinya. */
const RETURNING_STATES: ReadonlySet<AnimState> = new Set<AnimState>([
  'walk_from_trash',
  'walk_from_visit',
  'walk_from_meeting',
  'walk_back_to_desk',
]);

/** Rutinitas santai yang boleh disela saat agen mendapat pekerjaan nyata. */
const COFFEE_STATES: ReadonlySet<AnimState> = new Set<AnimState>([
  'walk_to_coffee',
  'waiting_in_queue',
  'brewing',
  'walk_to_trash',
  'disposing',
  'walk_from_trash',
]);

/** Agen yang sedang terikat rapat (dari dipanggil sampai berdiri dari kursi rapat). */
const MEETING_STATES: ReadonlySet<AnimState> = new Set<AnimState>([
  'meeting_called',
  'walk_to_meeting',
  'meeting_sitting',
  'in_meeting',
  'meeting_standing',
]);

interface AgentAnim {
  state: AnimState;
  stateTime: number;
  stateDuration: number;
  walkPath: NavPt[];
  walkSeg: number;
  walkT: number;
  /** Indeks segmen yang gate-nya sudah dilewati (door mutex). */
  gateSeg: number;
  hasCup: boolean;
  hasDoc: boolean;
  bubbleText: string | null;
  bubbleTimer: number;
  /** Tujuan kunjungan meja (agentId) saat walk_to_visit / visiting. */
  visitTarget?: string;
  /** Indeks kursi di BOARDROOM_SEATS selama terikat rapat. */
  meetingSeat?: number;
  /** Waktu berangkat ke / pulang dari ruang rapat (jeda bertahap). */
  departAt?: number;
  /** Penanda sub-fase animasi duduk / berdiri. */
  subT?: number;
}

interface AgentMeshRefs {
  deskGroup: THREE.Group;
  avatar: THREE.Group;
  leftArmPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  leftLegPivot: THREE.Group;
  rightLegPivot: THREE.Group;
  cup: THREE.Mesh;
  doc: THREE.Mesh;
  monitor: THREE.Mesh;
  screenMat: THREE.MeshStandardMaterial | null;
  screenGlow: THREE.PointLight;
  beacon: THREE.Mesh;
  selRing: THREE.Mesh;
  sitPos: { x: number; y: number; z: number };
  sitRotY: number;
}

interface ScheduledLine {
  agentId: string;
  text: string;
  showAt: number;
  dur: number;
}

type MeetingPhase = 'gathering' | 'session' | 'dispersing';

interface MeetingState {
  phase: MeetingPhase;
  host: string;
  topic: string;
  attendees: string[];
  startedAt: number;
  sessionStartAt: number;
  sessionEndsAt: number;
  /** Waktu kamera kembali ke ruang kerja setelah rapat bubar (0 = sudah). */
  focusBackAt: number;
}

interface StageApi {
  focusRoom: (room: 'workspace' | 'boardroom') => void;
  toggleCamera: () => void;
  resetCamera: () => void;
  focusAgent: (agentId: string) => void;
}

function rand(a: number, b: number) { return a + Math.random() * (b - a); }
function pick<T>(arr: readonly T[]): T { return arr[Math.floor(Math.random() * arr.length)]!; }
function clipText(text: string, max = 110) {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}
const smoothstep = (t: number) => { const c = Math.min(1, Math.max(0, t)); return c * c * (3 - 2 * c); };

/** Tampilan monitor & beacon per status agen (mode live). beacon null = warna kursi. */
const STATUS_LOOK: Record<AgentStatus, {
  screen: number;
  screenIntensity: number;
  glow: number;
  beacon: number | null;
  beaconIntensity: number;
}> = {
  idle:             { screen: 0xffffff, screenIntensity: 0.55, glow: 0.35, beacon: null,     beaconIntensity: 0.35 },
  meeting:          { screen: 0xffffff, screenIntensity: 0.55, glow: 0.35, beacon: null,     beaconIntensity: 0.6 },
  thinking:         { screen: 0xffffff, screenIntensity: 2.2,  glow: 1.0,  beacon: null,     beaconIntensity: 1.2 },
  working:          { screen: 0xffffff, screenIntensity: 2.4,  glow: 1.1,  beacon: null,     beaconIntensity: 1.4 },
  messaging:        { screen: 0xffffff, screenIntensity: 2.0,  glow: 1.0,  beacon: null,     beaconIntensity: 1.2 },
  waiting_approval: { screen: 0xffc04d, screenIntensity: 1.8,  glow: 0.9,  beacon: 0xffb020, beaconIntensity: 1.0 },
  error:            { screen: 0xff4d4f, screenIntensity: 2.4,  glow: 0.9,  beacon: 0xff4d4f, beaconIntensity: 1.0 },
  offline:          { screen: 0x000000, screenIntensity: 0,    glow: 0,    beacon: 0x475569, beaconIntensity: 0.2 },
};

// ============================================================================
// Komponen Utama
// ============================================================================

export function IsometricOfficeStage({
  agents,
  selectedAgentId,
  language,
  onSelectAgent,
  live = false,
  stageEvents = [],
}: IsometricOfficeStageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [camMode, setCamMode] = useState<CameraMode>('iso');
  const apiRef = useRef<StageApi | null>(null);

  const agentsRef = useRef(agents);
  const selectedRef = useRef(selectedAgentId);
  const onSelectRef = useRef(onSelectAgent);
  const liveRef = useRef(live);
  const pendingStageRef = useRef<StageEvent[]>([]);
  const lastStageSeqRef = useRef(0);
  useEffect(() => { agentsRef.current = agents; }, [agents]);
  useEffect(() => { selectedRef.current = selectedAgentId; }, [selectedAgentId]);
  useEffect(() => { onSelectRef.current = onSelectAgent; }, [onSelectAgent]);
  useEffect(() => { liveRef.current = live; }, [live]);
  useEffect(() => {
    // Antrekan event baru saja (seq naik); loop animasi yang mengeksekusinya.
    for (const ev of stageEvents) {
      if (ev.seq > lastStageSeqRef.current) {
        pendingStageRef.current.push(ev);
        lastStageSeqRef.current = ev.seq;
      }
    }
    if (pendingStageRef.current.length > 30) pendingStageRef.current.splice(0, pendingStageRef.current.length - 30);
  }, [stageEvents]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const initAgents = agentsRef.current;
    let animId = 0;
    const clock = new THREE.Clock();

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    // ----- Scene -----
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b151b);

    // ----- Renderer -----
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // ----- PBR Room Environment (PMREM) -----
    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    scene.environment = pmrem.fromScene(roomEnv, 0.04).texture;
    roomEnv.dispose();
    pmrem.dispose();

    // ----- Dual Kamera (Isometrik ↔ Free Cam 3D) & Auto-Fade Wall -----
    const cam = new CameraRig(renderer.domElement, width / height);
    cam.onModeChange = (m) => setCamMode(m);
    const fader = new WallFader();

    // ================================================================
    // ANIMATED MONITOR CODE CANVAS (Tekstur Layar Depan Saja)
    // ================================================================
    const codeCanvas = document.createElement('canvas');
    codeCanvas.width = 128;
    codeCanvas.height = 80;
    const codeCtx = codeCanvas.getContext('2d')!;
    const codeTexture = new THREE.CanvasTexture(codeCanvas);
    codeTexture.magFilter = THREE.NearestFilter;

    const sampleLines = [
      { text: 'const agent = initModel();', color: '#6ee7b7' },
      { text: 'async function deploy() {', color: '#38bdf8' },
      { text: '  await syncPBR3D();', color: '#f472b6' },
      { text: '  PASS 26/26 tests ok;', color: '#4ade80' },
      { text: '  git commit -m "feat";', color: '#fb923c' },
      { text: '  return latency(12ms);', color: '#c084fc' },
      { text: '}', color: '#38bdf8' },
      { text: '// FPS: 60 | Status: OK', color: '#94a3b8' },
    ];
    let codeScrollOffset = 0;

    const renderCodeTexture = () => {
      codeCtx.fillStyle = '#060d13';
      codeCtx.fillRect(0, 0, 128, 80);

      // IDE Title bar
      codeCtx.fillStyle = '#0f1a23';
      codeCtx.fillRect(0, 0, 128, 10);
      codeCtx.fillStyle = '#ef4444';
      codeCtx.fillRect(4, 3, 4, 4);
      codeCtx.fillStyle = '#eab308';
      codeCtx.fillRect(11, 3, 4, 4);
      codeCtx.fillStyle = '#22c55e';
      codeCtx.fillRect(18, 3, 4, 4);

      codeCtx.font = '7px monospace';
      const lineHeight = 8;
      const startY = 18;

      sampleLines.forEach((line, idx) => {
        const y = startY + ((idx + codeScrollOffset) % sampleLines.length) * lineHeight;
        codeCtx.fillStyle = line.color;
        codeCtx.fillText(line.text, 6, y);
      });

      if (Math.floor(Date.now() / 400) % 2 === 0) {
        codeCtx.fillStyle = '#38bdf8';
        codeCtx.fillRect(96, 66, 5, 7);
      }
      codeTexture.needsUpdate = true;
    };
    renderCodeTexture();

    // ================================================================
    // PENCAHAYAAN SINEMATIK
    // ================================================================
    const hemi = new THREE.HemisphereLight(0xdcf3ff, 0x1c2b33, 1.8);
    scene.add(hemi);

    // Bayangan matahari dipusatkan di tengah gedung agar ruang rapat ikut tercakup.
    const sun = new THREE.DirectionalLight(0xfff7ed, 3.2);
    sun.position.copy(SUN_TARGET).add(SUN_OFFSET);
    sun.target.position.copy(SUN_TARGET);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 70;
    sun.shadow.camera.left = -16;
    sun.shadow.camera.right = 16;
    sun.shadow.camera.top = 16;
    sun.shadow.camera.bottom = -16;
    sun.shadow.bias = -0.0003;
    sun.shadow.normalBias = 0.02;
    scene.add(sun, sun.target);

    const fill = new THREE.DirectionalLight(0x7ec8e3, 1.4);
    fill.position.set(-14, 15, -10);
    scene.add(fill);

    const zoneLight = (c: number, i: number, x: number, z: number) => {
      const l = new THREE.PointLight(c, i, 10, 1.6);
      l.position.set(x, 3.0, z);
      scene.add(l);
    };
    zoneLight(0xffdfb0, 32, -3.8, -2.0); // Strategi & Komando
    zoneLight(0xffc89b, 28, -3.8,  1.5); // Studio Desain
    zoneLight(0x6ee7b7, 30,  3.5, -2.0); // Engineering & Game
    zoneLight(0x60a5fa, 28,  3.5,  2.0); // QA & Vault

    // ================================================================
    // PEMUAT MODEL (sekali unduh per file, tiap pemakai mendapat klon)
    // ================================================================
    const gltfLoader = new GLTFLoader();
    // Model yang selesai dimuat setelah komponen dilepas tidak boleh menyentuh scene lagi.
    let disposed = false;
    type Waiter = { onLoad: (g: THREE.Group) => void; onError?: (e: unknown) => void };
    const templates = new Map<string, { scene?: THREE.Group; error?: unknown; waiters: Waiter[] }>();
    const load: ModelLoader = (url, onLoad, onError) => {
      let entry = templates.get(url);
      if (!entry) {
        const e: { scene?: THREE.Group; error?: unknown; waiters: Waiter[] } = { waiters: [] };
        entry = e;
        templates.set(url, e);
        gltfLoader.load(
          url,
          (gltf) => {
            if (disposed) { disposeObject(gltf.scene); return; }
            e.scene = gltf.scene;
            for (const w of e.waiters.splice(0)) w.onLoad(gltf.scene.clone(true));
          },
          undefined,
          (err) => {
            e.error = err ?? new Error(`Gagal memuat ${url}`);
            if (disposed) return;
            for (const w of e.waiters.splice(0)) w.onError?.(e.error);
          },
        );
      }
      if (entry.scene) { onLoad(entry.scene.clone(true)); return; }
      if (entry.error !== undefined) { onError?.(entry.error); return; }
      entry.waiters.push({ onLoad, onError });
    };

    // ================================================================
    // HIRARKI GEDUNG: BuildingRoot → Floor_1_Group → Layer Ruangan
    // ================================================================
    const building = new THREE.Group();
    building.name = 'BuildingRoot';
    const floor1 = new THREE.Group();
    floor1.name = 'Floor_1_Group';
    building.add(floor1);
    scene.add(building);

    const main = buildMainWorkspace({
      load,
      fader,
      onShellLoaded: () => setModelLoaded(true),
      onShellError: (e) => setLoadError(String(e)),
    });
    const corridor = buildCorridorEast(load);
    const board = buildBoardroom(load, fader);
    floor1.add(main.group, corridor.group, board.group);

    // Avatar berada di level lantai karena berpindah antar-ruangan.
    const avatarsGroup = new THREE.Group();
    avatarsGroup.name = 'AgentAvatars';
    floor1.add(avatarsGroup);
    building.updateMatrixWorld(true);
    board.bindWalls();

    // ================================================================
    // NAVIGASI GEDUNG (graf lokal per ruangan + portal pintu)
    // ================================================================
    const roomTransform = (g: THREE.Object3D) => {
      g.updateWorldMatrix(true, false);
      const m = g.matrixWorld.clone();
      const inv = m.clone().invert();
      const v = new THREE.Vector3();
      return {
        toWorld: (p: Pt) => { v.set(p.x, 0, p.z).applyMatrix4(m); return { x: v.x, z: v.z }; },
        toLocal: (p: Pt) => { v.set(p.x, 0, p.z).applyMatrix4(inv); return { x: v.x, z: v.z }; },
      };
    };
    const nav = createBuildingNav(
      [
        {
          id: 'boardroom',
          bounds: { minX: -4, maxX: 4, minZ: -4, maxZ: 4 },
          pathLocal: boardroomPath,
          ...roomTransform(board.group),
        },
        {
          id: 'corridor',
          bounds: {
            minX: -CORRIDOR_EAST.halfLength, maxX: CORRIDOR_EAST.halfLength,
            minZ: -CORRIDOR_EAST.halfWidth, maxZ: CORRIDOR_EAST.halfWidth,
          },
          pathLocal: corridorPath,
          ...roomTransform(corridor.group),
        },
        {
          id: 'main',
          bounds: { minX: -ROOM_MAIN.halfX, maxX: ROOM_MAIN.eastPartitionX, minZ: -ROOM_MAIN.halfZ, maxZ: ROOM_MAIN.halfZ },
          pathLocal: mainRoomPath,
          ...roomTransform(main.group),
        },
      ],
      [
        { id: 'main-corridor', a: { room: 'main', portal: FLOOR1_PORTALS.mainEast }, b: { room: 'corridor', portal: FLOOR1_PORTALS.corridorWest } },
        {
          id: 'corridor-boardroom',
          a: { room: 'corridor', portal: FLOOR1_PORTALS.corridorEastQueue },
          b: { room: 'boardroom', portal: FLOOR1_PORTALS.boardroomDoorInside },
          gate: BOARDROOM_DOOR_GATE,
        },
      ],
    );
    const walkPath = (from: Pt, to: Pt): NavPt[] => nav.path(from, to);
    const boardDoorInside = (() => {
      const v = board.group.localToWorld(new THREE.Vector3(BOARDROOM.doorInside.x, 0, BOARDROOM.doorInside.z));
      return { x: v.x, z: v.z };
    })();

    const meshMap = new Map<string, AgentMeshRefs>();
    const animMap = new Map<string, AgentAnim>();

    // Antrean Kopi Terstruktur
    let coffeeQueue: string[] = [];

    let deskT: THREE.Group | null = null;
    let chairT: THREE.Group | null = null;

    // ================================================================
    // DESK STATIONS (Meja, Kursi, Monitor SATU SISI LAYAR DEPAN SAJA)
    // ================================================================
    const seatAnchorOf = new Map<string, THREE.Object3D>();
    const clearGroup = (g: THREE.Group) => { while (g.children.length > 0) g.remove(g.children[0]!); };

    const rebuildDesks = () => {
      clearGroup(main.workstations);
      clearGroup(main.chairs);
      clearGroup(main.seatAnchors);
      seatAnchorOf.clear();

      initAgents.forEach((ag) => {
        const posInfo = AGENT_3D_POSITIONS[ag.id];
        if (!posInfo) return;
        const color = new THREE.Color(ag.color);

        const g = new THREE.Group();
        g.name = `Workstation_${ag.id}`;
        g.position.set(posInfo.x, 0, posInfo.z);
        g.rotation.y = posInfo.rotY;
        g.userData = { agentId: ag.id };

        // Meja Kerja
        if (deskT) {
          g.add(deskT.clone(true));
        } else {
          const m = new THREE.Mesh(
            new THREE.BoxGeometry(1.4, 0.75, 0.7),
            new THREE.MeshStandardMaterial({ color: 0x182a32, roughness: 0.6, metalness: 0.2 }),
          );
          m.position.y = 0.375;
          m.castShadow = true;
          m.receiveShadow = true;
          g.add(m);
        }

        // Keyboard di atas meja (z = 0.10 local)
        const kb = new THREE.Mesh(
          new THREE.BoxGeometry(0.32, 0.015, 0.12),
          new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.7, metalness: 0.3 }),
        );
        kb.position.set(0, 0.765, 0.10);
        g.add(kb);

        const mouseMesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.06, 0.02, 0.09),
          new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 }),
        );
        mouseMesh.position.set(0.24, 0.765, 0.10);
        g.add(mouseMesh);

        // ==============================================================
        // MONITOR: HANYA SATU LAYAR DEPAN AKTIF, BELAKANG MATTE PLASTIK!
        // BoxGeometry index 4 = +Z (layar menghadap karyawan), sisanya casing.
        // ==============================================================
        const casingMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.85, metalness: 0.2 });
        const screenMat = new THREE.MeshStandardMaterial({
          color: 0x050c12,
          map: codeTexture,
          emissive: 0xffffff,
          emissiveMap: codeTexture,
          emissiveIntensity: 2.2,
          roughness: 0.2,
          metalness: 0.1,
        });
        const monitorMaterials = [casingMat, casingMat, casingMat, casingMat, screenMat, casingMat];
        const mon = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.36, 0.04), monitorMaterials);
        mon.position.set(0, 0.95, -0.2);
        mon.castShadow = true;
        g.add(mon);

        // Screen Glow ke Meja
        const glow = new THREE.PointLight(color, 2.0, 1.8, 2);
        glow.position.set(0, 0.95, -0.05);
        g.add(glow);

        // Selection Ring
        const ringMat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0 });
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 0.9, 32), ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.01;
        g.add(ring);

        main.workstations.add(g);

        // Kursi kerja (SubLayer_Chairs) di titik duduk, menghadap ke meja
        const sp = sitWorld(posInfo);
        const sRotY = posInfo.rotY + Math.PI; // Karyawan duduk menghadap KE MEJA!
        const cg = new THREE.Group();
        cg.name = `Chair_${ag.id}`;
        cg.userData = { agentId: ag.id };
        cg.position.set(sp.x, 0, sp.z);
        cg.rotation.y = sRotY;
        if (chairT) {
          cg.add(chairT.clone(true));
        } else {
          const c = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 0.45, 0.5),
            new THREE.MeshStandardMaterial({ color: 0x111c22, roughness: 0.8 }),
          );
          c.position.set(0, 0.225, 0);
          c.castShadow = true;
          cg.add(c);
        }
        main.chairs.add(cg);

        // Seat anchor (SubLayer_SeatAnchors): posisi duduk dibaca lewat getWorldPosition.
        const anchor = new THREE.Object3D();
        anchor.name = `SeatAnchor_${ag.id}`;
        anchor.position.set(sp.x, sp.y, sp.z);
        anchor.rotation.y = sRotY;
        main.seatAnchors.add(anchor);
        seatAnchorOf.set(ag.id, anchor);
        anchor.updateWorldMatrix(true, false);
        const wp = anchor.getWorldPosition(new THREE.Vector3());
        const sitPos = { x: wp.x, y: wp.y, z: wp.z };

        const existing = meshMap.get(ag.id);
        if (existing) {
          existing.deskGroup = g;
          existing.monitor = mon;
          existing.screenMat = screenMat;
          existing.screenGlow = glow;
          existing.selRing = ring;
          existing.sitPos = sitPos;
          existing.sitRotY = sRotY;
        } else {
          meshMap.set(ag.id, {
            deskGroup: g, avatar: new THREE.Group(),
            leftArmPivot: new THREE.Group(), rightArmPivot: new THREE.Group(),
            leftLegPivot: new THREE.Group(), rightLegPivot: new THREE.Group(),
            cup: new THREE.Mesh(), doc: new THREE.Mesh(), monitor: mon, screenMat, screenGlow: glow,
            beacon: new THREE.Mesh(), selRing: ring,
            sitPos, sitRotY: sRotY,
          });
        }
      });
    };

    // ================================================================
    // AVATAR AGEN DENGAN ARTIKULASI LENGAN & KAKI (MENGHADAP MEJA!)
    // ================================================================
    const buildAvatars = () => {
      while (avatarsGroup.children.length > 0) avatarsGroup.remove(avatarsGroup.children[0]!);

      initAgents.forEach((ag, idx) => {
        const refs = meshMap.get(ag.id);
        if (!refs) return;
        const color = new THREE.Color(ag.color);
        const sp = refs.sitPos;

        const g = new THREE.Group();
        g.name = `Avatar_${ag.id}`;
        g.userData = { agentId: ag.id };
        g.position.set(sp.x, sp.y, sp.z);
        g.rotation.y = refs.sitRotY;

        // Badan / Kemeja
        const body = new THREE.Mesh(
          new THREE.CylinderGeometry(0.13, 0.15, 0.35, 12),
          new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1 }),
        );
        body.position.y = 0.28;
        body.castShadow = true;
        g.add(body);

        // Kepala
        const head = new THREE.Mesh(
          new THREE.SphereGeometry(0.12, 16, 16),
          new THREE.MeshStandardMaterial({ color: 0xffd9b3, roughness: 0.6 }),
        );
        head.position.y = 0.57;
        head.castShadow = true;
        g.add(head);

        // Rambut Stylized
        const hair = new THREE.Mesh(
          new THREE.SphereGeometry(0.124, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2),
          new THREE.MeshStandardMaterial({ color: 0x172227, roughness: 0.9 }),
        );
        hair.position.y = 0.58;
        g.add(hair);

        // Lengan Kiri (Pivot Sendi Bahu)
        const lap = new THREE.Group();
        lap.position.set(-0.17, 0.40, 0);
        const lf = new THREE.Mesh(
          new THREE.CylinderGeometry(0.028, 0.022, 0.18, 8),
          new THREE.MeshStandardMaterial({ color, roughness: 0.6 }),
        );
        lf.position.y = -0.09;
        lap.add(lf);
        const lh = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), new THREE.MeshStandardMaterial({ color: 0xffd9b3 }));
        lh.position.y = -0.18;
        lap.add(lh);

        // Map dokumen di tangan kiri (dibawa saat serah-terima / minta review)
        const doc = new THREE.Mesh(
          new THREE.BoxGeometry(0.17, 0.006, 0.22),
          new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.55 }),
        );
        doc.position.set(0, -0.2, 0.06);
        doc.rotation.x = -0.35;
        doc.visible = false;
        lap.add(doc);
        g.add(lap);

        // Lengan Kanan (Pivot Sendi Bahu)
        const rap = new THREE.Group();
        rap.position.set(0.17, 0.40, 0);
        const rf = new THREE.Mesh(
          new THREE.CylinderGeometry(0.028, 0.022, 0.18, 8),
          new THREE.MeshStandardMaterial({ color, roughness: 0.6 }),
        );
        rf.position.y = -0.09;
        rap.add(rf);
        const rh = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), new THREE.MeshStandardMaterial({ color: 0xffd9b3 }));
        rh.position.y = -0.18;
        rap.add(rh);

        // Cangkir Kopi di Tangan Kanan
        const cup = new THREE.Mesh(
          new THREE.CylinderGeometry(0.04, 0.032, 0.08, 8),
          new THREE.MeshStandardMaterial({ color: 0xfaf8f5, roughness: 0.25, metalness: 0.1 }),
        );
        cup.position.set(0, -0.20, 0.04);
        cup.visible = false;
        rap.add(cup);
        g.add(rap);

        // Kaki Kiri (Pivot Pinggul)
        const llp = new THREE.Group();
        llp.position.set(-0.07, 0.12, 0);
        const llMesh = new THREE.Mesh(
          new THREE.CylinderGeometry(0.035, 0.028, 0.22, 8),
          new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 }),
        );
        llMesh.position.y = -0.11;
        llMesh.castShadow = true;
        llp.add(llMesh);
        g.add(llp);

        // Kaki Kanan (Pivot Pinggul)
        const rlp = new THREE.Group();
        rlp.position.set(0.07, 0.12, 0);
        const rlMesh = new THREE.Mesh(
          new THREE.CylinderGeometry(0.035, 0.028, 0.22, 8),
          new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 }),
        );
        rlMesh.position.y = -0.11;
        rlMesh.castShadow = true;
        rlp.add(rlMesh);
        g.add(rlp);

        // Beacon Status Melayang di Atas Kepala
        const beaconMat = new THREE.MeshStandardMaterial({
          color, emissive: color, emissiveIntensity: 0.9, roughness: 0.15, metalness: 0.85,
        });
        beaconMat.userData.baseColor = color.clone();
        const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), beaconMat);
        beacon.position.y = 0.92;
        beacon.userData = { isBeacon: true, offset: idx * 0.7, baseY: 0.92 };
        g.add(beacon);

        avatarsGroup.add(g);

        refs.avatar = g;
        refs.leftArmPivot = lap;
        refs.rightArmPivot = rap;
        refs.leftLegPivot = llp;
        refs.rightLegPivot = rlp;
        refs.cup = cup;
        refs.doc = doc;
        refs.beacon = beacon;
      });
    };

    // ================================================================
    // INISIALISASI STATE ANIMASI
    // ================================================================
    const initAnims = () => {
      initAgents.forEach((ag) => {
        animMap.set(ag.id, {
          state: 'working',
          stateTime: 0,
          stateDuration: 0,
          walkPath: [],
          walkSeg: 0,
          walkT: 0,
          gateSeg: -1,
          hasCup: false,
          hasDoc: false,
          bubbleText: null,
          bubbleTimer: 0,
        });
      });
    };

    // ================================================================
    // SPEECH BUBBLE DOM (Imperatively-managed)
    // ================================================================
    const initBubbles = () => {
      const bc = bubbleRef.current;
      if (!bc) return;
      initAgents.forEach((ag) => {
        const div = document.createElement('div');
        div.dataset.agent = ag.id;
        Object.assign(div.style, {
          position: 'absolute', display: 'none',
          transform: 'translate(-50%, -100%)',
          background: 'rgba(12, 22, 28, 0.94)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: `1.5px solid ${ag.color}88`,
          borderRadius: '10px',
          padding: '8px 12px',
          color: '#f8fafc',
          fontSize: '11px',
          maxWidth: '220px',
          whiteSpace: 'normal',
          pointerEvents: 'none',
          zIndex: '15',
          lineHeight: '1.4',
          fontFamily: '"JetBrains Mono", "Fira Code", monospace',
          boxShadow: `0 4px 16px rgba(0,0,0,0.5), 0 0 10px ${ag.color}33`,
          transition: 'opacity 0.25s ease',
        });

        const name = document.createElement('div');
        Object.assign(name.style, {
          color: ag.color, fontWeight: '700', fontSize: '10px',
          marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.6px',
        });
        name.textContent = `${ag.name} · ${ag.role}`;
        div.appendChild(name);

        const txt = document.createElement('span');
        txt.dataset.text = 'true';
        div.appendChild(txt);

        const ptr = document.createElement('div');
        Object.assign(ptr.style, {
          position: 'absolute', bottom: '-7px', left: '50%',
          transform: 'translateX(-50%)',
          width: '0', height: '0',
          borderLeft: '7px solid transparent',
          borderRight: '7px solid transparent',
          borderTop: '7px solid rgba(12, 22, 28, 0.94)',
        });
        div.appendChild(ptr);
        bc.appendChild(div);
      });
    };

    rebuildDesks();
    buildAvatars();
    initAnims();
    initBubbles();

    // Template meja & kursi kerja (setelah fungsi rebuild siap)
    load('/models/desk.glb', (m) => { deskT = m; enableShadow(m); rebuildDesks(); });
    load('/models/Office_Ergonomic_Chair.glb', (m) => { chairT = m; enableShadow(m); rebuildDesks(); });

    // ================================================================
    // PEMILIHAN AGEN (klik tanpa seret, kedua mode kamera)
    // ================================================================
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let downX = 0;
    let downY = 0;
    const onPointerDown = (ev: PointerEvent) => { downX = ev.clientX; downY = ev.clientY; };
    const onPointerUp = (ev: PointerEvent) => {
      if (Math.hypot(ev.clientX - downX, ev.clientY - downY) > 6) return;
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, cam.active());
      const hits = raycaster.intersectObjects([main.workstations, main.chairs, avatarsGroup], true);
      if (hits.length > 0) {
        let obj: THREE.Object3D | null = hits[0]!.object;
        while (obj && !obj.userData?.agentId) obj = obj.parent;
        if (obj?.userData?.agentId) onSelectRef.current(obj.userData.agentId as string);
      }
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    // ================================================================
    // RESIZE
    // ================================================================
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth, h = container.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h);
      cam.resize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // ================================================================
    // SCHEDULER, ANTREAN KOPI & PINTU
    // ================================================================
    let globalTime = 0;
    let nextCoffeeT = rand(4, 8);
    let nextConvoT  = rand(8, 14);
    let nextThoughtT = rand(6, 12);
    let lastCodeUpdate = 0;
    const dlgQueue: ScheduledLine[] = [];
    const visitQueue = new Map<string, Array<{ to: string; text: string; carryDoc: boolean }>>();

    const currentPos = (refs: AgentMeshRefs): Pt => ({ x: refs.avatar.position.x, z: refs.avatar.position.z });
    const deskPos = (refs: AgentMeshRefs): Pt => ({ x: refs.sitPos.x, z: refs.sitPos.z });

    // ---- Door mutex: satu agen per DOOR_MUTEX_GAP_S detik melewati pintu ruang rapat ----
    const gates = new Map<string, { lastGrant: number; waiting: string[] }>();
    const gateOf = (id: string) => {
      let g = gates.get(id);
      if (!g) { g = { lastGrant: -Infinity, waiting: [] }; gates.set(id, g); }
      return g;
    };
    const leaveGate = (agentId: string) => {
      for (const g of gates.values()) {
        const i = g.waiting.indexOf(agentId);
        if (i >= 0) g.waiting.splice(i, 1);
      }
    };
    /** true = boleh lanjut melewati pintu. */
    const passGate = (agentId: string, gateId: string): boolean => {
      const g = gateOf(gateId);
      g.waiting = g.waiting.filter((id) => {
        const a = animMap.get(id);
        return !!a && a.walkPath[a.walkSeg]?.gate === gateId && a.gateSeg !== a.walkSeg;
      });
      if (!g.waiting.includes(agentId)) g.waiting.push(agentId);
      if (g.waiting[0] === agentId && globalTime - g.lastGrant >= DOOR_MUTEX_GAP_S) {
        g.lastGrant = globalTime;
        g.waiting.shift();
        return true;
      }
      return false;
    };

    /** Pasang rute jalan baru (selalu lewat sini agar status gate ikut direset). */
    const setWalk = (agentId: string, anim: AgentAnim, path: NavPt[]) => {
      leaveGate(agentId);
      anim.walkPath = path;
      anim.walkSeg = 0;
      anim.walkT = 0;
      anim.gateSeg = -1;
    };

    /** Keluarkan agen dari antrean kopi dan majukan yang di belakangnya. */
    const leaveCoffeeQueue = (agentId: string) => {
      const idx = coffeeQueue.indexOf(agentId);
      if (idx === -1) return;
      coffeeQueue.splice(idx, 1);
      coffeeQueue.forEach((waitingId, newIdx) => {
        const wAnim = animMap.get(waitingId);
        const wRefs = meshMap.get(waitingId);
        if (!wAnim || !wRefs || newIdx < idx) return;
        if (wAnim.state !== 'waiting_in_queue' && wAnim.state !== 'walk_to_coffee') return;
        const nextSpot = COFFEE_QUEUE_SPOTS[Math.min(newIdx, COFFEE_QUEUE_SPOTS.length - 1)]!;
        wAnim.state = 'walk_to_coffee';
        setWalk(waitingId, wAnim, [currentPos(wRefs), nextSpot]);
      });
    };

    /** Panggil kembali ke meja dari rutinitas santai (mis. ada pekerjaan/izin masuk). */
    const recallToDesk = (agentId: string, text?: string) => {
      const anim = animMap.get(agentId);
      const refs = meshMap.get(agentId);
      if (!anim || !refs) return;
      leaveCoffeeQueue(agentId);
      anim.hasCup = false;
      refs.cup.visible = false;
      // State khusus (bukan bagian rutinitas kopi) agar recall tidak terpicu ulang tiap frame.
      anim.state = 'walk_back_to_desk';
      anim.stateTime = 0;
      setWalk(agentId, anim, walkPath(currentPos(refs), deskPos(refs)));
      if (text) {
        anim.bubbleText = text;
        anim.bubbleTimer = 3.0;
      }
    };

    const startVisit = (fromId: string, toId: string, text: string, carryDoc: boolean) => {
      const anim = animMap.get(fromId);
      const refs = meshMap.get(fromId);
      const targetPos = AGENT_3D_POSITIONS[toId];
      if (!anim || !refs || !targetPos) return;
      const spot = visitSpotFor(targetPos);
      anim.state = 'walk_to_visit';
      anim.stateTime = 0;
      anim.visitTarget = toId;
      anim.hasDoc = carryDoc;
      refs.doc.visible = carryDoc;
      setWalk(fromId, anim, walkPath(deskPos(refs), spot));
      anim.bubbleText = clipText(text, 90);
      anim.bubbleTimer = 4.5;
    };

    const statusOf = (agentId: string): AgentStatus | null => {
      if (!liveRef.current) return null;
      return agentsRef.current.find((a) => a.id === agentId)?.status ?? null;
    };

    const atDesk = (anim: AgentAnim) => anim.state === 'working' || anim.state === 'drinking';

    const sitAtDesk = (refs: AgentMeshRefs) => {
      refs.avatar.position.set(refs.sitPos.x, refs.sitPos.y, refs.sitPos.z);
      refs.avatar.rotation.y = refs.sitRotY;
      refs.leftLegPivot.rotation.set(SEATED_LEG, 0, 0);
      refs.rightLegPivot.rotation.set(SEATED_LEG, 0, 0);
    };

    // ================================================================
    // RAPAT DI RUANG RAPAT: berkumpul → sesi → bubar
    // ================================================================
    let meeting: MeetingState | null = null;
    const seatOccupant: Array<string | null> = BOARDROOM_SEATS.map(() => null);
    const agentName = (id: string) => initAgents.find((a) => a.id === id)?.name ?? id;
    const agentRole = (id: string) => {
      const ag = initAgents.find((a) => a.id === id);
      return ag ? ag.title ?? roleLabel(ag.role, 'id') : '';
    };

    const assignSeat = (id: string, anim: AgentAnim): number => {
      if (anim.meetingSeat !== undefined) return anim.meetingSeat;
      const prefer = MEETING_SEAT_ASSIGNMENT[id];
      let idx = prefer ? BOARDROOM_SEATS.findIndex((s) => s.id === prefer) : -1;
      if (idx < 0 || seatOccupant[idx]) idx = seatOccupant.findIndex((o) => o === null);
      if (idx >= 0) {
        seatOccupant[idx] = id;
        anim.meetingSeat = idx;
      }
      return idx;
    };
    const releaseSeat = (id: string, anim: AgentAnim) => {
      const i = seatOccupant.indexOf(id);
      if (i >= 0) seatOccupant[i] = null;
      anim.meetingSeat = undefined;
    };

    const refreshScreen = () => {
      if (!meeting || meeting.phase === 'dispersing') { board.setScreen(null); return; }
      const seated = meeting.attendees.filter((id) => animMap.get(id)?.state === 'in_meeting').length;
      const role = agentRole(meeting.host);
      board.setScreen({
        phase: meeting.phase === 'session' ? 'session' : 'gathering',
        topic: meeting.topic,
        host: role ? `${agentName(meeting.host)} · ${role}` : agentName(meeting.host),
        seated,
        total: meeting.attendees.length,
      });
    };

    const walkToSeat = (id: string, anim: AgentAnim, refs: AgentMeshRefs) => {
      anim.state = 'walk_to_meeting';
      anim.stateTime = 0;
      setWalk(id, anim, walkPath(currentPos(refs), board.approachWorld(anim.meetingSeat!)));
    };

    const startMeeting = (host: string, text: string) => {
      const topic = clipText(text, 140);
      if (meeting && meeting.phase !== 'dispersing') {
        // Rapat masih berjalan: perbarui agenda; sesi yang sedang berlangsung diulang dengan topik baru.
        meeting.topic = topic;
        meeting.host = host;
        if (meeting.phase === 'session') beginSession();
        refreshScreen();
        return;
      }

      const attendees: string[] = [];
      const ids = [host, ...Array.from(animMap.keys()).filter((id) => id !== host)];
      for (const id of ids) {
        const anim = animMap.get(id);
        if (!anim || !meshMap.get(id) || statusOf(id) === 'offline') continue;
        if (assignSeat(id, anim) < 0) continue;
        attendees.push(id);
      }
      if (attendees.length === 0) return;
      meeting = {
        phase: 'gathering', host, topic, attendees,
        startedAt: globalTime, sessionStartAt: 0, sessionEndsAt: 0, focusBackAt: 0,
      };

      // Urutan keberangkatan: jarak tempuh ke pintu ruang rapat, terdekat jalan duluan.
      const order = attendees
        .map((id) => ({ id, len: pathLength(walkPath(currentPos(meshMap.get(id)!), boardDoorInside)) }))
        .sort((a, b) => a.len - b.len);
      let slot = 0;
      for (const { id } of order) {
        const anim = animMap.get(id)!;
        const refs = meshMap.get(id)!;
        if (anim.state === 'in_meeting' || anim.state === 'meeting_sitting' ||
            anim.state === 'walk_to_meeting' || anim.state === 'meeting_standing') continue;
        if (anim.state === 'walk_from_meeting') { walkToSeat(id, anim, refs); continue; }

        leaveCoffeeQueue(id);
        anim.hasCup = false;
        refs.cup.visible = false;
        anim.hasDoc = false;
        refs.doc.visible = false;
        anim.visitTarget = undefined;
        visitQueue.delete(id);
        if (atDesk(anim)) {
          anim.state = 'meeting_called';
          anim.stateTime = 0;
          anim.departAt = globalTime + 0.6 + slot * MEETING_DEPART_GAP_S;
          slot += 1;
        } else {
          walkToSeat(id, anim, refs);
        }
      }

      if (attendees.includes(host)) {
        dlgQueue.push({ agentId: host, text: pick(MEETING_CALL_LINES), showAt: globalTime + 0.2, dur: 3.2 });
      }
      const other = attendees.find((id) => id !== host);
      if (other) dlgQueue.push({ agentId: other, text: pick(MEETING_ON_THE_WAY), showAt: globalTime + 1.8, dur: 2.6 });

      cam.focus(board.focusPoint(), { auto: true });
      refreshScreen();
    };

    /** Sesi dimulai setelah semua duduk: presentasi (kursi menghadap TV) lalu tanggapan peserta. */
    const beginSession = () => {
      if (!meeting) return;
      meeting.phase = 'session';
      meeting.sessionStartAt = globalTime;
      meeting.sessionEndsAt = globalTime + MEETING_SESSION_S;
      const present = meeting.attendees.filter((id) => MEETING_STATES.has(animMap.get(id)?.state ?? 'working'));
      if (present.includes(meeting.host)) {
        dlgQueue.push({ agentId: meeting.host, text: meeting.topic, showAt: globalTime + 0.8, dur: 6.5 });
      }
      let t = globalTime + MEETING_PRESENT_S + 0.5;
      for (const id of present.filter((a) => a !== meeting!.host).slice(0, 3)) {
        dlgQueue.push({ agentId: id, text: pick(MEETING_REPLIES), showAt: t, dur: 3 });
        t += 3.4;
      }
      refreshScreen();
    };

    /** Bubar: kursi terdekat pintu keluar lebih dulu, jeda bertahap + door mutex. */
    const beginDispersal = () => {
      if (!meeting) return;
      meeting.phase = 'dispersing';
      meeting.focusBackAt = globalTime + 3.5;
      const seated: Array<{ id: string; len: number }> = [];
      for (const id of meeting.attendees) {
        const anim = animMap.get(id);
        const refs = meshMap.get(id);
        if (!anim || !refs) continue;
        if (anim.meetingSeat !== undefined) board.rigs[anim.meetingSeat]!.swivelTarget = 0;
        if (anim.state === 'in_meeting' || anim.state === 'meeting_sitting') {
          seated.push({ id, len: pathLength(walkPath(board.approachWorld(anim.meetingSeat!), boardDoorInside)) });
        } else if (anim.state === 'meeting_called') {
          anim.state = 'working';
          anim.stateTime = 0;
          releaseSeat(id, anim);
        } else if (anim.state === 'walk_to_meeting') {
          anim.state = 'walk_from_meeting';
          anim.stateTime = 0;
          setWalk(id, anim, walkPath(currentPos(refs), deskPos(refs)));
        }
      }
      seated.sort((a, b) => a.len - b.len).forEach(({ id }, k) => {
        animMap.get(id)!.departAt = globalTime + 0.5 + k * MEETING_DEPART_GAP_S;
      });
      refreshScreen();
    };

    const updateMeeting = () => {
      if (!meeting) return;
      if (meeting.phase === 'gathering') {
        const seated = meeting.attendees.filter((id) => animMap.get(id)?.state === 'in_meeting').length;
        if (seated === meeting.attendees.length || globalTime - meeting.startedAt > MEETING_GATHER_TIMEOUT_S) {
          beginSession();
        }
      } else if (meeting.phase === 'session') {
        const toTv = globalTime - meeting.sessionStartAt < MEETING_PRESENT_S;
        for (const id of meeting.attendees) {
          const anim = animMap.get(id);
          if (!anim || anim.meetingSeat === undefined || anim.state !== 'in_meeting') continue;
          board.rigs[anim.meetingSeat]!.swivelTarget = toTv ? board.tvSwivel(anim.meetingSeat) : 0;
        }
        if (globalTime >= meeting.sessionEndsAt) beginDispersal();
      } else {
        if (meeting.focusBackAt > 0 && globalTime >= meeting.focusBackAt) {
          meeting.focusBackAt = 0;
          cam.focus(new THREE.Vector3(0, ISO_FOCUS_HEIGHT, 0), { auto: true });
        }
        const busy = meeting.attendees.some((id) => {
          const a = animMap.get(id);
          return !!a && (MEETING_STATES.has(a.state) || a.state === 'walk_from_meeting');
        });
        if (!busy) {
          meeting = null;
          seatOccupant.fill(null);
        }
      }
      refreshScreen();
    };

    // ================================================================
    // HANDLER KEDATANGAN STATE MACHINE
    // ================================================================
    const handleArrival = (agentId: string, anim: AgentAnim) => {
      const refs = meshMap.get(agentId);
      if (!refs) return;
      leaveGate(agentId);

      switch (anim.state) {
        case 'walk_to_coffee': {
          const qIdx = coffeeQueue.indexOf(agentId);
          if (qIdx === 0) {
            // Berada di Slot 0 (Depan Mesin Espresso) — Mulai Menyeduh!
            anim.state = 'brewing';
            anim.stateTime = 0;
            anim.stateDuration = rand(3.5, 5);
            anim.bubbleText = pick(COFFEE_ROUTINE_DIALOGUES.brewing);
            anim.bubbleTimer = 3.5;
            refs.avatar.position.set(COFFEE_QUEUE_SPOTS[0]!.x, 0, COFFEE_QUEUE_SPOTS[0]!.z);
            refs.avatar.rotation.y = Math.PI; // Menghadap mesin barista
            refs.leftLegPivot.rotation.set(0, 0, 0);
            refs.rightLegPivot.rotation.set(0, 0, 0);
          } else if (qIdx > 0) {
            // Ada yang sedang memakai mesin — Masuk ke Antrean Rapi!
            anim.state = 'waiting_in_queue';
            anim.stateTime = 0;
            anim.bubbleText = pick(COFFEE_ROUTINE_DIALOGUES.waiting_in_queue);
            anim.bubbleTimer = 3.0;
            const spot = COFFEE_QUEUE_SPOTS[Math.min(qIdx, COFFEE_QUEUE_SPOTS.length - 1)]!;
            refs.avatar.position.set(spot.x, 0, spot.z);
            refs.avatar.rotation.y = Math.PI; // Menghadap ke arah depan antrean
            refs.leftLegPivot.rotation.set(0, 0, 0);
            refs.rightLegPivot.rotation.set(0, 0, 0);
          }
          break;
        }

        case 'walk_to_desk': {
          anim.state = 'drinking';
          anim.stateTime = 0;
          anim.stateDuration = rand(12, 18);
          anim.bubbleText = pick(COFFEE_ROUTINE_DIALOGUES.sipping_at_desk);
          anim.bubbleTimer = 3.5;
          sitAtDesk(refs);
          break;
        }

        case 'walk_to_trash': {
          anim.state = 'disposing';
          anim.stateTime = 0;
          anim.stateDuration = 2.0;
          anim.bubbleText = pick(COFFEE_ROUTINE_DIALOGUES.disposing);
          anim.bubbleTimer = 2.5;
          refs.avatar.position.set(TRASH_STAND.x, 0, TRASH_STAND.z);
          refs.avatar.rotation.y = 0; // Menghadap tong sampah (+Z)
          refs.leftLegPivot.rotation.set(0, 0, 0);
          refs.rightLegPivot.rotation.set(0, 0, 0);
          break;
        }

        case 'walk_from_trash':
        case 'walk_from_visit':
        case 'walk_from_meeting':
        case 'walk_back_to_desk': {
          if (anim.state === 'walk_from_meeting') releaseSeat(agentId, anim);
          anim.state = 'working';
          anim.stateTime = 0;
          anim.hasDoc = false;
          anim.visitTarget = undefined;
          refs.doc.visible = false;
          sitAtDesk(refs);
          // Kunjungan berikutnya yang mengantre
          const next = visitQueue.get(agentId)?.shift();
          if (next) startVisit(agentId, next.to, next.text, next.carryDoc);
          break;
        }

        case 'walk_to_visit': {
          anim.state = 'visiting';
          anim.stateTime = 0;
          anim.stateDuration = VISIT_STAY_S;
          const target = anim.visitTarget ? meshMap.get(anim.visitTarget) : undefined;
          const last = anim.walkPath[anim.walkPath.length - 1];
          if (last) refs.avatar.position.set(last.x, 0, last.z);
          if (target) {
            refs.avatar.rotation.y = Math.atan2(
              target.sitPos.x - refs.avatar.position.x,
              target.sitPos.z - refs.avatar.position.z,
            );
            // Rekan yang dikunjungi menjawab singkat
            const tAnim = anim.visitTarget ? animMap.get(anim.visitTarget) : undefined;
            if (tAnim && anim.visitTarget && tAnim.state === 'working') {
              dlgQueue.push({ agentId: anim.visitTarget, text: pick(VISIT_ACKS), showAt: globalTime + 1.2, dur: 2.6 });
            }
          }
          refs.leftLegPivot.rotation.set(0, 0, 0);
          refs.rightLegPivot.rotation.set(0, 0, 0);
          break;
        }

        case 'walk_to_meeting': {
          // Tiba di belakang kursi: tarik kursi, duduk, dorong ke meja.
          anim.state = 'meeting_sitting';
          anim.stateTime = 0;
          if (anim.meetingSeat !== undefined) {
            const a = board.approachWorld(anim.meetingSeat);
            refs.avatar.position.set(a.x, 0, a.z);
            refs.avatar.rotation.y = board.seatYaw(anim.meetingSeat);
          }
          refs.leftLegPivot.rotation.set(0, 0, 0);
          refs.rightLegPivot.rotation.set(0, 0, 0);
          break;
        }
      }
    };

    // ================================================================
    // EVENT LIVE DARI SERVER (bicara, kunjungan meja, rapat)
    // ================================================================
    const handleStageEvent = (ev: StageEvent) => {
      if (ev.kind === 'say') {
        const anim = animMap.get(ev.agentId);
        if (anim) {
          anim.bubbleText = clipText(ev.text);
          anim.bubbleTimer = 5.5;
        }
        return;
      }

      if (ev.kind === 'visit') {
        const anim = animMap.get(ev.from);
        if (!anim || statusOf(ev.from) === 'offline') return;
        // Masih rehat kopi -> pulang dulu ke meja, kunjungan dijalankan setibanya di kursi.
        if (COFFEE_STATES.has(anim.state)) recallToDesk(ev.from);
        if (anim.state === 'working') {
          startVisit(ev.from, ev.to, ev.text, ev.carryDoc);
        } else if (
          RETURNING_STATES.has(anim.state) ||
          anim.state === 'walk_to_visit' ||
          anim.state === 'visiting'
        ) {
          const q = visitQueue.get(ev.from) ?? [];
          if (q.length < 3) q.push({ to: ev.to, text: ev.text, carryDoc: ev.carryDoc });
          visitQueue.set(ev.from, q);
          anim.bubbleText = clipText(ev.text, 90);
          anim.bubbleTimer = 3.0;
        } else {
          anim.bubbleText = clipText(ev.text, 90);
          anim.bubbleTimer = 4.0;
        }
        return;
      }

      // Rapat: semua yang hadir menuju ruang rapat
      startMeeting(ev.host, ev.text);
    };

    const lastStatus = new Map<string, AgentStatus>();
    const tempVec = new THREE.Vector3();

    // ================================================================
    // SIMULASI (satu langkah waktu) — dipisah dari render
    // ================================================================
    const step = (dt: number) => {
      globalTime += dt;

      // Update monitor animated canvas setiap ~0.25 detik
      if (globalTime - lastCodeUpdate > 0.25) {
        lastCodeUpdate = globalTime;
        codeScrollOffset = (codeScrollOffset + 1) % sampleLines.length;
        renderCodeTexture();
      }

      const sel = selectedRef.current;
      const isLive = liveRef.current;

      // ---------- Event live dari server (bicara, kunjungan meja, rapat) ----------
      while (pendingStageRef.current.length > 0) {
        handleStageEvent(pendingStageRef.current.shift()!);
      }

      // ---------- Transisi status agen sebenarnya ----------
      if (isLive) {
        for (const ag of agentsRef.current) {
          const anim = animMap.get(ag.id);
          if (!anim) continue;
          const prev = lastStatus.get(ag.id);
          if (prev !== ag.status) {
            lastStatus.set(ag.id, ag.status);
            const line = LIVE_STATUS_LINES[ag.status];
            if (line && prev !== undefined) {
              anim.bubbleText = pick(line);
              anim.bubbleTimer = 4.0;
            }
          }
          // Pekerjaan nyata masuk saat sedang rehat kopi -> kembali ke meja
          if (ag.status !== 'idle' && ag.status !== 'meeting' && COFFEE_STATES.has(anim.state)) {
            recallToDesk(ag.id, ag.status === 'waiting_approval' ? 'Eh, ada yang butuh izin CEO!' : 'Ada tugas masuk, balik ke meja!');
          }
          // Tangan terangkat terus diingatkan selama menunggu izin
          if (ag.status === 'waiting_approval' && anim.bubbleTimer <= 0 && atDesk(anim)) {
            anim.bubbleText = pick(LIVE_STATUS_LINES.waiting_approval ?? ['Menunggu izin CEO']);
            anim.bubbleTimer = 3.5;
          }
        }
      } else if (lastStatus.size > 0) {
        lastStatus.clear();
      }

      updateMeeting();

      /** Live: hanya agen yang benar-benar santai boleh ikut rutinitas kopi/obrolan. */
      const ambientOk = (id: string) => {
        const st = statusOf(id);
        return st === null || st === 'idle' || st === 'meeting';
      };

      // ---------- Scheduler: Jadwalkan Karyawan Rehat Kopi (Antrean Teratur) ----------
      if (globalTime >= nextCoffeeT) {
        const candidates: string[] = [];
        for (const [id, a] of animMap) {
          if (a.state === 'working' && !coffeeQueue.includes(id) && ambientOk(id)) {
            candidates.push(id);
          }
        }
        // Maksimal 3 orang dalam antrean kopi pada saat yang sama
        if (candidates.length > 0 && coffeeQueue.length < 3) {
          const luckyId = pick(candidates);
          const a = animMap.get(luckyId)!;
          const refs = meshMap.get(luckyId);
          if (refs) {
            coffeeQueue.push(luckyId);
            const qIdx = coffeeQueue.indexOf(luckyId);
            const destSpot = COFFEE_QUEUE_SPOTS[Math.min(qIdx, COFFEE_QUEUE_SPOTS.length - 1)]!;
            a.state = 'walk_to_coffee';
            a.stateTime = 0;
            setWalk(luckyId, a, walkPath(deskPos(refs), destSpot));
            a.bubbleText = qIdx === 0
              ? 'Waktunya rehat kopi sebentar!'
              : pick(COFFEE_ROUTINE_DIALOGUES.waiting_in_queue);
            a.bubbleTimer = 3.0;
          }
        }
        nextCoffeeT = globalTime + rand(COFFEE_MIN_S, COFFEE_MAX_S);
      }

      // ---------- Scheduler: Percakapan Berbalas Antar Agen ----------
      if (globalTime >= nextConvoT) {
        const convo = pick(OFFICE_CONVERSATIONS);
        const ok = convo.dialogues.every((d) => {
          const a = animMap.get(d.speakerId);
          return a && (a.state === 'working' || a.state === 'drinking') && a.bubbleTimer <= 0 && ambientOk(d.speakerId);
        });
        if (ok) {
          let t = globalTime + 0.5;
          convo.dialogues.forEach((d) => {
            dlgQueue.push({ agentId: d.speakerId, text: d.text, showAt: t, dur: d.durationMs / 1000 });
            t += d.durationMs / 1000 + 0.3;
          });
        }
        nextConvoT = globalTime + rand(CONVO_MIN_S, CONVO_MAX_S);
      }

      // ---------- Scheduler: Gumaman Solo Saat Koding ----------
      if (globalTime >= nextThoughtT) {
        const cands: string[] = [];
        for (const [id, a] of animMap) {
          if (a.state === 'working' && a.bubbleTimer <= 0 && ambientOk(id)) cands.push(id);
        }
        if (cands.length > 0) {
          const id = pick(cands);
          const thoughts = AGENT_SOLO_THOUGHTS[id];
          if (thoughts && thoughts.length > 0) {
            const a = animMap.get(id)!;
            a.bubbleText = pick(thoughts);
            a.bubbleTimer = 4.0;
          }
        }
        nextThoughtT = globalTime + rand(THOUGHT_MIN_S, THOUGHT_MAX_S);
      }

      // ---------- Proses Antrian Dialog ----------
      for (let i = dlgQueue.length - 1; i >= 0; i--) {
        const dq = dlgQueue[i]!;
        if (globalTime >= dq.showAt) {
          const a = animMap.get(dq.agentId);
          // Ucapan live yang masih tampil tidak ditimpa obrolan template
          if (a && (a.bubbleTimer <= 0.5 || !isLive)) { a.bubbleText = dq.text; a.bubbleTimer = dq.dur; }
          dlgQueue.splice(i, 1);
        }
      }

      // ---------- Dynamic Collision Avoidance Antara Agen yang Sedang Berjalan ----------
      const movingAgents: string[] = [];
      for (const [id, a] of animMap) {
        if (a.state.startsWith('walk')) movingAgents.push(id);
      }
      for (let i = 0; i < movingAgents.length; i++) {
        for (let j = i + 1; j < movingAgents.length; j++) {
          const rA = meshMap.get(movingAgents[i]!);
          const rB = meshMap.get(movingAgents[j]!);
          if (!rA || !rB) continue;
          const dx = rA.avatar.position.x - rB.avatar.position.x;
          const dz = rA.avatar.position.z - rB.avatar.position.z;
          const distSq = dx * dx + dz * dz;
          if (distSq < 0.45 && distSq > 0.0001) {
            const d = Math.sqrt(distSq);
            const push = (0.67 - d) * 0.12;
            const nx = (dx / d) * push;
            const nz = (dz / d) * push;
            rA.avatar.position.x += nx;
            rA.avatar.position.z += nz;
            rB.avatar.position.x -= nx;
            rB.avatar.position.z -= nz;
          }
        }
      }

      // ---------- Update Setiap Agen ----------
      for (const [agentId, anim] of animMap) {
        const refs = meshMap.get(agentId);
        if (!refs) continue;

        anim.stateTime += dt;
        if (anim.bubbleTimer > 0) anim.bubbleTimer -= dt;
        if (anim.bubbleTimer <= 0) anim.bubbleText = null;

        const isSelected = agentId === sel;

        // Selection ring
        (refs.selRing.material as THREE.MeshBasicMaterial).opacity = isSelected ? 0.75 : 0;

        // Beacon melayang di atas kepala
        const bData = refs.beacon.userData;
        refs.beacon.position.y = (bData.baseY || 0.92) + Math.sin(globalTime * 2 + (bData.offset || 0)) * 0.04;
        refs.beacon.rotation.y += 0.025;
        (refs.beacon.material as THREE.MeshStandardMaterial).emissiveIntensity = isSelected ? 1.8 : 0.9;

        // Screen Glow flicker & intensitas
        refs.screenGlow.intensity = isSelected ? 3.0 : 1.8 + Math.sin(globalTime * 4 + (bData.offset || 0)) * 0.3;

        // ---------- Visual mengikuti status asli (live) ----------
        const status = statusOf(agentId);
        const beaconMat = refs.beacon.material as THREE.MeshStandardMaterial;
        const away = status === 'offline' && (anim.state === 'working' || anim.state === 'drinking');
        refs.avatar.visible = !away;
        if (status !== null) {
          const look = STATUS_LOOK[status];
          if (refs.screenMat) {
            refs.screenMat.emissive.setHex(look.screen);
            refs.screenMat.emissiveIntensity = look.screenIntensity;
          }
          refs.screenGlow.intensity *= look.glow;
          if (look.beacon !== null) {
            beaconMat.emissive.setHex(look.beacon);
            beaconMat.color.setHex(look.beacon);
          } else {
            beaconMat.emissive.set(beaconMat.userData.baseColor ?? beaconMat.color);
            beaconMat.color.set(beaconMat.userData.baseColor ?? beaconMat.color);
          }
          const pulse = status === 'waiting_approval' || status === 'error' ? 0.6 + Math.abs(Math.sin(globalTime * 4)) * 1.6 : 1;
          beaconMat.emissiveIntensity = (isSelected ? 1.8 : look.beaconIntensity) * pulse;
          refs.beacon.rotation.y += status === 'thinking' || status === 'working' ? 0.06 : 0;
        } else {
          if (refs.screenMat) {
            refs.screenMat.emissive.setHex(0xffffff);
            refs.screenMat.emissiveIntensity = 2.2;
          }
          if (beaconMat.userData.baseColor) {
            beaconMat.emissive.set(beaconMat.userData.baseColor);
            beaconMat.color.set(beaconMat.userData.baseColor);
          }
        }

        switch (anim.state) {
          case 'working': {
            // Duduk sempurna di kursi menghadap ke keyboard dan monitor
            sitAtDesk(refs);
            refs.cup.visible = false;
            refs.doc.visible = false;

            const phase = globalTime * 16 + (bData.offset || 0);
            if (status === 'waiting_approval') {
              // Angkat tangan memanggil CEO, tangan kiri tetap di keyboard
              refs.rightArmPivot.rotation.set(-2.85, 0, -0.15 + Math.sin(globalTime * 6) * 0.18);
              refs.leftArmPivot.rotation.set(-0.95, 0, 0.18);
            } else if (status === 'error') {
              // Bingung: garuk kepala
              refs.rightArmPivot.rotation.set(-2.45 + Math.sin(globalTime * 7) * 0.08, 0, 0.55);
              refs.leftArmPivot.rotation.set(-0.6, 0, 0.12);
            } else if (status === 'idle' || status === 'meeting' || status === 'offline') {
              // Santai bersandar, tangan di pangkuan
              refs.leftArmPivot.rotation.set(-0.5 + Math.sin(globalTime * 1.2 + (bData.offset || 0)) * 0.04, 0, 0.12);
              refs.rightArmPivot.rotation.set(-0.5 + Math.cos(globalTime * 1.2 + (bData.offset || 0)) * 0.04, 0, -0.12);
            } else {
              // Mengetik aktif bergantian tepat di atas keyboard (thinking/working/messaging, juga mode demo)
              const speed = status === 'thinking' ? 0.55 : 1;
              refs.leftArmPivot.rotation.set(-0.95 + Math.sin(phase * speed) * 0.12, 0, 0.18);
              refs.rightArmPivot.rotation.set(-0.95 + Math.cos(phase * 1.2 * speed) * 0.12, 0, -0.18);
            }

            // Efek bernapas halus
            refs.avatar.position.y = refs.sitPos.y + Math.sin(globalTime * 2.5 + (bData.offset || 0)) * 0.005;
            break;
          }

          case 'meeting_called': {
            // Menyimpan pekerjaan sebentar sebelum berangkat (jeda bertahap)
            sitAtDesk(refs);
            refs.leftArmPivot.rotation.set(-0.5, 0, 0.12);
            refs.rightArmPivot.rotation.set(-0.5, 0, -0.12);
            if (globalTime >= (anim.departAt ?? 0) && anim.meetingSeat !== undefined) {
              walkToSeat(agentId, anim, refs);
            }
            break;
          }

          case 'meeting_sitting': {
            const i = anim.meetingSeat;
            if (i === undefined) { anim.state = 'walk_from_meeting'; setWalk(agentId, anim, walkPath(currentPos(refs), deskPos(refs))); break; }
            const rig = board.rigs[i]!;
            const yaw = board.seatYaw(i);
            const appr = board.approachWorld(i);
            refs.leftArmPivot.rotation.set(-0.2, 0, 0.1);
            refs.rightArmPivot.rotation.set(-0.2, 0, -0.1);
            if (anim.stateTime < 0.45) {
              // Tarik kursi keluar
              rig.pullTarget = 1;
              refs.avatar.position.set(appr.x, 0, appr.z);
              refs.avatar.rotation.y = yaw;
              refs.leftLegPivot.rotation.set(0, 0, 0);
              refs.rightLegPivot.rotation.set(0, 0, 0);
            } else if (anim.stateTime < 0.85) {
              // Melangkah ke kursi & duduk
              const k = smoothstep((anim.stateTime - 0.45) / 0.4);
              const seat = board.seatWorld(i, rig.pull);
              refs.avatar.position.set(appr.x + (seat.x - appr.x) * k, seat.y * k, appr.z + (seat.z - appr.z) * k);
              refs.avatar.rotation.y = yaw;
              refs.leftLegPivot.rotation.set(SEATED_LEG * k, 0, 0);
              refs.rightLegPivot.rotation.set(SEATED_LEG * k, 0, 0);
            } else {
              // Dorong kursi ke meja bersama agen
              rig.pullTarget = 0;
              const seat = board.seatWorld(i, rig.pull);
              refs.avatar.position.copy(seat);
              refs.avatar.rotation.y = yaw + rig.swivelAngle;
              refs.leftLegPivot.rotation.set(SEATED_LEG, 0, 0);
              refs.rightLegPivot.rotation.set(SEATED_LEG, 0, 0);
              if (rig.pull <= 0.001) {
                anim.state = 'in_meeting';
                anim.stateTime = 0;
              }
            }
            break;
          }

          case 'in_meeting': {
            const i = anim.meetingSeat;
            if (i !== undefined) {
              const rig = board.rigs[i]!;
              refs.avatar.position.copy(board.seatWorld(i, rig.pull));
              refs.avatar.position.y += Math.sin(globalTime * 2.5 + (bData.offset || 0)) * 0.005;
              refs.avatar.rotation.y = board.seatYaw(i) + rig.swivelAngle;
            }
            refs.leftLegPivot.rotation.set(SEATED_LEG, 0, 0);
            refs.rightLegPivot.rotation.set(SEATED_LEG, 0, 0);
            const talking = anim.bubbleTimer > 0;
            refs.leftArmPivot.rotation.set(talking ? -0.6 + Math.sin(globalTime * 4) * 0.2 : -0.45, 0, 0.1);
            refs.rightArmPivot.rotation.set(talking ? -0.7 + Math.cos(globalTime * 3.5) * 0.2 : -0.45, 0, -0.1);
            if ((!meeting || meeting.phase === 'dispersing') && globalTime >= (anim.departAt ?? 0)) {
              anim.state = 'meeting_standing';
              anim.stateTime = 0;
              anim.subT = -1;
            }
            break;
          }

          case 'meeting_standing': {
            const i = anim.meetingSeat;
            if (i === undefined) { anim.state = 'walk_from_meeting'; setWalk(agentId, anim, walkPath(currentPos(refs), deskPos(refs))); break; }
            const rig = board.rigs[i]!;
            const yaw = board.seatYaw(i);
            const appr = board.approachWorld(i);
            rig.swivelTarget = 0;
            refs.leftArmPivot.rotation.set(-0.2, 0, 0.1);
            refs.rightArmPivot.rotation.set(-0.2, 0, -0.1);
            if ((anim.subT ?? -1) < 0) {
              // Tarik kursi keluar bersama agen
              rig.pullTarget = 1;
              refs.avatar.position.copy(board.seatWorld(i, rig.pull));
              refs.avatar.rotation.y = yaw + rig.swivelAngle;
              refs.leftLegPivot.rotation.set(SEATED_LEG, 0, 0);
              refs.rightLegPivot.rotation.set(SEATED_LEG, 0, 0);
              if (rig.pull >= 0.999) anim.subT = anim.stateTime;
            } else {
              // Berdiri & mundur ke belakang kursi
              const k = smoothstep((anim.stateTime - anim.subT!) / 0.4);
              const seat = board.seatWorld(i, 1);
              refs.avatar.position.set(seat.x + (appr.x - seat.x) * k, seat.y * (1 - k), seat.z + (appr.z - seat.z) * k);
              refs.avatar.rotation.y = yaw;
              refs.leftLegPivot.rotation.set(SEATED_LEG * (1 - k), 0, 0);
              refs.rightLegPivot.rotation.set(SEATED_LEG * (1 - k), 0, 0);
              if (k >= 1) {
                rig.pullTarget = 0;
                anim.stateTime = 0;
                if (meeting && meeting.phase !== 'dispersing') {
                  // Rapat baru dipanggil saat sedang bubar: duduk kembali.
                  anim.state = 'meeting_sitting';
                } else {
                  anim.state = 'walk_from_meeting';
                  setWalk(agentId, anim, walkPath(appr, deskPos(refs)));
                }
              }
            }
            break;
          }

          case 'visiting': {
            // Berdiri di meja rekan sambil menjelaskan / menyerahkan dokumen
            refs.leftLegPivot.rotation.set(0, 0, 0);
            refs.rightLegPivot.rotation.set(0, 0, 0);
            refs.doc.visible = anim.hasDoc && anim.stateTime < VISIT_STAY_S * 0.6;
            refs.leftArmPivot.rotation.set(anim.hasDoc ? -1.1 : -0.3, 0, 0.1);
            refs.rightArmPivot.rotation.set(-0.5 + Math.sin(globalTime * 5) * 0.25, 0, -0.15);
            if (anim.stateTime > anim.stateDuration) {
              anim.hasDoc = false;
              refs.doc.visible = false;
              anim.state = 'walk_from_visit';
              anim.stateTime = 0;
              setWalk(agentId, anim, walkPath(currentPos(refs), deskPos(refs)));
            }
            break;
          }

          case 'waiting_in_queue': {
            // Berdiri tertib di dalam barisan antrean menghadap ke mesin kopi
            const qIdx = coffeeQueue.indexOf(agentId);
            const spot = COFFEE_QUEUE_SPOTS[Math.min(qIdx, COFFEE_QUEUE_SPOTS.length - 1)]!;
            refs.avatar.position.set(spot.x, 0, spot.z);
            refs.avatar.rotation.y = Math.PI;
            refs.leftLegPivot.rotation.set(0, 0, 0);
            refs.rightLegPivot.rotation.set(0, 0, 0);

            // Gerakan santai menunggu antrean
            refs.leftArmPivot.rotation.set(-0.2 + Math.sin(globalTime * 1.5) * 0.05, 0, 0.08);
            refs.rightArmPivot.rotation.set(-0.2 + Math.cos(globalTime * 1.5) * 0.05, 0, -0.08);
            refs.cup.visible = false;
            break;
          }

          case 'brewing': {
            // Berdiri di depan mesin barista (Slot 0)
            refs.avatar.position.set(COFFEE_QUEUE_SPOTS[0]!.x, 0, COFFEE_QUEUE_SPOTS[0]!.z);
            refs.avatar.rotation.y = Math.PI;
            refs.leftLegPivot.rotation.set(0, 0, 0);
            refs.rightLegPivot.rotation.set(0, 0, 0);

            // Gestur meracik kopi di mesin
            refs.leftArmPivot.rotation.set(-0.8 + Math.sin(globalTime * 3) * 0.18, 0, 0.25);
            refs.rightArmPivot.rotation.set(-0.6 + Math.cos(globalTime * 2.5) * 0.15, 0, -0.25);
            refs.cup.visible = anim.stateTime > anim.stateDuration * 0.65;

            // Selesai menyeduh -> Tinggalkan antrean dan bawa kopi ke meja
            if (anim.stateTime > anim.stateDuration) {
              anim.hasCup = true;
              refs.cup.visible = true;

              // Keluarkan dari antrean Slot 0
              coffeeQueue.shift();

              // Majukan agen berikutnya dalam antrean!
              coffeeQueue.forEach((waitingId, newIdx) => {
                const wAnim = animMap.get(waitingId);
                const wRefs = meshMap.get(waitingId);
                if (wAnim && wRefs) {
                  const nextSpot = COFFEE_QUEUE_SPOTS[Math.min(newIdx, COFFEE_QUEUE_SPOTS.length - 1)]!;
                  wAnim.state = 'walk_to_coffee';
                  setWalk(waitingId, wAnim, [currentPos(wRefs), nextSpot]);
                }
              });

              // Jalan kembali ke meja masing-masing via koridor aman
              anim.state = 'walk_to_desk';
              anim.stateTime = 0;
              setWalk(agentId, anim, walkPath(COFFEE_QUEUE_SPOTS[0]!, deskPos(refs)));
              anim.bubbleText = pick(COFFEE_ROUTINE_DIALOGUES.walking_with_coffee);
              anim.bubbleTimer = 3.0;
            }
            break;
          }

          case 'drinking': {
            sitAtDesk(refs);
            refs.cup.visible = true;

            // Siklus minum kopi: sesekali angkat cangkir ke bibir, selebihnya mengetik satu tangan
            const sipCycle = (globalTime * 0.8 + (bData.offset || 0)) % (Math.PI * 2);
            const isSipping = Math.sin(sipCycle) > 0.6;

            if (isSipping) {
              refs.rightArmPivot.rotation.set(-1.45, 0, -0.15); // Angkat cangkir ke bibir
              refs.leftArmPivot.rotation.set(-0.5, 0, 0.1);
            } else {
              // Mengetik satu tangan, cangkir di tangan kanan istirahat di meja
              refs.rightArmPivot.rotation.set(-0.7, 0, -0.2);
              const phase = globalTime * 14;
              refs.leftArmPivot.rotation.set(-0.95 + Math.sin(phase) * 0.12, 0, 0.18);
            }

            // Kopi habis -> Berjalan ke tempat sampah via koridor aman
            if (anim.stateTime > anim.stateDuration) {
              anim.state = 'walk_to_trash';
              anim.stateTime = 0;
              setWalk(agentId, anim, walkPath(deskPos(refs), TRASH_STAND));
              anim.bubbleText = 'Kopi habis! Saatnya buang ke tempat sampah.';
              anim.bubbleTimer = 2.5;
            }
            break;
          }

          case 'disposing': {
            // Berdiri di depan tempat sampah
            refs.avatar.position.set(TRASH_STAND.x, 0, TRASH_STAND.z);
            refs.avatar.rotation.y = 0;
            refs.leftLegPivot.rotation.set(0, 0, 0);
            refs.rightLegPivot.rotation.set(0, 0, 0);

            // Tangan kanan mengayun ke arah tempat sampah lalu cup hilang
            refs.rightArmPivot.rotation.set(-0.8 + Math.sin(anim.stateTime * 5) * 0.2, 0, -0.2);
            if (anim.stateTime > 0.8) {
              anim.hasCup = false;
              refs.cup.visible = false;
            }

            if (anim.stateTime > anim.stateDuration) {
              anim.state = 'walk_from_trash';
              anim.stateTime = 0;
              setWalk(agentId, anim, walkPath(TRASH_STAND, deskPos(refs)));
            }
            break;
          }

          case 'walk_to_coffee':
          case 'walk_to_desk':
          case 'walk_to_trash':
          case 'walk_from_trash':
          case 'walk_to_visit':
          case 'walk_from_visit':
          case 'walk_to_meeting':
          case 'walk_from_meeting':
          case 'walk_back_to_desk': {
            refs.cup.visible = anim.hasCup;
            refs.doc.visible = anim.hasDoc;

            const seg = anim.walkPath[anim.walkSeg];
            const next = anim.walkPath[anim.walkSeg + 1];

            if (!seg || !next) {
              handleArrival(agentId, anim);
              break;
            }

            // Door mutex: tunggu giliran melewati pintu ruang rapat
            if (seg.gate && anim.gateSeg !== anim.walkSeg) {
              if (!passGate(agentId, seg.gate)) {
                const qi = Math.max(0, gateOf(seg.gate).waiting.indexOf(agentId));
                const prev = anim.walkPath[anim.walkSeg - 1] ?? seg;
                const ddx = seg.x - prev.x, ddz = seg.z - prev.z;
                const dl = Math.hypot(ddx, ddz) || 1;
                refs.avatar.position.set(seg.x - (ddx / dl) * 0.75 * qi, 0, seg.z - (ddz / dl) * 0.75 * qi);
                refs.avatar.rotation.y = Math.atan2(next.x - seg.x, next.z - seg.z);
                refs.leftLegPivot.rotation.set(0, 0, 0);
                refs.rightLegPivot.rotation.set(0, 0, 0);
                refs.leftArmPivot.rotation.set(-0.15, 0, 0.08);
                refs.rightArmPivot.rotation.set(-0.15, 0, -0.08);
                break;
              }
              anim.gateSeg = anim.walkSeg;
            }

            const sLen = segLen(seg, next);
            if (sLen < 0.01) { anim.walkSeg++; anim.walkT = 0; break; }

            anim.walkT += (WALK_SPEED * dt) / sLen;

            let t = anim.walkT;
            if (anim.walkT >= 1) {
              // Tetap di UJUNG segmen yang baru selesai pada frame ini (tidak melompat balik di belokan).
              t = 1;
              anim.walkT = 0;
              anim.walkSeg++;
              if (anim.walkSeg >= anim.walkPath.length - 1) {
                handleArrival(agentId, anim);
                break;
              }
            }
            const wx = seg.x + (next.x - seg.x) * t;
            const wz = seg.z + (next.z - seg.z) * t;
            const bob = Math.abs(Math.sin(anim.stateTime * 10)) * 0.04;
            refs.avatar.position.set(wx, bob, wz);

            const dx = next.x - seg.x, dz = next.z - seg.z;
            if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
              refs.avatar.rotation.y = Math.atan2(dx, dz);
            }

            // Langkah kaki berayun bolak-balik
            const legSwing = Math.sin(anim.stateTime * 10) * 0.55;
            refs.leftLegPivot.rotation.set(legSwing, 0, 0);
            refs.rightLegPivot.rotation.set(-legSwing, 0, 0);

            // Ayunan lengan
            if (anim.hasDoc) {
              refs.leftArmPivot.rotation.set(-1.0, 0, 0.1);
              refs.rightArmPivot.rotation.set(-legSwing * 0.7, 0, -0.08);
            } else if (anim.hasCup) {
              refs.rightArmPivot.rotation.set(-0.65, 0, -0.1);
              refs.leftArmPivot.rotation.set(legSwing * 0.7, 0, 0.08);
            } else {
              refs.leftArmPivot.rotation.set(legSwing * 0.7, 0, 0.08);
              refs.rightArmPivot.rotation.set(-legSwing * 0.7, 0, -0.08);
            }
            break;
          }
        }
      }

      main.update(globalTime);
      board.update(dt);
    };

    // ================================================================
    // RENDER (kamera aktif, auto-fade dinding, proyeksi speech bubble)
    // ================================================================
    const renderFrame = (dt: number) => {
      cam.update(dt);
      const camera = cam.active();
      fader.update(camera, dt);

      const bc = bubbleRef.current;
      if (bc && container) {
        const cw = container.clientWidth;
        const ch = container.clientHeight;

        for (const [agentId, anim] of animMap) {
          const el = bc.querySelector(`[data-agent="${agentId}"]`) as HTMLElement | null;
          if (!el) continue;

          const refs = meshMap.get(agentId);
          let shown = false;
          if (refs && anim.bubbleText && anim.bubbleTimer > 0 && refs.avatar.visible) {
            tempVec.setFromMatrixPosition(refs.avatar.matrixWorld);
            tempVec.y += 1.05;
            tempVec.project(camera);
            // Di belakang kamera Free Cam: jangan tampilkan bubble
            if (tempVec.z >= -1 && tempVec.z <= 1) {
              const sx = (tempVec.x * 0.5 + 0.5) * cw;
              const sy = (-tempVec.y * 0.5 + 0.5) * ch;
              el.style.display = 'block';
              el.style.left = `${sx}px`;
              el.style.top = `${sy}px`;
              el.style.opacity = String(Math.min(1, anim.bubbleTimer / 0.4));
              const txtEl = el.querySelector('[data-text]') as HTMLElement | null;
              if (txtEl) txtEl.textContent = anim.bubbleText;
              shown = true;
            }
          }
          if (!shown) el.style.display = 'none';
        }
      }

      renderer.render(scene, camera);
    };

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.1);
      step(dt);
      renderFrame(dt);
    };

    // ================================================================
    // API UNTUK TOMBOL HUD
    // ================================================================
    const workspaceFocus = () => {
      const v = main.group.localToWorld(new THREE.Vector3(0, 0, 0));
      return v.setY(ISO_FOCUS_HEIGHT);
    };
    apiRef.current = {
      focusRoom: (room) => cam.focus(room === 'workspace' ? workspaceFocus() : board.focusPoint()),
      toggleCamera: () => cam.toggle(),
      resetCamera: () => cam.reset(),
      focusAgent: (agentId) => {
        const refs = meshMap.get(agentId);
        if (!refs) return;
        cam.focus(new THREE.Vector3(refs.avatar.position.x, 0.8, refs.avatar.position.z));
      },
    };

    // Hook diagnostik khusus dev server (tidak ikut ke build produksi).
    const win = window as unknown as Record<string, unknown>;
    if (import.meta.env.DEV) {
      win.__officeStage = () =>
        Array.from(animMap.entries()).map(([id, a]) => {
          const r = meshMap.get(id);
          return {
            id,
            state: a.state,
            seg: `${a.walkSeg}/${a.walkPath.length}`,
            pos: r ? `${r.avatar.position.x.toFixed(2)},${r.avatar.position.z.toFixed(2)}` : '',
            rotDeg: r ? Math.round((r.avatar.rotation.y * 180) / Math.PI) : 0,
            seat: a.meetingSeat !== undefined ? BOARDROOM_SEATS[a.meetingSeat]!.id : '',
            queue: visitQueue.get(id)?.length ?? 0,
            bubble: a.bubbleTimer > 0 ? (a.bubbleText ?? '').slice(0, 30) : '',
          };
        });
      win.__officeStageDebug = {
        /** Picu rapat seperti event `/rapat` dari server. */
        meeting: (host = 'raka', text = 'Evaluasi sprint & rencana ruang rapat') => startMeeting(host, text),
        /** Majukan simulasi N detik secara instan (render tidak ikut). */
        fastForward: (seconds: number) => {
          for (let s = 0; s < seconds; s += 0.05) step(0.05);
        },
        camera: (mode: CameraMode) => cam.setMode(mode),
        zoom: (z: number) => { cam.iso.zoom = z; cam.iso.updateProjectionMatrix(); },
        /** Putar kamera isometrik mengelilingi target (0° = arah bawaan tenggara). */
        orbit: (deg: number) => {
          const off = cam.iso.position.clone().sub(cam.controls.target);
          off.applyAxisAngle(new THREE.Vector3(0, 1, 0), (deg * Math.PI) / 180);
          cam.iso.position.copy(cam.controls.target).add(off);
          cam.controls.update();
        },
        cameraState: () => ({
          mode: cam.mode,
          iso: cam.iso.position.toArray().map((n) => +n.toFixed(2)),
          target: cam.controls.target.toArray().map((n) => +n.toFixed(2)),
          zoom: +cam.iso.zoom.toFixed(2),
          persp: cam.persp.position.toArray().map((n) => +n.toFixed(2)),
        }),
        focus: (room: 'workspace' | 'boardroom') => apiRef.current?.focusRoom(room),
        look: (x: number, z: number) => cam.focus(new THREE.Vector3(x, ISO_FOCUS_HEIGHT, z), { dur: 0.1 }),
        meetingState: () => (meeting ? { ...meeting, attendees: [...meeting.attendees] } : null),
        path: (from: Pt, to: Pt) => walkPath(from, to),
      };
    }

    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(animId);
      apiRef.current = null;
      if (import.meta.env.DEV) {
        delete win.__officeStage;
        delete win.__officeStageDebug;
      }
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      cam.dispose();
      // Lepaskan memori GPU (geometri, material, tekstur) agar remount/HMR tidak bocor.
      disposeObject(scene);
      for (const tpl of templates.values()) {
        if (tpl.scene) disposeObject(tpl.scene);
      }
      scene.environment?.dispose();
      renderer.dispose();
      codeTexture.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      const bc = bubbleRef.current;
      if (bc) while (bc.firstChild) bc.removeChild(bc.firstChild);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const t = (id: string, en: string) => (language === 'id' ? id : en);
  const hudButton: React.CSSProperties = { padding: '4px 10px', minHeight: 28, fontSize: 12 };

  return (
    <section
      aria-label={t('Panggung Ruang Kantor 3D Three.js', '3D Three.js Office Stage')}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--color-paper)',
        borderRight: '1px solid var(--color-rule)',
        overflow: 'hidden',
        height: '100%',
      }}
    >
      {/* Top HUD Bar */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 8,
          padding: '10px 16px',
          borderBottom: '1px solid var(--color-rule)',
          background: 'var(--color-paper-2)',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 14 }}>
            {t('Ruang Kantor 3D (Three.js WebGL Diorama)', '3D Virtual Office (Three.js WebGL Diorama)')}
          </strong>
          <span className="mono" style={{ fontSize: 12, color: 'var(--color-muted)' }}>
            {t('Lantai 1 · Ruang Kerja 14×10 m + Ruang Rapat 8×8 m', 'Floor 1 · Workspace 14×10 m + Boardroom 8×8 m')}
          </span>
          {modelLoaded ? (
            <span className="chip mono" style={{ fontSize: 11, color: 'var(--color-ok)', borderColor: 'var(--color-ok)' }}>
              GLB Active
            </span>
          ) : loadError ? (
            <span className="chip mono" style={{ fontSize: 11, color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}>
              GLB Error
            </span>
          ) : (
            <span className="chip mono" style={{ fontSize: 11, color: 'var(--color-warn)', borderColor: 'var(--color-warn)' }}>
              Loading GLB...
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => apiRef.current?.focusRoom('workspace')}
            title={t('Arahkan kamera ke ruang kerja', 'Focus the workspace')}
            style={hudButton}
          >
            {t('Fokus: Ruang Kerja', 'Focus: Workspace')}
          </button>
          <button
            type="button"
            onClick={() => apiRef.current?.focusRoom('boardroom')}
            title={t('Arahkan kamera ke ruang rapat', 'Focus the boardroom')}
            style={hudButton}
          >
            {t('Fokus: Ruang Rapat', 'Focus: Boardroom')}
          </button>
          <button
            type="button"
            onClick={() => apiRef.current?.toggleCamera()}
            aria-pressed={camMode === 'free'}
            title={t('Ganti kamera isometrik ↔ Free Cam 3D', 'Toggle isometric ↔ Free Cam 3D')}
            style={{
              ...hudButton,
              borderColor: camMode === 'free' ? 'var(--color-focus)' : undefined,
              color: camMode === 'free' ? 'var(--color-focus)' : undefined,
            }}
          >
            {camMode === 'free' ? t('Kamera: Free Cam 3D', 'Camera: Free Cam 3D') : t('Kamera: Isometrik', 'Camera: Isometric')}
          </button>
          <button
            type="button"
            onClick={() => apiRef.current?.resetCamera()}
            title={t('Reset sudut kamera', 'Reset camera')}
            style={hudButton}
          >
            {t('Reset Kamera', 'Reset Camera')}
          </button>
          <button
            type="button"
            onClick={() => apiRef.current?.focusAgent(selectedAgentId)}
            title={t('Fokus ke agen terpilih', 'Focus selected agent')}
            style={{ ...hudButton, borderColor: 'var(--color-focus)', color: 'var(--color-focus)' }}
          >
            {t('Fokus Agen', 'Focus Agent')}
          </button>
        </div>
      </div>

      {/* Kontainer Kanvas 3D + Bubble Overlay */}
      <div
        ref={containerRef}
        style={{ flex: 1, width: '100%', height: '100%', position: 'relative', outline: 'none' }}
      >
        <div
          ref={bubbleRef}
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            pointerEvents: 'none',
            zIndex: 5,
            overflow: 'hidden',
          }}
        />
        {camMode === 'free' && (
          <div
            className="mono"
            style={{
              position: 'absolute', right: 16, top: 12, zIndex: 10,
              padding: '6px 10px', fontSize: 11,
              background: 'rgba(15, 26, 31, 0.85)',
              border: '1px solid var(--color-rule)', borderRadius: 6,
              color: 'var(--color-ink-2)', pointerEvents: 'none',
            }}
          >
            {t(
              'W A S D gerak · Q naik · E turun · Shift cepat · seret mouse untuk melihat',
              'W A S D move · Q up · E down · Shift fast · drag to look',
            )}
          </div>
        )}
      </div>

      {/* Floating Zone Legend */}
      <div
        style={{
          position: 'absolute',
          bottom: 14, left: 16,
          display: 'flex', gap: 12,
          padding: '8px 12px',
          background: 'rgba(15, 26, 31, 0.85)',
          backdropFilter: 'blur(8px)',
          border: '1px solid var(--color-rule)',
          borderRadius: 6,
          zIndex: 10,
          pointerEvents: 'none',
        }}
      >
        {OFFICE_ZONES.map((z) => (
          <span
            key={z.id}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--color-ink-2)' }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 8, height: 8,
                backgroundColor: z.accentColor,
                display: 'inline-block',
                borderRadius: 2,
              }}
            />
            <span>{language === 'id' ? z.labelId : z.labelEn}</span>
          </span>
        ))}
      </div>
    </section>
  );
}
