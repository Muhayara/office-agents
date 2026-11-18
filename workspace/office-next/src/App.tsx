import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type ClientCommand, type StateSnapshot, parseServerEvent } from '@office/shared';
import { IsometricOfficeStage, type CameraMode, type StageApi, type StageRoom } from './stage/IsometricOfficeStage';
import { InspectorPanel } from './panels/InspectorPanel';
import {
  DEMO_BUILD,
  type SessionRole,
  type StageEvent,
  applyServerEvent,
  fetchSession,
  login,
  logout,
  toStageEvents,
} from './state/liveOffice';

const FALLBACK_SNAPSHOT: StateSnapshot = {
  office: {
    name: 'Office Agents 3D',
    version: '1.1.0',
    mode: 'semi',
    language: 'id',
    paused: false,
    timezone: 'Asia/Jakarta',
    gateway: {
      status: 'online',
      baseUrl: 'local',
      checkedAt: new Date().toISOString(),
    },
    serverTime: new Date().toISOString(),
  },
  projects: [],
  agents: [
    { id: 'raka', name: 'Raka', role: 'manager', title: 'Manajer Proyek', color: '#E9A23B', status: 'idle', driver: 'api', model: 'gemini-3.8-flash-high', desk: { x: 6, y: 3 }, quota: { used: 0, cap: 350, resetAt: new Date().toISOString() } },
    { id: 'sari', name: 'Sari', role: 'researcher', title: 'Peneliti & Analis', color: '#63C3D9', status: 'idle', driver: 'api', model: 'gemini-3.8-flash-high', desk: { x: 10, y: 3 }, quota: { used: 0, cap: 300, resetAt: new Date().toISOString() } },
    { id: 'dimas', name: 'Dimas', role: 'writer', title: 'Penulis Dokumen & Copy', color: '#A8C46B', status: 'idle', driver: 'api', model: 'gemini-3.8-flash-high', desk: { x: 10, y: 7 }, quota: { used: 0, cap: 300, resetAt: new Date().toISOString() } },
    { id: 'bima', name: 'Bima', role: 'coder', title: 'Programmer Utama', color: '#D9735F', status: 'idle', driver: 'api', model: 'claude-opus-5-5-high', desk: { x: 6, y: 7 }, quota: { used: 0, cap: 250, resetAt: new Date().toISOString() } },
    { id: 'gita', name: 'Gita', role: 'gamedev', title: 'Game Dev 2.5D', color: '#5B9BD5', status: 'idle', driver: 'api', model: 'claude-opus-5-5-high', desk: { x: 6, y: 11 }, quota: { used: 0, cap: 250, resetAt: new Date().toISOString() } },
    { id: 'tari', name: 'Tari', role: 'designer', title: 'Desainer UI/UX & Ruang', color: '#9B7EDE', status: 'idle', driver: 'api', model: 'claude-sonnet-5-5-high', desk: { x: 14, y: 5 }, quota: { used: 0, cap: 250, resetAt: new Date().toISOString() } },
    { id: 'wulan', name: 'Wulan', role: 'artist', title: 'Artis Visual & Teknis', color: '#F29F67', status: 'idle', driver: 'api', model: 'gemini-4-argon-high', desk: { x: 14, y: 9 }, quota: { used: 0, cap: 250, resetAt: new Date().toISOString() } },
    { id: 'laras', name: 'Laras', role: 'reviewer', title: 'Reviewer & QA', color: '#C58BB0', status: 'idle', driver: 'api', model: 'gemini-4-argon-high', desk: { x: 3, y: 5 }, quota: { used: 0, cap: 300, resetAt: new Date().toISOString() } },
    { id: 'fajar', name: 'Fajar', role: 'visual_qa', title: 'Penguji Visual (Visual QA)', color: '#4ECDC4', status: 'idle', driver: 'api', model: 'gemini-3.8-flash-high', desk: { x: 3, y: 9 }, quota: { used: 0, cap: 300, resetAt: new Date().toISOString() } },
    { id: 'satria', name: 'Satria', role: 'security', title: 'Auditor Keamanan', color: '#E05A47', status: 'idle', driver: 'api', model: 'claude-sonnet-5-5-high', desk: { x: 3, y: 13 }, quota: { used: 0, cap: 250, resetAt: new Date().toISOString() } },
  ],
  tasks: [],
  approvals: [],
  messages: [],
  usage: [],
  securityFindings: [],
};

