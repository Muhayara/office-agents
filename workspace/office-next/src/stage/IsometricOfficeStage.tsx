import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { type AgentStatus, type AgentView, type Lang } from '@office/shared';
import { OFFICE_ZONES } from '../isometric/coords';
import type { StageEvent } from '../state/liveOffice';
import {
  COFFEE_ROUTINE_DIALOGUES,
  OFFICE_CONVERSATIONS,
  AGENT_SOLO_THOUGHTS,
  LIVE_STATUS_LINES,
  MEETING_REPLIES,
  VISIT_ACKS,
} from './officeDialogues';

// ============================================================================
// Tipe & Penataan Ruang Kantor Profesional
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

/**
 * Tata Letak Meja Kantor Modern (Benching Pod System):
 * - Meja Eksekutif & QA di dinding utara menghadap ke seluruh ruangan.
 * - Pod Barat (Riset & Desain): 4 meja 2x2 berhadapan (Sari & Dimas vs Tari & Wulan).
 * - Pod Timur (Engineering & Security): 4 meja 2x2 berhadapan (Bima & Gita vs Satria & Laras).
 * - Koridor tengah luas & terbuka menuju Barista Bar di kiri bawah.
 */
const AGENT_3D_POSITIONS: Record<string, { x: number; z: number; rotY: number }> = {
  // Command & Executive (Dinding Utara — Menghadap Selatan +Z)
  raka:   { x: -3.8, z: -3.8, rotY: Math.PI }, // Manajer
  fajar:  { x:  3.0, z: -3.8, rotY: Math.PI }, // Penguji Visual

  // Pod 1 (Barat: Riset, Penulisan & Desain — 4 Meja Berhadapan)
  sari:   { x: -4.8, z: -2.3, rotY: Math.PI }, // Peneliti (Baris atas, hadap Selatan)
  dimas:  { x: -2.8, z: -2.3, rotY: Math.PI }, // Penulis (Baris atas, hadap Selatan)
  tari:   { x: -4.8, z: -0.9, rotY: 0 },       // Desainer UI/UX (Baris bawah, hadap Utara)
  wulan:  { x: -2.8, z: -0.9, rotY: 0 },       // Artis Visual (Baris bawah, hadap Utara)

  // Pod 2 (Timur: Engineering & Keamanan — 4 Meja Berhadapan)
  bima:   { x:  2.0, z: -2.3, rotY: Math.PI }, // Programmer (Baris atas, hadap Selatan)
  gita:   { x:  4.0, z: -2.3, rotY: Math.PI }, // Game Dev 2.5D (Baris atas, hadap Selatan)
  satria: { x:  2.0, z: -0.9, rotY: 0 },       // Keamanan (Baris bawah, hadap Utara)
  laras:  { x:  4.0, z: -0.9, rotY: 0 },       // Reviewer (Baris bawah, hadap Utara)
};

// Titik Pantry & Antrean Kopi Barista
const COFFEE_BAR_POS = { x: -3.8, z: 4.1 };
const TRASH_BIN_POS  = { x: -5.0, z: 4.1 };
/** Titik berdiri di depan tempat sampah (bukan di dalam tong). */
const TRASH_STAND    = { x: -5.0, z: 3.75 };

// Titik Slot Antrean Kopi (Slot 0 di depan mesin, Slot 1-3 berbaris rapi di belakang)
const COFFEE_QUEUE_SPOTS = [
  { x: -3.8, z: 3.4 }, // Slot 0: Sedang menyeduh di depan mesin espresso
  { x: -3.8, z: 2.5 }, // Slot 1: Antrean pertama di belakang slot 0
  { x: -3.8, z: 1.6 }, // Slot 2: Antrean kedua
  { x: -3.8, z: 0.7 }, // Slot 3: Antrean ketiga
];

// Meja rapat bundar (posisi dari office-density-expansion-plan.md) & titik berdiri peserta
const MEETING_TABLE_POS = { x: 0.2, z: 2.2 };
const MEETING_RADIUS = 1.35;
const MEETING_SPOTS: Array<{ x: number; z: number }> = Array.from({ length: 10 }, (_, i) => {
  // Busur menghadap utara (sisi promenade) agar jalur masuk tidak menembus meja.
  const theta = ((-110 + (i * 220) / 9) * Math.PI) / 180;
  return {
    x: MEETING_TABLE_POS.x + MEETING_RADIUS * Math.sin(theta),
    z: MEETING_TABLE_POS.z - MEETING_RADIUS * Math.cos(theta),
  };
});

const WALK_SPEED     = 2.2;
const COFFEE_MIN_S   = 10;
const COFFEE_MAX_S   = 22;
const CONVO_MIN_S    = 12;
const CONVO_MAX_S    = 24;
const THOUGHT_MIN_S  = 8;
const THOUGHT_MAX_S  = 18;
const VISIT_STAY_S   = 3.5;
const MEETING_STAY_S = 22;

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
  | 'walk_to_meeting'
  | 'in_meeting'
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

