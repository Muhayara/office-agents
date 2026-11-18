/**
 * WorldSim — simulasi rutinitas 10 agen TANPA Three.js (F2, rencana-fpv-dan-kustomisasi-karakter.md §3.6).
 *
 * Dipindah dari `IsometricOfficeStage.tsx` (step / handleArrival / scheduler / rapat). Satu kode untuk
 * dua tempat: sutradara di server (mode live, semua penonton melihat agen yang sama) dan simulasi lokal
 * di peramban (demo statis, label SIMULASI). Semua keacakan memakai PRNG ber-seed.
 *
 * Keluaran per agen = transform badan (x, y, z, rotY), keadaan, campuran duduk `k`, petunjuk pose,
 * cangkir/dokumen, bubble. Panggung hanya merender pose dari keluaran ini.
 */
import type { AgentStatus } from '@office/shared';
import {
  ACCESS_GOING, ACCESS_LIFT, ACCESS_MAP, AGENT_SOLO_THOUGHTS, ARRIVAL_LINES, COFFEE_ROUTINE_DIALOGUES,
  COMMONS_CHAT, COMMONS_GOING, FOCUS_GOING, FOCUS_MUTTER, GARDEN_CHAT, GARDEN_GOING, INFOWALL_CHAT,
  INFOWALL_GOING, LEAVING_LINES, LIVE_STATUS_LINES, LOUNGE_CHAT, LOUNGE_GOING, MEETING_CALL_LINES,
  MEETING_ON_THE_WAY, MEETING_REPLIES, OFFICE_CONVERSATIONS, PODS_CHAT, PODS_GOING, SERVER_CONSOLE,
  SERVER_GOING, SERVER_INSPECT, STUDIO_CREW, STUDIO_GOING, STUDIO_TALK, VISIT_ACKS, WORKSHOP_CHAT,
  WORKSHOP_GOING, WORKSHOP_TALK, WORKSHOP_TOPICS,
} from './dialogues';
import {
  AGENT_3D_POSITIONS, BOARDROOM_SEATS, COLLABPODS, COMMONS, DOOR_MUTEX_GAP_S, FOCUSPODS, GARDEN, LOUNGE,
  MEETING_DEPART_GAP_S, MEETING_GATHER_TIMEOUT_S, MEETING_PRESENT_S, MEETING_SEAT_ASSIGNMENT, MEETING_SESSION_S,
  PANTRY, STUDIO, WALK_SPEED, WORKSHOP, type Pt, type Spot,
} from './layout';
import { pathLength, segLen, type BuildingNav, type NavPt } from './navigation';
import { createRng, type Rng } from './rng';
import { boardroom, createFloor1Nav, deskSeat, floor1Spots, type ChairRig, type DeskSeat, type Floor1Spots } from './spots';

// ---------------------------------------------------------------------------
// Konstanta ritme (sama dengan panggung sebelum F2)
// ---------------------------------------------------------------------------
const COFFEE_MIN_S = 10, COFFEE_MAX_S = 22;
const CONVO_MIN_S = 12, CONVO_MAX_S = 24;
const THOUGHT_MIN_S = 8, THOUGHT_MAX_S = 18;
export const VISIT_STAY_S = 3.5;
const SERVER_MIN_S = 70, SERVER_MAX_S = 120;
const COMMONS_MIN_S = 90, COMMONS_MAX_S = 150;
const GARDEN_MIN_S = 60, GARDEN_MAX_S = 100;
const WORKSHOP_MIN_S = 120, WORKSHOP_MAX_S = 180;
const INFOWALL_MIN_S = 85, INFOWALL_MAX_S = 135;
const PODS_MIN_S = 95, PODS_MAX_S = 145;
const STUDIO_MIN_S = 110, STUDIO_MAX_S = 165;
const FOCUS_MIN_S = 85, FOCUS_MAX_S = 130;
const ACCESS_MIN_S = 130, ACCESS_MAX_S = 190;
export const STUDIO_PREFERRED = ['wulan', 'tari', 'dimas', 'gita', 'fajar'];
export const FOCUS_PREFERRED = ['bima', 'gita', 'satria', 'sari', 'fajar', 'laras'];
export const ACCESS_PREFERRED = ['raka', 'sari', 'fajar'];
const PAIR_MEMORY_S = 90;
export const WORKSHOP_PRESENTERS = ['raka', 'bima', 'gita', 'tari', 'sari'];
export const INFOWALL_PREFERRED = ['laras', 'fajar', 'satria', 'bima', 'raka'];
const BUSY_STATUSES: ReadonlySet<AgentStatus> = new Set<AgentStatus>(['working', 'thinking', 'messaging']);
const COMMONS_SEAT_ORDER = [1, 4, 0, 3, 2, 5];
const WORKSHOP_SEAT_ORDER = [1, 0, 2, 4, 3, 5];
const SIT_S = 0.4;

export type AnimState =
  | 'working' | 'walk_to_coffee' | 'waiting_in_queue' | 'brewing' | 'walk_to_stool' | 'sipping_at_bar'
  | 'walk_to_desk' | 'drinking' | 'walk_to_trash' | 'disposing' | 'walk_from_trash' | 'walk_to_visit'
  | 'visiting' | 'walk_from_visit' | 'meeting_called' | 'walk_to_meeting' | 'meeting_sitting' | 'in_meeting'
  | 'meeting_standing' | 'walk_from_meeting' | 'walk_back_to_desk' | 'away' | 'walk_in_from_lobby'
  | 'walk_out_to_lobby' | 'walk_to_errand' | 'errand_stay';

/** Urutan tetap untuk kode kabel (wire). Tambah di AKHIR saja. */
export const ANIM_STATES: readonly AnimState[] = [
  'working', 'walk_to_coffee', 'waiting_in_queue', 'brewing', 'walk_to_stool', 'sipping_at_bar',
  'walk_to_desk', 'drinking', 'walk_to_trash', 'disposing', 'walk_from_trash', 'walk_to_visit',
  'visiting', 'walk_from_visit', 'meeting_called', 'walk_to_meeting', 'meeting_sitting', 'in_meeting',
  'meeting_standing', 'walk_from_meeting', 'walk_back_to_desk', 'away', 'walk_in_from_lobby',
  'walk_out_to_lobby', 'walk_to_errand', 'errand_stay',
];

export const RETURNING_STATES: ReadonlySet<AnimState> = new Set<AnimState>([
  'walk_from_trash', 'walk_from_visit', 'walk_from_meeting', 'walk_back_to_desk', 'walk_in_from_lobby',
]);
export const COFFEE_STATES: ReadonlySet<AnimState> = new Set<AnimState>([
  'walk_to_coffee', 'waiting_in_queue', 'brewing', 'walk_to_stool', 'sipping_at_bar', 'walk_to_trash',
  'disposing', 'walk_from_trash', 'walk_to_errand', 'errand_stay',
]);
export const MEETING_STATES: ReadonlySet<AnimState> = new Set<AnimState>([
  'meeting_called', 'walk_to_meeting', 'meeting_sitting', 'in_meeting', 'meeting_standing',
]);
export const isWalking = (s: AnimState) => s.startsWith('walk');
export const atDeskState = (s: AnimState) => s === 'working' || s === 'drinking';

export type ErrandPose = 'lounge' | 'inspect' | 'type' | 'discuss' | 'present';
export const ERRAND_POSES: readonly ErrandPose[] = ['lounge', 'inspect', 'type', 'discuss', 'present'];
type ErrandKind = 'lounge' | 'server' | 'commons' | 'garden' | 'workshop' | 'infowall' | 'pods' | 'studio' | 'focus' | 'access';

interface ErrandStop {
  approach: Spot;
  spot: Spot;
  sitY: number;
  duration: number;
  pose: ErrandPose;
  lines: readonly string[];
  chat?: readonly string[];
  chatRate?: number;
}
interface Errand {
  kind: ErrandKind;
  role?: 'presenter';
  stops: ErrandStop[];
  i: number;
  seat?: number;
}

export interface WorldAgentInfo {
  id: string;
  name: string;
  /** Jabatan untuk layar rapat / Workshop. */
  title: string;
}

interface SimAgent {
  info: WorldAgentInfo;
  desk: DeskSeat;
  // ---- badan (dunia) ----
  x: number; y: number; z: number; rotY: number;
  vis: boolean;
  /** 0 = berdiri, 1 = duduk penuh (lutut ditekuk). */
  k: number;
  cupVis: boolean;
  docVis: boolean;
  gateWait: boolean;
  // ---- mesin keadaan ----
  state: AnimState;
  stateTime: number;
  stateDuration: number;
  walkPath: NavPt[];
  walkSeg: number;
  walkT: number;
  gateSeg: number;
  hasCup: boolean;
  hasDoc: boolean;
  bubbleText: string | null;
  bubbleTimer: number;
  bubbleReal: boolean;
  /** Naik setiap bubble baru (dipakai kabel untuk mengirim bubble sekali). */
  bubbleSeq: number;
  visitTarget?: string;
  meetingSeat?: number;
  stool?: number;
  errand?: Errand;
  loungeAfter?: boolean;
  departAt?: number;
  subT?: number;
  status: AgentStatus | null;
  lastStatus?: AgentStatus;
}

interface ScheduledLine { agentId: string; text: string; showAt: number; dur: number; real: boolean }

type MeetingPhase = 'gathering' | 'session' | 'dispersing';
interface MeetingState {
  phase: MeetingPhase;
  host: string;
  topic: string;
  /** true = topik ditulis CEO / dari pesan asli (disamarkan untuk publik, K9). */
  topicReal: boolean;
  attendees: string[];
  startedAt: number;
  sessionStartAt: number;
  sessionEndsAt: number;
}

