import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  type Approval,
  type ClientCommand,
  type Lang,
  type Mode,
  type ServerEvent,
  type StateSnapshot,
  type TaskStatus,
  parseServerEvent,
} from '@office/shared';
import { StatusRail } from './components/StatusRail';
import { RosterRow } from './components/RosterRow';
import { WorkOrderBoard } from './components/WorkOrderBoard';
import { DispatchLog, type FeedItem } from './components/DispatchLog';
import { CommandComposer } from './components/CommandComposer';
import { DetailRail } from './components/DetailRail';
import { ApprovalModal } from './components/ApprovalModal';
import { type SessionRole, fetchSession } from './lib/session';

interface AppProps {
  role: SessionRole;
  onLogout: () => void;
}

export function App({ role, onLogout }: AppProps) {
  const [snapshot, setSnapshot] = useState<StateSnapshot | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [wsConnected, setWsConnected] = useState(false);

  const [selectedAgentId, setSelectedAgentId] = useState<string>('raka');
  const [filterAgentId, setFilterAgentId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | undefined>(undefined);

  const [target, setTarget] = useState<string>('manager');
  const [draft, setDraft] = useState<string>('');
  const [activeApproval, setActiveApproval] = useState<Approval | null>(null);
  const [toast, setToast] = useState<{ text: string; color: string } | null>(null);

  const wsRef = useRef<WebSocket | null>(null);

  const showToast = useCallback((text: string, color = 'var(--ok)') => {
    setToast({ text, color });
    setTimeout(() => {
      setToast((prev) => (prev?.text === text ? null : prev));
    }, 4000);
  }, []);

  const sendCommand = useCallback(
    async (cmd: ClientCommand) => {
      if (role !== 'ceo') {
        showToast('Mode pengunjung: perintah tidak bisa dikirim.', 'var(--warn)');
        return;
      }
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(cmd));
        return;
      }
      const res = await fetch('/api/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cmd),
      }).catch(() => null);
      if (!res) {
        showToast('Server tidak merespons.', 'var(--danger)');
      } else if (res.status === 401) {
        onLogout();
      } else if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        showToast(data.error ?? `Perintah gagal (HTTP ${res.status})`, 'var(--danger)');
      }
    },
    [role, showToast, onLogout],
  );

  const applyServerEvent = useCallback(
    (event: ServerEvent) => {
      switch (event.type) {
        case 'state.snapshot': {
          setSnapshot(event.state);
          const initialFeed: FeedItem[] = event.state.messages.map((m) => ({
            id: m.id,
            at: m.createdAt,
            kind: 'message',
            sender: m.sender,
            recipient: m.recipient,
            body: m.body,
            messageKind: m.kind,
          }));
          setFeed(initialFeed);
          const firstPending = event.state.approvals.find((a) => a.status === 'pending');
          if (firstPending) setActiveApproval(firstPending);
          break;
        }

        case 'agent.status': {
          setSnapshot((prev) => {
            if (!prev) return prev;
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
          });
          break;
        }

        case 'agent.say': {
          setFeed((prev) => [
            ...prev,
            {
              id: `say_${event.at}_${Math.random().toString(36).slice(2, 6)}`,
              at: event.at,
              kind: 'say',
              sender: event.agentId,
              recipient: event.to,
              body: event.text,
            },
          ]);
          break;
        }

        case 'message.created': {
          setFeed((prev) => [
            ...prev,
            {
              id: event.message.id,
              at: event.message.createdAt,
              kind: 'message',
              sender: event.message.sender,
              recipient: event.message.recipient,
              body: event.message.body,
              messageKind: event.message.kind,
            },
          ]);
          break;
        }

        case 'task.updated': {
          setSnapshot((prev) => {
            if (!prev) return prev;
            const exists = prev.tasks.some((t) => t.id === event.task.id);
            const nextTasks = exists
              ? prev.tasks.map((t) => (t.id === event.task.id ? event.task : t))
              : [...prev.tasks, event.task];
            return {
              ...prev,
              tasks: nextTasks,
              agents: prev.agents.map((a) =>
                a.id === event.task.assignee
                  ? {
                      ...a,
                      currentTaskId:
                        event.task.status === 'done' ? undefined : event.task.id,
                      currentTaskTitle:
                        event.task.status === 'done' ? undefined : event.task.title,
                    }
                  : a,
              ),
            };
          });
          setFeed((prev) => [
            ...prev,
            {
              id: `task_${event.task.id}_${event.at}`,
              at: event.at,
              kind: 'system',
              sender: event.task.assignee,
              body: `Tugas #${event.task.id.slice(-6)} "${event.task.title}" -> ${event.task.status}${
                event.task.blockedReason ? ` (${event.task.blockedReason})` : ''
              }`,
            },
          ]);
          break;
        }

        case 'approval.requested': {
          setSnapshot((prev) => {
            if (!prev) return prev;
            const filtered = prev.approvals.filter((a) => a.id !== event.approval.id);
            return {
              ...prev,
              approvals: [event.approval, ...filtered],
            };
          });
          if (event.approval.status === 'pending') {
            setActiveApproval(event.approval);
          }
          setFeed((prev) => [
            ...prev,
            {
              id: `apr_${event.approval.id}`,
              at: event.at,
              kind: 'approval',
              sender: event.approval.agentId,
              recipient: 'ceo',
              body: `Meminta izin: ${event.approval.payload.command ?? event.approval.kind} ${(
                event.approval.payload.args ?? []
              ).join(' ')}`,
            },
          ]);
          break;
        }

        case 'approval.resolved': {
          setSnapshot((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              approvals: prev.approvals.map((a) =>
                a.id === event.id
                  ? {
                      ...a,
                      // Penolakan oleh "system" = kedaluwarsa/dibatalkan, bukan keputusan CEO.
                      status: event.approved
                        ? 'approved'
                        : event.decidedBy === 'system'
                          ? 'expired'
                          : 'denied',
                      decidedAt: event.at,
                      decidedBy: event.decidedBy,
                      reason: event.reason,
                    }
                  : a,
              ),
            };
          });
          setActiveApproval((prev) => (prev?.id === event.id ? null : prev));
          showToast(
            event.approved ? 'Disetujui' : event.reason || 'Ditolak',
            event.approved ? 'var(--ok)' : 'var(--danger)',
          );
          break;
        }

        case 'usage.updated': {
          setSnapshot((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              agents: prev.agents.map((a) =>
                a.id === event.usage.agentId
                  ? {
                      ...a,
                      quota: {
                        ...a.quota,
                        used: event.usage.requests,
                        cap: event.usage.cap,
                      },
                    }
                  : a,
              ),
            };
          });
          break;
        }

        case 'office.mode': {
          setSnapshot((prev) =>
            prev ? { ...prev, office: { ...prev.office, mode: event.mode } } : prev,
          );
          showToast(`Mode diubah ke ${event.mode === 'semi' ? 'Semi' : 'Penuh'}`, 'var(--data)');
          break;
        }

        case 'office.paused': {
          setSnapshot((prev) =>
            prev ? { ...prev, office: { ...prev.office, paused: event.paused } } : prev,
          );
          showToast(event.paused ? 'Semua kursi dijeda' : 'Operasi dilanjutkan', 'var(--signal)');
          break;
        }

        case 'office.language': {
          setSnapshot((prev) =>
            prev ? { ...prev, office: { ...prev.office, language: event.language } } : prev,
          );
          break;
        }

        case 'git.updated': {
          setSnapshot((prev) => (prev ? { ...prev, git: event.git } : prev));
          if (event.git.pushBlocked || event.git.blockedReason) {
            showToast(
              `Git push tertahan: ${event.git.blockedReason ?? 'Temuan keamanan'}`,
              'var(--danger)',
            );
          } else if (event.git.lastCommitSha) {
            showToast(
              `Git sync (${event.git.branch}): ${event.git.lastCommitSha.slice(0, 7)}`,
              'var(--ok)',
            );
          }
          break;
        }

        case 'security.findings': {
          setSnapshot((prev) => (prev ? { ...prev, securityFindings: event.findings } : prev));
          const hardCount = event.findings.filter((f) => f.severity === 'hard').length;
          if (hardCount > 0) {
            showToast(
              `Audit Keamanan Satria: ${hardCount} temuan HARD terdeteksi`,
              'var(--danger)',
            );
          }
          break;
        }

        case 'error': {
          showToast(event.message, 'var(--danger)');
          break;
        }
      }
    },
    [showToast],
  );

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let unmounted = false;

    const connect = () => {
      if (unmounted) return;
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const wsUrl = `${proto}://${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
      };

      ws.onmessage = (msg) => {
        try {
          const raw = JSON.parse(String(msg.data));
          const parsed = parseServerEvent(raw);
          if (parsed.success) {
            applyServerEvent(parsed.data);
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        if (unmounted) return;
        // Bila sesi kedaluwarsa, kembali ke layar login alih-alih mencoba terus.
        reconnectTimer = setTimeout(() => {
          void fetchSession()
            .then((s) => {
              if (unmounted) return;
              if (!s.authenticated) onLogout();
              else connect();
            })
            .catch(() => {
              if (!unmounted) connect();
            });
        }, 2000);
      };
    };

    connect();

    // Initial HTTP fallback fetch in case WS takes a moment
    fetch('/api/state')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && !unmounted) {
          setSnapshot((prev) => prev ?? (data as StateSnapshot));
        }
      })
      .catch(() => {});

    return () => {
      unmounted = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [applyServerEvent, onLogout]);

  if (!snapshot) {
    return (
      <div
        className="dispatch-shell"
        style={{ alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}
      >
        Memuat Meja Dispatch Office Agents...
      </div>
    );
  }

  const { office, agents, tasks, approvals } = snapshot;
  const lang: Lang = office.language;
  const pendingApprovalCount = approvals.filter((a) => a.status === 'pending').length;

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);
  const selectedTask = tasks.find((t) => t.id === selectedTaskId);

  const handleSendCommand = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    void sendCommand({
      type: 'ceo.send',
      to: target,
      text: trimmed,
    });
    setDraft('');
  };

  const handleCheckGateway = async () => {
    try {
      if (role !== 'ceo') return;
      const res = await fetch('/api/gateway/check', { method: 'POST' });
      if (res.ok) {
        const gw = await res.json();
        setSnapshot((prev) =>
          prev ? { ...prev, office: { ...prev.office, gateway: gw } } : prev,
        );
      }
    } catch {
      // ignore
    }
  };

  return (
    <div className="dispatch-shell">
      <StatusRail
        officeName={office.name}
        gateway={office.gateway}
        gitStatus={snapshot.git}
        mode={office.mode}
        paused={office.paused}
        language={lang}
        pendingApprovalCount={pendingApprovalCount}
        wsConnected={wsConnected}
        role={role}
        onLogout={onLogout}
        onSetMode={(mode: Mode) => void sendCommand({ type: 'office.setMode', mode })}
        onTogglePause={() =>
          void sendCommand({ type: 'office.pauseAll', paused: !office.paused })
        }
        onSetLanguage={(language: Lang) =>
          void sendCommand({ type: 'office.setLanguage', language })
        }
        onCheckGateway={() => void handleCheckGateway()}
        onOpenApprovals={() => {
          const first = approvals.find((a) => a.status === 'pending');
          if (first) setActiveApproval(first);
        }}
      />

      {office.gateway.status === 'offline' && (
        <div className="offline-banner" role="alert">
          <span>
            {lang === 'id'
              ? 'Gateway model lokal offline. Pastikan layanan model aktif lalu klik Coba lagi.'
              : 'Local model gateway is offline. Ensure the model service is running and click Retry.'}
          </span>
          <button type="button" onClick={() => void handleCheckGateway()}>
            {lang === 'id' ? 'Coba lagi' : 'Retry'}
          </button>
        </div>
      )}

      <main className="dispatch-grid">
        {/* Roster Kiri 264px */}
        <section className="roster-rail" aria-label="Roster Karyawan AI">
          <div className="section-header">
            <span>
              {lang === 'id'
                ? `Kursi Karyawan (${agents.length})`
                : `Employee Seats (${agents.length})`}
            </span>
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-faint)' }}>
              kuota/hari
            </span>
          </div>
          {agents.map((agent) => (
            <RosterRow
              key={agent.id}
              agent={agent}
              language={lang}
              selected={selectedAgentId === agent.id}
              onSelect={(id) => {
                setSelectedAgentId(id);
                setFilterAgentId((prev) => (prev === id ? null : id));
              }}
              onPickTarget={(id) => {
                setSelectedAgentId(id);
                setTarget(id === 'raka' ? 'manager' : id);
              }}
              onStopAgent={(id) => void sendCommand({ type: 'office.stopAgent', agentId: id })}
            />
          ))}
        </section>

        {/* Panggung Tengah: Kanban + DispatchLog + Composer */}
        <div className="center-stage">
          <WorkOrderBoard
            tasks={tasks}
            agents={agents}
            language={lang}
            selectedTaskId={selectedTaskId}
            onSelectTask={(taskId) => setSelectedTaskId(taskId)}
            onMoveTask={(taskId: string, status: TaskStatus) =>
              void sendCommand({ type: 'task.move', taskId, status })
            }
          />

          <DispatchLog
            items={feed}
            agents={agents}
            language={lang}
            filterAgentId={filterAgentId}
            onClearFilter={() => setFilterAgentId(null)}
            onQuickPrompt={(text) => {
              setTarget('manager');
              setDraft(text);
            }}
          />

          <CommandComposer
            agents={agents}
            target={target}
            draft={draft}
            language={lang}
            gatewayStatus={office.gateway.status}
            onChangeTarget={setTarget}
            onChangeDraft={setDraft}
            onSend={handleSendCommand}
          />
        </div>

        {/* Rail Kanan: Approval + Audit Keamanan Satria + Detail + Workspace Files */}
        <DetailRail
          approvals={approvals}
          agents={agents}
          securityFindings={snapshot.securityFindings ?? []}
          selectedAgent={selectedAgent}
          selectedTask={selectedTask}
          language={lang}
          onRespondApproval={(id, approved) =>
            void sendCommand({ type: 'approval.respond', id, approved })
          }
          onInspectApproval={(apr) => setActiveApproval(apr)}
          onTargetAgent={(agentId) => setTarget(agentId === 'raka' ? 'manager' : agentId)}
        />
      </main>

      {activeApproval && (
        <ApprovalModal
          approval={activeApproval}
          agent={agents.find((a) => a.id === activeApproval.agentId)}
          language={lang}
          onRespond={(id, approved, reason) => {
            void sendCommand({ type: 'approval.respond', id, approved, reason });
            setActiveApproval(null);
          }}
          onClose={() => setActiveApproval(null)}
        />
      )}

      {toast && (
        <div className="toast-box" role="status">
          <span
            aria-hidden="true"
            style={{ width: 8, height: 8, backgroundColor: toast.color, display: 'inline-block' }}
          />
          <span>{toast.text}</span>
        </div>
      )}
    </div>
  );
}
