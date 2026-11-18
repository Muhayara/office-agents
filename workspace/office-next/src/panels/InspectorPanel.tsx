import React, { useEffect, useRef, useState } from 'react';
import {
  type AgentStatus,
  type AgentView,
  type Approval,
  type GitStatusSnapshot,
  type Lang,
  type SecurityFinding,
  type Task,
  formatPublicModelName,
  roleLabel,
} from '@office/shared';
import type { SessionRole } from '../state/liveOffice';

interface RunStepView {
  seq: number;
  kind: string;
  name?: string;
  output?: string;
}

interface RunView {
  id: string;
  status: string;
  model: string;
  startedAt: string;
  endedAt?: string;
  error?: string;
  steps: RunStepView[];
}

interface InspectorPanelProps {
  agents: AgentView[];
  tasks: Task[];
  approvals: Approval[];
  selectedAgent?: AgentView;
  git?: GitStatusSnapshot;
  securityFindings: SecurityFinding[];
  language: Lang;
  live: boolean;
  /** F2: penonton publik / tamu — status asli dari dunia bersama, tanpa tugas & kuota. */
  publicView?: boolean;
  role: SessionRole | null;
  viewOnly: boolean;
  onSelectAgent: (agentId: string) => void;
  onRespondApproval: (approvalId: string, approved: boolean) => void;
}

export const STATUS_LABELS: Record<Lang, Record<AgentStatus, string>> = {
  id: {
    idle: 'Santai',
    thinking: 'Berpikir',
    working: 'Bekerja',
    messaging: 'Berkoordinasi',
    meeting: 'Rapat',
    waiting_approval: 'Menunggu izin CEO',
    error: 'Error',
    offline: 'Pulang (offline)',
  },
  en: {
    idle: 'Idle',
    thinking: 'Thinking',
    working: 'Working',
    messaging: 'Coordinating',
    meeting: 'In meeting',
    waiting_approval: 'Waiting for CEO',
    error: 'Error',
    offline: 'Off duty',
  },
};

const STATUS_COLORS: Record<AgentStatus, string> = {
  idle: 'var(--color-muted)',
  thinking: 'var(--color-focus)',
  working: 'var(--color-ok)',
  messaging: 'var(--color-focus)',
  meeting: 'var(--color-accent)',
  waiting_approval: 'var(--color-warn)',
  error: 'var(--color-danger)',
  offline: 'var(--color-rule-strong)',
};