/** Event yang menggerakkan agen di luar status kursi biasa (dari server / debug). */
export type WorldEvent =
  | { kind: 'say'; agentId: string; text: string }
  | { kind: 'visit'; from: string; to: string; text: string; carryDoc: boolean }
  | { kind: 'meeting'; host: string; text: string };

// ---------------------------------------------------------------------------
// Keluaran
// ---------------------------------------------------------------------------
export interface AgentFrame {
  id: string;
  x: number; y: number; z: number; rotY: number;
  state: AnimState;
  /** Waktu dalam state (dtk). */
  t: number;
  k: number;
  pose: ErrandPose | null;
  cup: boolean;
  doc: boolean;
  vis: boolean;
  gateWait: boolean;
  hasDoc: boolean;
  bubble: string | null;
  bubbleT: number;
  bubbleReal: boolean;
  bubbleSeq: number;
  status: AgentStatus | null;
}

export interface MeetingInfo {
  phase: 'gathering' | 'session' | 'dispersing';
  topic: string;
  topicReal: boolean;
  host: string;
  hostId: string;
  seated: number;
  total: number;
}

export interface WorkshopInfo { topic: string; presenter: string; role: string; attendees: number }

export interface WorldProps {
  meeting: MeetingInfo | null;
  workshop: WorkshopInfo | null;
  /** Lampu okupansi 2 diner pod. */
  pods: [boolean, boolean];
  /** Lampu status 2 focus pod (merah koral saat duduk). */
  focus: [boolean, boolean];
  onAir: boolean;
  liftCalled: boolean;
}

export interface WorldFrame {
  /** Waktu simulasi (dtk sejak mulai). */
  time: number;
  live: boolean;
  agents: AgentFrame[];
  rigs: ChairRig[];
  props: WorldProps;
}

export interface WorldSimOptions {
  agents: WorldAgentInfo[];
  seed: number;
  /** true = sutradara live (pose & rutinitas mengikuti status agen asli). */
  live: boolean;
  /** Demo: agen datang bertahap dari Lobi (1,2 dtk). Bawaan: !live. */
  arriveFromLobby?: boolean;
}

const clipText = (text: string, max = 110) => {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};
const smoothstep = (t: number) => { const c = Math.min(1, Math.max(0, t)); return c * c * (3 - 2 * c); };

export class WorldSim {
  readonly live: boolean;
  readonly nav: BuildingNav;
  readonly spots: Floor1Spots;
  private readonly rng: Rng;
  private readonly agents = new Map<string, SimAgent>();
  private time = 0;
  private readonly rigs: ChairRig[] = BOARDROOM_SEATS.map(() => ({ pull: 0, pullTarget: 0, swivelAngle: 0, swivelTarget: 0 }));

  private nextCoffeeT: number;
  private nextConvoT: number;
  private nextThoughtT: number;
  private nextServerT: number;
  private nextCommonsT: number;
  private nextGardenT: number;
  private nextWorkshopT: number;
  private nextInfoT: number;
  private nextPodsT: number;
  private nextStudioT: number;
  private nextFocusT: number;
  private nextAccessT: number;

  private readonly dlgQueue: ScheduledLine[] = [];
  private readonly visitQueue = new Map<string, Array<{ to: string; text: string; carryDoc: boolean }>>();
  private readonly gates = new Map<string, { lastGrant: number; waiting: string[] }>();
  private coffeeQueue: string[] = [];
  private readonly stoolOccupant: Array<string | null>;
  private readonly sofaOccupant: Array<string | null>;
  private serverBusy: string | null = null;
  private readonly commonsOccupant: Array<string | null>;
  private readonly gardenOccupant: Array<string | null>;
  private readonly workshopOccupant: Array<string | null>;
  private workshopPresenter: string | null = null;
  private workshopTopic = '';
  private readonly infoOccupant: Array<string | null>;
  private readonly podOccupant: Array<string | null>;
  private readonly studioOccupant: Array<string | null> = [null, null, null];
  private readonly focusOccupant: Array<string | null>;
  private accessBusy: string | null = null;
  private readonly recentPairs: Array<{ a: string; b: string; t: number }> = [];
  private meeting: MeetingState | null = null;
  private readonly seatOccupant: Array<string | null> = BOARDROOM_SEATS.map(() => null);

  constructor(opts: WorldSimOptions) {
    this.live = opts.live;
    this.rng = createRng(opts.seed);
    this.nav = createFloor1Nav();
    this.spots = floor1Spots();
    const r = this.rng;
    this.nextCoffeeT = r.rand(4, 8);
    this.nextConvoT = r.rand(8, 14);
    this.nextThoughtT = r.rand(6, 12);
    this.nextServerT = r.rand(35, 50);
    this.nextCommonsT = r.rand(45, 65);
    this.nextGardenT = r.rand(20, 35);
    this.nextWorkshopT = r.rand(60, 90);
    this.nextInfoT = r.rand(30, 50);
    this.nextPodsT = r.rand(40, 60);
    this.nextStudioT = r.rand(50, 75);
    this.nextFocusT = r.rand(25, 40);
    this.nextAccessT = r.rand(55, 80);
    const S = this.spots;
    this.stoolOccupant = S.stools.map(() => null);
    this.sofaOccupant = S.sofa.map(() => null);
    this.commonsOccupant = S.commons.map(() => null);
    this.gardenOccupant = S.garden.map(() => null);
    this.workshopOccupant = S.workshop.map(() => null);
    this.infoOccupant = S.infoWall.map(() => null);
    this.podOccupant = S.pods.map(() => null);
    this.focusOccupant = S.focus.map(() => null);

    for (const info of opts.agents) {
      const desk = deskSeat(info.id);
      if (!desk || !AGENT_3D_POSITIONS[info.id]) continue;
      this.agents.set(info.id, {
        info, desk,
        x: desk.x, y: desk.y, z: desk.z, rotY: desk.rotY, vis: true, k: 1,
        cupVis: false, docVis: false, gateWait: false,
        state: 'working', stateTime: 0, stateDuration: 0, walkPath: [], walkSeg: 0, walkT: 0, gateSeg: -1,
        hasCup: false, hasDoc: false, bubbleText: null, bubbleTimer: 0, bubbleReal: false, bubbleSeq: 0,
        status: null,
      });
    }
    if (opts.arriveFromLobby ?? !opts.live) {
      const order = r.shuffle([...this.agents.keys()]);
      order.forEach((id, k) => {
        const a = this.agents.get(id)!;
        a.state = 'away';
        a.departAt = 0.8 + k * 1.2;
        this.setAwayBody(a);
      });
    }
  }

  // =========================================================================
  // API publik
  // =========================================================================
  get now() { return this.time; }
  agentIds(): string[] { return [...this.agents.keys()]; }
  infoOf(id: string): WorldAgentInfo | undefined { return this.agents.get(id)?.info; }

  /** Live: status asli agen (dari server). Transisi diproses di langkah berikutnya. */
  setStatus(agentId: string, status: AgentStatus) {
    const a = this.agents.get(agentId);
    if (a) a.status = status;
  }

  handleEvent(ev: WorldEvent) {
    if (ev.kind === 'say') {
      const a = this.agents.get(ev.agentId);
      if (a) this.say(a, clipText(ev.text), 5.5, true);
      return;
    }
    if (ev.kind === 'visit') {
      const a = this.agents.get(ev.from);
      if (!a || this.statusOf(a) === 'offline') return;
      if (COFFEE_STATES.has(a.state)) this.recallToDesk(ev.from);
      if (a.state === 'working') {
        this.startVisit(ev.from, ev.to, ev.text, ev.carryDoc);
      } else if (RETURNING_STATES.has(a.state) || a.state === 'walk_to_visit' || a.state === 'visiting') {
        const q = this.visitQueue.get(ev.from) ?? [];
        if (q.length < 3) q.push({ to: ev.to, text: ev.text, carryDoc: ev.carryDoc });
        this.visitQueue.set(ev.from, q);
        this.say(a, clipText(ev.text, 90), 3.0, true);
      } else {
        this.say(a, clipText(ev.text, 90), 4.0, true);
      }
      return;
    }
    this.startMeeting(ev.host, ev.text, true);
  }

  /** Satu langkah simulasi (dt dtk; server memakai 0,05 tetap, demo memakai dt frame ≤ 0,1). */
  step(dt: number) {
    this.time += dt;
    const isLive = this.live;
    if (isLive) this.processStatuses();
    this.updateMeeting();
    this.runSchedulers(isLive);
    this.processDialogue(isLive);
    for (const [id, a] of this.agents) this.updateAgent(id, a, dt, isLive);
    boardroom.stepRigs(this.rigs, dt);
  }

  frame(): WorldFrame {
    const agents: AgentFrame[] = [];
    for (const [id, a] of this.agents) {
      const stop = a.state === 'errand_stay' ? a.errand?.stops[a.errand.i] : undefined;
      agents.push({
        id, x: a.x, y: a.y, z: a.z, rotY: a.rotY, state: a.state, t: a.stateTime, k: a.k,
        pose: stop ? stop.pose : null, cup: a.cupVis, doc: a.docVis, vis: a.vis, gateWait: a.gateWait, hasDoc: a.hasDoc,
        bubble: a.bubbleTimer > 0 ? a.bubbleText : null, bubbleT: Math.max(0, a.bubbleTimer), bubbleReal: a.bubbleReal,
        bubbleSeq: a.bubbleSeq, status: a.status,
      });
    }
    return { time: this.time, live: this.live, agents, rigs: this.rigs.map((r) => ({ ...r })), props: this.props() };
  }

