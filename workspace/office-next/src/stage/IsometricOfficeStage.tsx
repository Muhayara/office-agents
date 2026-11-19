import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { type AgentStatus, type AgentView, type Lang, roleLabel } from '@office/shared';
import { OFFICE_ZONES } from '../isometric/coords';
import type { WorldFeed, WorldView } from '../state/worldFeed';
import {
  MEETING_STATES,
  atDeskState,
  boardroom as boardroomSpots,
  createFloor1Nav,
  deskSeat,
  floor1Spots,
  visitSpotFor,
  type AgentFrame,
} from '@office/world';
import {
  AGENT_3D_POSITIONS,
  BOARDROOM,
  BOARDROOM_SEATS,
  COLLABPODS,
  COMMONS,
  CORRIDOR_BUS,
  GARDEN,
  ROOM_ACCESS,
  ROOM_COLLABPODS,
  ROOM_FOCUS,
  ROOM_STUDIO,
  STUDIO,
  ROOM_INFOWALL,
  ROOM_WORKSHOP,
  WORKSHOP,
  DOOR_MUTEX_GAP_S,
  MEETING_DEPART_GAP_S,
  MEETING_GATHER_TIMEOUT_S,
  MEETING_PRESENT_S,
  MEETING_SEAT_ASSIGNMENT,
  MEETING_SESSION_S,
  MANAGER,
  PANTRY,
  ROOM_BOARDROOM,
  ROOM_COMMONS,
  ROOM_FOYER,
  ROOM_GARDEN,
  ROOM_MAIN,
  LOUNGE,
  ROOM_LOBBY,
  ROOM_LOUNGE,
  ROOM_MANAGER,
  ROOM_PANTRY,
  ROOM_SERVER,
  WALL_HEIGHT,
  WALL_THICKNESS,
  WALK_SPEED,
  sitLocal,
  type Pt,
  type Spot,
} from './layout';
import { CameraRig, ISO_FOCUS_HEIGHT, type CameraMode } from './camera/cameraRig';
import { WallFader, type WalkZone } from './camera/wallFade';
import { EyeCam, EYE_FAR, EYE_FOV, EYE_NEAR } from './camera/eyeCam';
import { disposeObject, enableShadow, lightAnchor, type ModelLoader } from './rooms/assets';
import { ContactShadows, DeskGlows, LightPools } from './groundFx';
import { ACTIVE_HOLD_MS, QUALITY, SHADOW_MAP_SIZE, type GraphicsQuality } from './graphics';
import { buildMainWorkspace } from './rooms/mainWorkspace';
import { buildMainCorridor } from './rooms/mainCorridor';
import { buildMeetingFoyer } from './rooms/meetingFoyer';
import { buildBoardroom } from './rooms/boardroom';
import { buildManagerOffice, type KpiInfo } from './rooms/managerOffice';
import { buildPantryCafe } from './rooms/pantryCafe';
import { buildLobbyReception } from './rooms/lobbyReception';
import { buildLoungeRelax } from './rooms/loungeRelax';
import { buildServerRoom } from './rooms/serverRoom';
import { buildCollabCommons } from './rooms/collabCommons';
import { buildDigitalGarden } from './rooms/digitalGarden';
import { buildWorkshopTraining } from './rooms/workshopTraining';
import { buildInfoWall, type InfoAgentRow, type InfoWallData } from './rooms/infoWall';
import { buildCollabPods } from './rooms/collabPods';
import { buildStudioContent } from './rooms/studioContent';
import { buildFocusPods } from './rooms/focusPods';
import { buildAccessHub } from './rooms/accessHub';
import { V2Avatar, type AgentAvatar } from './avatar/agentAvatar';
import { createAvatarShared } from './avatar/rig';
import { createV1Shared, V1Avatar } from './avatar/rigV1';
import { allSeats, seatCalibAt, seatKindFor, type SeatKind } from './avatar/seats';
import { chooseLook, type LookTarget, type LookWorld } from './avatar/lookAt';

// ============================================================================
// Tipe & konstanta panggung
// ============================================================================

export type { CameraMode };

/** Ruangan Lantai 1 yang bisa difokus kamera. */
export type StageRoom =
  | 'workspace' | 'boardroom' | 'foyer' | 'bus' | 'manager' | 'pantry' | 'lobby' | 'lounge' | 'server'
  | 'commons' | 'garden' | 'workshop' | 'infowall' | 'collabpods' | 'studio' | 'focus' | 'access';

export interface StageApi {
  focusRoom: (room: StageRoom) => void;
  toggleCamera: () => void;
  resetCamera: () => void;
  focusAgent: (agentId: string) => void;
  /** F3: masuk Mata Agen (atau pindah agen). false = agen sedang tidak di kantor. */
  enterEye: (agentId: string) => boolean;
  /** F3: keluar dari Mata Agen (luncur keluar → redup → kamera sebelumnya). */
  exitEye: () => void;
  /** F3: agen berikutnya (+1) / sebelumnya (−1) yang sedang di kantor. */
  cycleEye: (dir: 1 | -1) => void;
}

/** F3: keadaan Mata Agen untuk HUD (panel kiri bawah & subtitle). */
export interface EyeInfo {
  agentId: string;
  /** Ruangan saat ini (label pendek). */
  room: string;
  /** Ucapan yang sedang tampil (subtitle), null bila diam. */
  speaking: string | null;
  /** Baris bicara terakhir sejak mata dimasuki. */
  lastLine: string | null;
}

interface IsometricOfficeStageProps {
  agents: AgentView[];
  selectedAgentId: string;
  language: Lang;
  onSelectAgent: (agentId: string) => void;
  /**
   * Sumber keadaan dunia (F2): sutradara server (`NetWorldFeed`, sama untuk semua penonton) atau
   * simulasi lokal (`LocalWorldFeed`). Boleh diganti tanpa me-mount ulang scene.
   */
  feed?: WorldFeed | null;
  /** Status agen dari dunia bersama berubah (mode publik: Inspector tanpa /api/state). */
  onAgentStatuses?: (statuses: Record<string, AgentStatus>) => void;
  /** Ref API kontrol kamera/fokus panggung untuk bilah header utama. */
  stageApiRef?: React.MutableRefObject<StageApi | null>;
  onCamModeChange?: (mode: CameraMode) => void;
  onLoadErrorChange?: (err: string | null) => void;
  /** Mode grafis (Hemat / Tinggi). Diganti tanpa me-mount ulang scene. */
  quality?: GraphicsQuality;
  /** F3: keadaan Mata Agen berubah (null = keluar; `away` = agen yang diikuti pulang). */
  onEyeInfo?: (info: EyeInfo | null, reason?: 'exit' | 'away') => void;
  /** F3: head-bob kamera mata (toggle HUD "Goyang kepala"); tetap mati bila `prefers-reduced-motion`. */
  headBob?: boolean;
  /** F3: lapisan HUD milik App (panel Mata Agen & subtitle) di atas kanvas. */
  overlay?: React.ReactNode;
}

/** Ruangan navigasi yang GLB-nya dimuat di gelombang 1 (bingkai kamera awal). Sisanya gelombang 2. */
const WAVE1_ROOMS: ReadonlySet<string> = new Set(['main', 'boardroom', 'foyer', 'bus', 'manager', 'pantry', 'lobby', 'lounge']);
const WAVE1_CONCURRENCY = 4;
const WAVE2_CONCURRENCY = 2;
/** GLB yang tidak diberi bayangan kontak (cangkang ruangan, menempel dinding, alas besar). */
const NO_CONTACT_SHADOW = /(room_shell|Boardroom_Shell|Living_Wall|Cyclorama|Elevator_Portal|Staircase|Kanban|Wall_AC|Pendant)/i;
/** Slot GLB yang bergerak (kursi rapat ditarik): bayangan kontaknya diperbarui per frame. */
const FOLLOW_CONTACT_SHADOW = /Conference_Chair/;

/** Label pendek ruangan navigasi (layar Information Wall). */
const ROOM_SHORT: Record<string, string> = {
  main: 'Ruang Kerja', boardroom: 'Rapat', foyer: 'Foyer', bus: 'Jalan Utama', manager: 'Manajer', pantry: 'Pantry',
  lobby: 'Lobi', lounge: 'Lounge', server: 'Server', commons: 'Commons', garden: 'Garden', workshop: 'Workshop',
  infowall: 'Info Wall', collabpods: 'Pods', studio: 'Studio', focus: 'Focus Pods', access: 'Access Hub',
};
/** Arah datang matahari (dari tenggara atas). Target & frustum bayangan dipaskan ke tapak gedung. */
const SUN_OFFSET = new THREE.Vector3(12, 24, 16);
/** F1: Rig v2 1,70 m bawaan; `?rig=v1` = avatar chibi lama untuk perbandingan selama migrasi. */
const RIG_VERSION: 1 | 2 = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('rig') === 'v1' ? 1 : 2;
const NO_LOOK: LookTarget = { kind: 'dir', yaw: 0, pitch: 0 };