function timeShort(iso: string): string {
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function InspectorPanel({
  agents,
  tasks,
  approvals,
  selectedAgent,
  git,
  securityFindings,
  language,
  live,
  publicView = false,
  role,
  viewOnly,
  onSelectAgent,
  onRespondApproval,
}: InspectorPanelProps) {
  const [runs, setRuns] = useState<RunView[] | null>(null);
  const [runsError, setRunsError] = useState<string | null>(null);
  const canSeeHistory = live && role === 'ceo';
  const selectedId = selectedAgent?.id;
  const selectedStatus = selectedAgent?.status;

  // Riwayat kerja dimuat ulang saat agen dipilih, atau saat gilirannya selesai (idle/error).
  const fetchedFor = useRef<string | null>(null);
  const requestSeq = useRef(0);
  useEffect(() => {
    if (!canSeeHistory || !selectedId) {
      fetchedFor.current = null;
      setRuns(null);
      return;
    }
    const agentChanged = fetchedFor.current !== selectedId;
    const turnSettled = selectedStatus === 'idle' || selectedStatus === 'error';
    if (!agentChanged && !turnSettled) return;
    if (agentChanged) setRuns(null);
    fetchedFor.current = selectedId;
    const requestId = ++requestSeq.current;
    fetch(`/api/runs?agent=${encodeURIComponent(selectedId)}&limit=5`, { credentials: 'same-origin' })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = (await r.json()) as { runs: RunView[] };
        // Abaikan respons basi bila CEO sudah memilih agen lain.
        if (requestId !== requestSeq.current) return;
        setRuns(data.runs);
        setRunsError(null);
      })
      .catch(() => {
        if (requestId === requestSeq.current) setRunsError('Riwayat gagal dimuat.');
      });
  }, [canSeeHistory, selectedId, selectedStatus]);

  const pendingForAgent = approvals.filter((a) => a.status === 'pending' && a.agentId === selectedId);
  const pendingTotal = approvals.filter((a) => a.status === 'pending').length;
  const currentTask = selectedAgent?.currentTaskId
    ? tasks.find((t) => t.id === selectedAgent.currentTaskId)
    : undefined;
  const activeTasks = tasks.filter((t) => t.status !== 'done').length;

  return (
    <aside className="inspector" aria-label={language === 'id' ? 'Panel Inspeksi Kantor' : 'Office Inspector Panel'}>
      <div className="inspector-head">
        <strong style={{ fontSize: 14 }}>
          {language === 'id' ? 'Inspektur Kursi & Telemetri' : 'Seat & Telemetry Inspector'}
        </strong>
        <span className="chip mono" style={{ color: viewOnly ? 'var(--color-focus)' : 'var(--color-accent)' }}>
          {publicView ? 'Publik · dunia bersama' : !live ? 'Simulasi' : viewOnly ? 'Lihat saja' : 'Mode CEO'}
        </span>
      </div>

      {selectedAgent && (
        <section className="inspector-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 18, fontWeight: 600, color: selectedAgent.color }}>{selectedAgent.name}</span>
            <span style={{ fontSize: 13, color: 'var(--color-ink-2)' }}>
              {selectedAgent.title ?? roleLabel(selectedAgent.role, language)}
            </span>
          </div>

          <div className="status-line">
            <span className="status-dot" style={{ background: STATUS_COLORS[selectedAgent.status] }} />
            <strong>{STATUS_LABELS[language][selectedAgent.status]}</strong>
            {!live && !publicView && <span className="muted">(simulasi)</span>}
          </div>

          {selectedAgent.offlineReason && <div className="muted small">{selectedAgent.offlineReason}</div>}

          {currentTask && (
            <div className="small">
              {language === 'id' ? 'Tugas: ' : 'Task: '}
              <strong>{currentTask.title}</strong> <span className="mono muted">[{currentTask.status}]</span>
            </div>
          )}

          {!publicView && <div className="mono muted small">
            {formatPublicModelName(selectedAgent.model)} · Kuota {selectedAgent.quota.used}/{selectedAgent.quota.cap}
            {live ? ` · reset ${timeShort(selectedAgent.quota.resetAt)}` : ''}
          </div>}
        </section>
      )}

      {live && (
        <section className="inspector-section">
          <div className="section-title">
            {language === 'id' ? 'Izin menunggu' : 'Pending approvals'}{' '}
            <span className="mono muted">({pendingTotal})</span>
          </div>
          {pendingForAgent.length === 0 ? (
            <div className="muted small">
              {selectedAgent
                ? `${selectedAgent.name} ${language === 'id' ? 'tidak sedang menunggu izin.' : 'is not waiting for approval.'}`
                : '—'}
            </div>
          ) : (
            pendingForAgent.map((apr) => (
              <div key={apr.id} className="approval-card">
                <div className="mono small">
                  {apr.payload.command ? `${apr.payload.command} ${(apr.payload.args ?? []).join(' ')}` : apr.kind}
                </div>
                {apr.payload.reason && <div className="muted small">{apr.payload.reason}</div>}
                {apr.payload.risk && <div className="small" style={{ color: 'var(--color-warn)' }}>{apr.payload.risk}</div>}
                {!viewOnly && role === 'ceo' ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" className="btn-primary" onClick={() => onRespondApproval(apr.id, true)}>
                      Setujui
                    </button>
                    <button type="button" onClick={() => onRespondApproval(apr.id, false)}>
                      Tolak
                    </button>
                  </div>
                ) : (
                  <div className="muted small">Hanya CEO yang bisa memutuskan.</div>
                )}
              </div>
            ))
          )}
        </section>
      )}

      {canSeeHistory && selectedAgent && (
        <section className="inspector-section">
          <div className="section-title">{language === 'id' ? 'Riwayat kerja' : 'Work history'}</div>
          {runsError && <div className="small" style={{ color: 'var(--color-danger)' }}>{runsError}</div>}
          {runs && runs.length === 0 && <div className="muted small">Belum ada giliran tercatat.</div>}
          {runs?.map((run) => (
            <details key={run.id} className="run-item">
              <summary>
                <span className="mono">{timeShort(run.startedAt)}</span>{' '}
                <span style={{ color: run.status === 'ok' ? 'var(--color-ok)' : 'var(--color-danger)' }}>{run.status}</span>{' '}
                <span className="muted small">
                  {run.steps.length > 0
                    ? run.steps.map((s) => s.name ?? s.kind).join(' → ')
                    : (run.error ?? 'tanpa langkah')}
                </span>
              </summary>
              {run.error && <div className="small" style={{ color: 'var(--color-danger)' }}>{run.error}</div>}
              <ol className="run-steps">
                {run.steps.map((s) => (
                  <li key={s.seq}>
                    <span className="mono">{s.name ?? s.kind}</span>
                    {s.output && <div className="muted small run-output">{s.output}</div>}
                  </li>
                ))}
              </ol>
            </details>
          ))}
        </section>
      )}

      <section className="inspector-section">
        <div className="section-title">
          {language === 'id' ? `Daftar Kursi (${agents.length})` : `Seat Roster (${agents.length})`}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {agents.map((ag) => (
            <button
              key={ag.id}
              type="button"
              onClick={() => onSelectAgent(ag.id)}
              className="roster-btn"
              style={{
                borderColor: ag.id === selectedAgent?.id ? ag.color : 'var(--color-rule)',
                background: ag.id === selectedAgent?.id ? 'var(--color-paper-3)' : 'var(--color-paper)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="status-dot" style={{ background: live || publicView ? STATUS_COLORS[ag.status] : ag.color }} />
                <span style={{ fontWeight: 600, color: ag.color, fontSize: 13 }}>{ag.name}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>
                {live || publicView ? STATUS_LABELS[language][ag.status] : roleLabel(ag.role, language)}
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="inspector-section" style={{ borderBottom: 'none' }}>
        <div className="section-title">{language === 'id' ? 'Ringkasan Keamanan & Git' : 'Git & Security Summary'}</div>
        <div className="mono muted small">
          Branch: {git?.branch ?? 'main'} {git?.lastCommitSha ? `· ${git.lastCommitSha.slice(0, 7)}` : ''}
        </div>
        {git?.pushBlocked && (
          <div className="small" style={{ color: 'var(--color-danger)' }}>
            Push tertahan: {git.blockedReason ?? 'temuan keamanan'}
          </div>
        )}
        <div className="mono small" style={{ color: securityFindings.some((f) => f.severity === 'hard') ? 'var(--color-danger)' : 'var(--color-ok)' }}>
          {language === 'id'
            ? `Temuan keamanan: ${securityFindings.length} · Tugas aktif: ${activeTasks}`
            : `Security findings: ${securityFindings.length} · Active tasks: ${activeTasks}`}
        </div>
      </section>
    </aside>
  );
}