/**
 * - demo: build statis / pilihan pengunjung — simulasi template tanpa backend.
 * - offline: server tidak terjangkau — simulasi + tombol coba lagi.
 * - login: server aktif tapi belum login.
 * - live: terhubung; avatar mengikuti status agen sebenarnya.
 */
type Connection = 'checking' | 'demo' | 'offline' | 'login' | 'live';

/** Ruangan Lantai 1 di pilihan fokus kamera (urutan Barat → Timur, utara dulu). */
const FOCUS_ROOMS: ReadonlyArray<[StageRoom, string, string]> = [
  ['workspace', 'Ruang Kerja', 'Workspace'],
  ['boardroom', 'Ruang Rapat', 'Boardroom'],
  ['foyer', 'Meeting Foyer', 'Meeting Foyer'],
  ['bus', 'Jalan Utama', 'Main Corridor'],
  ['manager', 'Ruang Manajer', 'Manager Office'],
  ['lobby', 'Lobi & Resepsionis', 'Lobby & Reception'],
  ['pantry', 'Pantry / Café', 'Pantry / Café'],
  ['lounge', 'Lounge', 'Lounge'],
  ['server', 'Server / IT', 'Server / IT'],
  ['commons', 'Collaboration Commons', 'Collaboration Commons'],
  ['garden', 'Digital Garden', 'Digital Garden'],
  ['workshop', 'Workshop / Training', 'Workshop / Training'],
  ['infowall', 'Information Wall', 'Information Wall'],
  ['collabpods', 'Collaboration Pods', 'Collaboration Pods'],
];