  props(): WorldProps {
    const m = this.meeting;
    let meeting: MeetingInfo | null = null;
    if (m) {
      const seated = m.attendees.filter((id) => this.agents.get(id)?.state === 'in_meeting').length;
      const role = this.agents.get(m.host)?.info.title ?? '';
      const name = this.agents.get(m.host)?.info.name ?? m.host;
      meeting = { phase: m.phase, topic: m.topic, topicReal: m.topicReal, host: role ? `${name} · ${role}` : name, hostId: m.host, seated, total: m.attendees.length };
    }
    const wp = this.workshopPresenter ? this.agents.get(this.workshopPresenter) : undefined;
    const staying = (id: string | null) => !!id && this.agents.get(id)?.state === 'errand_stay';
    return {
      meeting,
      workshop: wp ? { topic: this.workshopTopic, presenter: wp.info.name, role: wp.info.title, attendees: this.workshopOccupant.filter(Boolean).length } : null,
      pods: [!!(this.podOccupant[0] || this.podOccupant[1]), !!(this.podOccupant[2] || this.podOccupant[3])],
      focus: [staying(this.focusOccupant[0] ?? null), staying(this.focusOccupant[1] ?? null)],
      onAir: staying(this.studioOccupant[0] ?? null),
      liftCalled: staying(this.accessBusy) && this.agents.get(this.accessBusy!)?.errand?.i === 1,
    };
  }

  /** Hook debug / uji (dipakai `__officeStageDebug` di mode simulasi lokal). */
  readonly debug = {
    meeting: (host = 'raka', text = 'Evaluasi sprint & rencana ruang rapat') => this.startMeeting(host, text, false),
    working: () => [...this.agents].filter(([, a]) => a.state === 'working').map(([id]) => id),
    coffee: (id: string) => {
      const a = this.agents.get(id);
      if (!a || a.state !== 'working' || this.coffeeQueue.includes(id)) return false;
      this.coffeeQueue.push(id);
      a.state = 'walk_to_coffee';
      a.stateTime = 0;
      this.setWalk(id, a, this.walkPath(this.deskPos(a), this.queueSpot(this.coffeeQueue.length - 1)));
      return true;
    },
    lounge: (id: string) => { const a = this.agents.get(id); return !!a && a.state === 'working' && this.startLoungeErrand(id, a, this.deskPos(a)); },
    inspect: (id = 'satria') => { const a = this.agents.get(id); return !!a && a.state === 'working' && this.startServerErrand(id, a); },
    garden: (id: string) => { const a = this.agents.get(id); return !!a && a.state === 'working' && this.startGardenErrand(id, a); },
    commons: (ids?: string[]) => {
      const working = this.debug.working();
      return this.startCommonsDiscussion(ids ? ids.filter((id) => working.includes(id)) : this.pickCommonsGroup(working));
    },
    workshop: (presenterId?: string, attendeeIds?: string[]) => {
      const working = this.debug.working();
      const host = presenterId ?? WORKSHOP_PRESENTERS.find((id) => working.includes(id));
      if (!host || !working.includes(host)) return [];
      const rest = (attendeeIds ?? working.filter((id) => id !== host).slice(0, 3)).filter((id) => working.includes(id));
      return this.startWorkshopSession(host, rest);
    },
    infowall: (ids?: string[]) => {
      const working = this.debug.working();
      return this.startInfoWallCheck((ids ?? INFOWALL_PREFERRED.filter((id) => working.includes(id)).slice(0, 2)).filter((id) => working.includes(id)));
    },
    pod: (idA?: string, idB?: string, podIndex?: number) => {
      const working = this.debug.working();
      const a = idA ?? working[0], b = idB ?? working.find((id) => id !== a);
      if (!a || !b || !working.includes(a) || !working.includes(b)) return false;
      return this.startPodHuddle(a, b, podIndex);
    },
    studio: (ids?: string[]) => {
      const working = this.debug.working();
      return this.startStudioSession((ids ?? STUDIO_PREFERRED.filter((id) => working.includes(id)).slice(0, 2)).filter((id) => working.includes(id)));
    },
    focusPod: (id?: string, podIndex?: number) => {
      const working = this.debug.working();
      const who = id ?? FOCUS_PREFERRED.find((k) => working.includes(k));
      return !!who && working.includes(who) && this.startFocusSession(who, podIndex);
    },
    access: (id?: string) => {
      const working = this.debug.working();
      const who = id ?? ACCESS_PREFERRED.find((k) => working.includes(k));
      return !!who && working.includes(who) && this.startAccessVisit(who);
    },
    leave: (id: string) => { const a = this.agents.get(id); if (a) this.startLeaving(id, a); },
    arrive: (id: string) => { const a = this.agents.get(id); if (a) this.startArrival(id, a); },
    visit: (from: string, to: string, text = 'Minta review sebentar, Pak.') => this.handleEvent({ kind: 'visit', from, to, text, carryDoc: true }),
    meetingState: () => (this.meeting ? { ...this.meeting, attendees: [...this.meeting.attendees] } : null),
    pantryState: () => ({ queue: [...this.coffeeQueue], stools: [...this.stoolOccupant] }),
    errandState: () => ({
      sofa: [...this.sofaOccupant], server: this.serverBusy, commons: [...this.commonsOccupant], garden: [...this.gardenOccupant],
      workshop: { presenter: this.workshopPresenter, seats: [...this.workshopOccupant] }, infowall: [...this.infoOccupant], pods: [...this.podOccupant],
      studio: [...this.studioOccupant], focus: [...this.focusOccupant], access: this.accessBusy,
    }),
    dump: () => [...this.agents].map(([id, a]) => ({
      id, state: a.state, seg: `${a.walkSeg}/${a.walkPath.length}`, pos: `${a.x.toFixed(2)},${a.z.toFixed(2)}`,
      rotDeg: Math.round((a.rotY * 180) / Math.PI), seat: a.meetingSeat !== undefined ? BOARDROOM_SEATS[a.meetingSeat]!.id : '',
      stool: a.stool ?? -1, room: this.nav.roomAt({ x: a.x, z: a.z }), queue: this.visitQueue.get(id)?.length ?? 0,
      bubble: a.bubbleTimer > 0 ? (a.bubbleText ?? '').slice(0, 30) : '',
    })),
    path: (from: Pt, to: Pt) => this.walkPath(from, to),
    rngState: () => this.rng.state(),
  };

  // =========================================================================
  // Bantuan
  // =========================================================================
  private walkPath(from: Pt, to: Pt): NavPt[] { return this.nav.path(from, to); }
  private currentPos(a: SimAgent): Pt { return { x: a.x, z: a.z }; }
  private deskPos(a: SimAgent): Pt { return { x: a.desk.x, z: a.desk.z }; }
  private queueSpot(i: number): Spot {
    const q = this.spots.coffeeQueue;
    return q[Math.min(Math.max(i, 0), q.length - 1)]!;
  }
  private statusOf(a: SimAgent): AgentStatus | null { return this.live ? a.status : null; }
  private ambientOk(id: string) {
    const a = this.agents.get(id);
    const st = a ? this.statusOf(a) : null;
    return st === null || st === 'idle' || st === 'meeting';
  }
  private say(a: SimAgent, text: string, dur: number, real = false) {
    a.bubbleText = text;
    a.bubbleTimer = dur;
    a.bubbleReal = real;
    a.bubbleSeq += 1;
  }
  private place(a: SimAgent, p: Pt & { rotY?: number }, y = 0) {
    a.x = p.x; a.y = y; a.z = p.z;
    if (p.rotY !== undefined) a.rotY = p.rotY;
  }
  private sitAtDesk(a: SimAgent) {
    a.x = a.desk.x; a.y = a.desk.y; a.z = a.desk.z; a.rotY = a.desk.rotY; a.k = 1;
  }
  private setAwayBody(a: SimAgent) {
    const s = this.spots.lobbySpawn;
    a.vis = false;
    a.x = s.x; a.y = 0; a.z = s.z; a.k = 0;
  }

  // ---- Door mutex ----
  private gateOf(id: string) {
    let g = this.gates.get(id);
    if (!g) { g = { lastGrant: -Infinity, waiting: [] }; this.gates.set(id, g); }
    return g;
  }
  private leaveGate(agentId: string) {
    for (const g of this.gates.values()) {
      const i = g.waiting.indexOf(agentId);
      if (i >= 0) g.waiting.splice(i, 1);
    }
  }
  private passGate(agentId: string, gateId: string): boolean {
    const g = this.gateOf(gateId);
    g.waiting = g.waiting.filter((id) => {
      const a = this.agents.get(id);
      return !!a && a.walkPath[a.walkSeg]?.gate === gateId && a.gateSeg !== a.walkSeg;
    });
    if (!g.waiting.includes(agentId)) g.waiting.push(agentId);
    if (g.waiting[0] === agentId && this.time - g.lastGrant >= DOOR_MUTEX_GAP_S) {
      g.lastGrant = this.time;
      g.waiting.shift();
      return true;
    }
    return false;
  }
  private setWalk(agentId: string, a: SimAgent, path: NavPt[]) {
    this.leaveGate(agentId);
    a.walkPath = path;
    a.walkSeg = 0;
    a.walkT = 0;
    a.gateSeg = -1;
  }

