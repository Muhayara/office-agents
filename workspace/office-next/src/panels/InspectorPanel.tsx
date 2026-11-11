import React from 'react';
import {
  type AgentView,
  type GitStatusSnapshot,
  type Lang,
  type SecurityFinding,
  type Task,
  formatPublicModelName,
  roleLabel,
} from '@office/shared';

interface InspectorPanelProps {
  agents: AgentView[];
  tasks: Task[];
  selectedAgent?: AgentView;
  git?: GitStatusSnapshot;
  securityFindings: SecurityFinding[];
  language: Lang;
  spectatorMode: boolean;
  onSelectAgent: (agentId: string) => void;
}

export function InspectorPanel({
  agents,
  tasks,
  selectedAgent,
  git,
  securityFindings,
  language,
  spectatorMode,
  onSelectAgent,
}: InspectorPanelProps) {
  return (
    <aside
      aria-label={language === 'id' ? 'Panel Inspeksi Kantor' : 'Office Inspector Panel'}
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--color-paper-2)',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--color-rule)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <strong style={{ fontSize: 14 }}>
          {language === 'id' ? 'Inspektur Kursi & Telemetri' : 'Seat & Telemetry Inspector'}
        </strong>
        <span
          className="mono"
          style={{
            fontSize: 11,
            padding: '2px 6px',
            borderRadius: 4,
            background: 'var(--color-paper-3)',
            color: spectatorMode ? 'var(--color-focus)' : 'var(--color-accent)',
          }}
        >
          {spectatorMode
            ? language === 'id'
              ? 'Mode Pengunjung (View-Only)'
              : 'Spectator Mode (View-Only)'
            : 'Mode CEO'}
        </span>
      </div>

      {selectedAgent && (
        <div
          style={{
            padding: 16,
            borderBottom: '1px solid var(--color-rule)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 18, fontWeight: 600, color: selectedAgent.color }}>
              {selectedAgent.name}
            </span>
            <span style={{ fontSize: 13, color: 'var(--color-ink-2)' }}>
              {roleLabel(selectedAgent.role, language)}
            </span>
          </div>

          <div className="mono" style={{ fontSize: 12, color: 'var(--color-muted)' }}>
            Model: {formatPublicModelName(selectedAgent.model)} · Meja ({selectedAgent.desk.x},{' '}
            {selectedAgent.desk.y})
          </div>

          <div className="mono" style={{ fontSize: 12, color: 'var(--color-ink-2)' }}>
            Status: <strong>{selectedAgent.status}</strong> · Kuota: {selectedAgent.quota.used}/
            {selectedAgent.quota.cap}
          </div>
        </div>
      )}

      <div
        style={{
          padding: 16,
          borderBottom: '1px solid var(--color-rule)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-ink-2)' }}>
          {language === 'id' ? `Daftar Kursi (${agents.length})` : `Seat Roster (${agents.length})`}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {agents.map((ag) => (
            <button
              key={ag.id}
              type="button"
              onClick={() => onSelectAgent(ag.id)}
              style={{
                textAlign: 'left',
                padding: '6px 8px',
                borderColor:
                  ag.id === selectedAgent?.id ? ag.color : 'var(--color-rule)',
                background:
                  ag.id === selectedAgent?.id
                    ? 'var(--color-paper-3)'
                    : 'var(--color-paper)',
              }}
            >
              <div style={{ fontWeight: 600, color: ag.color, fontSize: 13 }}>{ag.name}</div>
              <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>
                {roleLabel(ag.role, language)}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-ink-2)' }}>
          {language === 'id' ? 'Ringkasan Keamanan & Git' : 'Git & Security Summary'}
        </div>
        <div className="mono" style={{ fontSize: 12, color: 'var(--color-muted)' }}>
          Branch: {git?.branch ?? 'main'}{' '}
          {git?.lastCommitSha ? `· ${git.lastCommitSha.slice(0, 7)}` : ''}
        </div>
        <div className="mono" style={{ fontSize: 12, color: 'var(--color-ok)' }}>
          {language === 'id'
            ? `Temuan keamanan aktif: ${securityFindings.length} · Tugas aktif: ${tasks.length}`
            : `Active security findings: ${securityFindings.length} · Tasks: ${tasks.length}`}
        </div>
      </div>
    </aside>
  );
}
