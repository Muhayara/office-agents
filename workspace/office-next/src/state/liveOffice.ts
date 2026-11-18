import type { ServerEvent, StateSnapshot } from '@office/shared';

/* ------------------------------------------------------------------ */
/* Sesi                                                                */
/* ------------------------------------------------------------------ */

/**
 * - `ceo` / `viewer`: token (CEO / pengunjung tepercaya).
 * - `employee` / `guest`: akun Google (F4). Tamu hanya menonton dunia terfilter; karyawan setara viewer.
 */
export type SessionRole = 'ceo' | 'viewer' | 'employee' | 'guest';

export interface SessionUser {
  id: string;
  name: string;
}

export interface SessionInfo {
  authenticated: boolean;
  role: SessionRole | null;
  user: SessionUser | null;
  tokenSource: 'env' | 'file';
  viewerEnabled: boolean;
  googleEnabled: boolean;
}

/** Boleh membaca state kantor penuh (/api/state, /ws). Sama dengan `canReadOffice` di server. */
export const canReadOffice = (role: SessionRole | null) => role === 'ceo' || role === 'viewer' || role === 'employee';

export const ROLE_LABEL: Record<SessionRole, string> = {
  ceo: 'CEO',
  viewer: 'Pengunjung',
  employee: 'Karyawan',
  guest: 'Tamu',
};

/** `VITE_DEMO=1` saat build statis (hosting tanpa backend): tidak ada panggilan jaringan sama sekali. */
export const DEMO_BUILD = import.meta.env.VITE_DEMO === '1';

export async function fetchSession(): Promise<SessionInfo> {
  const res = await fetch('/api/session', { credentials: 'same-origin' });
  const type = res.headers.get('content-type') ?? '';
  if (!res.ok || !type.includes('application/json')) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as Partial<SessionInfo>;
  return {
    authenticated: Boolean(data.authenticated),
    role: data.role ?? null,
    user: data.user ?? null,
    tokenSource: data.tokenSource ?? 'file',
    viewerEnabled: Boolean(data.viewerEnabled),
    googleEnabled: Boolean(data.googleEnabled),
  };
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
/* Akun Google (panel CEO, F4)                                         */
/* ------------------------------------------------------------------ */

export interface OfficeUserRow {
  id: string;
  name: string;
  email: string;
  role: 'guest' | 'employee';
  blocked: boolean;
  createdAt: string;
  lastLoginAt: string;
}

export async function fetchUsers(): Promise<OfficeUserRow[]> {
  const res = await fetch('/api/users', { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return ((await res.json()) as { users: OfficeUserRow[] }).users;
}

export async function updateUser(id: string, patch: { role?: 'guest' | 'employee'; blocked?: boolean }): Promise<OfficeUserRow> {
  const res = await fetch('/api/users/update', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, ...patch }),
  });
  const data = (await res.json().catch(() => ({}))) as { user?: OfficeUserRow; error?: string };
  if (!res.ok || !data.user) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data.user;
}

/** Pesan untuk `/?login_error=<kode>` dari callback Google. */
export const LOGIN_ERRORS: Record<string, string> = {
  state: 'Sesi login kedaluwarsa atau tidak sah. Coba masuk lagi.',
  cancelled: 'Login Google dibatalkan.',
  blocked: 'Akun ini diblokir CEO.',
  throttled: 'Terlalu banyak percobaan. Coba lagi 1 menit lagi.',
  email: 'Email akun Google belum terverifikasi.',
  nonce: 'Login Google ditolak (nonce tidak cocok).',
  audience: 'Login Google ditolak (token untuk aplikasi lain).',
  expired: 'Login Google kedaluwarsa. Coba lagi.',
  signature: 'Login Google ditolak (tanda tangan tidak sah).',
  network: 'Server Google tidak terjangkau.',
};

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