  // ---- Antrean kopi & kursi ----
  private moveToQueueSlot(waitingId: string, slot: number) {
    const w = this.agents.get(waitingId);
    if (!w || (w.state !== 'waiting_in_queue' && w.state !== 'walk_to_coffee')) return;
    const from = this.currentPos(w);
    const to = this.queueSpot(slot);
    const head = this.queueSpot(0);
    const tail = this.queueSpot(this.spots.coffeeQueue.length - 1);
    const onLine = Math.abs(from.x - to.x) < 0.05 && from.z >= Math.min(head.z, tail.z) - 0.1 && from.z <= Math.max(head.z, tail.z) + 0.1;
    w.state = 'walk_to_coffee';
    this.setWalk(waitingId, w, onLine ? [from, to] : this.walkPath(from, to));
  }
  private leaveCoffeeQueue(agentId: string) {
    const idx = this.coffeeQueue.indexOf(agentId);
    if (idx === -1) return;
    this.coffeeQueue.splice(idx, 1);
    this.coffeeQueue.forEach((waitingId, newIdx) => { if (newIdx >= idx) this.moveToQueueSlot(waitingId, newIdx); });
  }
  private releaseStool(agentId: string) {
    const i = this.stoolOccupant.indexOf(agentId);
    if (i >= 0) this.stoolOccupant[i] = null;
    const a = this.agents.get(agentId);
    if (a) a.stool = undefined;
  }
  private releaseErrand(agentId: string) {
    const a = this.agents.get(agentId);
    const er = a?.errand;
    if (!a || !er) return;
    const seats = er.kind === 'lounge' ? this.sofaOccupant : er.kind === 'commons' ? this.commonsOccupant : er.kind === 'garden' ? this.gardenOccupant
      : er.kind === 'workshop' ? this.workshopOccupant : er.kind === 'infowall' ? this.infoOccupant : er.kind === 'pods' ? this.podOccupant
        : er.kind === 'studio' ? this.studioOccupant : er.kind === 'focus' ? this.focusOccupant : null;
    if (seats && er.seat !== undefined && seats[er.seat] === agentId) seats[er.seat] = null;
    if (er.kind === 'workshop' && er.role === 'presenter' && this.workshopPresenter === agentId) this.workshopPresenter = null;
    if (er.kind === 'server' && this.serverBusy === agentId) this.serverBusy = null;
    if (er.kind === 'access' && this.accessBusy === agentId) this.accessBusy = null;
    a.errand = undefined;
  }
  private leaveAmbient(agentId: string) {
    this.leaveCoffeeQueue(agentId);
    this.releaseStool(agentId);
    this.releaseErrand(agentId);
  }
  private recallToDesk(agentId: string, text?: string) {
    const a = this.agents.get(agentId);
    if (!a) return;
    this.leaveAmbient(agentId);
    a.hasCup = false;
    a.state = 'walk_back_to_desk';
    a.stateTime = 0;
    this.setWalk(agentId, a, this.walkPath(this.currentPos(a), this.deskPos(a)));
    if (text) this.say(a, text, 3.0);
  }
  private startVisit(fromId: string, toId: string, text: string, carryDoc: boolean) {
    const a = this.agents.get(fromId);
    const target = this.agents.get(toId);
    if (!a || !target || toId === fromId) return;
    if (this.live) this.recentPairs.push({ a: fromId, b: toId, t: this.time });
    a.state = 'walk_to_visit';
    a.stateTime = 0;
    a.visitTarget = toId;
    a.hasDoc = carryDoc;
    this.setWalk(fromId, a, this.walkPath(this.deskPos(a), target.desk.visit));
    this.say(a, clipText(text, 90), 4.5, true);
  }
  private startArrival(agentId: string, a: SimAgent) {
    this.leaveAmbient(agentId);
    const s = this.spots.lobbySpawn;
    a.departAt = undefined;
    a.state = 'walk_in_from_lobby';
    a.stateTime = 0;
    a.vis = true;
    a.x = s.x; a.y = 0; a.z = s.z; a.rotY = s.rotY; a.k = 0;
    this.setWalk(agentId, a, this.walkPath(s, this.deskPos(a)));
    this.say(a, this.rng.pick(ARRIVAL_LINES), 3.0);
  }
  private startLeaving(agentId: string, a: SimAgent) {
    this.leaveAmbient(agentId);
    a.state = 'walk_out_to_lobby';
    a.stateTime = 0;
    a.hasCup = false;
    this.setWalk(agentId, a, this.walkPath(this.currentPos(a), this.spots.lobbySpawn));
    this.say(a, this.rng.pick(LEAVING_LINES), 2.8);
  }
  private setAway(a: SimAgent) {
    a.state = 'away';
    a.stateTime = 0;
    this.setAwayBody(a);
  }
  private beginErrand(id: string, a: SimAgent, errand: Errand, from: Pt, going: readonly string[] | string) {
    a.errand = errand;
    a.state = 'walk_to_errand';
    a.stateTime = 0;
    this.setWalk(id, a, this.walkPath(from, errand.stops[0]!.approach));
    this.say(a, typeof going === 'string' ? going : this.rng.pick(going), typeof going === 'string' ? 3.5 : 3.0);
  }
  private startLoungeErrand(agentId: string, a: SimAgent, from: Pt): boolean {
    const i = this.sofaOccupant.indexOf(null);
    if (i < 0) return false;
    this.sofaOccupant[i] = agentId;
    const seat = this.spots.sofa[i]!;
    this.beginErrand(agentId, a, {
      kind: 'lounge', i: 0, seat: i,
      stops: [{ approach: seat.approach, spot: seat.spot, sitY: LOUNGE.sitY, duration: this.rng.rand(16, 24), pose: 'lounge', lines: LOUNGE_CHAT }],
    }, from, LOUNGE_GOING);
    return true;
  }
  private startServerErrand(agentId: string, a: SimAgent): boolean {
    if (this.serverBusy) return false;
    this.serverBusy = agentId;
    const ins = this.spots.serverInspect, con = this.spots.serverConsole;
    this.beginErrand(agentId, a, {
      kind: 'server', i: 0,
      stops: [
        { approach: ins, spot: ins, sitY: 0, duration: this.rng.rand(7, 10), pose: 'inspect', lines: SERVER_INSPECT },
        { approach: con.approach, spot: con.spot, sitY: 0.45, duration: this.rng.rand(8, 11), pose: 'type', lines: SERVER_CONSOLE },
      ],
    }, this.deskPos(a), SERVER_GOING);
    return true;
  }
  private startCommonsDiscussion(ids: readonly string[]): string[] {
    const started: string[] = [];
    for (const id of ids) {
      const a = this.agents.get(id);
      const i = COMMONS_SEAT_ORDER.find((k) => this.commonsOccupant[k] === null);
      if (!a || i === undefined) continue;
      this.commonsOccupant[i] = id;
      const seat = this.spots.commons[i]!;
      this.beginErrand(id, a, {
        kind: 'commons', i: 0, seat: i,
        stops: [{ approach: seat.approach, spot: seat.spot, sitY: COMMONS.sitY, duration: this.rng.rand(25, 35), pose: 'discuss', lines: COMMONS_CHAT, chat: COMMONS_CHAT, chatRate: 0.22 }],
      }, this.deskPos(a), COMMONS_GOING);
      started.push(id);
    }
    return started;
  }
  private podOf(id: string) {
    const p = AGENT_3D_POSITIONS[id];
    if (!p) return 'other';
    if (p.room === 'manager') return 'manager';
    if (p.z < -3.0) return 'exec';
    return p.x < 0 ? 'pod_west' : 'pod_east';
  }
  private pickCommonsGroup(cands: readonly string[]): string[] {
    const groups = new Map<string, string[]>();
    for (const id of this.rng.shuffle(cands)) {
      const g = this.podOf(id);
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(id);
    }
    if (groups.size < 2 || cands.length < 3) return [];
    const keys = this.rng.shuffle([...groups.keys()]);
    const picked = [groups.get(keys[0]!)![0]!, groups.get(keys[1]!)![0]!];
    const rest = this.rng.shuffle(cands.filter((id) => !picked.includes(id)));
    const n = Math.min(this.rng.next() < 0.5 ? 3 : 4, picked.length + rest.length);
    return [...picked, ...rest].slice(0, n);
  }
  private startGardenErrand(agentId: string, a: SimAgent): boolean {
    const i = [0, 2, 1].find((k) => this.gardenOccupant[k] === null);
    if (i === undefined) return false;
    this.gardenOccupant[i] = agentId;
    const seat = this.spots.garden[i]!;
    this.beginErrand(agentId, a, {
      kind: 'garden', i: 0, seat: i,
      stops: [{ approach: seat.approach, spot: seat.spot, sitY: GARDEN.sitY, duration: this.rng.rand(15, 25), pose: 'lounge', lines: GARDEN_CHAT, chat: GARDEN_CHAT, chatRate: 0.06 }],
    }, this.currentPos(a), GARDEN_GOING);
    return true;
  }
  private startWorkshopSession(presenterId: string, attendees: readonly string[]): string[] {
    const pa = this.agents.get(presenterId);
    if (!pa || this.workshopPresenter) return [];
    const dur = this.rng.rand(25, 35);
    this.workshopPresenter = presenterId;
    this.workshopTopic = this.rng.pick(WORKSHOP_TOPICS);
    const ps = this.spots.presenter;
    this.beginErrand(presenterId, pa, {
      kind: 'workshop', role: 'presenter', i: 0,
      stops: [{ approach: ps, spot: ps, sitY: 0, duration: dur + 4, pose: 'inspect', lines: WORKSHOP_TALK, chat: WORKSHOP_TALK, chatRate: 0.3 }],
    }, this.deskPos(pa), `Sesi Workshop: ${this.workshopTopic}`);
    const started = [presenterId];
    for (const id of attendees) {
      if (id === presenterId) continue;
      const a = this.agents.get(id);
      const i = WORKSHOP_SEAT_ORDER.find((k) => this.workshopOccupant[k] === null);
      if (!a || i === undefined) continue;
      this.workshopOccupant[i] = id;
      const seat = this.spots.workshop[i]!;
      this.beginErrand(id, a, {
        kind: 'workshop', i: 0, seat: i,
        stops: [{ approach: seat.approach, spot: seat.spot, sitY: WORKSHOP.sitY, duration: dur, pose: 'discuss', lines: WORKSHOP_CHAT, chat: WORKSHOP_CHAT, chatRate: 0.06 }],
      }, this.deskPos(a), WORKSHOP_GOING);
      started.push(id);
    }
    return started;
  }
  private startInfoWallCheck(ids: readonly string[]): string[] {
    const started: string[] = [];
    for (const id of ids) {
      const a = this.agents.get(id);
      const i = [1, 0, 2].find((k) => this.infoOccupant[k] === null);
      if (!a || i === undefined) continue;
      this.infoOccupant[i] = id;
      const spot = this.spots.infoWall[i]!;
      this.beginErrand(id, a, {
        kind: 'infowall', i: 0, seat: i,
        stops: [{ approach: spot, spot, sitY: 0, duration: this.rng.rand(14, 20), pose: 'inspect', lines: INFOWALL_CHAT, chat: INFOWALL_CHAT, chatRate: 0.12 }],
      }, this.currentPos(a), INFOWALL_GOING);
      started.push(id);
    }
    return started;
  }
  private startPodHuddle(idA: string, idB: string, podIndex?: number): boolean {
    const free = [0, 1].filter((p) => this.podOccupant[p * 2] === null && this.podOccupant[p * 2 + 1] === null);
    const pod = podIndex !== undefined ? (free.includes(podIndex) ? podIndex : undefined) : free[0];
    if (pod === undefined || idA === idB) return false;
    const dur = this.rng.rand(20, 30);
    [idA, idB].forEach((id, k) => {
      const a = this.agents.get(id);
      if (!a) return;
      const i = pod * 2 + k;
      this.podOccupant[i] = id;
      const seat = this.spots.pods[i]!;
      this.beginErrand(id, a, {
        kind: 'pods', i: 0, seat: i,
        stops: [{ approach: seat.approach, spot: seat.spot, sitY: COLLABPODS.sitY, duration: dur, pose: 'discuss', lines: PODS_CHAT, chat: PODS_CHAT, chatRate: 0.22 }],
      }, this.currentPos(a), PODS_GOING);
    });
    return true;
  }
  private startStudioSession(ids: readonly string[]): string[] {
    const started: string[] = [];
    if (this.studioOccupant.some((o) => o !== null)) return started;
    const dur = this.rng.rand(20, 28);
    const sp = this.spots.studio;
    // 0 = talent, 1 = sutradara / kameramen, 2 = editor
    const roles = ids.length >= 2 ? [1, 0] : [2];
    roles.forEach((role, k) => {
      const id = ids[k];
      const a = id ? this.agents.get(id) : undefined;
      if (!id || !a) return;
      this.studioOccupant[role] = id;
      const stop: ErrandStop = role === 0
        ? { approach: sp.talent, spot: sp.talent, sitY: 0, duration: dur, pose: 'present', lines: STUDIO_TALK, chat: STUDIO_TALK, chatRate: 0.2 }
        : role === 1
          ? { approach: sp.director, spot: sp.director, sitY: 0, duration: dur + 1, pose: 'inspect', lines: STUDIO_CREW, chat: STUDIO_CREW, chatRate: 0.08 }
          : { approach: sp.editor.approach, spot: sp.editor.spot, sitY: STUDIO.sitY, duration: dur, pose: 'type', lines: STUDIO_CREW, chat: STUDIO_CREW, chatRate: 0.05 };
      this.beginErrand(id, a, { kind: 'studio', i: 0, seat: role, stops: [stop] }, this.currentPos(a), STUDIO_GOING);
      started.push(id);
    });
    return started;
  }
  private startFocusSession(id: string, podIndex?: number): boolean {
    const a = this.agents.get(id);
    const free = [0, 1].filter((k) => this.focusOccupant[k] === null);
    const i = podIndex !== undefined ? (free.includes(podIndex) ? podIndex : undefined) : free[Math.floor(this.rng.next() * free.length)];
    if (!a || i === undefined) return false;
    this.focusOccupant[i] = id;
    const seat = this.spots.focus[i]!;
    this.beginErrand(id, a, {
      kind: 'focus', i: 0, seat: i,
      stops: [{ approach: seat.approach, spot: seat.spot, sitY: FOCUSPODS.sitY, duration: this.rng.rand(22, 32), pose: 'type', lines: FOCUS_MUTTER, chat: FOCUS_MUTTER, chatRate: 0.03 }],
    }, this.currentPos(a), FOCUS_GOING);
    return true;
  }
  private startAccessVisit(id: string): boolean {
    const a = this.agents.get(id);
    if (!a || this.accessBusy) return false;
    this.accessBusy = id;
    const s = this.spots.access;
    this.beginErrand(id, a, {
      kind: 'access', i: 0,
      stops: [
        { approach: s.map, spot: s.map, sitY: 0, duration: this.rng.rand(9, 13), pose: 'inspect', lines: ACCESS_MAP, chat: ACCESS_MAP, chatRate: 0.1 },
        { approach: s.lift, spot: s.lift, sitY: 0, duration: this.rng.rand(5, 8), pose: 'inspect', lines: ACCESS_LIFT },
      ],
    }, this.currentPos(a), ACCESS_GOING);
    return true;
  }
  private finishErrand(agentId: string, a: SimAgent) {
    this.releaseErrand(agentId);
    a.state = 'walk_back_to_desk';
    a.stateTime = 0;
    this.setWalk(agentId, a, this.walkPath(this.currentPos(a), this.deskPos(a)));
  }