interface AgentMeshRefs {
  deskGroup: THREE.Group;
  /** Avatar agen (Rig v2, atau v1 lewat `?rig=v1`); dipasang oleh buildAvatars. */
  av?: AgentAvatar;
  monitor: THREE.Mesh;
  screenMat: THREE.MeshStandardMaterial | null;
  /** Indeks pendar layar di DeskGlows & warna agennya. */
  glowIndex: number;
  glowColor: THREE.Color;
  selRing: THREE.Mesh;
  sitPos: { x: number; y: number; z: number };
  sitRotY: number;
  /** Titik berdiri tamu di depan meja ini (dunia). */
  visitPos: Pt;
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
  feed = null,
  onAgentStatuses,
  stageApiRef,
  onCamModeChange,
  onLoadErrorChange,
  quality = 'low',
  onEyeInfo,
  headBob = true,
  overlay,
}: IsometricOfficeStageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const qualityRef = useRef<GraphicsQuality>(quality);
  const applyQualityRef = useRef<((q: GraphicsQuality) => void) | null>(null);
  useEffect(() => {
    qualityRef.current = quality;
    applyQualityRef.current?.(quality);
  }, [quality]);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [camMode, setCamMode] = useState<CameraMode>('iso');
  // F3: petunjuk Mata Agen tampil 6 dtk setelah masuk (supaya tidak menutupi bubble di atas layar).
  const [eyeHint, setEyeHint] = useState(false);
  useEffect(() => {
    if (camMode !== 'eye') { setEyeHint(false); return; }
    setEyeHint(true);
    const id = window.setTimeout(() => setEyeHint(false), 6000);
    return () => window.clearTimeout(id);
  }, [camMode]);
  const apiRef = useRef<StageApi | null>(null);
  const onCamModeChangeRef = useRef(onCamModeChange);
  const onLoadErrorChangeRef = useRef(onLoadErrorChange);
  useEffect(() => { onCamModeChangeRef.current = onCamModeChange; }, [onCamModeChange]);
  useEffect(() => { onLoadErrorChangeRef.current = onLoadErrorChange; }, [onLoadErrorChange]);
  const onEyeInfoRef = useRef(onEyeInfo);
  const headBobRef = useRef(headBob);
  useEffect(() => { onEyeInfoRef.current = onEyeInfo; }, [onEyeInfo]);
  useEffect(() => { headBobRef.current = headBob; }, [headBob]);

  const agentsRef = useRef(agents);
  const selectedRef = useRef(selectedAgentId);
  const onSelectRef = useRef(onSelectAgent);
  const feedRef = useRef<WorldFeed | null>(feed);
  const onStatusesRef = useRef(onAgentStatuses);
  useEffect(() => { onStatusesRef.current = onAgentStatuses; }, [onAgentStatuses]);
  useEffect(() => { agentsRef.current = agents; }, [agents]);
  useEffect(() => { selectedRef.current = selectedAgentId; }, [selectedAgentId]);
  useEffect(() => { onSelectRef.current = onSelectAgent; }, [onSelectAgent]);
  useEffect(() => { feedRef.current = feed; }, [feed]);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const initAgents = agentsRef.current;
    let animId = 0;
    const clock = new THREE.Clock();

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;
    /** Ukuran panggung (di-cache: membaca clientWidth tiap frame memaksa layout). */
    let viewW = width;
    let viewH = height;

    // ----- Scene -----
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b151b);

    // ----- Renderer -----
    let quality: GraphicsQuality = qualityRef.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(QUALITY[quality].pixelRatio());
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    // Grafis Hemat: tanpa shadow map (bayangan kontak palsu). PCFSoftShadowMap sudah dihapus di three r187.
    renderer.shadowMap.enabled = QUALITY[quality].shadows;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(renderer.domElement);

    // ----- PBR Room Environment (PMREM) -----
    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    scene.environment = pmrem.fromScene(roomEnv, 0.04).texture;
    roomEnv.dispose();
    pmrem.dispose();

    // ----- Dual Kamera (Isometrik ↔ Free Cam 3D) & Auto-Fade Wall -----
    const cam = new CameraRig(renderer.domElement, width / height);
    cam.onModeChange = (m) => {
      setCamMode(m);
      onCamModeChangeRef.current?.(m);
    };
    const fader = new WallFader();

    // ----- F3: Mata Agen (kamera perspektif di soket mata agen) -----
    let eyePrev: 'iso' | 'free' = 'iso';
    let eyeExitReason: 'exit' | 'away' = 'exit';
    const eyeRay = new THREE.Raycaster();
    const motionQuery = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    const eye = new EyeCam(cam.persp, {
      onViewEnter: () => {
        eyePrev = cam.mode === 'free' ? 'free' : 'iso';
        cam.setMode('eye', { fov: EYE_FOV, near: EYE_NEAR, far: EYE_FAR });
      },
      onViewLeave: (id) => {
        const back = cam.persp.position.clone();
        const at = meshMap.get(id)?.av?.group.position.clone() ?? null;
        cam.setMode(eyePrev);
        if (at) {
          if (eyePrev === 'free') cam.placeFree(back, at.clone().setY(1.2));
          else cam.focus(at.setY(ISO_FOCUS_HEIGHT), { dur: 0.05 });
        }
      },
      // Titik awal luncur tidak boleh di balik dinding buram (kamera akan menatap dinding).
      clampStart: (from, to) => {
        const dir = to.clone().sub(from);
        const len = dir.length();
        if (len < 1e-3) return;
        dir.normalize();
        eyeRay.set(from, dir);
        eyeRay.far = len;
        const hit = eyeRay.intersectObjects(fader.occluders(), false)[0];
        if (hit) to.copy(from).addScaledVector(dir, Math.max(0.45, hit.distance - 0.3));
      },
    });
    const dimEl = document.createElement('div');
    Object.assign(dimEl.style, {
      position: 'absolute', left: '0', top: '0', right: '0', bottom: '0', background: '#05090c',
      opacity: '0', pointerEvents: 'none', zIndex: '8', display: 'none',
    });
    container.appendChild(dimEl);
    let dimShown = -1;

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
    const hemi = new THREE.HemisphereLight(0xdcf3ff, 0x1c2b33, QUALITY[quality].hemi);
    scene.add(hemi);
    scene.environmentIntensity = QUALITY[quality].env;

    // Grafis Tinggi: frustum bayangan mengikuti area pandang kamera (fitSunToView di bawah).
    const sun = new THREE.DirectionalLight(0xfff7ed, 3.2);
    sun.castShadow = QUALITY[quality].shadows;
    sun.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
    sun.shadow.bias = -0.0003;
    sun.shadow.normalBias = 0.02;
    scene.add(sun, sun.target);

    const fill = new THREE.DirectionalLight(0x7ec8e3, 1.4);
    fill.position.set(-14, 15, -10);
    scene.add(fill);

    // Lampu zona ruang kerja: titik lampu (genangan cahaya / pool lampu), bukan PointLight permanen.
    const zoneLight = (c: number, i: number, x: number, z: number) => {
      const l = lightAnchor(c, i, 10, 1.6);
      l.position.set(x, 3.0, z);
      scene.add(l);
    };
    zoneLight(0xffdfb0, 32, -3.8, -2.0); // Strategi & Komando
    zoneLight(0xffc89b, 28, -3.8,  1.5); // Studio Desain
    zoneLight(0x6ee7b7, 30,  3.5, -2.0); // Engineering & Game
    zoneLight(0x60a5fa, 28,  3.5,  2.0); // QA & Vault

    // ================================================================
    // PEMUAT MODEL: sekali unduh per file (tiap pemakai mendapat klon), antrean DUA GELOMBANG:
    // 1) ruangan di bingkai kamera awal (maks 4 paralel), 2) ruangan timur/utara saat browser idle
    // (maks 2 paralel). Fokus kamera ke sebuah ruangan langsung memajukan antrean ruangan itu.
    // Shader tiap GLB dipanaskan dengan compileAsync (KHR_parallel_shader_compile) sebelum dipasang.
    // ================================================================
    const gltfLoader = new GLTFLoader();
    gltfLoader.setMeshoptDecoder(MeshoptDecoder);
    // Model yang selesai dimuat setelah komponen dilepas tidak boleh menyentuh scene lagi.
    let disposed = false;
    type Waiter = { onLoad: (g: THREE.Group) => void; onError?: (e: unknown) => void };
    interface GlbTemplate {
      url: string;
      scene?: THREE.Group;
      error?: unknown;
      waiters: Waiter[];
      /** 0 = dipromosikan (fokus kamera), 1 = gelombang 1, 2 = gelombang 2. */
      priority: number;
      rooms: Set<string>;
      state: 'queued' | 'loading' | 'done';
    }
    const templates = new Map<string, GlbTemplate>();
    const glbQueue: GlbTemplate[] = [];
    let glbActive = 0;
    let glbLoaded = 0;
    let wave2Open = false;
    let firstFrameDone = false;
    let pumpScheduled = false;

    const pumpGlb = () => {
      if (disposed) return;
      glbQueue.sort((a, b) => a.priority - b.priority);
      while (glbQueue.length > 0) {
        const next = glbQueue[0]!;
        const wave2 = next.priority >= 2;
        if (wave2 && !wave2Open) break;
        if (glbActive >= (wave2 ? WAVE2_CONCURRENCY : WAVE1_CONCURRENCY)) break;
        glbQueue.shift();
        startGlb(next);
      }
    };
    const schedulePump = () => {
      if (pumpScheduled) return;
      pumpScheduled = true;
      queueMicrotask(() => { pumpScheduled = false; pumpGlb(); });
    };
    /** Gelombang 2 dibuka setelah semua GLB gelombang 1 selesai & frame pertama tampil, saat browser idle. */
    const maybeOpenWave2 = () => {
      if (wave2Open || !firstFrameDone || disposed) return;
      for (const t of templates.values()) if (t.priority < 2 && t.state !== 'done') return;
      const open = () => { if (disposed || wave2Open) return; wave2Open = true; pumpGlb(); };
      const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
      if (ric) ric(open, { timeout: 1500 }); else window.setTimeout(open, 300);
    };
    const finishGlb = (t: GlbTemplate) => {
      t.state = 'done';
      pumpGlb();
      maybeOpenWave2();
    };
    const startGlb = (t: GlbTemplate) => {
      t.state = 'loading';
      glbActive++;
      gltfLoader.load(
        t.url,
        (gltf) => {
          glbActive--;
          if (disposed) { disposeObject(gltf.scene); return; }
          const tpl = gltf.scene;
          // Panaskan shader di latar (tanpa mengunci UI), baru pasang klon ke ruangan.
          renderer.compileAsync(tpl, cam.active(), scene).catch(() => undefined).then(() => {
            if (disposed) return;
            t.scene = tpl;
            glbLoaded++;
            for (const w of t.waiters.splice(0)) w.onLoad(tpl.clone(true));
            finishGlb(t);
          });
          pumpGlb();
        },
        undefined,
        (err) => {
          glbActive--;
          t.error = err ?? new Error(`Gagal memuat ${t.url}`);
          if (disposed) return;
          for (const w of t.waiters.splice(0)) w.onError?.(t.error);
          finishGlb(t);
        },
      );
    };
    const requestGlb = (url: string, room: string, onLoad: Waiter['onLoad'], onError?: Waiter['onError']) => {
      const priority = WAVE1_ROOMS.has(room) ? 1 : 2;
      let t = templates.get(url);
      if (!t) {
        t = { url, waiters: [], priority, rooms: new Set([room]), state: 'queued' };
        templates.set(url, t);
        glbQueue.push(t);
      } else {
        t.rooms.add(room);
        if (t.state === 'queued') t.priority = Math.min(t.priority, priority);
      }
      if (t.scene) { onLoad(t.scene.clone(true)); return; }
      if (t.error !== undefined) { onError?.(t.error); return; }
      t.waiters.push({ onLoad, onError });
      schedulePump();
    };
    /** Majukan GLB sebuah ruangan navigasi ke urutan pertama antrean (fokus kamera / kamera mendekat). */
    const promoteRoom = (room: string) => {
      let any = false;
      for (const t of glbQueue) if (t.rooms.has(room) && t.priority > 0) { t.priority = 0; any = true; }
      if (any) pumpGlb();
    };

    // ---- Bayangan kontak (mode Hemat): dipasang otomatis untuk setiap GLB yang menapak lantai ----
    const contactShadows = new ContactShadows();
    contactShadows.setVisible(!QUALITY[quality].shadows);
    scene.add(contactShadows.group);
    const onModelMount = (slot: THREE.Object3D, model: THREE.Object3D, url: string) => {
      if (disposed || NO_CONTACT_SHADOW.test(url)) return;
      contactShadows.addFootprint(slot, model, { follow: FOLLOW_CONTACT_SHADOW.test(url) });
    };
    const loaderFor = (room: string): ModelLoader => {
      const fn: ModelLoader = (url, onLoad, onError) => requestGlb(url, room, onLoad, onError);
      fn.onMount = onModelMount;
      return fn;
    };
    const load = loaderFor('main');
    const loadAsync = (url: string) => new Promise<THREE.Group | null>((resolve) => load(url, resolve, () => resolve(null)));

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
      onShellLoaded: () => {},
      onShellError: (e) => onLoadErrorChangeRef.current?.(String(e)),
    });
    const bus = buildMainCorridor(fader);
    const foyer = buildMeetingFoyer(loaderFor('foyer'), fader);
    // Tahap 2: ruangan di sisi selatan Jalan Utama.
    const manager = buildManagerOffice(loaderFor('manager'), fader);
    const pantry = buildPantryCafe(loaderFor('pantry'), fader);
    // Tahap 3: Lobi & Resepsionis, Lounge, Server / IT.
    const lobby = buildLobbyReception(loaderFor('lobby'), fader);
    const lounge = buildLoungeRelax(loaderFor('lounge'), fader);
    const server = buildServerRoom(loaderFor('server'), fader);
    // Tahap 4: Collaboration Commons (utara bus) & Digital Garden (selatan, timur Server).
    const commons = buildCollabCommons(loaderFor('commons'), fader);
    const garden = buildDigitalGarden(loaderFor('garden'), fader);
    // Tahap 5: Workshop / Training (utara bus), Information Wall & Collaboration Pods (baris utara kedua).
    const workshop = buildWorkshopTraining(loaderFor('workshop'), fader);
    const infoWall = buildInfoWall(loaderFor('infowall'), fader);
    const collabPods = buildCollabPods(loaderFor('collabpods'), fader);
    // Tahap 6 (penutup Lantai 1): Studio / Content (baris utara kedua), Focus Pods & Digital Access Hub (selatan).
    const studio = buildStudioContent(loaderFor('studio'), fader);
    const focusPods = buildFocusPods(loaderFor('focus'), fader);
    const accessHub = buildAccessHub(loaderFor('access'), fader);
    // Karpet seluruh lantai disamakan dengan karpet ruang rapat begitu GLB-nya dimuat
    // (Pantry memakai keramik mozaik sendiri).
    const board = buildBoardroom(loaderFor('boardroom'), fader, (mat) => {
      main.setCarpetMaterial(mat);
      foyer.setCarpetMaterial(mat);
      bus.setCarpetMaterial(mat);
      manager.setCarpetMaterial(mat);
    });
    floor1.add(main.group, bus.group, foyer.group, board.group, manager.group, pantry.group, lobby.group, lounge.group, server.group, commons.group, garden.group, workshop.group, infoWall.group, collabPods.group, studio.group, focusPods.group, accessHub.group);

    // Avatar berada di level lantai karena berpindah antar-ruangan.
    const avatarsGroup = new THREE.Group();
    avatarsGroup.name = 'AgentAvatars';
    floor1.add(avatarsGroup);
    building.updateMatrixWorld(true);
    // Papan "QUIET ZONE" Focus Pods menempel di dinding timur Lounge (ikut memudar) sebelum dinding didaftarkan.
    focusPods.attachSign(lounge.group.getObjectByName('East_Wall'));
    main.bindWalls();
    board.bindWalls();
    foyer.bindWalls();
    bus.bindWalls();
    manager.bindWalls();
    pantry.bindWalls();
    lobby.bindWalls();
    lounge.bindWalls();
    server.bindWalls();
    commons.bindWalls();
    garden.bindWalls();
    workshop.bindWalls();
    infoWall.bindWalls();
    collabPods.bindWalls();
    studio.bindWalls();
    focusPods.bindWalls();
    accessHub.bindWalls();

    // ---- Tapak dunia tiap ruangan (ruangan tidak diputar, jadi cukup dua sudutnya) ----
    const worldZone = (g: THREE.Object3D, minX: number, maxX: number, minZ: number, maxZ: number): WalkZone => {
      const a = g.localToWorld(new THREE.Vector3(minX, 0, minZ));
      const b = g.localToWorld(new THREE.Vector3(maxX, 0, maxZ));
      return { minX: Math.min(a.x, b.x), maxX: Math.max(a.x, b.x), minZ: Math.min(a.z, b.z), maxZ: Math.max(a.z, b.z) };
    };
    const zones = {
      main: worldZone(main.group, -ROOM_MAIN.halfX, ROOM_MAIN.halfX, -ROOM_MAIN.halfZ, ROOM_MAIN.halfZ),
      board: worldZone(board.group, -ROOM_BOARDROOM.half, ROOM_BOARDROOM.half, -ROOM_BOARDROOM.half, ROOM_BOARDROOM.half),
      foyer: worldZone(foyer.group, -ROOM_FOYER.halfX, ROOM_FOYER.halfX, -ROOM_FOYER.halfZ, ROOM_FOYER.halfZ),
      // Termasuk tebal dinding kaca selatan yang berdiri di luar lebar 2,4 m.
      bus: worldZone(bus.group, -CORRIDOR_BUS.halfLength, CORRIDOR_BUS.halfLength, -CORRIDOR_BUS.halfWidth, CORRIDOR_BUS.halfWidth + WALL_THICKNESS),
      manager: worldZone(manager.group, -ROOM_MANAGER.halfX, ROOM_MANAGER.halfX, -ROOM_MANAGER.halfZ, ROOM_MANAGER.halfZ),
      pantry: worldZone(pantry.group, -ROOM_PANTRY.halfX, ROOM_PANTRY.halfX, -ROOM_PANTRY.halfZ, ROOM_PANTRY.halfZ),
      lobby: worldZone(lobby.group, -ROOM_LOBBY.halfX, ROOM_LOBBY.halfX, -ROOM_LOBBY.halfZ, ROOM_LOBBY.halfZ),
      lounge: worldZone(lounge.group, -ROOM_LOUNGE.halfX, ROOM_LOUNGE.halfX, -ROOM_LOUNGE.halfZ, ROOM_LOUNGE.halfZ),
      server: worldZone(server.group, -ROOM_SERVER.halfX, ROOM_SERVER.halfX, -ROOM_SERVER.halfZ, ROOM_SERVER.halfZ),
      commons: worldZone(commons.group, -ROOM_COMMONS.halfX, ROOM_COMMONS.halfX, -ROOM_COMMONS.halfZ, ROOM_COMMONS.halfZ),
      garden: worldZone(garden.group, -ROOM_GARDEN.halfX, ROOM_GARDEN.halfX, -ROOM_GARDEN.halfZ, ROOM_GARDEN.halfZ),
      workshop: worldZone(workshop.group, -ROOM_WORKSHOP.halfX, ROOM_WORKSHOP.halfX, -ROOM_WORKSHOP.halfZ, ROOM_WORKSHOP.halfZ),
      infowall: worldZone(infoWall.group, -ROOM_INFOWALL.halfX, ROOM_INFOWALL.halfX, -ROOM_INFOWALL.halfZ, ROOM_INFOWALL.halfZ),
      collabpods: worldZone(collabPods.group, -ROOM_COLLABPODS.halfX, ROOM_COLLABPODS.halfX, -ROOM_COLLABPODS.halfZ, ROOM_COLLABPODS.halfZ),
      studio: worldZone(studio.group, -ROOM_STUDIO.halfX, ROOM_STUDIO.halfX, -ROOM_STUDIO.halfZ, ROOM_STUDIO.halfZ),
      focus: worldZone(focusPods.group, -ROOM_FOCUS.halfX, ROOM_FOCUS.halfX, -ROOM_FOCUS.halfZ, ROOM_FOCUS.halfZ),
      access: worldZone(accessHub.group, -ROOM_ACCESS.halfX, ROOM_ACCESS.halfX, -ROOM_ACCESS.halfZ, ROOM_ACCESS.halfZ),
    };
    // Free Cam di dalam tapak ini & di bawah tinggi dinding = mode jalan kaki (dinding utuh).
    fader.setWalkZones(Object.values(zones), WALL_HEIGHT);

    const zoneBox = (list: WalkZone[]) => {
      const box = new THREE.Box3();
      for (const z of list) {
        box.expandByPoint(new THREE.Vector3(z.minX, 0, z.minZ));
        box.expandByPoint(new THREE.Vector3(z.maxX, WALL_HEIGHT, z.maxZ));
      }
      return box;
    };

    // ---- Bayangan matahari (Grafis Tinggi). Arah & matriks pandang matahari tetap (pusat tapak);
    // hanya persegi frustum (ruang cahaya) yang mengikuti area lantai yang terlihat kamera, dibulatkan
    // ke kelipatan 2 m & di-snap ke ukuran texel supaya bayangan tidak berkedip saat kamera digeser. ----
    const siteBox = zoneBox(Object.values(zones));
    const sunView = new THREE.Matrix4();
    const siteLight = { lo: new THREE.Vector3(), hi: new THREE.Vector3() };
    {
      const center = siteBox.getCenter(new THREE.Vector3()).setY(0);
      sun.position.copy(center).add(SUN_OFFSET);
      sun.target.position.copy(center);
      sun.target.updateMatrixWorld();
      sunView.lookAt(sun.position, center, THREE.Object3D.DEFAULT_UP).setPosition(sun.position).invert();
      siteLight.lo.set(Infinity, Infinity, Infinity);
      siteLight.hi.set(-Infinity, -Infinity, -Infinity);
      const p = new THREE.Vector3();
      for (const x of [siteBox.min.x, siteBox.max.x]) for (const y of [-0.3, siteBox.max.y]) for (const z of [siteBox.min.z, siteBox.max.z]) {
        p.set(x, y, z).applyMatrix4(sunView);
        siteLight.lo.min(p);
        siteLight.hi.max(p);
      }
      const sc = sun.shadow.camera;
      sc.near = Math.max(0.5, -siteLight.hi.z - 2);
      sc.far = -siteLight.lo.z + 2;
      sc.left = siteLight.lo.x - 0.5; sc.right = siteLight.hi.x + 0.5;
      sc.bottom = siteLight.lo.y - 0.5; sc.top = siteLight.hi.y + 0.5;
      sc.updateProjectionMatrix();
    }
    const fitTmp = { near: new THREE.Vector3(), far: new THREE.Vector3(), p: new THREE.Vector3(), lo: new THREE.Vector3(), hi: new THREE.Vector3() };
    let sunFitKey = '';
    /** Paskan frustum bayangan ke tapak lantai yang terlihat kamera aktif (dipanggil per frame di mode Tinggi). */
    const fitSunToView = (camera: THREE.Camera, maxDist = 45) => {
      const { near, far, p, lo, hi } = fitTmp;
      lo.set(Infinity, Infinity, Infinity);
      hi.set(-Infinity, -Infinity, -Infinity);
      const add = (x: number, z: number) => {
        x = THREE.MathUtils.clamp(x, siteBox.min.x - 0.5, siteBox.max.x + 0.5);
        z = THREE.MathUtils.clamp(z, siteBox.min.z - 0.5, siteBox.max.z + 0.5);
        for (const y of [0, WALL_HEIGHT]) {
          p.set(x, y, z).applyMatrix4(sunView);
          lo.min(p);
          hi.max(p);
        }
      };
      for (const [nx, ny] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0]] as const) {
        near.set(nx, ny, -1).unproject(camera);
        far.set(nx, ny, 1).unproject(camera);
        far.sub(near).normalize();
        for (const h of [0, WALL_HEIGHT]) {
          const t = far.y < -1e-3 ? (h - near.y) / far.y : -1;
          const d = t > 0 ? Math.min(t, maxDist) : maxDist;
          add(near.x + far.x * d, near.z + far.z * d);
        }
      }
      if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) add(camera.position.x, camera.position.z);
      const step = 2;
      const w = Math.min(Math.ceil((hi.x - lo.x + 1) / step) * step, siteLight.hi.x - siteLight.lo.x + 2);
      const h = Math.min(Math.ceil((hi.y - lo.y + 1) / step) * step, siteLight.hi.y - siteLight.lo.y + 2);
      const tx = w / SHADOW_MAP_SIZE, ty = h / SHADOW_MAP_SIZE;
      const left = Math.floor((lo.x - 0.5) / tx) * tx;
      const bottom = Math.floor((lo.y - 0.5) / ty) * ty;
      const key = `${left.toFixed(4)}|${bottom.toFixed(4)}|${w}|${h}`;
      if (key === sunFitKey) return;
      sunFitKey = key;
      const sc = sun.shadow.camera;
      sc.left = left; sc.right = left + w;
      sc.bottom = bottom; sc.top = bottom + h;
      sc.updateProjectionMatrix();
    };

    // ---- Culling kanvas animasi: layar NOC & Information Wall hanya digambar ulang saat terlihat ----
    const roomBoxes = { server: zoneBox([zones.server]), infowall: zoneBox([zones.infowall]) };
    const viewFrustum = new THREE.Frustum();
    const viewProj = new THREE.Matrix4();
    let frustumReady = false;
    const roomInView = (b: THREE.Box3) => !frustumReady || viewFrustum.intersectsBox(b);

    // ---- Genangan cahaya palsu di tiap titik lampu + pool 3 PointLight (Grafis Tinggi) ----
    scene.updateMatrixWorld(true);
    const anchorObjects: THREE.Object3D[] = [];
    scene.traverse((o) => { if (o.userData.lightAnchor) anchorObjects.push(o); });
    const lightPools = new LightPools(anchorObjects, Object.values(zones));
    lightPools.setHigh(QUALITY[quality].shadows);
    scene.add(lightPools.group);

    // ---- Bingkai awal kamera: klaster inti (ruang kerja + ruang rapat + foyer + ruas bus di
    // depannya) dan ruangan Tahap 2 di seberang Jalan Utama (Ruang Manajer & Pantry) ----
    {
      // Server / IT (X 18..22) sengaja di luar bingkai home: memasukkannya menurunkan zoom ±16% (0,63 → 0,53).
      // Tahap 4 (keputusan CEO): Commons & Garden (X 15..27) juga di luar bingkai; memasukkan semuanya
      // menurunkan zoom ±24%. Ketiga ruangan itu dijangkau lewat pilihan "Fokus: ruangan".
      const core = zoneBox([zones.main, zones.board, zones.foyer, zones.manager, zones.pantry, zones.lobby, zones.lounge]);
      core.max.z = Math.max(core.max.z, zones.bus.maxZ);
      cam.setHomeBox(core);
    }

    // ================================================================
    // NAVIGASI GEDUNG: graf murni dari @office/world (sama persis dengan sutradara dunia di server)
    // ================================================================
    const nav = createFloor1Nav();
    const worldSpots = floor1Spots();
    const boardDoorWorld = () => {
      const v = board.group.localToWorld(new THREE.Vector3(BOARDROOM.doorInside.x, 0, BOARDROOM.doorInside.z));
      return { x: v.x, z: v.z };
    };

    const meshMap = new Map<string, AgentMeshRefs>();
    // ================================================================
    // DESK STATIONS (Meja, Kursi, Monitor SATU SISI LAYAR DEPAN SAJA)
    // Dibangun SEKALI. desk.glb & Office_Ergonomic_Chair.glb (dimuat bersamaan) menggantikan
    // placeholder di slotnya masing-masing; monitor, keyboard, dan titik duduk tidak dibangun ulang.
    // ================================================================
    const seatAnchorOf = new Map<string, THREE.Object3D>();

    /** Sub-layer meja per ruangan (koordinat meja LOKAL terhadap ruangannya). */
    const deskRooms = {
      main: { group: main.group, workstations: main.workstations, chairs: main.chairs, seatAnchors: main.seatAnchors },
      manager: { group: manager.group, workstations: manager.workstations, chairs: manager.chairs, seatAnchors: manager.seatAnchors },
    } as const;

    /** Geometri & material bersama 10 meja (bukan puluhan BoxGeometry per agen). */
    const deskShared = {
      deskPhGeo: new THREE.BoxGeometry(1.4, 0.75, 0.7),
      deskPhMat: new THREE.MeshStandardMaterial({ color: 0x182a32, roughness: 0.6, metalness: 0.2 }),
      chairPhGeo: new THREE.BoxGeometry(0.5, 0.45, 0.5),
      chairPhMat: new THREE.MeshStandardMaterial({ color: 0x111c22, roughness: 0.8 }),
      kbGeo: new THREE.BoxGeometry(0.32, 0.015, 0.12),
      kbMat: new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.7, metalness: 0.3 }),
      mouseGeo: new THREE.BoxGeometry(0.06, 0.02, 0.09),
      mouseMat: new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 }),
      monGeo: new THREE.BoxGeometry(0.62, 0.36, 0.04),
      casingMat: new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.85, metalness: 0.2 }),
      ringGeo: new THREE.RingGeometry(0.8, 0.9, 32),
    };
    const deskSlots: THREE.Group[] = [];
    const chairSlots: THREE.Group[] = [];
    // Pendar layar di permukaan meja (pengganti 10 PointLight screenGlow).
    const deskGlows = new DeskGlows(initAgents.length);
    scene.add(deskGlows.mesh);

    const buildDesks = () => {
      initAgents.forEach((ag, agentIndex) => {
        const posInfo = AGENT_3D_POSITIONS[ag.id];
        if (!posInfo) return;
        const room = deskRooms[posInfo.room ?? 'main'];
        const color = new THREE.Color(ag.color);

        const g = new THREE.Group();
        g.name = `Workstation_${ag.id}`;
        g.position.set(posInfo.x, 0, posInfo.z);
        g.rotation.y = posInfo.rotY;
        g.userData = { agentId: ag.id };

        // Meja Kerja (Raka: meja L walnut Ruang Manajer)
        if (posInfo.style === 'executive') {
          g.add(manager.executiveDesk());
        } else {
          const slot = new THREE.Group();
          slot.name = 'Desk_Slot';
          const m = new THREE.Mesh(deskShared.deskPhGeo, deskShared.deskPhMat);
          m.position.y = 0.375;
          m.castShadow = true;
          m.receiveShadow = true;
          slot.add(m);
          g.add(slot);
          deskSlots.push(slot);
        }

        // Keyboard di atas meja (z = 0.10 local)
        const kb = new THREE.Mesh(deskShared.kbGeo, deskShared.kbMat);
        // Aksesori meja mengikuti tinggi permukaan meja (desk.glb 0,754 m; meja L Raka 0,75 m).
        const dy = (posInfo.style === 'executive' ? MANAGER.deskTopY : 0.754) - 0.754;
        kb.position.set(0, 0.765 + dy, 0.10);
        g.add(kb);

        const mouseMesh = new THREE.Mesh(deskShared.mouseGeo, deskShared.mouseMat);
        mouseMesh.position.set(0.24, 0.765 + dy, 0.10);
        g.add(mouseMesh);

        // ==============================================================
        // MONITOR: HANYA SATU LAYAR DEPAN AKTIF, BELAKANG MATTE PLASTIK!
        // BoxGeometry index 4 = +Z (layar menghadap karyawan), sisanya casing.
        // ==============================================================
        const casingMat = deskShared.casingMat;
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
        const mon = new THREE.Mesh(deskShared.monGeo, monitorMaterials);
        mon.position.set(0, 0.95 + dy, -0.2);
        mon.castShadow = true;
        g.add(mon);

        // Selection Ring
        const ringMat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0 });
        const ring = new THREE.Mesh(deskShared.ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.01;
        g.add(ring);

        room.workstations.add(g);
        // Pendar layar ke meja: bidang aditif di permukaan meja, di depan monitor.
        deskGlows.place(agentIndex, g, 0, 0.757 + dy, 0.02, 1.0, 0.62);

        // Kursi kerja (SubLayer_Chairs) di titik duduk, menghadap ke meja
        const sp = sitLocal(posInfo);
        const sRotY = posInfo.rotY + Math.PI; // Karyawan duduk menghadap KE MEJA!
        const cg = new THREE.Group();
        cg.name = `Chair_${ag.id}`;
        cg.userData = { agentId: ag.id };
        cg.position.set(sp.x, 0, sp.z);
        cg.rotation.y = sRotY;
        if (posInfo.style === 'executive') {
          // Raka: kursi eksekutif kulit (GLB sendiri). Placeholder milik sendiri (dibuang mountAsset).
          const ph = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.5), deskShared.chairPhMat.clone());
          ph.position.set(0, 0.225, 0);
          ph.castShadow = true;
          cg.add(manager.executiveChair(ph));
        } else {
          const slot = new THREE.Group();
          slot.name = 'Chair_Slot';
          const ph = new THREE.Mesh(deskShared.chairPhGeo, deskShared.chairPhMat);
          ph.position.set(0, 0.225, 0);
          ph.castShadow = true;
          slot.add(ph);
          cg.add(slot);
          chairSlots.push(slot);
        }
        room.chairs.add(cg);

        // Seat anchor (SubLayer_SeatAnchors): posisi duduk dibaca lewat getWorldPosition.
        const anchor = new THREE.Object3D();
        anchor.name = `SeatAnchor_${ag.id}`;
        anchor.position.set(sp.x, sp.y, sp.z);
        anchor.rotation.y = sRotY;
        room.seatAnchors.add(anchor);
        seatAnchorOf.set(ag.id, anchor);
        anchor.updateWorldMatrix(true, false);
        const wp = anchor.getWorldPosition(new THREE.Vector3());
        const sitPos = { x: wp.x, y: wp.y, z: wp.z };
        const vl = visitSpotFor(posInfo);
        const vw = room.group.localToWorld(new THREE.Vector3(vl.x, 0, vl.z));
        const visitPos = { x: vw.x, z: vw.z };

        meshMap.set(ag.id, {
          deskGroup: g, monitor: mon, screenMat,
          glowIndex: agentIndex, glowColor: color,
          selRing: ring,
          sitPos, sitRotY: sRotY, visitPos,
        });
      });
    };

    /** Ganti placeholder meja/kursi dengan GLB (sekali, setelah kedua template siap). */
    const mountDeskModels = (deskT: THREE.Group | null, chairT: THREE.Group | null) => {
      const fill = (slots: THREE.Group[], tpl: THREE.Group | null) => {
        if (tpl) enableShadow(tpl);
        for (const slot of slots) {
          if (tpl) {
            slot.clear(); // placeholder memakai geometri bersama: cukup dilepas, dibuang saat unmount
            slot.add(tpl.clone(true));
          }
          contactShadows.addFootprint(slot, slot);
        }
      };
      fill(deskSlots, deskT);
      fill(chairSlots, chairT);
    };

    // ================================================================
    // AVATAR AGEN (F1, rencana FPV §3.2): Rig v2 1,70 m — satu SkinnedMesh per agen, siku & lutut (IK),
    // kepala menoleh, seragam Navy Tech. `?rig=v1` = avatar chibi lama (perbandingan selama migrasi).
    // ================================================================
    const v2Shared = createAvatarShared();
    const v1Shared = RIG_VERSION === 1 ? createV1Shared() : null;
    const agentIdx = new Map(initAgents.map((a, i) => [a.id, i] as const));

    const buildAvatars = () => {
      initAgents.forEach((ag, idx) => {
        const refs = meshMap.get(ag.id);
        if (!refs) return;
        const color = new THREE.Color(ag.color);
        const av: AgentAvatar = v1Shared ? new V1Avatar(ag.id, color, idx, v1Shared) : new V2Avatar(ag.id, ag.name, color, idx, v2Shared);
        av.group.position.set(refs.sitPos.x, 0, refs.sitPos.z);
        av.group.rotation.y = refs.sitRotY;
        avatarsGroup.add(av.group);
        contactShadows.addAvatar(av.group);
        refs.av = av;
      });
    };

    // ================================================================
    // SPEECH BUBBLE DOM (Imperatively-managed)
    // ================================================================
    /** Elemen bubble per agen (tanpa querySelector di loop render). */
    const bubbleEls = new Map<string, { el: HTMLDivElement; txt: HTMLSpanElement; text: string; shown: boolean; x: number; y: number; op: number }>();
    const initBubbles = () => {
      const bc = bubbleRef.current;
      if (!bc) return;
      initAgents.forEach((ag) => {
        const div = document.createElement('div');
        div.dataset.agent = ag.id;
        // Diposisikan lewat transform (komposit GPU, tanpa layout ulang). Tanpa backdrop-filter:
        // latar 94% opak, blur di atas kanvas WebGL hanya membebani GPU setiap frame.
        Object.assign(div.style, {
          position: 'absolute', display: 'none',
          left: '0px', top: '0px',
          willChange: 'transform',
          background: 'rgba(12, 22, 28, 0.94)',
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
        bubbleEls.set(ag.id, { el: div, txt, text: '', shown: false, x: NaN, y: NaN, op: -1 });

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

    buildDesks();
    buildAvatars();
    initBubbles();

    // F2: titik rutinitas murni (@office/world, dipakai sutradara server) harus sama dengan scene graph.
    if (import.meta.env.DEV) {
      const bad: string[] = [];
      const near = (a: Pt, b: Pt, what: string) => {
        if (Math.hypot(a.x - b.x, a.z - b.z) > 0.002) bad.push(`${what}: (${a.x.toFixed(3)}, ${a.z.toFixed(3)}) ≠ (${b.x.toFixed(3)}, ${b.z.toFixed(3)})`);
      };
      const pairs = (xs: ReadonlyArray<{ spot: Spot; approach: Spot }>, ys: ReadonlyArray<{ spot: Spot; approach: Spot }>, what: string) => {
        if (xs.length !== ys.length) bad.push(`${what}: jumlah ${xs.length} ≠ ${ys.length}`);
        xs.forEach((s, i) => {
          const y = ys[i];
          if (!y) return;
          near(s.spot, y.spot, `${what}[${i}].spot`);
          near(s.approach, y.approach, `${what}[${i}].approach`);
          if (Math.abs(s.spot.rotY - y.spot.rotY) > 1e-6) bad.push(`${what}[${i}].rotY`);
        });
      };
      near(lobby.spawnWorld(), worldSpots.lobbySpawn, 'lobbySpawn');
      pairs(lounge.seatsWorld(), worldSpots.sofa, 'sofa');
      pairs(commons.seatsWorld(), worldSpots.commons, 'commons');
      pairs(garden.seatsWorld(), worldSpots.garden, 'garden');
      pairs(workshop.seatsWorld(), worldSpots.workshop, 'workshop');
      near(workshop.presenterWorld(), worldSpots.presenter, 'presenter');
      infoWall.observersWorld().forEach((s, i) => near(s, worldSpots.infoWall[i]!, `infoWall[${i}]`));
      pairs(collabPods.seatsWorld(), worldSpots.pods, 'pods');
      pairs(focusPods.seatsWorld(), worldSpots.focus, 'focus');
      const st = studio.spotsWorld();
      near(st.talent, worldSpots.studio.talent, 'studio.talent');
      near(st.director, worldSpots.studio.director, 'studio.director');
      pairs([st.editor], [worldSpots.studio.editor], 'studio.editor');
      const ac = accessHub.spotsWorld();
      near(ac.map, worldSpots.access.map, 'access.map');
      near(ac.lift, worldSpots.access.lift, 'access.lift');
      near(server.inspectWorld(), worldSpots.serverInspect, 'server.inspect');
      pairs([server.consoleSeatWorld()], [worldSpots.serverConsole], 'server.console');
      BOARDROOM_SEATS.forEach((_, i) => {
        near(board.approachWorld(i), boardroomSpots.approach(i), `board.approach[${i}]`);
        const a = board.seatWorld(i, 0.5), b = boardroomSpots.seat(i, 0.5);
        near({ x: a.x, z: a.z }, b, `board.seat[${i}]`);
        if (Math.abs(a.y - b.y) > 0.002) bad.push(`board.seat[${i}].y`);
      });
      near(boardDoorWorld(), worldSpots.boardDoorInside, 'board.doorInside');
      for (const ag of initAgents) {
        const r = meshMap.get(ag.id), d = deskSeat(ag.id);
        if (!r || !d) continue;
        near({ x: r.sitPos.x, z: r.sitPos.z }, d, `desk.${ag.id}`);
        if (Math.abs(r.sitPos.y - d.y) > 0.002 || Math.abs(r.sitRotY - d.rotY) > 1e-6) bad.push(`desk.${ag.id}.y/rotY`);
        near(r.visitPos, d.visit, `visit.${ag.id}`);
      }
      PANTRY.queue.forEach((q, i) => {
        const v = pantry.group.localToWorld(new THREE.Vector3(q.x, 0, q.z));
        near({ x: v.x, z: v.z }, worldSpots.coffeeQueue[i]!, `coffee[${i}]`);
      });
      worldSpots.stools.forEach((s, i) => {
        const v = pantry.group.localToWorld(new THREE.Vector3(PANTRY.stoolX, 0, PANTRY.stoolZ[i]!));
        near({ x: v.x, z: v.z }, s.seat, `stool[${i}]`);
      });
      if (bad.length) console.warn('[office] Titik dunia @office/world TIDAK cocok dengan scene graph:', bad);
      else console.info('[office] F2: semua titik dunia @office/world cocok dengan scene graph.');
    }

    // Template meja & kursi kerja: ditunggu bersamaan, lalu dipasang SEKALI di slotnya.
    void Promise.all([loadAsync('/models/desk.glb'), loadAsync('/models/Office_Ergonomic_Chair.glb')]).then(([deskT, chairT]) => {
      if (!disposed) mountDeskModels(deskT, chairT);
    });

    // ================================================================
    // PEMILIHAN AGEN (klik tanpa seret, kedua mode kamera)
    // ================================================================
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let downX = 0;
    let downY = 0;
    let glanceX = 0;
    let glanceY = 0;
    const visibleChain = (o: THREE.Object3D | null) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
    /** Agen di bawah kursor (avatar terlihat, meja, atau kursinya), null bila tidak ada. */
    const pickAgent = (clientX: number, clientY: number): string | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, cam.active());
      const hits = raycaster.intersectObjects([
        main.workstations, main.chairs, manager.workstations, manager.chairs, avatarsGroup,
      ], true).filter((h) => visibleChain(h.object));
      for (const h of hits.slice(0, 1)) {
        let obj: THREE.Object3D | null = h.object;
        while (obj && !obj.userData?.agentId) obj = obj.parent;
        if (obj?.userData?.agentId) return obj.userData.agentId as string;
      }
      return null;
    };
    const onPointerDown = (ev: PointerEvent) => {
      downX = ev.clientX; downY = ev.clientY;
      // F3: seret di mode mata = lirik (yaw ±60°, pitch ±35°).
      if (eye.phase === 'on') { eye.glanceStart(); glanceX = ev.clientX; glanceY = ev.clientY; }
    };
    const onPointerUp = (ev: PointerEvent) => {
      if (Math.hypot(ev.clientX - downX, ev.clientY - downY) > 6) return;
      const id = pickAgent(ev.clientX, ev.clientY);
      if (id) onSelectRef.current(id);
    };
    const onGlanceMove = (ev: PointerEvent) => {
      if (!eye.glancing) return;
      eye.glanceBy(ev.clientX - glanceX, ev.clientY - glanceY);
      glanceX = ev.clientX; glanceY = ev.clientY;
    };
    const onGlanceUp = () => eye.glanceEnd();
    /** F3: klik ganda pada agen = masuk Mata Agen. */
    const onDblClick = (ev: MouseEvent) => {
      const id = pickAgent(ev.clientX, ev.clientY);
      if (id) enterEye(id);
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('dblclick', onDblClick);
    window.addEventListener('pointermove', onGlanceMove);
    window.addEventListener('pointerup', onGlanceUp);

    // ================================================================
    // RESIZE
    // ================================================================
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth, h = container.clientHeight;
      if (w === 0 || h === 0) return;
      viewW = w;
      viewH = h;
      renderer.setSize(w, h);
      cam.resize(w, h);
      cam.poke();
    };
    window.addEventListener('resize', handleResize);

    // ================================================================
    // RENDERER DUNIA (F2): keadaan agen dari WorldFeed — sutradara di server (live, sama untuk semua
    // penonton) atau WorldSim lokal (demo / server mati). Panggung hanya merender pose & ruangan.
    // ================================================================
    let globalTime = 0;
    /** Riwayat jumlah agen aktif untuk grafik layar Information Wall (1 sampel / detik). */
    const activityHistory: number[] = [];
    let lastCodeUpdate = 0;
    let lastKpiT = -Infinity;
    let view: WorldView | null = null;
    const frameOf = new Map<string, AgentFrame>();
    let lastMeetingPhase: string | null = null;
    let focusBackAt = 0;
    let lastBoardInfo = '';
    let lastStatusKey = '';
    const agentName = (id: string) => initAgents.find((a) => a.id === id)?.name ?? id;
    const tempVec = new THREE.Vector3();

    // F1: kalibrasi dudukan & tolehan kepala (logika keadaan tetap di @office/world, pose di avatar/).
    const roomOfAgent = new Map<string, string>();
    const lookTmp = new THREE.Vector3();
    const tvWorld = board.group.localToWorld(new THREE.Vector3(BOARDROOM.tv.x, BOARDROOM.tv.y, BOARDROOM.tv.z));
    const workshopDisplay = workshop.group.localToWorld(new THREE.Vector3(WORKSHOP.display.x, WORKSHOP.display.y, WORKSHOP.display.z));
    const lookWorld: LookWorld = {
      frames: [],
      headOf: (id, out) => meshMap.get(id)?.av?.headWorld(out) ?? null,
      roomOf: (f) => roomOfAgent.get(f.id) ?? '',
      meetingSession: false,
      tv: tvWorld,
      workshopDisplay,
    };
    let hideAgents = false;

    /** Pose dari keadaan dunia: jenis dudukan → kalibrasi, target tatapan → tolehan. */
    const applyAgent = (f: AgentFrame, refs: AgentMeshRefs, t: number, dt: number) => {
      const av = refs.av;
      if (!av) return;
      const idx = agentIdx.get(f.id) ?? 0;
      const kind = seatKindFor(f, roomOfAgent.get(f.id) ?? '');
      const seat = kind ? seatCalibAt(kind, f.x, f.z, worldSpots) : null;
      const look = av.version === 2 ? chooseLook(f, idx, seat, lookWorld, lookTmp) : NO_LOOK;
      av.apply(f, { t, dt, seat, look });
      if (hideAgents) av.group.visible = false;
    };

    // ================================================================
    // LANGKAH PER FRAME (dunia → avatar, layar, pintu, KPI)
    // ================================================================
    const step = (dt: number) => {
      globalTime += dt;

      // Update monitor animated canvas setiap ~0.25 detik
      if (globalTime - lastCodeUpdate > 0.25) {
        lastCodeUpdate = globalTime;
        codeScrollOffset = (codeScrollOffset + 1) % sampleLines.length;
        renderCodeTexture();
      }

      const v = feedRef.current ? feedRef.current.sample(dt) : null;
      if (!v) return;
      view = v;
      const sel = selectedRef.current;
      const t = globalTime;
      frameOf.clear();
      roomOfAgent.clear();
      for (const f of v.agents) roomOfAgent.set(f.id, f.vis ? nav.roomAt({ x: f.x, z: f.z }) ?? '' : '');
      lookWorld.frames = v.agents;
      lookWorld.meetingSession = v.props.meeting?.phase === 'session';

      for (const f of v.agents) {
        frameOf.set(f.id, f);
        const refs = meshMap.get(f.id);
        if (!refs) continue;
        const isSelected = f.id === sel;
        (refs.selRing.material as THREE.MeshBasicMaterial).opacity = isSelected ? 0.75 : 0;

        const av = refs.av;
        if (!av) continue;
        // Beacon melayang di atas kepala (posisi & putaran dasar diatur avatar).
        const beacon = av.beacon;
        let glow = isSelected ? 3.0 : 1.8 + Math.sin(t * 4 + (agentIdx.get(f.id) ?? 0) * 0.7) * 0.3;

        // Visual mengikuti status asli (live)
        const status = f.status;
        const beaconMat = beacon.material as THREE.MeshStandardMaterial;
        if (status !== null) {
          const look = STATUS_LOOK[status];
          if (refs.screenMat) {
            refs.screenMat.emissive.setHex(look.screen);
            refs.screenMat.emissiveIntensity = look.screenIntensity;
          }
          glow *= look.glow;
          if (look.beacon !== null) {
            beaconMat.emissive.setHex(look.beacon);
            beaconMat.color.setHex(look.beacon);
          } else {
            beaconMat.emissive.set(beaconMat.userData.baseColor ?? beaconMat.color);
            beaconMat.color.set(beaconMat.userData.baseColor ?? beaconMat.color);
          }
          const pulse = status === 'waiting_approval' || status === 'error' ? 0.6 + Math.abs(Math.sin(t * 4)) * 1.6 : 1;
          beaconMat.emissiveIntensity = (isSelected ? 1.8 : look.beaconIntensity) * pulse;
          beacon.rotation.y += status === 'thinking' || status === 'working' ? 0.06 : 0;
        } else {
          if (refs.screenMat) {
            refs.screenMat.emissive.setHex(0xffffff);
            refs.screenMat.emissiveIntensity = 2.2;
          }
          if (beaconMat.userData.baseColor) {
            beaconMat.emissive.set(beaconMat.userData.baseColor);
            beaconMat.color.set(beaconMat.userData.baseColor);
          }
          beaconMat.emissiveIntensity = isSelected ? 1.8 : 0.9;
        }
        deskGlows.setColor(refs.glowIndex, refs.glowColor, glow * 0.15);
        applyAgent(f, refs, t, dt);
      }

      deskGlows.commit();
      // F3: agen yang diikuti pergi (away / tidak terlihat) → kamera keluar ke isometrik + toast.
      if (eye.agentId && (eye.phase === 'glideIn' || eye.phase === 'on')) {
        const ef = frameOf.get(eye.agentId);
        if (!ef || !ef.vis || ef.state === 'away') { eyeExitReason = 'away'; eye.exit(); }
      }
      // Status dunia berubah → beri tahu App (Inspector mode publik tanpa /api/state).
      const statusKey = v.agents.map((f) => f.status ?? '-').join(',');
      if (statusKey !== lastStatusKey) {
        lastStatusKey = statusKey;
        const map: Record<string, AgentStatus> = {};
        for (const f of v.agents) if (f.status) map[f.id] = f.status;
        if (Object.keys(map).length > 0) onStatusesRef.current?.(map);
      }
      main.update(globalTime);
      board.applyRigs(v.rigs);
      // Pintu otomatis (sensor gerak), LED rak & layar NOC.
      const agentPts: Pt[] = [];
      for (const r of meshMap.values()) if (r.av?.group.visible) agentPts.push({ x: r.av.group.position.x, z: r.av.group.position.z });
      lobby.update(dt, agentPts);
      server.update(globalTime, dt, agentPts, roomInView(roomBoxes.server));
      garden.update(globalTime, dt, agentPts);
      workshop.update(globalTime);
      collabPods.setOccupancy(v.props.pods);
      focusPods.update(dt, agentPts);
      accessHub.update(dt, agentPts);
      focusPods.setBusy(v.props.focus);
      studio.setOnAir(v.props.onAir);
      accessHub.setLiftCalled(v.props.liftCalled);

      // Layar TV rapat & status foyer; kamera ikut rapat (kecuali CEO baru menggeser kamera).
      const m = v.props.meeting;
      const boardInfo = m && m.phase !== 'dispersing'
        ? { phase: m.phase === 'session' ? 'session' as const : 'gathering' as const, topic: m.topic, host: m.host, seated: m.seated, total: m.total }
        : null;
      const infoKey = JSON.stringify(boardInfo);
      if (infoKey !== lastBoardInfo) {
        lastBoardInfo = infoKey;
        board.setScreen(boardInfo);
        foyer.setStatus(boardInfo);
      }
      const phase = m?.phase ?? null;
      if (phase !== lastMeetingPhase) {
        if (phase === 'gathering' && lastMeetingPhase === null) cam.focus(board.focusPoint(), { auto: true });
        if (phase === 'dispersing') focusBackAt = globalTime + 3.5;
        lastMeetingPhase = phase;
      }
      if (focusBackAt > 0 && globalTime >= focusBackAt) {
        focusBackAt = 0;
        cam.focus(cam.home(), { auto: true });
      }

      // ---------- TV KPI, kios Lobi, peta Access Hub, Information Wall, Workshop (tiap 1 detik) ----------
      if (globalTime - lastKpiT >= 1) {
        lastKpiT = globalTime;
        const isLive = v.live;
        const meetingTopic = m && m.phase !== 'dispersing' ? m.topic : null;
        const kpi: KpiInfo = { total: v.agents.length, working: 0, waiting: 0, error: 0, offline: 0, pantry: 0, meeting: meetingTopic, live: isLive };
        const rooms: Record<string, number> = {};
        let present = 0;
        const counts = { working: 0, idle: 0, waiting: 0, error: 0, offline: 0, meeting: 0 };
        const rows: InfoAgentRow[] = [];
        for (const f of v.agents) {
          const st = f.status;
          if (st === 'waiting_approval') kpi.waiting++;
          else if (st === 'error') kpi.error++;
          else if (st === 'offline') kpi.offline++;
          else if (st === null ? atDeskState(f.state) : st === 'working' || st === 'thinking' || st === 'messaging') kpi.working++;
          const room = f.state !== 'away' ? nav.roomAt({ x: f.x, z: f.z }) : '';
          if (room === 'pantry') kpi.pantry++;
          if (f.state !== 'away') {
            present += 1;
            rooms[room] = (rooms[room] ?? 0) + 1;
          }
          let tone: InfoAgentRow['tone'];
          if (st !== null) {
            tone = st === 'offline' ? 'away' : st === 'error' ? 'error' : st === 'waiting_approval' ? 'wait' : st === 'meeting' ? 'meet' : st === 'idle' ? 'idle' : 'work';
          } else {
            tone = f.state === 'away' ? 'away' : MEETING_STATES.has(f.state) ? 'meet' : atDeskState(f.state) ? 'work' : 'idle';
          }
          if (tone === 'work') counts.working++; else if (tone === 'idle') counts.idle++; else if (tone === 'wait') counts.waiting++;
          else if (tone === 'error') counts.error++; else if (tone === 'away') counts.offline++; else counts.meeting++;
          const label = { work: 'bekerja', idle: 'santai', wait: 'tunggu izin', error: 'error', meet: 'rapat', away: 'offline' }[tone];
          rows.push({ name: agentName(f.id), status: label, tone, room: room ? ROOM_SHORT[room] ?? '' : '—' });
        }
        manager.setKpi(kpi);
        lobby.setDirectory({ present, total: v.agents.length, live: isLive, rooms });
        accessHub.setMap(rooms, isLive);
        activityHistory.push(counts.working);
        if (activityHistory.length > 60) activityHistory.shift();
        const order = ['main', 'boardroom', 'manager', 'pantry', 'lobby', 'lounge', 'focus', 'server', 'garden', 'access', 'commons', 'workshop', 'studio', 'infowall', 'collabpods'];
        const info: InfoWallData = {
          live: isLive, counts, history: [...activityHistory],
          rooms: order.map((id) => [ROOM_SHORT[id] ?? id, rooms[id] ?? 0] as [string, number]),
          meeting: meetingTopic,
          agents: rows,
        };
        // Layar komando digambar ulang hanya saat Information Wall terlihat kamera.
        if (roomInView(roomBoxes.infowall)) infoWall.setScreen(info);
        workshop.setSession(v.props.workshop);
      }
    };

    // ================================================================
    // RENDER (kamera aktif, auto-fade dinding, proyeksi speech bubble)
    // ================================================================
    const focusTmp = new THREE.Vector3();
    // ---- F3: garis pandang bubble & info HUD Mata Agen ----
    const losCache = new Map<string, { t: number; ok: boolean }>();
    const losDir = new THREE.Vector3();
    const bubbleSeenFromEye = (id: string, anchor: THREE.Vector3, camera: THREE.Camera) => {
      const d = anchor.distanceTo(camera.position);
      if (d > 12) return false;
      const c = losCache.get(id);
      if (c && globalTime - c.t < 0.25) return c.ok;
      losDir.copy(anchor).sub(camera.position).normalize();
      eyeRay.set(camera.position, losDir);
      eyeRay.far = Math.max(0, d - 0.3);
      const ok = eyeRay.intersectObjects(fader.occluders(), false).length === 0;
      losCache.set(id, { t: globalTime, ok });
      return ok;
    };
    let lastEyeKey = '';
    let eyeLineFor = '';
    let eyeLastLine: string | null = null;
    const emitEyeInfo = () => {
      const id = eye.agentId;
      const showing = !!id && (eye.phase === 'glideIn' || eye.phase === 'on' || (eye.phase === 'dimIn' && eye.viewing));
      if (!showing || !id) {
        if (lastEyeKey !== '') {
          lastEyeKey = '';
          onEyeInfoRef.current?.(null, eyeExitReason);
        }
        if (!eye.active) eyeExitReason = 'exit';
        return;
      }
      if (eyeLineFor !== id) { eyeLineFor = id; eyeLastLine = null; }
      const f = frameOf.get(id);
      const speaking = f && f.bubbleT > 0 && f.bubble ? f.bubble : null;
      if (speaking) eyeLastLine = speaking;
      const room = ROOM_SHORT[roomOfAgent.get(id) ?? ''] ?? '—';
      const key = `${id}|${room}|${speaking ?? ''}|${eyeLastLine ?? ''}`;
      if (key !== lastEyeKey) {
        lastEyeKey = key;
        onEyeInfoRef.current?.({ agentId: id, room, speaking, lastLine: eyeLastLine });
      }
    };
    let promoteT = 0;
    let lastPromoted = '';
    let beaconsHiddenForEye = false;
    const beaconTmp = new THREE.Vector3();
    const renderFrame = (dt: number) => {
      cam.update(dt);
      eye.update(dt, { bob: headBobRef.current && !(motionQuery?.matches ?? false) });
      const dv = Math.round(eye.dim * 50) / 50;
      if (dv !== dimShown) {
        dimShown = dv;
        dimEl.style.display = dv > 0 ? 'block' : 'none';
        dimEl.style.opacity = String(dv);
      }
      const camera = cam.active();
      // F3: beacon status melayang setinggi mata agen yang duduk — di mode mata, beacon dalam 3,5 m (dan milik
      // agen yang diikuti) disembunyikan supaya tidak menutupi pandangan.
      if (eye.viewing || beaconsHiddenForEye) {
        beaconsHiddenForEye = eye.viewing;
        for (const [id, r] of meshMap) {
          const b = r.av?.beacon;
          if (!b) continue;
          b.visible = !(eye.viewing && (id === eye.agentId || b.getWorldPosition(beaconTmp).distanceTo(camera.position) < 3.5));
        }
      }
      camera.updateMatrixWorld();
      viewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      viewFrustum.setFromProjectionMatrix(viewProj);
      frustumReady = true;
      fader.update(camera, dt);
      contactShadows.update();
      cam.focusPoint(focusTmp);
      lightPools.update(focusTmp, dt);
      if (renderer.shadowMap.enabled) fitSunToView(camera, eye.viewing ? 14 : 45);

      // Gelombang 2: ruangan yang sedang didekati kamera langsung dimajukan antrean GLB-nya.
      promoteT -= dt;
      if (promoteT <= 0 && glbQueue.length > 0) {
        promoteT = 0.5;
        const room = nav.roomAt({ x: focusTmp.x, z: focusTmp.z });
        if (room && room !== lastPromoted) { lastPromoted = room; promoteRoom(room); }
      }

      // Speech bubble: elemen di-cache, posisi lewat transform, DOM hanya ditulis saat berubah.
      // F3: di mode mata, bubble agen yang diikuti pindah ke subtitle HUD; bubble lain hanya ≤ 12 m dan
      // tidak terhalang dinding buram.
      const eyeId = eye.viewing ? eye.agentId : null;
      for (const [agentId, b] of bubbleEls) {
        const anim = frameOf.get(agentId);
        const refs = meshMap.get(agentId);
        let shown = false;
        if (anim && refs?.av && anim.bubble && anim.bubbleT > 0 && refs.av.group.visible && agentId !== eyeId
          && (!eyeId || bubbleSeenFromEye(agentId, refs.av.bubbleAnchor(tempVec), camera))) {
          refs.av.bubbleAnchor(tempVec);
          tempVec.project(camera);
          // Di belakang kamera Free Cam: jangan tampilkan bubble
          if (tempVec.z >= -1 && tempVec.z <= 1) {
            const sx = Math.round((tempVec.x * 0.5 + 0.5) * viewW);
            const sy = Math.round((-tempVec.y * 0.5 + 0.5) * viewH);
            if (!b.shown) { b.el.style.display = 'block'; b.shown = true; }
            if (sx !== b.x || sy !== b.y) {
              b.x = sx; b.y = sy;
              b.el.style.transform = `translate3d(${sx}px, ${sy}px, 0) translate(-50%, -100%)`;
            }
            const op = Math.round(Math.min(1, anim.bubbleT / 0.4) * 50) / 50;
            if (op !== b.op) { b.op = op; b.el.style.opacity = String(op); }
            if (anim.bubble !== b.text) { b.text = anim.bubble; b.txt.textContent = anim.bubble; }
            shown = true;
          }
        }
        if (!shown && b.shown) { b.el.style.display = 'none'; b.shown = false; }
      }

      emitEyeInfo();
      renderer.render(scene, camera);
      if (!firstFrameDone) { firstFrameDone = true; maybeOpenWave2(); }
    };

    // ---- Adaptive FPS: 60 FPS saat kamera bergerak (+1,5 dtk), 30 FPS saat diam (Grafis Hemat) ----
    let nextFrameAt = 0;
    /** Render ditahan sementara shader dikompilasi di latar (awal & ganti mode grafis). */
    let renderPaused = true;
    const frameTimes: number[] = [];
    let frameMsAvg = 0;
    /** F3: lama (dtk) frameMs rata-rata > 20 ms di mode mata → target turun ke 45 FPS. */
    let eyeSlowS = 0;
    let lastAnimNow = 0;
    /**
     * Kebijakan FPS (rencana §5): kamera bergerak = activeFps, diam = idleFps. Mode mata (Hemat): agen duduk
     * diam = 30, berjalan / lirik / transisi = 60; turun ke 45 bila frame berat > 3 dtk.
     */
    const targetFps = (spec: (typeof QUALITY)[GraphicsQuality]) => {
      const moving = cam.isActive(ACTIVE_HOLD_MS) || (eye.active && eye.isMoving());
      let fps: number = moving ? spec.activeFps : spec.idleFps;
      if (eye.active && fps > 45 && eyeSlowS >= 3) fps = 45;
      return fps;
    };
    const animate = (now: number) => {
      animId = requestAnimationFrame(animate);
      if (renderPaused) return;
      const spec = QUALITY[quality];
      const interval = 1000 / targetFps(spec);
      if (now < nextFrameAt - 2) return;
      nextFrameAt = now - nextFrameAt > interval ? now + interval : nextFrameAt + interval;
      const t0 = performance.now();
      const dt = Math.min(clock.getDelta(), 0.1);
      step(dt);
      renderFrame(dt);
      frameMsAvg += (performance.now() - t0 - frameMsAvg) * 0.1;
      const since = lastAnimNow > 0 ? Math.min(0.25, (now - lastAnimNow) / 1000) : 0;
      lastAnimNow = now;
      eyeSlowS = eye.active && frameMsAvg > 20 ? eyeSlowS + since : 0;
      frameTimes.push(now);
      while (frameTimes.length > 0 && frameTimes[0]! < now - 1000) frameTimes.shift();
    };
    /** Tab kembali aktif: jangan lompatkan simulasi sebesar lamanya tab tersembunyi. */
    const onVisibility = () => {
      if (!document.hidden) { clock.getDelta(); nextFrameAt = 0; }
    };
    document.addEventListener('visibilitychange', onVisibility);

    /** Bangun ulang program shader di latar lalu lanjutkan render (maks 5 dtk menunggu). */
    const warmShadersThenRender = () => {
      renderPaused = true;
      const resume = () => {
        if (disposed) return;
        renderPaused = false;
        clock.getDelta();
        nextFrameAt = 0;
        cam.poke();
      };
      // Ditunda satu frame: mount sementara (StrictMode / remount cepat) sudah dilepas sebelum
      // kompilasi dimulai, sehingga tidak ada polling program milik renderer yang sudah dibuang.
      requestAnimationFrame(() => {
        if (disposed) return;
        Promise.race([
          renderer.compileAsync(scene, cam.active()),
          new Promise((r) => window.setTimeout(r, 5000)),
        ]).then(resume, resume);
      });
    };

    /** Ganti mode grafis tanpa me-mount ulang scene (posisi agen & kamera tetap). */
    const applyQuality = (q: GraphicsQuality) => {
      if (disposed || q === quality) return;
      quality = q;
      const spec = QUALITY[q];
      renderer.setPixelRatio(spec.pixelRatio());
      renderer.setSize(viewW, viewH);
      renderer.shadowMap.enabled = spec.shadows;
      sun.castShadow = spec.shadows;
      hemi.intensity = spec.hemi;
      scene.environmentIntensity = spec.env;
      contactShadows.setVisible(!spec.shadows);
      lightPools.setHigh(spec.shadows);
      sunFitKey = '';
      // Jumlah lampu & bayangan berubah: semua material perlu program baru.
      scene.traverse((o) => {
        const m = (o as THREE.Mesh).material;
        if (m) for (const mm of Array.isArray(m) ? m : [m]) mm.needsUpdate = true;
      });
      warmShadersThenRender();
    };
    applyQualityRef.current = applyQuality;

    // ================================================================
    // API UNTUK TOMBOL HUD
    // ================================================================
    const workspaceFocus = () => {
      const v = main.group.localToWorld(new THREE.Vector3(0, 0, 0));
      return v.setY(ISO_FOCUS_HEIGHT);
    };
    const roomFocus: Record<StageRoom, () => THREE.Vector3> = {
      workspace: workspaceFocus,
      boardroom: board.focusPoint,
      foyer: foyer.focusPoint,
      bus: bus.focusPoint,
      manager: manager.focusPoint,
      pantry: pantry.focusPoint,
      lobby: lobby.focusPoint,
      lounge: lounge.focusPoint,
      server: server.focusPoint,
      commons: commons.focusPoint,
      garden: garden.focusPoint,
      workshop: workshop.focusPoint,
      infowall: infoWall.focusPoint,
      collabpods: collabPods.focusPoint,
      studio: studio.focusPoint,
      focus: focusPods.focusPoint,
      access: accessHub.focusPoint,
    };
    // ---- F3: masuk / ganti / keluar Mata Agen ----
    function enterEye(id: string): boolean {
      const av = meshMap.get(id)?.av;
      const f = frameOf.get(id);
      if (!av || !f || !f.vis || f.state === 'away') return false;
      eye.enter(id, av.eyeSource());
      return true;
    }
    const cycleEye = (dir: 1 | -1) => {
      const ids = initAgents.map((a) => a.id).filter((id) => { const f = frameOf.get(id); return !!f && f.vis && f.state !== 'away'; });
      if (ids.length === 0) return;
      const cur = eye.agentId ? ids.indexOf(eye.agentId) : -1;
      enterEye(ids[(cur + dir + ids.length) % ids.length]!);
    };
    const onEyeKey = (e: KeyboardEvent) => {
      if (!eye.active || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || el?.isContentEditable) return;
      if (e.key === 'Escape') { eye.exit(); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { cycleEye(1); e.preventDefault(); }
      else if (e.key === 'ArrowLeft') { cycleEye(-1); e.preventDefault(); }
    };
    window.addEventListener('keydown', onEyeKey);
    /** Tinggalkan mode mata seketika (tanpa animasi) sebelum perintah kamera lain. */
    const dropEye = () => {
      if (!eye.active) return;
      const wasViewing = eye.viewing;
      eye.cancel();
      if (wasViewing) cam.setMode(eyePrev);
    };
    apiRef.current = {
      focusRoom: (room) => {
        dropEye();
        // GLB ruangan yang belum termuat (gelombang 2) langsung dimajukan ke depan antrean.
        promoteRoom(room === 'workspace' ? 'main' : room);
        cam.focus(roomFocus[room]());
      },
      toggleCamera: () => {
        if (eye.active) { eye.exit(); return; }
        cam.toggle();
      },
      resetCamera: () => { dropEye(); cam.reset(); },
      focusAgent: (agentId) => {
        dropEye();
        const refs = meshMap.get(agentId);
        if (!refs?.av) return;
        cam.focus(new THREE.Vector3(refs.av.group.position.x, 0.8, refs.av.group.position.z));
      },
      enterEye: (agentId) => enterEye(agentId),
      exitEye: () => eye.exit(),
      cycleEye: (dir) => cycleEye(dir),
    };
    if (stageApiRef) stageApiRef.current = apiRef.current;

    // Hook diagnostik khusus dev server (tidak ikut ke build produksi).
    const win = window as unknown as Record<string, unknown>;
    // ---- F1 (rencana FPV §3.2): matriks 50 dudukan & alat bantu rig ----
    const f1Group = new THREE.Group();
    f1Group.name = 'F1_SeatProbes';
    floor1.add(f1Group);
    let f1Probes: V2Avatar[] = [];
    const f1Clear = () => {
      f1Probes.forEach((p) => p.dispose());
      f1Probes = [];
      hideAgents = false;
    };
    const seatRay = new THREE.Raycaster();
    const probeTargets = () => floor1.children.filter((c) => c !== avatarsGroup && c !== f1Group);
    /** Raycaster three.js tidak memeriksa visibilitas: buang mesh tersembunyi (mis. sisa `Timber_Work_Zone`). */
    const shown = (o: THREE.Object3D | null) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
    const castVisible = () => seatRay.intersectObjects(probeTargets(), true).filter((h) => shown(h.object));
    /** Tinggi permukaan tertinggi di bawah titik (x, z), dicari di pita minY–maxY m (raycast ke GLB, tanpa avatar). */
    const seatTopAt = (x: number, z: number, maxY = 1.2, minY = 0.15): number => {
      seatRay.set(new THREE.Vector3(x, maxY, z), new THREE.Vector3(0, -1, 0));
      seatRay.far = maxY - minY;
      const hits = castVisible();
      return hits.length > 0 ? +(maxY - hits[0]!.distance).toFixed(3) : 0;
    };
    /** Ruang bebas di atas titik sampai permukaan bawah perabot (m; Infinity = bebas sejauh `up`). */
    const clearAbove = (p: THREE.Vector3, up = 0.6): number => {
      seatRay.set(p, new THREE.Vector3(0, 1, 0));
      seatRay.far = up;
      const hits = castVisible();
      return hits.length > 0 ? +hits[0]!.distance.toFixed(3) : Infinity;
    };
    /** Nama perabot yang ditembus ruas a → b (dikurangi `trimEnd` m di ujung b), null bila bersih. */
    const segmentHit = (a: THREE.Vector3, b: THREE.Vector3, trimEnd = 0): string | null => {
      const d = b.clone().sub(a);
      const len = d.length() - trimEnd;
      if (len <= 0.01) return null;
      seatRay.set(a, d.normalize());
      seatRay.far = len;
      const h = castVisible()[0];
      if (!h) return null;
      let o: THREE.Object3D | null = h.object;
      while (o && !o.name) o = o.parent;
      return o?.name ?? 'mesh';
    };
    /** 50 dudukan Lantai 1 (dunia): 10 meja, 10 kursi rapat terselip, 4 stool, 3 sofa, 6+3+6+4+2+1+1. */
    const seatList = () => {
      const desks = initAgents.flatMap((ag) => {
        const r = meshMap.get(ag.id);
        return r ? [{ id: ag.id, x: r.sitPos.x, z: r.sitPos.z, rotY: r.sitRotY }] : [];
      });
      const boardSeats = BOARDROOM_SEATS.map((_, i) => {
        const s = boardroomSpots.seat(i, 0);
        return { x: s.x, z: s.z, rotY: boardroomSpots.yaw(i) };
      });
      return allSeats(worldSpots, desks, boardSeats);
    };
    const frameTemplate = (id: string): AgentFrame => ({
      id, x: 0, y: 0, z: 0, rotY: 0, state: 'working', t: 0, k: 1, pose: null, cup: false, doc: false, vis: true,
      gateWait: false, hasDoc: false, bubble: null, bubbleT: 0, bubbleReal: false, bubbleSeq: 0, status: 'working',
    });
    if (import.meta.env.DEV) {
      /** Simulasi lokal (demo / server mati). Mode live dikendalikan sutradara di server. */
      const localSim = () => {
        const s = feedRef.current?.sim;
        if (!s) console.warn('[office] Hook ini hanya untuk simulasi lokal (demo / server mati). Mode live dikendalikan sutradara dunia di server.');
        return s;
      };
      win.__officeStage = () => {
        const s = feedRef.current?.sim;
        if (s) return s.debug.dump();
        return [...frameOf.values()].map((f) => ({
          id: f.id, state: f.state, pos: `${f.x.toFixed(2)},${f.z.toFixed(2)}`, rotDeg: Math.round((f.rotY * 180) / Math.PI),
          room: nav.roomAt({ x: f.x, z: f.z }), bubble: f.bubbleT > 0 ? (f.bubble ?? '').slice(0, 30) : '',
        }));
      };
      win.__officeStageDebug = {
        /** Metrik performa terukur (rencana-optimasi-performa-3d.md Task 1). */
        perf: () => {
          const info = renderer.info;
          let lights = 0, pointLights = 0;
          scene.traverseVisible((o) => {
            if ((o as THREE.Light).isLight) lights++;
            if ((o as THREE.PointLight).isPointLight) pointLights++;
          });
          return {
            quality,
            fps: frameTimes.length,
            /** Target FPS saat ini (Adaptive FPS: kamera aktif = 60, diam di Hemat = 30). */
            targetFps: cam.isActive(ACTIVE_HOLD_MS) ? QUALITY[quality].activeFps : QUALITY[quality].idleFps,
            frameMs: +frameMsAvg.toFixed(2),
            calls: info.render.calls,
            triangles: info.render.triangles,
            geometries: info.memory.geometries,
            textures: info.memory.textures,
            programs: info.programs?.length ?? 0,
            lights,
            pointLights,
            shadows: renderer.shadowMap.enabled,
            pixelRatio: renderer.getPixelRatio(),
            loadedGlbs: `${glbLoaded}/${templates.size}`,
            queuedGlbs: glbQueue.length,
            wave2Open,
          };
        },
        /** Ganti mode grafis tanpa HUD ('low' = Hemat, 'high' = Tinggi). */
        setQuality: (q: GraphicsQuality) => applyQuality(q),
        /** F2: sumber dunia ('local' = simulasi peramban, 'net' = sutradara server). */
        feed: () => feedRef.current?.kind ?? null,
        /**
         * F2: posisi semua agen (uji dua tab: harus sama di semua penonton). `atServerMs` = jam server
         * yang sama untuk semua tab (tanpa bergantung pada frame render tab yang di-throttle).
         */
        worldState: (atServerMs?: number) => {
          const w = feedRef.current?.peek(atServerMs) ?? view;
          return w ? {
            time: +w.time.toFixed(2), live: w.live,
            agents: w.agents.map((f) => ({ id: f.id, x: +f.x.toFixed(3), z: +f.z.toFixed(3), rotY: +f.rotY.toFixed(3), state: f.state })),
            meeting: w.props.meeting,
          } : null;
        },
        /** F2: perkiraan jam server (ms epoch) & selisihnya terhadap jam dinding lokal. */
        serverNow: () => {
          const s = feedRef.current?.serverNowMs() ?? null;
          return s === null ? null : { serverMs: Math.round(s), minusWallMs: Math.round(s - (performance.timeOrigin + performance.now())) };
        },
        /** F2: selisih jam server − lokal (ms) dari sinkronisasi ping. */
        clockOffset: () => feedRef.current?.clockOffsetMs() ?? 0,
        /** Picu rapat seperti event `/rapat` dari server (simulasi lokal). */
        meeting: (host = 'raka', text = 'Evaluasi sprint & rencana ruang rapat') => localSim()?.debug.meeting(host, text),
        /** Majukan simulasi lokal N detik secara instan (render menyusul di frame berikutnya). */
        fastForward: (seconds: number) => {
          const s = localSim();
          if (s) for (let x = 0; x < seconds; x += 0.05) s.step(0.05);
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
        focus: (room: StageRoom) => apiRef.current?.focusRoom(room),
        /** Pindahkan Free Cam ke posisi tertentu sambil menatap sebuah titik (uji mode jalan kaki). */
        freeAt: (pos: [number, number, number], lookAt: [number, number, number]) => {
          cam.setMode('free');
          cam.placeFree(new THREE.Vector3(...pos), new THREE.Vector3(...lookAt));
        },
        /** Ruangan navigasi tempat sebuah titik dunia berada. */
        roomAt: (p: Pt) => nav.roomAt(p),
        /** Akses langsung ke scene & matahari untuk inspeksi (mis. mencari objek lewat nama). */
        scene,
        sun,
        look: (x: number, z: number) => cam.focus(new THREE.Vector3(x, ISO_FOCUS_HEIGHT, z), { dur: 0.1 }),
        meetingState: () => (feedRef.current?.sim ? feedRef.current.sim.debug.meetingState() : view?.props.meeting ?? null),
        /** Antrean kopi & penghuni kursi bar Pantry. */
        pantryState: () => localSim()?.debug.pantryState() ?? null,
        /** Penghuni sofa Lounge, Server, Commons, Garden, Workshop, Info Wall, Pods, Studio, Focus, Access. */
        errandState: () => localSim()?.debug.errandState() ?? null,
        studio: (ids?: string[]) => localSim()?.debug.studio(ids) ?? [],
        focusPod: (id?: string, podIndex?: number) => localSim()?.debug.focusPod(id, podIndex) ?? false,
        access: (id?: string) => localSim()?.debug.access(id) ?? false,
        workshop: (presenterId?: string, attendeeIds?: string[]) => localSim()?.debug.workshop(presenterId, attendeeIds) ?? [],
        infowall: (ids?: string[]) => localSim()?.debug.infowall(ids) ?? [],
        pod: (idA?: string, idB?: string, podIndex?: number) => localSim()?.debug.pod(idA, idB, podIndex) ?? false,
        commons: (ids?: string[]) => localSim()?.debug.commons(ids) ?? [],
        garden: (id: string) => localSim()?.debug.garden(id) ?? false,
        lounge: (id: string) => localSim()?.debug.lounge(id) ?? false,
        inspect: (id = 'satria') => localSim()?.debug.inspect(id) ?? false,
        leave: (id: string) => localSim()?.debug.leave(id),
        arrive: (id: string) => localSim()?.debug.arrive(id),
        coffee: (id: string) => localSim()?.debug.coffee(id) ?? false,
        /** Kunjungan meja seperti event live `visit` (mis. minta review ke Raka). */
        visit: (from: string, to: string, text = 'Minta review sebentar, Pak.') => localSim()?.debug.visit(from, to, text),
        path: (from: Pt, to: Pt) => nav.path(from, to),
        /** Tinggi permukaan dudukan / perabot di bawah titik dunia (raycast ke GLB). */
        seatTop: (x: number, z: number, maxY?: number) => seatTopAt(x, z, maxY),
        /** F1: objek yang kena sinar turun di (x, z) antara maxY..minY (nama + tinggi), untuk mencari penghalang. */
        probe: (x: number, z: number, maxY = 1.2, minY = -0.05) => {
          seatRay.set(new THREE.Vector3(x, maxY, z), new THREE.Vector3(0, -1, 0));
          seatRay.far = maxY - minY;
          return castVisible().slice(0, 6).map((h) => {
            const names: string[] = [];
            for (let o: THREE.Object3D | null = h.object; o && names.length < 4; o = o.parent) if (o.name) names.push(o.name);
            return { y: +(maxY - h.distance).toFixed(3), names: names.join(' < ') };
          });
        },
        /** F1: versi rig, ukuran mesh skinned, dan jumlah mesh avatar yang terlihat (≈ draw call pass utama). */
        rig: () => {
          const out: Record<string, unknown> = { version: RIG_VERSION };
          const av = meshMap.get(initAgents[0]?.id ?? '')?.av;
          if (av instanceof V2Avatar) {
            const g = av.rig.mesh.geometry;
            out.bones = av.rig.mesh.skeleton.bones.length;
            out.vertices = g.getAttribute('position').count;
            out.triangles = (g.index?.count ?? 0) / 3;
          }
          let meshes = 0;
          avatarsGroup.traverseVisible((o) => { if ((o as THREE.Mesh).isMesh) meshes++; });
          out.visibleAvatarMeshes = meshes;
          return out;
        },
        /**
         * F1: matriks dudukan (rencana §3.2). Avatar uji duduk penuh di tiap dudukan (`kinds` = saring jenis), lalu
         * diukur: celah telapak ke lantai / pijakan (footL/footR), bawah panggul vs permukaan nyata (pelvis),
         * ruang di atas lutut sampai bawah meja (knee), galat jangkauan pergelangan (hand). `show` = biarkan
         * avatar uji terlihat (agen disembunyikan) untuk screenshot; `seatCheck()` lagi = bersihkan.
         */
        seatCheck: (show = false, kinds?: SeatKind[]) => {
          f1Clear();
          const rows: Array<Record<string, unknown>> = [];
          const failed: string[] = [];
          let probe: V2Avatar | null = null;
          seatList().filter((s) => !kinds || kinds.includes(s.kind)).forEach((s, i) => {
            const ag = initAgents[i % initAgents.length]!;
            if (show || !probe) {
              probe = new V2Avatar(ag.id, ag.name, new THREE.Color(ag.color), i, v2Shared);
              f1Group.add(probe.group);
              f1Probes.push(probe);
            }
            const calib = seatCalibAt(s.kind, s.x, s.z, worldSpots);
            const m = probe.measureSeat(calib, s.x, s.z, s.rotY, frameTemplate(ag.id));
            const under = (v: THREE.Vector3) => seatTopAt(v.x, v.z, v.y + 0.2, -0.05);
            const footL = +(m.soleL.y - under(m.soleL)).toFixed(3);
            const footR = +(m.soleR.y - under(m.soleR)).toFixed(3);
            const fx = Math.sin(s.rotY), fz = Math.cos(s.rotY);
            const surf = seatTopAt(s.x + fx * calib.hipFwd, s.z + fz * calib.hipFwd, calib.top + 0.15);
            const pelvis = +(m.pelvisBottom - surf).toFixed(3);
            const knee = Math.min(clearAbove(m.kneeL.clone().setY(m.kneeL.y + 0.07)), clearAbove(m.kneeR.clone().setY(m.kneeR.y + 0.07)));
            // Sumbu paha (pinggul → lutut) & betis (lutut → 4 cm sebelum pergelangan) tidak boleh menembus perabot.
            const leg = [segmentHit(m.hipL, m.kneeL), segmentHit(m.hipR, m.kneeR), segmentHit(m.kneeL, m.ankleL, 0.04), segmentHit(m.kneeR, m.ankleR, 0.04)].find(Boolean) ?? null;
            const ok = Math.abs(footL) <= 0.03 && Math.abs(footR) <= 0.03 && pelvis > -0.03 && pelvis < 0.05 && knee >= 0.005 && m.handErr <= 0.02 && !leg;
            if (!ok) failed.push(s.id);
            rows.push({
              seat: s.id, kind: s.kind, top: calib.top, surf, footL, footR, pelvis,
              knee: knee === Infinity ? null : knee, hand: +m.handErr.toFixed(3), eye: +m.eye.y.toFixed(2), leg, ok,
            });
          });
          if (show) hideAgents = true;
          else f1Clear();
          return { total: rows.length, failed, rows };
        },
        /** F1: titik layar (px relatif kanvas) dada agen — uji klik pilih agen pada SkinnedMesh. */
        screenOf: (id: string) => {
          const av = meshMap.get(id)?.av;
          if (!av?.group.visible) return null;
          const v = av.group.getWorldPosition(new THREE.Vector3());
          v.y += av.version === 2 ? 1.0 : 0.3;
          v.project(cam.active());
          return { x: Math.round((v.x * 0.5 + 0.5) * viewW), y: Math.round((-v.y * 0.5 + 0.5) * viewH) };
        },
        /** F3: masuk Mata Agen agen `id` (false = tidak di kantor); null = keluar. */
        eye: (id: string | null = 'raka') => {
          if (id === null) { eye.exit(); return true; }
          return enterEye(id);
        },
        /** F3: keadaan kamera mata (fase, lompatan yaw terbesar per frame, kecepatan, lensa, target FPS). */
        eyeState: () => ({
          phase: eye.phase, agentId: eye.agentId, viewing: eye.viewing, mode: cam.mode, dim: +eye.dim.toFixed(2),
          maxYawStepDeg: +eye.maxYawStepDeg.toFixed(1), frames: eye.frames,
          linSpeed: +eye.linSpeed.toFixed(2), angSpeed: +eye.angSpeed.toFixed(2), moving: eye.isMoving(),
          glanceDeg: [eye.glanceYaw, eye.glancePitch].map((n) => +((n * 180) / Math.PI).toFixed(1)),
          cam: cam.persp.position.toArray().map((n) => +n.toFixed(3)),
          fov: cam.persp.fov, near: cam.persp.near, far: cam.persp.far,
          targetFps: targetFps(QUALITY[quality]),
          bob: headBobRef.current && !(motionQuery?.matches ?? false),
        }),
        /** F3: jarak & garis pandang (dinding buram) dari kamera mata ke titik bubble tiap agen terlihat. */
        eyeSight: () => {
          if (!eye.viewing) return null;
          const camera = cam.active();
          return initAgents.flatMap((a) => {
            const av = meshMap.get(a.id)?.av;
            if (!av || !av.group.visible || a.id === eye.agentId) return [];
            losCache.delete(a.id);
            const anchor = av.bubbleAnchor(new THREE.Vector3());
            return [{ id: a.id, room: roomOfAgent.get(a.id) ?? '', dist: +anchor.distanceTo(camera.position).toFixed(1), seen: bubbleSeenFromEye(a.id, anchor, camera) }];
          });
        },
        /** F3: simulasi seret lirik (piksel) tanpa mouse — uji batas ±60° / ±35°. */
        glance: (dx: number, dy: number) => { eye.glanceStart(); eye.glanceBy(dx, dy); eye.glanceEnd(); },
        /** F1: sembunyikan / tampilkan ke-10 agen (screenshot bersih). */
        hideAgents: (on = true) => { hideAgents = on; },
        /** F1 (dasar F3): sembunyikan kepala agen untuk FPV — soket mata tetap di tempatnya. */
        firstPerson: (id: string, on = true) => {
          const av = meshMap.get(id)?.av;
          if (av instanceof V2Avatar) av.rig.setFirstPerson(on);
          return av instanceof V2Avatar;
        },
        /** F1: soket mata (dunia) & tolehan kepala agen saat ini (derajat). */
        eyeOf: (id: string) => {
          const av = meshMap.get(id)?.av;
          if (!(av instanceof V2Avatar)) return null;
          const e = av.rig.eye.getWorldPosition(new THREE.Vector3());
          return {
            eye: e.toArray().map((n) => +n.toFixed(3)),
            yawDeg: Math.round((av.look.yaw * 180) / Math.PI), pitchDeg: Math.round((av.look.pitch * 180) / Math.PI),
            bodyDeg: Math.round((av.group.rotation.y * 180) / Math.PI),
          };
        },
      };
    }

    // Shader seluruh scene awal dipanaskan di latar sebelum frame pertama (tanpa freeze panjang).
    warmShadersThenRender();
    animId = requestAnimationFrame(animate);

    return () => {
      disposed = true;
      cancelAnimationFrame(animId);
      apiRef.current = null;
      applyQualityRef.current = null;
      if (stageApiRef) stageApiRef.current = null;
      if (import.meta.env.DEV) {
        delete win.__officeStage;
        delete win.__officeStageDebug;
      }
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', onVisibility);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('dblclick', onDblClick);
      window.removeEventListener('pointermove', onGlanceMove);
      window.removeEventListener('pointerup', onGlanceUp);
      window.removeEventListener('keydown', onEyeKey);
      dimEl.remove();
      cam.dispose();
      // Lepaskan memori GPU (geometri, material, tekstur) agar remount/HMR tidak bocor.
      disposeObject(scene);
      for (const tpl of templates.values()) {
        if (tpl.scene) disposeObject(tpl.scene);
      }
      contactShadows.dispose();
      lightPools.dispose();
      deskGlows.dispose();
      for (const v of Object.values(deskShared)) v.dispose();
      f1Clear();
      for (const r of meshMap.values()) r.av?.dispose();
      v2Shared.dispose();
      v1Shared?.dispose();
      scene.environment?.dispose();
      renderer.dispose();
      codeTexture.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      const bc = bubbleRef.current;
      if (bc) while (bc.firstChild) bc.removeChild(bc.firstChild);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const t = (id: string, en: string) => (language === 'id' ? id : en);

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
        {camMode === 'eye' && eyeHint && (
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
            {t('Mata Agen · seret = lirik · ←/→ ganti agen · Esc keluar', 'Agent Eyes · drag = glance · ←/→ switch agent · Esc exit')}
          </div>
        )}
        {overlay}
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
              'W A S D gerak · Q naik · E turun · Shift cepat · seret mouse untuk melihat · turun di bawah dinding = jalan kaki (dinding utuh)',
              'W A S D move · Q up · E down · Shift fast · drag to look · drop below the walls = walk mode (solid walls)',
            )}
          </div>
        )}
      </div>

      {/* Floating Zone Legend (disembunyikan di Mata Agen: panel agen memakai pojok ini) */}
      <div
        style={{
          position: 'absolute',
          bottom: 14, left: 16,
          display: camMode === 'eye' ? 'none' : 'flex', gap: 12,
          padding: '8px 12px',
          // Tanpa backdrop-filter: blur di atas kanvas WebGL dihitung ulang setiap frame.
          background: 'rgba(15, 26, 31, 0.92)',
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