export function App() {
  const [snapshot, setSnapshot] = useState<StateSnapshot>(FALLBACK_SNAPSHOT);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('raka');
  const [spectatorMode, setSpectatorMode] = useState<boolean>(false);
  const [connection, setConnection] = useState<Connection>(DEMO_BUILD ? 'demo' : 'checking');
  const [role, setRole] = useState<SessionRole | null>(null);
  const [tokenSource, setTokenSource] = useState<'env' | 'file'>('file');
  const [wsConnected, setWsConnected] = useState(false);
  const [stageEvents, setStageEvents] = useState<StageEvent[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const stageApiRef = useRef<StageApi | null>(null);
  const [camMode, setCamMode] = useState<CameraMode>('iso');
  const [loadError, setLoadError] = useState<string | null>(null);
  const agentIdsRef = useRef<ReadonlySet<string>>(new Set(FALLBACK_SNAPSHOT.agents.map((a) => a.id)));

  const checkSession = useCallback(async () => {
    if (DEMO_BUILD) return;
    setConnection('checking');
    try {
      const info = await fetchSession();
      setTokenSource(info.tokenSource);
      if (info.authenticated && info.role) {
        setRole(info.role);
        setConnection('live');
      } else {
        setRole(null);
        setConnection('login');
      }
    } catch {
      setRole(null);
      setConnection('offline');
    }
  }, []);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  // Koneksi live: snapshot awal + WebSocket dengan reconnect.
  useEffect(() => {
    if (connection !== 'live') return;
    let unmounted = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      if (unmounted) return;
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${window.location.host}/ws`);
      wsRef.current = ws;
      ws.onopen = () => setWsConnected(true);
      ws.onmessage = (ev) => {
        let raw: unknown;
        try {
          raw = JSON.parse(String(ev.data));
        } catch {
          return;
        }
        const parsed = parseServerEvent(raw);
        if (!parsed.success) return;
        const event = parsed.data;
        if (event.type === 'state.snapshot') {
          agentIdsRef.current = new Set(event.state.agents.map((a) => a.id));
        }
        setSnapshot((prev) => applyServerEvent(prev, event));
        setStageEvents((list) => toStageEvents(list, event, agentIdsRef.current));
        if (event.type === 'error') setNotice(event.message);
      };
      ws.onclose = () => {
        setWsConnected(false);
        if (unmounted) return;
        reconnectTimer = setTimeout(() => {
          void fetchSession()
            .then((s) => {
              if (unmounted) return;
              if (!s.authenticated) {
                setRole(null);
                setConnection('login');
              } else connect();
            })
            .catch(() => {
              if (!unmounted) connect();
            });
        }, 2000);
      };
    };

    connect();
    return () => {
      unmounted = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connection]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(t);
  }, [notice]);

  const sendCommand = useCallback(
    (cmd: ClientCommand) => {
      if (role !== 'ceo') {
        setNotice('Mode pengunjung: perintah tidak bisa dikirim.');
        return;
      }
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(cmd));
      else setNotice('Koneksi ke server terputus.');
    },
    [role],
  );

  const handleLogout = useCallback(() => {
    void logout().then(() => {
      setRole(null);
      setSnapshot(FALLBACK_SNAPSHOT);
      setConnection('login');
    });
  }, []);

  const live = connection === 'live';
  const viewOnly = spectatorMode || role !== 'ceo';
  const lang = snapshot.office.language;
  const t = (id: string, en: string) => (lang === 'id' ? id : en);
  const hudButton: React.CSSProperties = { padding: '4px 10px', minHeight: 28, fontSize: 12 };
  const selectedAgent = snapshot.agents.find((a) => a.id === selectedAgentId);
  const connectionChip = useMemo(() => {
    switch (connection) {
      case 'live':
        return wsConnected
          ? { text: 'LIVE', color: 'var(--color-ok)' }
          : { text: 'Menyambung ulang…', color: 'var(--color-warn)' };
      case 'demo':
        return null;
      case 'offline':
        return { text: 'Server mati · simulasi', color: 'var(--color-danger)' };
      case 'login':
        return { text: 'Belum login', color: 'var(--color-warn)' };
      default:
        return { text: 'Memeriksa…', color: 'var(--color-muted)' };
    }
  }, [connection, wsConnected]);

  return (
    <>
      <header className="app-header" style={{ flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 15, whiteSpace: 'nowrap' }}>
            {snapshot.office.name.replace(/2\.5D/g, '3D')} · 3D Studio
          </strong>
          <span style={{ color: 'var(--color-rule-strong)' }} aria-hidden="true">|</span>
          <strong style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
            {t('Kantor 3D', '3D Office')}
          </strong>
          <span className="mono" style={{ fontSize: 12, color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>
            {t('Lantai 1 · Jalan Utama + 13 ruangan', 'Floor 1 · Main Corridor + 13 rooms')}
          </span>
          {connectionChip && (
            <span className="chip mono" style={{ color: connectionChip.color, borderColor: connectionChip.color }}>
              {connectionChip.text}
            </span>
          )}
          {loadError && (
            <span className="chip mono" style={{ fontSize: 11, color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}>
              GLB Error
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <select
            aria-label={t('Fokus kamera ke ruangan', 'Focus the camera on a room')}
            title={t('Arahkan kamera ke sebuah ruangan Lantai 1', 'Point the camera at a Floor 1 room')}
            value=""
            onChange={(e) => {
              const room = e.target.value as StageRoom;
              if (room) stageApiRef.current?.focusRoom(room);
            }}
            style={{
              ...hudButton,
              background: 'var(--color-paper)',
              color: 'inherit',
              border: '1px solid var(--color-rule)',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            <option value="">{t('Fokus: ruangan…', 'Focus: room…')}</option>
            {FOCUS_ROOMS.map(([room, id, en]) => (
              <option key={room} value={room}>{t(id, en)}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => stageApiRef.current?.toggleCamera()}
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
            onClick={() => stageApiRef.current?.resetCamera()}
            title={t('Reset sudut kamera', 'Reset camera')}
            style={hudButton}
          >
            {t('Reset Kamera', 'Reset Camera')}
          </button>
          <button
            type="button"
            onClick={() => stageApiRef.current?.focusAgent(selectedAgentId)}
            title={t('Fokus ke agen terpilih', 'Focus selected agent')}
            style={{ ...hudButton, borderColor: 'var(--color-focus)', color: 'var(--color-focus)' }}
          >
            {t('Fokus Agen', 'Focus Agent')}
          </button>

          {live && role === 'ceo' && (
            <button type="button" onClick={() => setSpectatorMode((v) => !v)} aria-pressed={spectatorMode} style={hudButton}>
              {spectatorMode ? 'Tampilan: Pengunjung' : 'Tampilan: CEO'}
            </button>
          )}
          {live && role === 'viewer' && <span className="chip mono">Pengunjung (lihat saja)</span>}
          {live && (
            <button type="button" onClick={handleLogout} style={hudButton}>
              Keluar
            </button>
          )}
          {(connection === 'demo' || connection === 'offline') && !DEMO_BUILD && (
            <button type="button" onClick={() => void checkSession()} style={hudButton}>
              {connection === 'offline' ? 'Coba sambung lagi' : 'Masuk ke kantor live'}
            </button>
          )}
        </div>
      </header>

      <main className="workbench-shell">
        <IsometricOfficeStage
          agents={snapshot.agents}
          selectedAgentId={selectedAgentId}
          language={lang}
          onSelectAgent={setSelectedAgentId}
          live={live}
          stageEvents={stageEvents}
          stageApiRef={stageApiRef}
          onCamModeChange={setCamMode}
          onLoadErrorChange={setLoadError}
        />

        <InspectorPanel
          agents={snapshot.agents}
          tasks={snapshot.tasks}
          approvals={snapshot.approvals}
          selectedAgent={selectedAgent}
          git={snapshot.git}
          securityFindings={snapshot.securityFindings ?? []}
          language={lang}
          live={live}
          role={role}
          viewOnly={viewOnly}
          onSelectAgent={setSelectedAgentId}
          onRespondApproval={(id, approved) => sendCommand({ type: 'approval.respond', id, approved })}
        />
      </main>

      {connection === 'login' && (
        <LoginOverlay
          tokenSource={tokenSource}
          onLoggedIn={(r) => {
            setRole(r);
            setConnection('live');
          }}
          onDemo={() => setConnection('demo')}
        />
      )}

      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
    </>
  );
}

function LoginOverlay({
  tokenSource,
  onLoggedIn,
  onDemo,
}: {
  tokenSource: 'env' | 'file';
  onLoggedIn: (role: SessionRole) => void;
  onDemo: () => void;
}) {
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await login(token.trim());
      if (res.ok) onLoggedIn(res.role);
      else setError(res.error);
    } catch {
      setError('Server tidak merespons.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-backdrop">
      <form className="login-card" onSubmit={(e) => void submit(e)} aria-labelledby="login-title">
        <h2 id="login-title">Masuk ke kantor live</h2>
        <p>
          {tokenSource === 'file' ? (
            <>
              Tempel token CEO dari file <code>data/.office-token</code>, atau token pengunjung bila
              disediakan.
            </>
          ) : (
            <>
              Tempel token CEO (<code>OFFICE_TOKEN</code> di <code>.env</code>), atau token pengunjung.
            </>
          )}
        </p>
        <label htmlFor="office-token">Token</label>
        <input
          id="office-token"
          className="mono"
          type="password"
          autoComplete="current-password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          autoFocus
        />
        {error && (
          <p className="login-error" role="alert">
            {error}
          </p>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="submit" className="btn-primary" disabled={busy || !token.trim()}>
            {busy ? 'Memeriksa…' : 'Masuk'}
          </button>
          <button type="button" onClick={onDemo}>
            Lihat simulasi saja
          </button>
        </div>
      </form>
    </div>
  );
}