  // =========================================================================
  // Rapat
  // =========================================================================
  private assignSeat(id: string, a: SimAgent): number {
    if (a.meetingSeat !== undefined) return a.meetingSeat;
    const prefer = MEETING_SEAT_ASSIGNMENT[id];
    let idx = prefer ? BOARDROOM_SEATS.findIndex((s) => s.id === prefer) : -1;
    if (idx < 0 || this.seatOccupant[idx]) idx = this.seatOccupant.findIndex((o) => o === null);
    if (idx >= 0) {
      this.seatOccupant[idx] = id;
      a.meetingSeat = idx;
    }
    return idx;
  }
  private releaseSeat(id: string, a: SimAgent) {
    const i = this.seatOccupant.indexOf(id);
    if (i >= 0) this.seatOccupant[i] = null;
    a.meetingSeat = undefined;
  }
  private walkToSeat(id: string, a: SimAgent) {
    a.state = 'walk_to_meeting';
    a.stateTime = 0;
    this.setWalk(id, a, this.walkPath(this.currentPos(a), boardroom.approach(a.meetingSeat!)));
  }
  private startMeeting(host: string, text: string, real: boolean) {
    const topic = clipText(text, 140);
    const m = this.meeting;
    if (m && m.phase !== 'dispersing') {
      m.topic = topic;
      m.topicReal = real;
      m.host = host;
      if (m.phase === 'session') this.beginSession();
      return;
    }
    const attendees: string[] = [];
    const ids = [host, ...[...this.agents.keys()].filter((id) => id !== host)];
    for (const id of ids) {
      const a = this.agents.get(id);
      if (!a || this.statusOf(a) === 'offline') continue;
      if (a.state === 'away' || a.state === 'walk_out_to_lobby') continue;
      if (this.assignSeat(id, a) < 0) continue;
      attendees.push(id);
    }
    if (attendees.length === 0) return;
    this.meeting = { phase: 'gathering', host, topic, topicReal: real, attendees, startedAt: this.time, sessionStartAt: 0, sessionEndsAt: 0 };
    const door = this.spots.boardDoorInside;
    const order = attendees
      .map((id) => ({ id, len: pathLength(this.walkPath(this.currentPos(this.agents.get(id)!), door)) }))
      .sort((a, b) => a.len - b.len);
    let slot = 0;
    for (const { id } of order) {
      const a = this.agents.get(id)!;
      if (a.state === 'in_meeting' || a.state === 'meeting_sitting' || a.state === 'walk_to_meeting' || a.state === 'meeting_standing') continue;
      if (a.state === 'walk_from_meeting') { this.walkToSeat(id, a); continue; }
      this.leaveAmbient(id);
      a.hasCup = false;
      a.hasDoc = false;
      a.visitTarget = undefined;
      this.visitQueue.delete(id);
      if (atDeskState(a.state)) {
        a.state = 'meeting_called';
        a.stateTime = 0;
        a.departAt = this.time + 0.6 + slot * MEETING_DEPART_GAP_S;
        slot += 1;
      } else {
        this.walkToSeat(id, a);
      }
    }
    if (attendees.includes(host)) this.dlgQueue.push({ agentId: host, text: this.rng.pick(MEETING_CALL_LINES), showAt: this.time + 0.2, dur: 3.2, real: false });
    const other = attendees.find((id) => id !== host);
    if (other) this.dlgQueue.push({ agentId: other, text: this.rng.pick(MEETING_ON_THE_WAY), showAt: this.time + 1.8, dur: 2.6, real: false });
  }
  private beginSession() {
    const m = this.meeting;
    if (!m) return;
    m.phase = 'session';
    m.sessionStartAt = this.time;
    m.sessionEndsAt = this.time + MEETING_SESSION_S;
    const present = m.attendees.filter((id) => MEETING_STATES.has(this.agents.get(id)?.state ?? 'working'));
    if (present.includes(m.host)) this.dlgQueue.push({ agentId: m.host, text: m.topic, showAt: this.time + 0.8, dur: 6.5, real: m.topicReal });
    let t = this.time + MEETING_PRESENT_S + 0.5;
    for (const id of present.filter((x) => x !== m.host).slice(0, 3)) {
      this.dlgQueue.push({ agentId: id, text: this.rng.pick(MEETING_REPLIES), showAt: t, dur: 3, real: false });
      t += 3.4;
    }
  }
  private beginDispersal() {
    const m = this.meeting;
    if (!m) return;
    m.phase = 'dispersing';
    const door = this.spots.boardDoorInside;
    const seated: Array<{ id: string; len: number }> = [];
    for (const id of m.attendees) {
      const a = this.agents.get(id);
      if (!a) continue;
      if (a.meetingSeat !== undefined) this.rigs[a.meetingSeat]!.swivelTarget = 0;
      if (a.state === 'in_meeting' || a.state === 'meeting_sitting') {
        seated.push({ id, len: pathLength(this.walkPath(boardroom.approach(a.meetingSeat!), door)) });
      } else if (a.state === 'meeting_called') {
        a.state = 'working';
        a.stateTime = 0;
        this.releaseSeat(id, a);
      } else if (a.state === 'walk_to_meeting') {
        a.state = 'walk_from_meeting';
        a.stateTime = 0;
        this.setWalk(id, a, this.walkPath(this.currentPos(a), this.deskPos(a)));
      }
    }
    seated.sort((a, b) => a.len - b.len).forEach(({ id }, k) => { this.agents.get(id)!.departAt = this.time + 0.5 + k * MEETING_DEPART_GAP_S; });
    const loungeCount = Math.min(this.spots.sofa.length, 2 + Math.floor(this.rng.next() * 2));
    this.rng.shuffle(seated.map((s) => s.id)).slice(0, loungeCount).forEach((id) => { this.agents.get(id)!.loungeAfter = true; });
  }
  private updateMeeting() {
    const m = this.meeting;
    if (!m) return;
    if (m.phase === 'gathering') {
      const seated = m.attendees.filter((id) => this.agents.get(id)?.state === 'in_meeting').length;
      if (seated === m.attendees.length || this.time - m.startedAt > MEETING_GATHER_TIMEOUT_S) this.beginSession();
    } else if (m.phase === 'session') {
      const toTv = this.time - m.sessionStartAt < MEETING_PRESENT_S;
      for (const id of m.attendees) {
        const a = this.agents.get(id);
        if (!a || a.meetingSeat === undefined || a.state !== 'in_meeting') continue;
        this.rigs[a.meetingSeat]!.swivelTarget = toTv ? boardroom.tvSwivel(a.meetingSeat) : 0;
      }
      if (this.time >= m.sessionEndsAt) this.beginDispersal();
    } else {
      const busy = m.attendees.some((id) => {
        const a = this.agents.get(id);
        return !!a && (MEETING_STATES.has(a.state) || a.state === 'walk_from_meeting');
      });
      if (!busy) {
        this.meeting = null;
        this.seatOccupant.fill(null);
      }
    }
  }

