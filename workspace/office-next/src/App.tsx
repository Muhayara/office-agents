import React, { useEffect, useState } from 'react';
import {
  type StateSnapshot,
  parseServerEvent,
} from '@office/shared';
import { IsometricOfficeStage } from './stage/IsometricOfficeStage';
import { InspectorPanel } from './panels/InspectorPanel';

const FALLBACK_SNAPSHOT: StateSnapshot = {
  office: {
    name: 'Office Agents 2.5D',
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
    { id: 'raka', name: 'Raka', role: 'manager', color: '#E9A23B', status: 'idle', driver: 'api', model: 'gemini-3.8-flash-high', desk: { x: 2, y: 1 }, quota: { used: 0, cap: 350, resetAt: new Date().toISOString() } },
    { id: 'sari', name: 'Sari', role: 'researcher', color: '#63C3D9', status: 'idle', driver: 'api', model: 'gemini-3.8-flash-high', desk: { x: 1, y: 2 }, quota: { used: 0, cap: 300, resetAt: new Date().toISOString() } },
    { id: 'dimas', name: 'Dimas', role: 'writer', color: '#A8C46B', status: 'idle', driver: 'api', model: 'gemini-3.8-flash-high', desk: { x: 3, y: 2 }, quota: { used: 0, cap: 300, resetAt: new Date().toISOString() } },
    { id: 'tari', name: 'Tari', role: 'designer', color: '#E8998D', status: 'idle', driver: 'api', model: 'claude-sonnet-5-5-high', desk: { x: 1, y: 4 }, quota: { used: 0, cap: 250, resetAt: new Date().toISOString() } },
    { id: 'wulan', name: 'Wulan', role: 'artist', color: '#9B7EDE', status: 'idle', driver: 'api', model: 'gemini-4-argon-high', desk: { x: 3, y: 4 }, quota: { used: 0, cap: 250, resetAt: new Date().toISOString() } },
    { id: 'bima', name: 'Bima', role: 'coder', color: '#D9735F', status: 'idle', driver: 'api', model: 'claude-opus-5-5-high', desk: { x: 6, y: 2 }, quota: { used: 0, cap: 250, resetAt: new Date().toISOString() } },
    { id: 'gita', name: 'Gita', role: 'gamedev', color: '#4DA8DA', status: 'idle', driver: 'api', model: 'claude-opus-5-5-high', desk: { x: 6, y: 4 }, quota: { used: 0, cap: 250, resetAt: new Date().toISOString() } },
    { id: 'laras', name: 'Laras', role: 'reviewer', color: '#C58BB0', status: 'idle', driver: 'api', model: 'gemini-4-argon-high', desk: { x: 4, y: 5 }, quota: { used: 0, cap: 300, resetAt: new Date().toISOString() } },
    { id: 'fajar', name: 'Fajar', role: 'visual_qa', color: '#5CC8A1', status: 'idle', driver: 'api', model: 'gemini-3.8-flash-high', desk: { x: 6, y: 5 }, quota: { used: 0, cap: 300, resetAt: new Date().toISOString() } },
    { id: 'satria', name: 'Satria', role: 'security', color: '#E06A66', status: 'idle', driver: 'api', model: 'claude-sonnet-5-5-high', desk: { x: 2, y: 5 }, quota: { used: 0, cap: 250, resetAt: new Date().toISOString() } },
  ],
  tasks: [],
  approvals: [],
  messages: [],
  usage: [],
  securityFindings: [],
};

export function App() {
  const [snapshot, setSnapshot] = useState<StateSnapshot>(FALLBACK_SNAPSHOT);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('raka');
  const [spectatorMode, setSpectatorMode] = useState<boolean>(false);

  useEffect(() => {
    let unmounted = false;
    fetch('/api/state')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && !unmounted) {
          setSnapshot(data as StateSnapshot);
        }
      })
      .catch(() => {
        // gunakan fallback snapshot bila dev server berdiri sendiri
      });

    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${window.location.host}/ws`);
    ws.onmessage = (ev) => {
      try {
        const parsed = parseServerEvent(JSON.parse(String(ev.data)));
        if (!parsed.success) return;
        const event = parsed.data;
        if (event.type === 'state.snapshot') {
          setSnapshot(event.state);
        } else if (event.type === 'git.updated') {
          setSnapshot((prev) => ({ ...prev, git: event.git }));
        } else if (event.type === 'security.findings') {
          setSnapshot((prev) => ({ ...prev, securityFindings: event.findings }));
        }
      } catch {
        // abaikan frame tidak valid
      }
    };

    return () => {
      unmounted = true;
      ws.close();
    };
  }, []);

  const lang = snapshot.office.language;
  const selectedAgent = snapshot.agents.find((a) => a.id === selectedAgentId);

  return (
    <>
      <header
        style={{
          height: 48,
          minHeight: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          background: 'var(--color-paper-2)',
          borderBottom: '1px solid var(--color-rule)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <strong style={{ fontSize: 15 }}>{snapshot.office.name} · 2.5D Studio</strong>
          <span className="mono" style={{ fontSize: 12, color: 'var(--color-muted)' }}>
            v{snapshot.office.version}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={() => setSpectatorMode((v) => !v)}
            aria-pressed={spectatorMode}
          >
            {spectatorMode
              ? lang === 'id'
                ? 'Mode: Pengunjung (View-Only)'
                : 'Mode: Spectator (View-Only)'
              : lang === 'id'
                ? 'Mode: CEO (Kendali Penuh)'
                : 'Mode: CEO (Full Control)'}
          </button>
        </div>
      </header>

      <main className="workbench-shell">
        <IsometricOfficeStage
          agents={snapshot.agents}
          selectedAgentId={selectedAgentId}
          language={lang}
          onSelectAgent={setSelectedAgentId}
        />

        <InspectorPanel
          agents={snapshot.agents}
          tasks={snapshot.tasks}
          selectedAgent={selectedAgent}
          git={snapshot.git}
          securityFindings={snapshot.securityFindings ?? []}
          language={lang}
          spectatorMode={spectatorMode}
          onSelectAgent={setSelectedAgentId}
        />
      </main>
    </>
  );
}
