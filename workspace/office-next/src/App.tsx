import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type AgentStatus, type ClientCommand, type StateSnapshot, parseServerEvent, roleLabel } from '@office/shared';
import { IsometricOfficeStage, type CameraMode, type EyeInfo, type StageApi, type StageRoom } from './stage/IsometricOfficeStage';
import { loadGraphicsQuality, saveGraphicsQuality, type GraphicsQuality } from './stage/graphics';
import { InspectorPanel } from './panels/InspectorPanel';
import { EyePanel } from './panels/EyePanel';
import {
  DEMO_BUILD,
  LOGIN_ERRORS,
  ROLE_LABEL,
  type OfficeUserRow,
  type SessionInfo,
  type SessionRole,
  applyServerEvent,
  canReadOffice,
  fetchSession,
  fetchUsers,
  login,
  logout,
  updateUser,
} from './state/liveOffice';
import { LocalWorldFeed, NetWorldFeed, worldUrl, type FeedStatus, type WorldFeed } from './state/worldFeed';

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
    { id: 'gita', name: 'Gita', role: 'gamedev', title: 'Game Dev 3D', color: '#5B9BD5', status: 'idle', driver: 'api', model: 'claude-opus-5-5-high', desk: { x: 6, y: 11 }, quota: { used: 0, cap: 250, resetAt: new Date().toISOString() } },
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
 * - demo: build statis / pilihan pengunjung — simulasi lokal tanpa backend.
 * - offline: server tidak terjangkau — simulasi lokal + tombol coba lagi.
 * - public: server aktif; dunia bersama real-time tanpa login (atau akun tamu Google) — F2/K2.
 * - live: sesi CEO / viewer / karyawan; dunia bersama + state kantor lengkap (/ws).
 */
type Connection = 'checking' | 'demo' | 'offline' | 'public' | 'live';

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
  ['focus', 'Focus Pods', 'Focus Pods'],
  ['server', 'Server / IT', 'Server / IT'],
  ['commons', 'Collaboration Commons', 'Collaboration Commons'],
  ['studio', 'Studio / Content', 'Studio / Content'],
  ['garden', 'Digital Garden', 'Digital Garden'],
  ['workshop', 'Workshop / Training', 'Workshop / Training'],
  ['infowall', 'Information Wall', 'Information Wall'],
  ['collabpods', 'Collaboration Pods', 'Collaboration Pods'],
  ['access', 'Digital Access Hub', 'Digital Access Hub'],
];