  // =========================================================================
  // Status live, penjadwal, dialog
  // =========================================================================
  private processStatuses() {
    for (const [id, a] of this.agents) {
      const st = a.status;
      if (st === null) continue;
      const prev = a.lastStatus;
      if (prev !== st) {
        a.lastStatus = st;
        const line = LIVE_STATUS_LINES[st];
        if (line && prev !== undefined) this.say(a, this.rng.pick(line), 4.0);
      }
      if (st === 'offline') {
        if (prev === undefined && a.state !== 'away') this.setAway(a);
        else if (atDeskState(a.state)) this.startLeaving(id, a);
      } else if (a.state === 'away') {
        this.startArrival(id, a);
      }
      if (prev !== undefined && BUSY_STATUSES.has(prev) && st === 'idle' && a.state === 'working' && !this.coffeeQueue.includes(id) && !this.meeting) {
        this.startGardenErrand(id, a);
      }
      if (st !== 'idle' && st !== 'meeting' && COFFEE_STATES.has(a.state)) {
        this.recallToDesk(id, st === 'waiting_approval' ? 'Eh, ada yang butuh izin CEO!' : 'Ada tugas masuk, balik ke meja!');
      }
      if (st === 'waiting_approval' && a.bubbleTimer <= 0 && atDeskState(a.state)) {
        this.say(a, this.rng.pick(LIVE_STATUS_LINES.waiting_approval ?? ['Menunggu izin CEO']), 3.5);
      }
    }
  }

  private relaxed(): string[] {
    return [...this.agents].filter(([id, a]) => a.state === 'working' && this.ambientOk(id) && !this.coffeeQueue.includes(id)).map(([id]) => id);
  }

  private runSchedulers(isLive: boolean) {
    const r = this.rng, t = this.time;
    if (t >= this.nextServerT) {
      const techs = ['satria', 'bima'].filter((id) => this.agents.get(id)?.state === 'working' && this.ambientOk(id) && !this.coffeeQueue.includes(id));
      const id = techs.length ? r.pick(techs) : null;
      const a = id ? this.agents.get(id) : undefined;
      if (id && a) this.startServerErrand(id, a);
      this.nextServerT = t + r.rand(SERVER_MIN_S, SERVER_MAX_S);
    }
    if (t >= this.nextCommonsT) {
      const cands = this.relaxed();
      if (!this.meeting && this.commonsOccupant.every((o) => o === null)) this.startCommonsDiscussion(this.pickCommonsGroup(cands));
      this.nextCommonsT = t + r.rand(COMMONS_MIN_S, COMMONS_MAX_S);
    }
    if (!isLive && t >= this.nextGardenT) {
      const cands = [...this.agents].filter(([id, a]) => a.state === 'working' && !this.coffeeQueue.includes(id)).map(([id]) => id);
      const id = cands.length ? r.pick(cands) : null;
      const a = id ? this.agents.get(id) : undefined;
      if (id && a && !this.meeting) this.startGardenErrand(id, a);
      this.nextGardenT = t + r.rand(GARDEN_MIN_S, GARDEN_MAX_S);
    }
    if (t >= this.nextWorkshopT) {
      const cands = this.relaxed(), hosts = WORKSHOP_PRESENTERS.filter((id) => cands.includes(id));
      if (!this.meeting && !this.workshopPresenter && hosts.length > 0) {
        const host = r.pick(hosts);
        const rest = r.shuffle(cands.filter((id) => id !== host));
        const n = 2 + Math.floor(r.next() * 3);
        if (rest.length >= 2) this.startWorkshopSession(host, rest.slice(0, n));
      }
      this.nextWorkshopT = t + r.rand(WORKSHOP_MIN_S, WORKSHOP_MAX_S);
    }
    if (t >= this.nextInfoT) {
      const cands = this.relaxed();
      const ordered = [...INFOWALL_PREFERRED.filter((id) => cands.includes(id)), ...r.shuffle(cands.filter((id) => !INFOWALL_PREFERRED.includes(id)))];
      if (!this.meeting && this.infoOccupant.every((o) => o === null) && ordered.length > 0) this.startInfoWallCheck(ordered.slice(0, r.next() < 0.5 ? 1 : 2));
      this.nextInfoT = t + r.rand(INFOWALL_MIN_S, INFOWALL_MAX_S);
    }
    if (t >= this.nextPodsT) {
      const cands = r.shuffle(this.relaxed());
      if (!this.meeting && cands.length >= 2) this.startPodHuddle(cands[0]!, cands[1]!);
      this.nextPodsT = t + r.rand(PODS_MIN_S, PODS_MAX_S);
    }
    if (t >= this.nextStudioT) {
      const cands = this.relaxed();
      const ordered = [...r.shuffle(STUDIO_PREFERRED.filter((id) => cands.includes(id))), ...r.shuffle(cands.filter((id) => !STUDIO_PREFERRED.includes(id)))];
      if (!this.meeting && this.studioOccupant.every((o) => o === null) && ordered.length > 0) this.startStudioSession(ordered.slice(0, r.next() < 0.6 ? 2 : 1));
      this.nextStudioT = t + r.rand(STUDIO_MIN_S, STUDIO_MAX_S);
    }
    if (t >= this.nextFocusT) {
      const cands = this.relaxed(), techs = FOCUS_PREFERRED.filter((id) => cands.includes(id));
      if (!this.meeting && techs.length > 0) this.startFocusSession(r.pick(techs));
      this.nextFocusT = t + r.rand(FOCUS_MIN_S, FOCUS_MAX_S);
    }
    if (t >= this.nextAccessT) {
      const cands = this.relaxed(), pref = ACCESS_PREFERRED.filter((id) => cands.includes(id));
      const id = pref.length > 0 && r.next() < 0.75 ? r.pick(pref) : cands.length > 0 ? r.pick(cands) : null;
      if (!this.meeting && id && !this.accessBusy) this.startAccessVisit(id);
      this.nextAccessT = t + r.rand(ACCESS_MIN_S, ACCESS_MAX_S);
    }
    if (isLive && this.recentPairs.length > 0) {
      for (let i = this.recentPairs.length - 1; i >= 0; i--) {
        const pr = this.recentPairs[i]!;
        if (t - pr.t > PAIR_MEMORY_S) { this.recentPairs.splice(i, 1); continue; }
        const ok = (id: string) => {
          const a = this.agents.get(id);
          return !!a && a.status === 'idle' && a.state === 'working' && !this.coffeeQueue.includes(id);
        };
        if (!this.meeting && ok(pr.a) && ok(pr.b) && this.startPodHuddle(pr.a, pr.b)) this.recentPairs.splice(i, 1);
      }
    }
    if (t >= this.nextCoffeeT) {
      const candidates = [...this.agents].filter(([id, a]) => a.state === 'working' && !this.coffeeQueue.includes(id) && this.ambientOk(id)).map(([id]) => id);
      if (candidates.length > 0 && this.coffeeQueue.length < 3) {
        const luckyId = r.pick(candidates);
        const a = this.agents.get(luckyId)!;
        this.coffeeQueue.push(luckyId);
        a.state = 'walk_to_coffee';
        a.stateTime = 0;
        this.setWalk(luckyId, a, this.walkPath(this.deskPos(a), this.queueSpot(this.coffeeQueue.indexOf(luckyId))));
        this.say(a, r.pick(COFFEE_ROUTINE_DIALOGUES.going_to_pantry), 3.0);
      }
      this.nextCoffeeT = t + r.rand(COFFEE_MIN_S, COFFEE_MAX_S);
    }
    if (t >= this.nextConvoT) {
      const convo = r.pick(OFFICE_CONVERSATIONS);
      const ok = convo.dialogues.every((d) => {
        const a = this.agents.get(d.speakerId);
        return a && atDeskState(a.state) && a.bubbleTimer <= 0 && this.ambientOk(d.speakerId);
      });
      if (ok) {
        let st = t + 0.5;
        convo.dialogues.forEach((d) => {
          this.dlgQueue.push({ agentId: d.speakerId, text: d.text, showAt: st, dur: d.durationMs / 1000, real: false });
          st += d.durationMs / 1000 + 0.3;
        });
      }
      this.nextConvoT = t + r.rand(CONVO_MIN_S, CONVO_MAX_S);
    }
    if (t >= this.nextThoughtT) {
      const cands = [...this.agents].filter(([id, a]) => a.state === 'working' && a.bubbleTimer <= 0 && this.ambientOk(id)).map(([id]) => id);
      if (cands.length > 0) {
        const id = r.pick(cands);
        const thoughts = AGENT_SOLO_THOUGHTS[id];
        if (thoughts && thoughts.length > 0) this.say(this.agents.get(id)!, r.pick(thoughts), 4.0);
      }
      this.nextThoughtT = t + r.rand(THOUGHT_MIN_S, THOUGHT_MAX_S);
    }
  }