interface AgentAnim {
  state: AnimState;
  stateTime: number;
  stateDuration: number;
  walkPath: Array<{ x: number; z: number }>;
  walkSeg: number;
  walkT: number;
  hasCup: boolean;
  hasDoc: boolean;
  bubbleText: string | null;
  bubbleTimer: number;
  /** Tujuan kunjungan meja (agentId) saat walk_to_visit / visiting. */
  visitTarget?: string;
  meetingSpot?: { x: number; z: number };
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

// ============================================================================
// Navigasi Jalur Bebas Tabrakan (Collision-Free Waypoint Graph)
// ============================================================================

function rand(a: number, b: number) { return a + Math.random() * (b - a); }
function pick<T>(arr: readonly T[]): T { return arr[Math.floor(Math.random() * arr.length)]!; }
function clipText(text: string, max = 110) {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function segLen(a: { x: number; z: number }, b: { x: number; z: number }) {
  const dx = b.x - a.x, dz = b.z - a.z;
  return Math.sqrt(dx * dx + dz * dz);
}

/**
 * SISTEM NAVIGASI KORIDOR RESMI KANTOR (Anti Menembus Objek & Agen Lain)
 *
 * Jaringan jalan:
 * - Lorong Utara (North Aisle): Z = -3.4 (di antara meja Raka/Fajar dan meja Pods)
 * - Lorong Tengah (Central Avenue): X = 0.0 (menghubungkan Utara ke Selatan)
 * - Promenade Selatan: Z = 0.8 (di depan Pods menuju Pantry, Meja Rapat & Server)
 * - Garis Antrean Kopi: X = -3.8 dan Koridor Tempat Sampah: X = -5.0 (keluar-masuk via promenade)
 *
 * Setiap titik punya "jalan keluar" ke jaringan; rute = keluar -> koridor -> masuk.
 */
type Pt = { x: number; z: number };
const NORTH_AISLE_Z = -3.4;
const PROMENADE_Z = 0.8;
const AVENUE_X = 0.0;
/** Meja eksekutif di dinding utara (Raka & Fajar). */
const EXEC_DESKS: Pt[] = Object.values(AGENT_3D_POSITIONS)
  .filter((p) => p.z < -3.0)
  .map((p) => ({ x: p.x, z: p.z }));

function toNetwork(p: Pt): Pt[] {
  // Antrean / mesin kopi: mundur lurus di garis antrean ke promenade
  if (p.z > 1.6 && Math.abs(p.x - -3.8) < 0.6) return [{ x: -3.8, z: PROMENADE_Z }];
  // Tempat sampah: lewat koridor X = -5.0 agar tidak menabrak bar kopi
  if (p.x <= -4.5 && p.z >= 3.0) return [{ x: -5.0, z: PROMENADE_Z }];
  // Kursi eksekutif di depan dinding utara: keluar lewat celah samping meja (tidak menembus meja).
  // Celah dihitung dari posisi meja, bukan dari posisi agen, agar titik di celah itu sendiri
  // tidak terus "digeser" ke timur.
  if (p.z < -4.0) {
    const desk = EXEC_DESKS.reduce((best, d) => (Math.abs(d.x - p.x) < Math.abs(best.x - p.x) ? d : best), EXEC_DESKS[0]!);
    const gapX = desk.x + 0.95;
    return [{ x: gapX, z: p.z }, { x: gapX, z: NORTH_AISLE_Z }];
  }
  // Sudah berada di Lorong Tengah (mis. dipanggil balik di tengah jalan)
  if (Math.abs(p.x - AVENUE_X) < 0.4) return [];
  // Baris belakang pod & depan meja eksekutif: mundur ke Lorong Utara
  if (p.z < -1.5) return [{ x: p.x, z: NORTH_AISLE_Z }];
  // Baris depan pod, area rapat, dan sisi selatan: ke promenade
  return [{ x: p.x, z: PROMENADE_Z }];
}

function viaCorridor(a: Pt, b: Pt): Pt[] {
  const sameZ = Math.abs(a.z - b.z) < 0.05;
  if (sameZ) return [];
  return [{ x: AVENUE_X, z: a.z }, { x: AVENUE_X, z: b.z }];
}

function walkPath(from: Pt, to: Pt): Pt[] {
  const exit = toNetwork(from);
  const entry = toNetwork(to).reverse();
  const a = exit[exit.length - 1] ?? from;
  const b = entry[0] ?? to;
  const pts = [{ ...from }, ...exit, ...viaCorridor(a, b), ...entry, { ...to }];
  // Hapus titik-titik redundan yang berdekatan
  return pts.filter((pt, i, arr) =>
    i === 0 || Math.abs(pt.x - arr[i - 1]!.x) > 0.06 || Math.abs(pt.z - arr[i - 1]!.z) > 0.06,
  );
}

/** Titik berdiri tamu di samping/depan meja rekan (selalu di koridor yang bisa dicapai). */
function visitSpotFor(p: { x: number; z: number; rotY: number }): Pt {
  if (p.z < -3.0) return { x: p.x, z: -3.15 };          // depan meja eksekutif (Raka/Fajar)
  if (p.z < -1.5) return { x: p.x + 0.55, z: NORTH_AISLE_Z }; // belakang kursi baris belakang pod
  return { x: p.x + 0.55, z: 0.15 };                    // belakang kursi baris depan pod
}

/**
 * Menghitung koordinat dunia dan rotasi hadap kursi yang tepat.
 * Posisi kursi berjarak +0.55m di belakang meja pada arah posInfo.rotY.
 * Karyawan duduk menghadap KE MEJA (rotY + Math.PI).
 */
function sitWorld(p: { x: number; z: number; rotY: number }) {
  return {
    x: p.x + 0.55 * Math.sin(p.rotY),
    y: 0.45,
    z: p.z + 0.55 * Math.cos(p.rotY),
  };
}

/** Membebaskan geometri, material, dan tekstur sebuah objek beserta anak-anaknya. */
function disposeObject(root: THREE.Object3D) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (!mat) continue;
      for (const value of Object.values(mat)) {
        if (value instanceof THREE.Texture) value.dispose();
      }
      mat.dispose();
    }
  });
}

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
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);

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
    let animId: number;
    const clock = new THREE.Clock();

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;
    const aspect = width / height;

    // ----- Scene & Environment -----
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b151b);

    // ----- Kamera Isometrik -----
    const VH = 15;
    const camera = new THREE.OrthographicCamera(
      (-VH * aspect) / 2, (VH * aspect) / 2, VH / 2, -VH / 2, 0.1, 1000,
    );
    camera.position.set(18, 14, 20);
    camera.lookAt(0, 1.05, 0);
    cameraRef.current = camera;

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

    // ----- Orbit Controls -----
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.05, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minZoom = 0.6;
    controls.maxZoom = 3.0;
    controls.minPolarAngle = 0.35;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.update();
    controlsRef.current = controls;

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

    const sun = new THREE.DirectionalLight(0xfff7ed, 3.2);
    sun.position.set(12, 24, 16);
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
    scene.add(sun);

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
    // MEMUAT MODEL 3D
    // ================================================================
    const loader = new GLTFLoader();
    // Model yang selesai dimuat setelah komponen dilepas tidak boleh menyentuh scene lagi.
    let disposed = false;
    const loadModel = (url: string, onLoad: (scene: THREE.Group) => void, onError?: (e: unknown) => void) => {
      loader.load(
        url,
        (gltf) => {
          if (disposed) {
            disposeObject(gltf.scene);
            return;
          }
          onLoad(gltf.scene);
        },
        undefined,
        (e) => { if (!disposed) onError?.(e); },
      );
    };
    let deskT: THREE.Group | null = null;
    let chairT: THREE.Group | null = null;
    let serverT: THREE.Group | null = null;
    let monsteraT: THREE.Group | null = null;
    let snakeT: THREE.Group | null = null;
    let coffeeBarT: THREE.Group | null = null;

    const decorGroup = new THREE.Group();
    decorGroup.name = 'OfficeDecor3D';
    scene.add(decorGroup);

    const deskStationsGroup = new THREE.Group();
    deskStationsGroup.name = 'DeskStations';
    scene.add(deskStationsGroup);

    const avatarsGroup = new THREE.Group();
    avatarsGroup.name = 'AgentAvatars';
    scene.add(avatarsGroup);

    const meshMap = new Map<string, AgentMeshRefs>();
    const animMap = new Map<string, AgentAnim>();

    // Antrean Kopi Terstruktur
    let coffeeQueue: string[] = [];

    const enableShadow = (g: THREE.Group) => {
      g.traverse((c) => { if ((c as THREE.Mesh).isMesh) { c.castShadow = true; c.receiveShadow = true; } });
    };

    // ---- Room Shell ----
    loadModel('/models/office_room_shell.glb', (shell) => {
      enableShadow(shell);
      scene.add(shell);
      setModelLoaded(true);
    }, (e) => { setLoadError(String(e)); });

    // ---- Desk ----
    loadModel('/models/desk.glb', (m) => { deskT = m; enableShadow(m); rebuildDesks(); });

    // ---- Chair ----
    loadModel('/models/Office_Ergonomic_Chair.glb', (m) => { chairT = m; enableShadow(m); rebuildDesks(); });

    // ---- Server Rack ----
    loadModel('/models/Server_Rack_42U.glb', (m) => { serverT = m; enableShadow(m); rebuildDecor(); });

    // ---- Monstera ----
    loadModel('/models/Office_Indoor_Plant.glb', (m) => { monsteraT = m; enableShadow(m); rebuildDecor(); });

    // ---- Snake Plant ----
    loadModel('/models/Office_Indoor_Plant_SnakePlant.glb', (m) => { snakeT = m; enableShadow(m); rebuildDecor(); });

    // ---- Coffee Bar ----
    loadModel('/models/Office_Coffee_Bar.glb', (m) => { coffeeBarT = m; enableShadow(m); rebuildDecor(); });

    // ---- Meja Rapat Bundar ----
    // Placeholder prosedural; otomatis diganti GLB bila Office_Meeting_Table_Round.glb sudah dibuat.
    const meetingGroup = new THREE.Group();
    meetingGroup.name = 'MeetingTable';
    meetingGroup.position.set(MEETING_TABLE_POS.x, 0, MEETING_TABLE_POS.z);
    {
      const top = new THREE.Mesh(
        new THREE.CylinderGeometry(0.6, 0.6, 0.04, 40),
        new THREE.MeshStandardMaterial({ color: 0x6b4a32, roughness: 0.45, metalness: 0.05 }),
      );
      top.position.y = 0.74;
      top.castShadow = true;
      top.receiveShadow = true;
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.08, 0.72, 16),
        new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.35, metalness: 0.8 }),
      );
      stem.position.y = 0.36;
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.32, 0.03, 24),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.8 }),
      );
      base.position.y = 0.015;
      meetingGroup.add(top, stem, base);
    }
    scene.add(meetingGroup);
    loadModel('/models/Office_Meeting_Table_Round.glb', (m) => {
      enableShadow(m);
      for (const child of [...meetingGroup.children]) {
        meetingGroup.remove(child);
        disposeObject(child);
      }
      meetingGroup.add(m);
    });

    // ================================================================
    // DEKORASI TETAP (Pantry, Tanaman Estetik, Server Rack)
    // ================================================================
    const rebuildDecor = () => {
      while (decorGroup.children.length > 0) decorGroup.remove(decorGroup.children[0]!);

      // Server Rack di Area Data Center Kanan Bawah
      if (serverT) {
        [{ x: 1.8, z: 3.8 }, { x: 5.5, z: 3.8 }].forEach((p, i) => {
          const r = serverT!.clone(true);
          r.position.set(p.x, 0, p.z);
          r.name = `ServerRack_${i}`;
          decorGroup.add(r);
          const led = new THREE.PointLight(i === 0 ? 0x5dbb8a : 0x4da8da, 4.5, 3.5, 2);
          led.position.set(p.x, 1.2, p.z - 0.45);
          led.userData = { isServerPulse: true, offset: i * 2.5 };
          decorGroup.add(led);
        });
      }

      // Monstera di Sudut-sudut Estetik
      if (monsteraT) {
        [
          { x: -6.0, z: 3.8, s: 0.95 },  // Sudut Rehat/Lounge
          { x: -6.0, z: -4.2, s: 0.90 }, // Sudut Eksekutif Raka
          { x: -6.0, z: -1.6, s: 0.85 }, // Pembatas Pod Barat
        ].forEach((p, i) => {
          const m = monsteraT!.clone(true);
          m.position.set(p.x, 0, p.z);
          m.scale.setScalar(p.s);
          m.name = `Monstera_${i}`;
          decorGroup.add(m);
        });
      }

      // Snake Plant di Sepanjang Partisi & Koridor
      if (snakeT) {
        [
          { x: 0.0, z: -4.0, s: 0.90 }, // Dinding Tengah Utara
          { x: 5.8, z: -4.0, s: 0.90 }, // Sudut Kanan Atas
          { x: 5.8, z: 0.0, s: 0.85 },  // Pembatas Samping Pod Timur
        ].forEach((p, i) => {
          const m = snakeT!.clone(true);
          m.position.set(p.x, 0, p.z);
          m.scale.setScalar(p.s);
          m.name = `SnakePlant_${i}`;
          decorGroup.add(m);
        });
      }

      // Office Coffee Bar
      if (coffeeBarT) {
        const bar = coffeeBarT.clone(true);
        bar.position.set(COFFEE_BAR_POS.x, 0, COFFEE_BAR_POS.z);
        bar.rotation.y = Math.PI;
        bar.name = 'Office_Coffee_Bar';
        decorGroup.add(bar);
      }

      // Modern Metallic Trash Bin
      const binGeo = new THREE.CylinderGeometry(0.16, 0.13, 0.52, 16);
      const binMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.35, metalness: 0.8 });
      const bin = new THREE.Mesh(binGeo, binMat);
      bin.position.set(TRASH_BIN_POS.x, 0.26, TRASH_BIN_POS.z);
      bin.castShadow = true;
      bin.name = 'Trash_Bin';
      decorGroup.add(bin);

      const lidGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.03, 16);
      const lidMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2, metalness: 0.9 });
      const lid = new THREE.Mesh(lidGeo, lidMat);
      lid.position.set(TRASH_BIN_POS.x, 0.53, TRASH_BIN_POS.z);
      decorGroup.add(lid);

      // Warm Barista Downlight
      const baristaLight = new THREE.PointLight(0xffdfb8, 28, 5, 1.6);
      baristaLight.position.set(-3.8, 2.3, 3.8);
      decorGroup.add(baristaLight);
    };
    rebuildDecor();

    // ================================================================
    // DESK STATIONS (Meja, Kursi, Monitor SATU SISI LAYAR DEPAN SAJA)
    // ================================================================
    const rebuildDesks = () => {
      while (deskStationsGroup.children.length > 0) deskStationsGroup.remove(deskStationsGroup.children[0]!);

      initAgents.forEach((ag) => {
        const posInfo = AGENT_3D_POSITIONS[ag.id];
        if (!posInfo) return;
        const color = new THREE.Color(ag.color);

        const g = new THREE.Group();
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

        // Kursi Kerja Ergonomis di belakang meja (z = 0.55 local, menghadap ke meja di -Z)
        if (chairT) {
          const c = chairT.clone(true);
          c.position.set(0, 0, 0.55);
          c.rotation.y = Math.PI;
          g.add(c);
        } else {
          const c = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 0.45, 0.5),
            new THREE.MeshStandardMaterial({ color: 0x111c22, roughness: 0.8 }),
          );
          c.position.set(0, 0.225, 0.55);
          c.castShadow = true;
          g.add(c);
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
        // Di Three.js BoxGeometry:
        // index 0: +X, index 1: -X, index 2: +Y, index 3: -Y
        // index 4: +Z (Layar depan menghadap ke arah karyawan di kursi!)
        // index 5: -Z (Casing belakang menghadap ke luar/belakang!)
        // ==============================================================
        const casingMat = new THREE.MeshStandardMaterial({
          color: 0x0f172a, // Matte dark slate plastic
          roughness: 0.85,
          metalness: 0.2,
        });

        const screenMat = new THREE.MeshStandardMaterial({
          color: 0x050c12,
          map: codeTexture,
          emissive: 0xffffff,
          emissiveMap: codeTexture,
          emissiveIntensity: 2.2,
          roughness: 0.2,
          metalness: 0.1,
        });

        const monitorMaterials = [
          casingMat, // 0: +X (kanan)
          casingMat, // 1: -X (kiri)
          casingMat, // 2: +Y (atas)
          casingMat, // 3: -Y (bawah)
          screenMat, // 4: +Z (Hanya sisi depan yang menyala & ada animasi kode!)
          casingMat, // 5: -Z (Sisi belakang monitor gelap plastik murni!)
        ];

        const mon = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.36, 0.04), monitorMaterials);
        mon.position.set(0, 0.95, -0.2);
        mon.castShadow = true;
        g.add(mon);

        // Screen Glow ke Meja
        const glow = new THREE.PointLight(color, 2.0, 1.8, 2);
        glow.position.set(0, 0.95, -0.05);
        g.add(glow);

        // Selection Ring
        const ringMat = new THREE.MeshBasicMaterial({
          color, side: THREE.DoubleSide, transparent: true, opacity: 0,
        });
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 0.9, 32), ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.01;
        g.add(ring);

        deskStationsGroup.add(g);

        const sp = sitWorld(posInfo);
        const sRotY = posInfo.rotY + Math.PI; // Karyawan duduk menghadap KE MEJA!

        const existing = meshMap.get(ag.id);
        if (existing) {
          existing.deskGroup = g;
          existing.monitor = mon;
          existing.screenMat = screenMat;
          existing.screenGlow = glow;
          existing.selRing = ring;
          existing.sitPos = sp;
          existing.sitRotY = sRotY;
        } else {
          meshMap.set(ag.id, {
            deskGroup: g, avatar: new THREE.Group(),
            leftArmPivot: new THREE.Group(), rightArmPivot: new THREE.Group(),
            leftLegPivot: new THREE.Group(), rightLegPivot: new THREE.Group(),
            cup: new THREE.Mesh(), doc: new THREE.Mesh(), monitor: mon, screenMat, screenGlow: glow,
            beacon: new THREE.Mesh(), selRing: ring,
            sitPos: sp, sitRotY: sRotY,
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
        const posInfo = AGENT_3D_POSITIONS[ag.id];
        if (!posInfo) return;
        const color = new THREE.Color(ag.color);
        const sp = sitWorld(posInfo);
        const sRotY = posInfo.rotY + Math.PI; // Menghadap KE MEJA & KEYBOARD!

        const g = new THREE.Group();
        g.name = `Avatar_${ag.id}`;
        g.userData = { agentId: ag.id };
        g.position.set(sp.x, sp.y, sp.z);
        g.rotation.y = sRotY;

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
        const lh = new THREE.Mesh(
          new THREE.SphereGeometry(0.03, 8, 8),
          new THREE.MeshStandardMaterial({ color: 0xffd9b3 }),
        );
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
        const rh = new THREE.Mesh(
          new THREE.SphereGeometry(0.03, 8, 8),
          new THREE.MeshStandardMaterial({ color: 0xffd9b3 }),
        );
        rh.position.y = -0.18;
        rap.add(rh);

        // Cangkir Kopi di Tangan Kanan
        const cupGeo = new THREE.CylinderGeometry(0.04, 0.032, 0.08, 8);
        const cupMat = new THREE.MeshStandardMaterial({ color: 0xfaf8f5, roughness: 0.25, metalness: 0.1 });
        const cup = new THREE.Mesh(cupGeo, cupMat);
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

        const refs = meshMap.get(ag.id);
        if (refs) {
          refs.avatar = g;
          refs.leftArmPivot = lap;
          refs.rightArmPivot = rap;
          refs.leftLegPivot = llp;
          refs.rightLegPivot = rlp;
          refs.cup = cup;
          refs.doc = doc;
          refs.beacon = beacon;
          refs.sitPos = sp;
          refs.sitRotY = sRotY;
        }
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

    // ================================================================
    // RAYCASTER
    // ================================================================
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const onPointerDown = (ev: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects([deskStationsGroup, avatarsGroup], true);
      if (hits.length > 0) {
        let obj: THREE.Object3D | null = hits[0]!.object;
        while (obj && !obj.userData?.agentId) obj = obj.parent;
        if (obj?.userData?.agentId) onSelectRef.current(obj.userData.agentId as string);
      }
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);

    // ================================================================
    // RESIZE
    // ================================================================
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth, h = container.clientHeight, a = w / h;
      renderer.setSize(w, h);
      camera.left = (-VH * a) / 2;
      camera.right = (VH * a) / 2;
      camera.top = VH / 2;
      camera.bottom = -VH / 2;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', handleResize);

    // ================================================================
    // SCHEDULER & ANTREAN KOPI (Queue State Machine)
    // ================================================================
    let globalTime = 0;
    let nextCoffeeT = rand(4, 8);
    let nextConvoT  = rand(8, 14);
    let nextThoughtT = rand(6, 12);
    let lastCodeUpdate = 0;
    const dlgQueue: ScheduledLine[] = [];

    // ================================================================
    // HANDLER KEDATANGAN STATE MACHINE
    // ================================================================
    const handleArrival = (agentId: string, anim: AgentAnim) => {
      const refs = meshMap.get(agentId);
      if (!refs) return;

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
          // Duduk kembali di kursi menghadap ke meja kerja
          refs.avatar.position.set(refs.sitPos.x, refs.sitPos.y, refs.sitPos.z);
          refs.avatar.rotation.y = refs.sitRotY;
          refs.leftLegPivot.rotation.set(Math.PI / 2.2, 0, 0);
          refs.rightLegPivot.rotation.set(Math.PI / 2.2, 0, 0);
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
          anim.state = 'working';
          anim.stateTime = 0;
          anim.hasDoc = false;
          anim.visitTarget = undefined;
          anim.meetingSpot = undefined;
          refs.doc.visible = false;
          refs.avatar.position.set(refs.sitPos.x, refs.sitPos.y, refs.sitPos.z);
          refs.avatar.rotation.y = refs.sitRotY;
          refs.leftLegPivot.rotation.set(Math.PI / 2.2, 0, 0);
          refs.rightLegPivot.rotation.set(Math.PI / 2.2, 0, 0);
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
          anim.state = 'in_meeting';
          anim.stateTime = 0;
          const spot = anim.meetingSpot ?? MEETING_SPOTS[0]!;
          refs.avatar.position.set(spot.x, 0, spot.z);
          refs.avatar.rotation.y = Math.atan2(MEETING_TABLE_POS.x - spot.x, MEETING_TABLE_POS.z - spot.z);
          refs.leftLegPivot.rotation.set(0, 0, 0);
          refs.rightLegPivot.rotation.set(0, 0, 0);
          break;
        }
      }
    };

    // ================================================================
    // RUTINITAS BERBASIS DATA LIVE (kunjungan meja, rapat, recall)
    // ================================================================
    const visitQueue = new Map<string, Array<{ to: string; text: string; carryDoc: boolean }>>();
    let meetingEndsAt = 0;

    const currentPos = (refs: AgentMeshRefs): Pt => ({ x: refs.avatar.position.x, z: refs.avatar.position.z });

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
        wAnim.walkPath = [currentPos(wRefs), nextSpot];
        wAnim.walkSeg = 0;
        wAnim.walkT = 0;
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
      anim.walkPath = walkPath(currentPos(refs), { x: refs.sitPos.x, z: refs.sitPos.z });
      anim.walkSeg = 0;
      anim.walkT = 0;
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
      anim.walkPath = walkPath({ x: refs.sitPos.x, z: refs.sitPos.z }, spot);
      anim.walkSeg = 0;
      anim.walkT = 0;
      anim.bubbleText = clipText(text, 90);
      anim.bubbleTimer = 4.5;
    };

    const statusOf = (agentId: string): AgentStatus | null => {
      if (!liveRef.current) return null;
      return agentsRef.current.find((a) => a.id === agentId)?.status ?? null;
    };

    const atDesk = (anim: AgentAnim) => anim.state === 'working' || anim.state === 'drinking';

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

      // Rapat: semua yang hadir berkumpul di meja bundar
      meetingEndsAt = globalTime + MEETING_STAY_S;
      let spotIdx = 0;
      const ids = [ev.host, ...Array.from(animMap.keys()).filter((id) => id !== ev.host)];
      const attendees: string[] = [];
      for (const id of ids) {
        const anim = animMap.get(id);
        const refs = meshMap.get(id);
        if (!anim || !refs || statusOf(id) === 'offline') continue;
        attendees.push(id);
        if (anim.state === 'in_meeting' || anim.state === 'walk_to_meeting') {
          spotIdx += 1;
          continue;
        }
        leaveCoffeeQueue(id);
        anim.hasCup = false;
        refs.cup.visible = false;
        anim.hasDoc = false;
        refs.doc.visible = false;
        visitQueue.delete(id);
        const spot = MEETING_SPOTS[spotIdx % MEETING_SPOTS.length]!;
        spotIdx += 1;
        anim.meetingSpot = spot;
        anim.state = 'walk_to_meeting';
        anim.stateTime = 0;
        anim.walkPath = walkPath(currentPos(refs), spot);
        anim.walkSeg = 0;
        anim.walkT = 0;
      }
      if (attendees.includes(ev.host)) {
        dlgQueue.push({ agentId: ev.host, text: clipText(ev.text, 120), showAt: globalTime + 4.5, dur: 6 });
        let t = globalTime + 11;
        for (const id of attendees.filter((a) => a !== ev.host).slice(0, 3)) {
          dlgQueue.push({ agentId: id, text: pick(MEETING_REPLIES), showAt: t, dur: 3 });
          t += 3.4;
        }
      }
    };

    const lastStatus = new Map<string, AgentStatus>();

    // Hook diagnostik khusus dev server (tidak ikut ke build produksi).
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__officeStage = () =>
        Array.from(animMap.entries()).map(([id, a]) => {
          const r = meshMap.get(id);
          return {
            id,
            state: a.state,
            seg: `${a.walkSeg}/${a.walkPath.length}`,
            pos: r ? `${r.avatar.position.x.toFixed(2)},${r.avatar.position.z.toFixed(2)}` : '',
            queue: visitQueue.get(id)?.length ?? 0,
            bubble: a.bubbleTimer > 0 ? (a.bubbleText ?? '').slice(0, 30) : '',
          };
        });
    }

    // ================================================================
    // ANIMATION LOOP UTAMA (60 FPS)
    // ================================================================
    const tempVec = new THREE.Vector3();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.1);
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

      // Rapat selesai -> semua kembali ke meja
      if (meetingEndsAt > 0 && globalTime >= meetingEndsAt) {
        meetingEndsAt = 0;
        for (const [id, anim] of animMap) {
          const refs = meshMap.get(id);
          if (!refs || (anim.state !== 'in_meeting' && anim.state !== 'walk_to_meeting')) continue;
          anim.state = 'walk_from_meeting';
          anim.stateTime = 0;
          anim.walkPath = walkPath(currentPos(refs), { x: refs.sitPos.x, z: refs.sitPos.z });
          anim.walkSeg = 0;
          anim.walkT = 0;
        }
      }

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
            a.walkPath = walkPath({ x: refs.sitPos.x, z: refs.sitPos.z }, destSpot);
            a.walkSeg = 0;
            a.walkT = 0;
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

      // ---------- Update Setiap Agen (Loop Render 60 FPS) ----------
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
            refs.avatar.position.set(refs.sitPos.x, refs.sitPos.y, refs.sitPos.z);
            refs.avatar.rotation.y = refs.sitRotY;
            refs.leftLegPivot.rotation.set(Math.PI / 2.2, 0, 0);
            refs.rightLegPivot.rotation.set(Math.PI / 2.2, 0, 0);
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
              anim.walkPath = walkPath(currentPos(refs), { x: refs.sitPos.x, z: refs.sitPos.z });
              anim.walkSeg = 0;
              anim.walkT = 0;
            }
            break;
          }

          case 'in_meeting': {
            refs.leftLegPivot.rotation.set(0, 0, 0);
            refs.rightLegPivot.rotation.set(0, 0, 0);
            const talking = anim.bubbleTimer > 0;
            refs.leftArmPivot.rotation.set(talking ? -0.6 + Math.sin(globalTime * 4) * 0.2 : -0.15, 0, 0.1);
            refs.rightArmPivot.rotation.set(talking ? -0.7 + Math.cos(globalTime * 3.5) * 0.2 : -0.15, 0, -0.1);
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
                  const curPos = { x: wRefs.avatar.position.x, z: wRefs.avatar.position.z };
                  wAnim.walkPath = [curPos, nextSpot];
                  wAnim.walkSeg = 0;
                  wAnim.walkT = 0;
                }
              });

              // Jalan kembali ke meja masing-masing via koridor aman
              anim.state = 'walk_to_desk';
              anim.stateTime = 0;
              anim.walkPath = walkPath(COFFEE_QUEUE_SPOTS[0]!, { x: refs.sitPos.x, z: refs.sitPos.z });
              anim.walkSeg = 0;
              anim.walkT = 0;
              anim.bubbleText = pick(COFFEE_ROUTINE_DIALOGUES.walking_with_coffee);
              anim.bubbleTimer = 3.0;
            }
            break;
          }

          case 'drinking': {
            refs.avatar.position.set(refs.sitPos.x, refs.sitPos.y, refs.sitPos.z);
            refs.avatar.rotation.y = refs.sitRotY;
            refs.leftLegPivot.rotation.set(Math.PI / 2.2, 0, 0);
            refs.rightLegPivot.rotation.set(Math.PI / 2.2, 0, 0);
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
              const sp = { x: refs.sitPos.x, z: refs.sitPos.z };
              anim.state = 'walk_to_trash';
              anim.stateTime = 0;
              anim.walkPath = walkPath(sp, TRASH_STAND);
              anim.walkSeg = 0;
              anim.walkT = 0;
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
              const sp = { x: refs.sitPos.x, z: refs.sitPos.z };
              const path = walkPath(TRASH_STAND, sp);
              anim.state = 'walk_from_trash';
              anim.stateTime = 0;
              anim.walkPath = path;
              anim.walkSeg = 0;
              anim.walkT = 0;
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

            const sLen = segLen(seg, next);
            if (sLen < 0.01) { anim.walkSeg++; anim.walkT = 0; break; }

            anim.walkT += (WALK_SPEED * dt) / sLen;

            let t = anim.walkT;
            if (anim.walkT >= 1) {
              // Tetap di UJUNG segmen yang baru selesai pada frame ini. Sebelumnya posisi dihitung
              // dari awal segmen (t = 0) sehingga avatar "melompat balik" satu frame di tiap belokan.
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

      // Server LED Pulse
      decorGroup.children.forEach((c) => {
        if (c.userData?.isServerPulse) {
          (c as THREE.PointLight).intensity = 2.8 + Math.sin(globalTime * 5 + c.userData.offset) * 1.8;
        }
      });

      // Update Speech Bubbles Projection
      const bc = bubbleRef.current;
      if (bc && container) {
        const cw = container.clientWidth;
        const ch = container.clientHeight;

        for (const [agentId, anim] of animMap) {
          const el = bc.querySelector(`[data-agent="${agentId}"]`) as HTMLElement | null;
          if (!el) continue;

          if (anim.bubbleText && anim.bubbleTimer > 0) {
            const refs = meshMap.get(agentId);
            if (!refs) continue;

            tempVec.setFromMatrixPosition(refs.avatar.matrixWorld);
            tempVec.y += 1.05;
            tempVec.project(camera);

            const sx = (tempVec.x * 0.5 + 0.5) * cw;
            const sy = (-tempVec.y * 0.5 + 0.5) * ch;

            el.style.display = 'block';
            el.style.left = `${sx}px`;
            el.style.top = `${sy}px`;
            el.style.opacity = String(Math.min(1, anim.bubbleTimer / 0.4));

            const txtEl = el.querySelector('[data-text]') as HTMLElement | null;
            if (txtEl) txtEl.textContent = anim.bubbleText;
          } else {
            el.style.display = 'none';
          }
        }
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      controls.dispose();
      // Lepaskan memori GPU (geometri, material, tekstur) agar remount/HMR tidak bocor.
      disposeObject(scene);
      for (const tpl of [deskT, chairT, serverT, monsteraT, snakeT, coffeeBarT]) {
        if (tpl) disposeObject(tpl);
      }
      scene.environment?.dispose();
      renderer.dispose();
      codeTexture.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      const bc = bubbleRef.current;
      if (bc) while (bc.firstChild) bc.removeChild(bc.firstChild);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleResetCamera = () => {
    if (controlsRef.current && cameraRef.current) {
      cameraRef.current.position.set(18, 14, 20);
      controlsRef.current.target.set(0, 1.05, 0);
      controlsRef.current.update();
    }
  };

  const handleFocusAgent = () => {
    const pos = AGENT_3D_POSITIONS[selectedAgentId];
    if (pos && controlsRef.current) {
      controlsRef.current.target.set(pos.x, 0.8, pos.z);
      controlsRef.current.update();
    }
  };

  return (
    <section
      aria-label={language === 'id' ? 'Panggung Ruang Kantor 3D Three.js' : '3D Three.js Office Stage'}
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
          padding: '10px 16px',
          borderBottom: '1px solid var(--color-rule)',
          background: 'var(--color-paper-2)',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <strong style={{ fontSize: 14 }}>
            {language === 'id'
              ? 'Ruang Kantor 3D (Three.js WebGL Diorama)'
              : '3D Virtual Office (Three.js WebGL Diorama)'}
          </strong>
          <span className="mono" style={{ fontSize: 12, color: 'var(--color-muted)' }}>
            14×10m · 10 Kursi Karyawan
          </span>
          {modelLoaded ? (
            <span
              className="chip mono"
              style={{ fontSize: 11, color: 'var(--color-ok)', borderColor: 'var(--color-ok)' }}
            >
              GLB Active
            </span>
          ) : loadError ? (
            <span
              className="chip mono"
              style={{ fontSize: 11, color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
            >
              GLB Error
            </span>
          ) : (
            <span
              className="chip mono"
              style={{ fontSize: 11, color: 'var(--color-warn)', borderColor: 'var(--color-warn)' }}
            >
              Loading GLB...
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={handleResetCamera}
            title={language === 'id' ? 'Reset sudut kamera' : 'Reset camera'}
            style={{ padding: '4px 10px', minHeight: 28, fontSize: 12 }}
          >
            {language === 'id' ? 'Reset Kamera' : 'Reset Camera'}
          </button>
          <button
            type="button"
            onClick={handleFocusAgent}
            title={language === 'id' ? 'Fokus ke meja agen terpilih' : 'Focus selected agent'}
            style={{
              padding: '4px 10px', minHeight: 28, fontSize: 12,
              borderColor: 'var(--color-focus)', color: 'var(--color-focus)',
            }}
          >
            {language === 'id' ? 'Fokus Meja' : 'Focus Desk'}
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