/** F3: pilihan "Goyang kepala" (head-bob Mata Agen) disimpan per peramban. */
const HEAD_BOB_KEY = 'office.headBob';
function loadHeadBob(): boolean {
  try { return window.localStorage.getItem(HEAD_BOB_KEY) !== 'off'; } catch { return true; }
}
function saveHeadBob(on: boolean) {
  try { window.localStorage.setItem(HEAD_BOB_KEY, on ? 'on' : 'off'); } catch { /* mode privat: berlaku sesi ini saja */ }
}
/** `prefers-reduced-motion: reduce` (head-bob mati otomatis). */
function useReducedMotion(): boolean {
  const query = '(prefers-reduced-motion: reduce)';
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const q = window.matchMedia(query);
    const onChange = () => setReduced(q.matches);
    q.addEventListener('change', onChange);
    return () => q.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/** Info agen untuk simulasi lokal (nama & jabatan di layar rapat / Workshop). */
const LOCAL_AGENTS = FALLBACK_SNAPSHOT.agents.map((a) => ({ id: a.id, name: a.name, title: a.title ?? roleLabel(a.role, 'id') }));

export function App() {
  const [snapshot, setSnapshot] = useState<StateSnapshot>(FALLBACK_SNAPSHOT);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('raka');
  const [spectatorMode, setSpectatorMode] = useState<boolean>(false);
  const [connection, setConnection] = useState<Connection>(DEMO_BUILD ? 'demo' : 'checking');
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [worldStatus, setWorldStatus] = useState<FeedStatus>('connecting');
  const [worldStatuses, setWorldStatuses] = useState<Record<string, AgentStatus>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const stageApiRef = useRef<StageApi | null>(null);
  const [camMode, setCamMode] = useState<CameraMode>('iso');
  // Mode grafis: bawaan Hemat di semua perangkat, pilihan disimpan di localStorage.
  const [graphics, setGraphics] = useState<GraphicsQuality>(() => loadGraphicsQuality());
  const toggleGraphics = useCallback(() => {
    setGraphics((g) => {
      const next: GraphicsQuality = g === 'low' ? 'high' : 'low';
      saveGraphicsQuality(next);
      return next;
    });
  }, []);
  const [loadError, setLoadError] = useState<string | null>(null);
  const role: SessionRole | null = session?.role ?? null;
  // ---- F3: Mata Agen ----
  const [eyeInfo, setEyeInfo] = useState<EyeInfo | null>(null);
  const eyeInfoRef = useRef<EyeInfo | null>(null);
  const [headBob, setHeadBob] = useState<boolean>(() => loadHeadBob());
  const reducedMotion = useReducedMotion();
  const agentName = useCallback((id: string) => snapshot.agents.find((a) => a.id === id)?.name ?? id, [snapshot.agents]);
  const handleEyeInfo = useCallback((info: EyeInfo | null, reason?: 'exit' | 'away') => {
    const prev = eyeInfoRef.current;
    eyeInfoRef.current = info;
    setEyeInfo(info);
    if (!info && reason === 'away' && prev) setNotice(`${agentName(prev.agentId)} sudah pulang.`);
  }, [agentName]);
  const enterEye = useCallback((id: string) => {
    const ok = stageApiRef.current?.enterEye(id) ?? false;
    if (!ok) setNotice(`${agentName(id)} sedang tidak di kantor.`);
  }, [agentName]);
  const toggleHeadBob = useCallback(() => {
    setHeadBob((v) => {
      saveHeadBob(!v);
      return !v;
    });
  }, []);

  const checkSession = useCallback(async () => {
    if (DEMO_BUILD) return;
    setConnection('checking');
    try {
      const info = await fetchSession();
      setSession(info);
      // Semua orang menonton dunia bersama; sesi berhak (CEO / viewer / karyawan) juga membaca kantor.
      setConnection(info.authenticated && canReadOffice(info.role) ? 'live' : 'public');
    } catch {
      setSession(null);
      setConnection('offline');
    }
  }, []);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  // Hasil callback login Google (`/?login=google` atau `/?login_error=<kode>`): tampilkan & bersihkan URL.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const err = q.get('login_error');
    if (q.has('login') || err) {
      if (err) setNotice(LOGIN_ERRORS[err] ?? 'Login Google gagal. Coba lagi.');
      else setNotice('Berhasil masuk dengan Google.');
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  // ---- Sumber dunia (F2): jaringan = sutradara server (sama untuk semua penonton), lokal = simulasi ----
  const feedKey = connection === 'public' || connection === 'live'
    ? `net:${connection === 'live' ? 'full' : 'public'}`
    : connection === 'demo' || connection === 'offline' ? 'local' : null;
  const [feed, setFeed] = useState<WorldFeed | null>(null);
  useEffect(() => {
    if (!feedKey) return;
    const f: WorldFeed = feedKey === 'local' ? new LocalWorldFeed(LOCAL_AGENTS) : new NetWorldFeed(worldUrl(), setWorldStatus);
    setFeed(f);
    return () => f.dispose();
  }, [feedKey]);

  // Koneksi live: snapshot kantor + WebSocket /ws dengan reconnect (hanya sesi berhak).
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
        setSnapshot((prev) => applyServerEvent(prev, event));
        if (event.type === 'error') setNotice(event.message);
      };
      ws.onclose = () => {
        setWsConnected(false);
        if (unmounted) return;
        reconnectTimer = setTimeout(() => {
          void fetchSession()
            .then((s) => {
              if (unmounted) return;
              setSession(s);
              if (!s.authenticated || !canReadOffice(s.role)) setConnection('public');
              else connect();
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
      setSnapshot(FALLBACK_SNAPSHOT);
      setSpectatorMode(false);
      void checkSession();
    });
  }, [checkSession]);

  const live = connection === 'live';
  const publicView = connection === 'public';
  const viewOnly = spectatorMode || role !== 'ceo';
  const lang = snapshot.office.language;
  const t = (id: string, en: string) => (lang === 'id' ? id : en);
  const hudButton: React.CSSProperties = { padding: '4px 10px', minHeight: 28, fontSize: 12 };
  // Mode publik / tamu: status agen dari dunia bersama (tanpa /api/state).
  const agentsView = useMemo(
    () => (live ? snapshot.agents : snapshot.agents.map((a) => (worldStatuses[a.id] ? { ...a, status: worldStatuses[a.id]! } : a))),
    [live, snapshot.agents, worldStatuses],
  );
  const selectedAgent = agentsView.find((a) => a.id === selectedAgentId);
  const connectionChip = useMemo(() => {
    switch (connection) {
      case 'live':
        return wsConnected && worldStatus === 'open'
          ? { text: 'LIVE', color: 'var(--color-ok)' }
          : { text: 'Menyambung ulang…', color: 'var(--color-warn)' };
      case 'public':
        return worldStatus === 'open'
          ? { text: 'LIVE · dunia bersama', color: 'var(--color-ok)' }
          : { text: 'Menyambung…', color: 'var(--color-warn)' };
      case 'demo':
        return null;
      case 'offline':
        return { text: 'Server mati · simulasi', color: 'var(--color-danger)' };
      default:
        return { text: 'Memeriksa…', color: 'var(--color-muted)' };
    }
  }, [connection, wsConnected, worldStatus]);
  const who = role
    ? session?.user ? `${session.user.name} · ${ROLE_LABEL[role]}` : role === 'viewer' ? 'Pengunjung (lihat saja)' : ROLE_LABEL[role]
    : null;

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
            {t('Lantai 1 · Jalan Utama + 16 ruangan', 'Floor 1 · Main Corridor + 16 rooms')}
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
          <select
            aria-label={t('Lihat kantor dari mata seorang agen', "See the office through an agent's eyes")}
            title={t('Mata Agen: kamera orang pertama dari mata agen (←/→ ganti, Esc keluar)', 'Agent Eyes: first-person camera (←/→ switch, Esc exit)')}
            value={eyeInfo?.agentId ?? ''}
            onChange={(e) => {
              const id = e.target.value;
              e.currentTarget.blur();
              if (id) enterEye(id);
              else stageApiRef.current?.exitEye();
            }}
            style={{
              ...hudButton,
              background: 'var(--color-paper)',
              color: eyeInfo ? 'var(--color-focus)' : 'inherit',
              border: `1px solid ${eyeInfo ? 'var(--color-focus)' : 'var(--color-rule)'}`,
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            <option value="">{eyeInfo ? t('Keluar dari Mata Agen', 'Leave Agent Eyes') : t('Mata Agen: pilih…', 'Agent Eyes: pick…')}</option>
            {agentsView.map((a) => (
              <option key={a.id} value={a.id}>{t('Mata ', 'Eyes: ')}{a.name}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => stageApiRef.current?.toggleCamera()}
            aria-pressed={camMode !== 'iso'}
            title={camMode === 'eye' ? t('Keluar dari Mata Agen', 'Leave Agent Eyes') : t('Ganti kamera isometrik ↔ Free Cam 3D', 'Toggle isometric ↔ Free Cam 3D')}
            style={{
              ...hudButton,
              borderColor: camMode !== 'iso' ? 'var(--color-focus)' : undefined,
              color: camMode !== 'iso' ? 'var(--color-focus)' : undefined,
            }}
          >
            {camMode === 'eye' ? t('Kamera: Mata Agen', 'Camera: Agent Eyes') : camMode === 'free' ? t('Kamera: Free Cam 3D', 'Camera: Free Cam 3D') : t('Kamera: Isometrik', 'Camera: Isometric')}
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
          <button
            type="button"
            onClick={toggleGraphics}
            aria-pressed={graphics === 'high'}
            title={graphics === 'low'
              ? t('Hemat: tanpa lampu & bayangan real-time, 30 FPS saat kamera diam. Klik untuk Grafis Tinggi.', 'Saver: no real-time lights or shadows, 30 FPS when idle. Click for High graphics.')
              : t('Tinggi: 3 lampu dekat kamera + bayangan matahari, 60 FPS. Klik untuk Grafis Hemat.', 'High: 3 lights near the camera + sun shadows, 60 FPS. Click for Saver graphics.')}
            style={hudButton}
          >
            {graphics === 'low' ? t('Grafis: Hemat', 'Graphics: Saver') : t('Grafis: Tinggi', 'Graphics: High')}
          </button>

          {live && role === 'ceo' && (
            <button type="button" onClick={() => setSpectatorMode((v) => !v)} aria-pressed={spectatorMode} style={hudButton}>
              {spectatorMode ? 'Tampilan: Pengunjung' : 'Tampilan: CEO'}
            </button>
          )}
          {live && role === 'ceo' && (
            <button type="button" onClick={() => setShowUsers(true)} style={hudButton} title="Akun Google: naikkan ke karyawan, turunkan, atau blokir">
              Pengguna
            </button>
          )}
          {who && <span className="chip mono" title="Sesi saat ini">{who}</span>}
          {role && (
            <button type="button" onClick={handleLogout} style={hudButton}>
              Keluar
            </button>
          )}
          {publicView && !role && (
            <button type="button" className="btn-primary" onClick={() => setShowLogin(true)} style={hudButton}>
              Masuk
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
          feed={feed}
          onAgentStatuses={setWorldStatuses}
          stageApiRef={stageApiRef}
          onCamModeChange={setCamMode}
          onLoadErrorChange={setLoadError}
          quality={graphics}
          onEyeInfo={handleEyeInfo}
          headBob={headBob}
          overlay={eyeInfo ? (
            <EyePanel
              info={eyeInfo}
              agent={agentsView.find((a) => a.id === eyeInfo.agentId)}
              tasks={snapshot.tasks}
              showTask={!publicView}
              language={lang}
              headBob={headBob}
              reducedMotion={reducedMotion}
              onToggleBob={toggleHeadBob}
              onCycle={(dir) => stageApiRef.current?.cycleEye(dir)}
              onExit={() => stageApiRef.current?.exitEye()}
            />
          ) : null}
        />

        <InspectorPanel
          agents={agentsView}
          tasks={snapshot.tasks}
          approvals={snapshot.approvals}
          selectedAgent={selectedAgent}
          git={snapshot.git}
          securityFindings={snapshot.securityFindings ?? []}
          language={lang}
          live={live}
          publicView={publicView}
          role={role}
          viewOnly={viewOnly}
          onSelectAgent={setSelectedAgentId}
          onRespondApproval={(id, approved) => sendCommand({ type: 'approval.respond', id, approved })}
          onEye={enterEye}
        />
      </main>

      {showLogin && (
        <LoginOverlay
          tokenSource={session?.tokenSource ?? 'file'}
          googleEnabled={Boolean(session?.googleEnabled)}
          onLoggedIn={() => {
            setShowLogin(false);
            void checkSession();
          }}
          onDemo={() => {
            setShowLogin(false);
            setConnection('demo');
          }}
          onClose={() => setShowLogin(false)}
        />
      )}

      {showUsers && <UsersPanel onClose={() => setShowUsers(false)} onNotice={setNotice} />}

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
  googleEnabled,
  onLoggedIn,
  onDemo,
  onClose,
}: {
  tokenSource: 'env' | 'file';
  googleEnabled: boolean;
  onLoggedIn: (role: SessionRole) => void;
  onDemo: () => void;
  onClose: () => void;
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
    <div className="login-backdrop" onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}>
      <form className="login-card" onSubmit={(e) => void submit(e)} aria-labelledby="login-title">
        <h2 id="login-title">Masuk ke kantor</h2>
        <p>
          Tanpa login Anda tetap menonton kantor secara real-time (dunia bersama). Masuk untuk fitur
          tamu; karyawan yang dinaikkan CEO juga bisa melihat ucapan &amp; tugas asli agen.
        </p>
        {googleEnabled ? (
          <a className="btn-primary" href="/api/auth/google" style={{ textAlign: 'center', padding: '8px 12px', borderRadius: 6, textDecoration: 'none' }}>
            Masuk dengan Google
          </a>
        ) : (
          <p className="muted small">
            Login Google belum diaktifkan di server (isi <code>GOOGLE_CLIENT_ID</code> &amp; <code>GOOGLE_CLIENT_SECRET</code> di <code>.env</code>).
          </p>
        )}
        <label htmlFor="office-token">
          {tokenSource === 'file' ? (
            <>Atau token CEO dari <code>data/.office-token</code> / token pengunjung</>
          ) : (
            <>Atau token CEO (<code>OFFICE_TOKEN</code>) / token pengunjung</>
          )}
        </label>
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
          <button type="submit" disabled={busy || !token.trim()}>
            {busy ? 'Memeriksa…' : 'Masuk dengan token'}
          </button>
          <button type="button" onClick={onDemo}>
            Simulasi lokal
          </button>
          <button type="button" onClick={onClose}>
            Tutup
          </button>
        </div>
      </form>
    </div>
  );
}

/** Panel CEO (F4): akun Google — naikkan ke karyawan / turunkan ke tamu, blokir / buka blokir. */
function UsersPanel({ onClose, onNotice }: { onClose: () => void; onNotice: (msg: string) => void }) {
  const [users, setUsers] = useState<OfficeUserRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchUsers()
      .then((u) => { if (alive) setUsers(u); })
      .catch((e: unknown) => { if (alive) setError(e instanceof Error ? e.message : String(e)); });
    return () => { alive = false; };
  }, []);

  const apply = async (u: OfficeUserRow, patch: { role?: 'guest' | 'employee'; blocked?: boolean }) => {
    setBusyId(u.id);
    try {
      const next = await updateUser(u.id, patch);
      setUsers((list) => list?.map((x) => (x.id === next.id ? next : x)) ?? null);
      onNotice(`${next.name}: ${next.blocked ? 'diblokir' : next.role === 'employee' ? 'karyawan' : 'tamu'}.`);
    } catch (e) {
      onNotice(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="login-backdrop" onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}>
      <section className="login-card" style={{ maxWidth: 640 }} aria-labelledby="users-title">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <h2 id="users-title">Pengguna (akun Google)</h2>
          <button type="button" onClick={onClose}>Tutup</button>
        </div>
        <p>
          Akun baru masuk sebagai <strong>tamu</strong> (hanya menonton dunia bersama). Karyawan juga melihat
          ucapan &amp; tugas asli. Akun Google tidak pernah mendapat hak CEO.
        </p>
        {error && <p className="login-error" role="alert">{error}</p>}
        {!users && !error && <p className="muted small">Memuat…</p>}
        {users && users.length === 0 && <p className="muted small">Belum ada yang masuk dengan Google.</p>}
        {users && users.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '55vh', overflowY: 'auto' }}>
            {users.map((u) => (
              <div key={u.id} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '8px 10px', border: '1px solid var(--color-rule)', borderRadius: 6 }}>
                <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{u.name}</div>
                  <div className="mono muted small" style={{ overflowWrap: 'anywhere' }}>{u.email}</div>
                  <div className="muted small">
                    {u.blocked ? 'Diblokir' : u.role === 'employee' ? 'Karyawan' : 'Tamu'} · terakhir {new Date(u.lastLoginAt).toLocaleString('id-ID')}
                  </div>
                </div>
                <button type="button" disabled={busyId === u.id || u.blocked} onClick={() => void apply(u, { role: u.role === 'employee' ? 'guest' : 'employee' })}>
                  {u.role === 'employee' ? 'Jadikan tamu' : 'Jadikan karyawan'}
                </button>
                <button type="button" disabled={busyId === u.id} onClick={() => void apply(u, { blocked: !u.blocked })}>
                  {u.blocked ? 'Buka blokir' : 'Blokir'}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