  private processDialogue(isLive: boolean) {
    for (let i = this.dlgQueue.length - 1; i >= 0; i--) {
      const dq = this.dlgQueue[i]!;
      if (this.time >= dq.showAt) {
        const a = this.agents.get(dq.agentId);
        // Ucapan live yang masih tampil tidak ditimpa obrolan template
        if (a && (a.bubbleTimer <= 0.5 || !isLive)) this.say(a, dq.text, dq.dur, dq.real);
        this.dlgQueue.splice(i, 1);
      }
    }
  }

  // =========================================================================
  // Kedatangan di ujung rute
  // =========================================================================
  private handleArrival(agentId: string, a: SimAgent) {
    this.leaveGate(agentId);
    const r = this.rng;
    switch (a.state) {
      case 'walk_to_coffee': {
        const qIdx = this.coffeeQueue.indexOf(agentId);
        if (qIdx === 0) {
          a.state = 'brewing';
          a.stateTime = 0;
          a.stateDuration = r.rand(3.5, 5);
          this.say(a, r.pick(COFFEE_ROUTINE_DIALOGUES.brewing), 3.5);
          this.place(a, this.queueSpot(0));
          a.k = 0;
        } else if (qIdx > 0) {
          a.state = 'waiting_in_queue';
          a.stateTime = 0;
          this.say(a, r.pick(COFFEE_ROUTINE_DIALOGUES.waiting_in_queue), 3.0);
          this.place(a, this.queueSpot(qIdx));
          a.k = 0;
        }
        break;
      }
      case 'walk_to_stool':
        a.state = 'sipping_at_bar';
        a.stateTime = 0;
        a.stateDuration = r.rand(10, 16);
        this.say(a, r.pick(COFFEE_ROUTINE_DIALOGUES.sipping_at_bar), 3.5);
        break;
      case 'walk_to_desk':
        a.state = 'drinking';
        a.stateTime = 0;
        a.stateDuration = r.rand(12, 18);
        this.say(a, r.pick(COFFEE_ROUTINE_DIALOGUES.sipping_at_desk), 3.5);
        this.sitAtDesk(a);
        break;
      case 'walk_to_trash':
        a.state = 'disposing';
        a.stateTime = 0;
        a.stateDuration = 2.0;
        this.say(a, r.pick(COFFEE_ROUTINE_DIALOGUES.disposing), 2.5);
        this.place(a, this.spots.trashStand);
        a.k = 0;
        break;
      case 'walk_out_to_lobby':
        this.setAway(a);
        break;
      case 'walk_to_errand': {
        const stop = a.errand?.stops[a.errand.i];
        if (!stop) { this.finishErrand(agentId, a); break; }
        a.state = 'errand_stay';
        a.stateTime = 0;
        this.place(a, { x: stop.approach.x, z: stop.approach.z, rotY: stop.spot.rotY });
        a.k = 0;
        this.say(a, r.pick(stop.lines), 3.4);
        break;
      }
      case 'walk_in_from_lobby':
      case 'walk_from_trash':
      case 'walk_from_visit':
      case 'walk_from_meeting':
      case 'walk_back_to_desk': {
        if (a.state === 'walk_from_meeting') this.releaseSeat(agentId, a);
        a.state = 'working';
        a.stateTime = 0;
        a.hasDoc = false;
        a.visitTarget = undefined;
        this.sitAtDesk(a);
        const next = this.visitQueue.get(agentId)?.shift();
        if (next) this.startVisit(agentId, next.to, next.text, next.carryDoc);
        break;
      }
      case 'walk_to_visit': {
        a.state = 'visiting';
        a.stateTime = 0;
        a.stateDuration = VISIT_STAY_S;
        const target = a.visitTarget ? this.agents.get(a.visitTarget) : undefined;
        const last = a.walkPath[a.walkPath.length - 1];
        if (last) this.place(a, last);
        a.k = 0;
        if (target) {
          a.rotY = Math.atan2(target.desk.x - a.x, target.desk.z - a.z);
          if (a.visitTarget && target.state === 'working') {
            this.dlgQueue.push({ agentId: a.visitTarget, text: r.pick(VISIT_ACKS), showAt: this.time + 1.2, dur: 2.6, real: false });
          }
        }
        break;
      }
      case 'walk_to_meeting': {
        a.state = 'meeting_sitting';
        a.stateTime = 0;
        if (a.meetingSeat !== undefined) {
          this.place(a, boardroom.approach(a.meetingSeat));
          a.rotY = boardroom.yaw(a.meetingSeat);
        }
        a.k = 0;
        break;
      }
      default:
        break;
    }
  }

