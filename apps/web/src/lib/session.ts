export type SessionRole = 'ceo' | 'viewer';

export interface SessionInfo {
  authenticated: boolean;
  role: SessionRole | null;
  tokenSource: 'env' | 'file';
  viewerEnabled: boolean;
}

export async function fetchSession(): Promise<SessionInfo> {
  const res = await fetch('/api/session', { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as SessionInfo;
}

export async function login(token: string): Promise<{ ok: true; role: SessionRole } | { ok: false; error: string }> {
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
