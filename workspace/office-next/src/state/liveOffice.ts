import type { ServerEvent, StateSnapshot } from '@office/shared';

/* ------------------------------------------------------------------ */
/* Sesi                                                                */
/* ------------------------------------------------------------------ */

export type SessionRole = 'ceo' | 'viewer';

export interface SessionInfo {
  authenticated: boolean;
  role: SessionRole | null;
  tokenSource: 'env' | 'file';
  viewerEnabled: boolean;
}

/** `VITE_DEMO=1` saat build statis (hosting tanpa backend): tidak ada panggilan jaringan sama sekali. */
export const DEMO_BUILD = import.meta.env.VITE_DEMO === '1';

export async function fetchSession(): Promise<SessionInfo> {
  const res = await fetch('/api/session', { credentials: 'same-origin' });
  const type = res.headers.get('content-type') ?? '';
  if (!res.ok || !type.includes('application/json')) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as SessionInfo;
}

export async function login(
  token: string,
): Promise<{ ok: true; role: SessionRole } | { ok: false; error: string }> {
  const res = await fetch('/api/session', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  const data = (await res.json().catch(() => ({}))) as { role?: SessionRole; error?: string };
  if (res.ok && data.role) return { ok: true, role: data.role };
  return { ok: false, error: data.error ?? `HTTP ${res.status}` };
}

export async function logout(): Promise<void> {
  await fetch('/api/session', { method: 'DELETE', credentials: 'same-origin' }).catch(() => {});
}

/* ------------------------------------------------------------------ */
/* Event panggung 3D                                                   */
/* ------------------------------------------------------------------ */

/** Event yang menggerakkan avatar di luar status kursi biasa. */
export type StageEvent =
  | { seq: number; kind: 'say'; agentId: string; text: string }
  | { seq: number; kind: 'visit'; from: string; to: string; text: string; carryDoc: boolean }
  | { seq: number; kind: 'meeting'; host: string; text: string };

type StageEventInput = StageEvent extends infer E ? (E extends StageEvent ? Omit<E, 'seq'> : never) : never;

let stageSeq = 0;
const MAX_STAGE_EVENTS = 40;

function pushStage(list: StageEvent[], ev: StageEventInput): StageEvent[] {
  stageSeq += 1;
  const next = [...list, { ...ev, seq: stageSeq } as StageEvent];
  return next.length > MAX_STAGE_EVENTS ? next.slice(-MAX_STAGE_EVENTS) : next;
}

/** Mengubah event server menjadi event panggung (bicara, kunjungan meja, rapat). */
export function toStageEvents(
  list: StageEvent[],
  event: ServerEvent,
  agentIds: ReadonlySet<string>,
): StageEvent[] {
  if (event.type === 'agent.say') {
    return pushStage(list, { kind: 'say', agentId: event.agentId, text: event.text });
  }
  if (event.type === 'message.created') {
    const m = event.message;
    // Salinan broadcast per-agen tidak dikirim ulang ke UI; pesan "all" = rapat.
    if (m.recipient === 'all' || m.kind === 'meeting') {
      const host = agentIds.has(m.sender) ? m.sender : 'raka';
      // "/rapat Evaluasi sprint" -> "Evaluasi sprint"
      const text = m.body.replace(/^\/(rapat|meeting)\s*/i, '').trim() || 'Rapat dimulai.';
      return pushStage(list, { kind: 'meeting', host, text });
    }
    if (agentIds.has(m.sender) && agentIds.has(m.recipient) && m.sender !== m.recipient) {
      return pushStage(list, {
        kind: 'visit',
        from: m.sender,
        to: m.recipient,
        text: m.body,
        carryDoc: m.kind === 'review' || m.kind === 'handoff',
      });
    }
  }
  return list;
}

/* ------------------------------------------------------------------ */
/* Reducer snapshot                                                    */
/* ------------------------------------------------------------------ */

export function applyServerEvent(prev: StateSnapshot, event: ServerEvent): StateSnapshot {
  switch (event.type) {
    case 'state.snapshot':
      return event.state;
    case 'agent.status':
      return {
        ...prev,
        agents: prev.agents.map((a) =>
          a.id === event.agentId
            ? {
                ...a,
                status: event.status,
                currentTaskId: event.taskId ?? a.currentTaskId,
                offlineReason: event.status === 'offline' ? event.detail : undefined,
              }
            : a,
        ),
      };
    case 'task.updated': {
      const exists = prev.tasks.some((t) => t.id === event.task.id);
      return {
        ...prev,
        tasks: exists
          ? prev.tasks.map((t) => (t.id === event.task.id ? event.task : t))
          : [...prev.tasks, event.task],
        agents: prev.agents.map((a) =>
          a.id === event.task.assignee
            ? {
                ...a,
                currentTaskId: event.task.status === 'done' ? undefined : event.task.id,
                currentTaskTitle: event.task.status === 'done' ? undefined : event.task.title,
              }
            : a,
        ),
      };
    }
    case 'message.created':
      return { ...prev, messages: [...prev.messages, event.message].slice(-150) };
    case 'approval.requested':
      return {
        ...prev,
        approvals: [event.approval, ...prev.approvals.filter((a) => a.id !== event.approval.id)],
      };
    case 'approval.resolved':
      return {
        ...prev,
        approvals: prev.approvals.map((a) =>
          a.id === event.id
            ? {
                ...a,
                // Penolakan oleh "system" = kedaluwarsa/dibatalkan, bukan keputusan CEO.
                status: event.approved ? 'approved' : event.decidedBy === 'system' ? 'expired' : 'denied',
                decidedAt: event.at,
                decidedBy: event.decidedBy,
                reason: event.reason,
              }
            : a,
        ),
      };
    case 'usage.updated':
      return {
        ...prev,
        agents: prev.agents.map((a) =>
          a.id === event.usage.agentId
            ? { ...a, quota: { ...a.quota, used: event.usage.requests, cap: event.usage.cap } }
            : a,
        ),
      };
    case 'office.mode':
      return { ...prev, office: { ...prev.office, mode: event.mode } };
    case 'office.paused':
      return { ...prev, office: { ...prev.office, paused: event.paused } };
    case 'office.language':
      return { ...prev, office: { ...prev.office, language: event.language } };
    case 'git.updated':
      return { ...prev, git: event.git };
    case 'security.findings':
      return { ...prev, securityFindings: event.findings };
    default:
      return prev;
  }
}