  // =========================================================================
  // Pembaruan per agen (logika + transform badan; pose lengan di panggung)
  // =========================================================================
  private updateAgent(agentId: string, a: SimAgent, dt: number, isLive: boolean) {
    a.stateTime += dt;
    if (a.bubbleTimer > 0) a.bubbleTimer -= dt;
    if (a.bubbleTimer <= 0) { a.bubbleText = null; a.bubbleReal = false; }
    a.vis = a.state !== 'away';
    a.gateWait = false;
    const r = this.rng;

    switch (a.state) {
      case 'working':
        this.sitAtDesk(a);
        a.cupVis = false;
        a.docVis = false;
        break;

      case 'meeting_called':
        this.sitAtDesk(a);
        if (this.time >= (a.departAt ?? 0) && a.meetingSeat !== undefined) this.walkToSeat(agentId, a);
        break;

      case 'meeting_sitting': {
        const i = a.meetingSeat;
        if (i === undefined) { a.state = 'walk_from_meeting'; this.setWalk(agentId, a, this.walkPath(this.currentPos(a), this.deskPos(a))); break; }
        const rig = this.rigs[i]!;
        const yaw = boardroom.yaw(i), appr = boardroom.approach(i);
        if (a.stateTime < 0.45) {
          rig.pullTarget = 1;
          this.place(a, appr);
          a.rotY = yaw;
          a.k = 0;
        } else if (a.stateTime < 0.85) {
          const k = smoothstep((a.stateTime - 0.45) / 0.4);
          const seat = boardroom.seat(i, rig.pull);
          a.x = appr.x + (seat.x - appr.x) * k; a.y = seat.y * k; a.z = appr.z + (seat.z - appr.z) * k;
          a.rotY = yaw;
          a.k = k;
        } else {
          rig.pullTarget = 0;
          const seat = boardroom.seat(i, rig.pull);
          a.x = seat.x; a.y = seat.y; a.z = seat.z;
          a.rotY = yaw + rig.swivelAngle;
          a.k = 1;
          if (rig.pull <= 0.001) { a.state = 'in_meeting'; a.stateTime = 0; }
        }
        break;
      }

      case 'in_meeting': {
        const i = a.meetingSeat;
        if (i !== undefined) {
          const rig = this.rigs[i]!;
          const seat = boardroom.seat(i, rig.pull);
          a.x = seat.x; a.y = seat.y; a.z = seat.z;
          a.rotY = boardroom.yaw(i) + rig.swivelAngle;
        }
        a.k = 1;
        if ((!this.meeting || this.meeting.phase === 'dispersing') && this.time >= (a.departAt ?? 0)) {
          a.state = 'meeting_standing';
          a.stateTime = 0;
          a.subT = -1;
        }
        break;
      }

      case 'meeting_standing': {
        const i = a.meetingSeat;
        if (i === undefined) { a.state = 'walk_from_meeting'; this.setWalk(agentId, a, this.walkPath(this.currentPos(a), this.deskPos(a))); break; }
        const rig = this.rigs[i]!;
        const yaw = boardroom.yaw(i), appr = boardroom.approach(i);
        rig.swivelTarget = 0;
        if ((a.subT ?? -1) < 0) {
          rig.pullTarget = 1;
          const seat = boardroom.seat(i, rig.pull);
          a.x = seat.x; a.y = seat.y; a.z = seat.z;
          a.rotY = yaw + rig.swivelAngle;
          a.k = 1;
          if (rig.pull >= 0.999) a.subT = a.stateTime;
        } else {
          const k = smoothstep((a.stateTime - a.subT!) / 0.4);
          const seat = boardroom.seat(i, 1);
          a.x = seat.x + (appr.x - seat.x) * k; a.y = seat.y * (1 - k); a.z = seat.z + (appr.z - seat.z) * k;
          a.rotY = yaw;
          a.k = 1 - k;
          if (k >= 1) {
            rig.pullTarget = 0;
            a.stateTime = 0;
            if (this.meeting && this.meeting.phase !== 'dispersing') {
              a.state = 'meeting_sitting';
            } else if (a.loungeAfter && this.ambientOk(agentId) && this.startLoungeErrand(agentId, a, appr)) {
              a.loungeAfter = false;
              this.releaseSeat(agentId, a);
            } else {
              a.loungeAfter = false;
              a.state = 'walk_from_meeting';
              this.setWalk(agentId, a, this.walkPath(appr, this.deskPos(a)));
            }
          }
        }
        break;
      }

      case 'visiting':
        a.k = 0;
        a.docVis = a.hasDoc && a.stateTime < VISIT_STAY_S * 0.6;
        if (a.stateTime > a.stateDuration) {
          a.hasDoc = false;
          a.docVis = false;
          a.state = 'walk_from_visit';
          a.stateTime = 0;
          this.setWalk(agentId, a, this.walkPath(this.currentPos(a), this.deskPos(a)));
        }
        break;

      case 'waiting_in_queue':
        this.place(a, this.queueSpot(this.coffeeQueue.indexOf(agentId)));
        a.k = 0;
        a.cupVis = false;
        break;

      case 'brewing': {
        const head = this.queueSpot(0);
        this.place(a, head);
        a.k = 0;
        a.cupVis = a.stateTime > a.stateDuration * 0.65;
        if (a.stateTime > a.stateDuration) {
          a.hasCup = true;
          a.cupVis = true;
          this.coffeeQueue.shift();
          this.coffeeQueue.forEach((waitingId, newIdx) => this.moveToQueueSlot(waitingId, newIdx));
          a.stateTime = 0;
          const free = this.stoolOccupant.indexOf(null);
          if (free >= 0) {
            this.stoolOccupant[free] = agentId;
            a.stool = free;
            a.state = 'walk_to_stool';
            this.setWalk(agentId, a, this.walkPath(head, this.spots.stools[free]!.approach));
            this.say(a, r.pick(COFFEE_ROUTINE_DIALOGUES.walking_to_bar), 3.0);
          } else {
            a.state = 'walk_to_desk';
            this.setWalk(agentId, a, this.walkPath(head, this.deskPos(a)));
            this.say(a, r.pick(COFFEE_ROUTINE_DIALOGUES.walking_with_coffee), 3.0);
          }
        }
        break;
      }

      case 'away':
        if (!isLive && a.departAt !== undefined && this.time >= a.departAt) this.startArrival(agentId, a);
        break;

      case 'errand_stay': {
        const stop = a.errand?.stops[a.errand.i];
        if (!a.errand || !stop) { this.finishErrand(agentId, a); break; }
        const t = a.stateTime, seated = stop.sitY > 0;
        const k = !seated ? 0 : t < SIT_S ? smoothstep(t / SIT_S) : t < SIT_S + stop.duration ? 1 : 1 - smoothstep((t - SIT_S - stop.duration) / SIT_S);
        a.x = stop.approach.x + (stop.spot.x - stop.approach.x) * k;
        a.y = stop.sitY * k;
        a.z = stop.approach.z + (stop.spot.z - stop.approach.z) * k;
        a.rotY = stop.spot.rotY;
        a.k = k;
        const chat = stop.chat ?? (stop.pose === 'lounge' ? LOUNGE_CHAT : null);
        if (chat && k >= 1 && a.bubbleTimer <= 0 && r.next() < dt * (stop.chatRate ?? 0.18)) this.say(a, r.pick(chat), 3.2);
        const end = seated ? SIT_S * 2 + stop.duration : stop.duration;
        if (t >= end) {
          const er = a.errand;
          er.i += 1;
          const next = er.stops[er.i];
          if (next) {
            a.state = 'walk_to_errand';
            a.stateTime = 0;
            this.setWalk(agentId, a, this.walkPath(stop.approach, next.approach));
          } else {
            this.finishErrand(agentId, a);
          }
        }
        break;
      }

      case 'sipping_at_bar': {
        const st = a.stool !== undefined ? this.spots.stools[a.stool] : undefined;
        if (!st) {
          a.state = 'walk_to_trash';
          a.stateTime = 0;
          this.setWalk(agentId, a, this.walkPath(this.currentPos(a), this.spots.trashStand));
          break;
        }
        const { seat, approach } = st;
        const t = a.stateTime;
        const k = t < SIT_S ? smoothstep(t / SIT_S) : t < SIT_S + a.stateDuration ? 1 : 1 - smoothstep((t - SIT_S - a.stateDuration) / SIT_S);
        a.cupVis = true;
        a.rotY = seat.rotY;
        a.x = approach.x + (seat.x - approach.x) * k;
        a.y = PANTRY.stoolSitY * k;
        a.z = approach.z + (seat.z - approach.z) * k;
        a.k = k;
        if (t >= SIT_S * 2 + a.stateDuration) {
          this.releaseStool(agentId);
          a.state = 'walk_to_trash';
          a.stateTime = 0;
          this.setWalk(agentId, a, this.walkPath(approach, this.spots.trashStand));
          this.say(a, 'Kopi habis, buang cup dulu sebelum balik ke meja.', 2.5);
        }
        break;
      }

      case 'drinking':
        this.sitAtDesk(a);
        a.cupVis = true;
        if (a.stateTime > a.stateDuration) {
          a.state = 'walk_to_trash';
          a.stateTime = 0;
          this.setWalk(agentId, a, this.walkPath(this.deskPos(a), this.spots.trashStand));
          this.say(a, 'Kopi habis! Saatnya buang ke tempat sampah.', 2.5);
        }
        break;

      case 'disposing':
        this.place(a, this.spots.trashStand);
        a.k = 0;
        if (a.stateTime > 0.8) { a.hasCup = false; a.cupVis = false; }
        if (a.stateTime > a.stateDuration) {
          a.state = 'walk_from_trash';
          a.stateTime = 0;
          this.setWalk(agentId, a, this.walkPath(this.spots.trashStand, this.deskPos(a)));
        }
        break;

      default: {
        // Semua state walk_*
        a.cupVis = a.hasCup;
        a.docVis = a.hasDoc;
        a.k = 0;
        a.y = 0;
        const seg = a.walkPath[a.walkSeg];
        const next = a.walkPath[a.walkSeg + 1];
        if (!seg || !next) { this.handleArrival(agentId, a); break; }
        if (seg.gate && a.gateSeg !== a.walkSeg) {
          if (!this.passGate(agentId, seg.gate)) {
            const qi = Math.max(0, this.gateOf(seg.gate).waiting.indexOf(agentId));
            const prev = a.walkPath[a.walkSeg - 1] ?? seg;
            const ddx = seg.x - prev.x, ddz = seg.z - prev.z;
            const dl = Math.hypot(ddx, ddz) || 1;
            a.x = seg.x - (ddx / dl) * 0.75 * qi;
            a.z = seg.z - (ddz / dl) * 0.75 * qi;
            a.rotY = Math.atan2(next.x - seg.x, next.z - seg.z);
            a.gateWait = true;
            break;
          }
          a.gateSeg = a.walkSeg;
        }
        const sLen = segLen(seg, next);
        if (sLen < 0.01) { a.walkSeg++; a.walkT = 0; break; }
        a.walkT += (WALK_SPEED * dt) / sLen;
        let t = a.walkT;
        if (a.walkT >= 1) {
          t = 1;
          a.walkT = 0;
          a.walkSeg++;
          if (a.walkSeg >= a.walkPath.length - 1) { this.handleArrival(agentId, a); break; }
        }
        a.x = seg.x + (next.x - seg.x) * t;
        a.z = seg.z + (next.z - seg.z) * t;
        const dx = next.x - seg.x, dz = next.z - seg.z;
        if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) a.rotY = Math.atan2(dx, dz);
        break;
      }
    }
  }
}
