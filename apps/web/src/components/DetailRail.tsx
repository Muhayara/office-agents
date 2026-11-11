import React, { useEffect, useState } from 'react';
import { Check, FileText, FolderOpen, RefreshCw, ShieldCheck, ShieldAlert, X } from 'lucide-react';
import {
  type AgentView,
  type Approval,
  type Lang,
  type SecurityFinding,
  type Task,
  formatPublicModelName,
  roleLabel,
} from '@office/shared';
import { STATUS_LABELS, TASK_STATUS_LABELS } from '../lib/i18n';
import { Tick } from './Tick';

interface DetailRailProps {
  approvals: Approval[];
  agents: AgentView[];
  securityFindings?: SecurityFinding[];
  selectedAgent?: AgentView;
  selectedTask?: Task;
  language: Lang;
  onRespondApproval: (id: string, approved: boolean) => void;
  onInspectApproval: (approval: Approval) => void;
  onTargetAgent: (agentId: string) => void;
}

export function DetailRail({
  approvals,
  agents,
  securityFindings = [],
  selectedAgent,
  selectedTask,
  language,
  onRespondApproval,
  onInspectApproval,
  onTargetAgent,
}: DetailRailProps) {
  const [tab, setTab] = useState<'detail' | 'files'>('detail');
  const [files, setFiles] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [loadingFiles, setLoadingFiles] = useState(false);

  const pendingApprovals = approvals.filter((a) => a.status === 'pending');
  const agentMap = new Map(agents.map((a) => [a.id, a]));

  const fetchFiles = async () => {
    setLoadingFiles(true);
    try {
      const res = await fetch('/api/files');
      if (res.ok) {
        const data = (await res.json()) as { files: string[] };
        setFiles(data.files.filter((f) => !f.endsWith('/')));
      }
    } catch {
      // ignore
    } finally {
      setLoadingFiles(false);
    }
  };

  const openFile = async (relPath: string) => {
    setSelectedFile(relPath);
    try {
      const res = await fetch(`/api/file?path=${encodeURIComponent(relPath)}`);
      if (res.ok) {
        const data = (await res.json()) as { content: string };
        setFileContent(data.content);
      } else {
        setFileContent('(Gagal memuat file)');
      }
    } catch {
      setFileContent('(Gagal memuat file)');
    }
  };

  useEffect(() => {
    void fetchFiles();
  }, [selectedTask?.updatedAt]);

  return (
    <aside className="detail-rail" aria-label="Approval & Detail">
      {/* Antrean Approval di atas (§3) */}
      <div className="section-header">
        <span>
          {language === 'id' ? 'Menunggu izin' : 'Pending approvals'} ({pendingApprovals.length})
        </span>
      </div>

      <div
        style={{
          padding: 12,
          borderBottom: '1px solid var(--rule)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {pendingApprovals.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>
            {language === 'id'
              ? 'Tidak ada permintaan izin yang tertunda.'
              : 'No pending approval requests.'}
          </div>
        ) : (
          pendingApprovals.map((apr) => {
            const ag = agentMap.get(apr.agentId);
            const cmd = [apr.payload.command, ...(apr.payload.args ?? [])]
              .filter(Boolean)
              .join(' ');
            return (
              <div
                key={apr.id}
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--rule-strong)',
                  borderLeft: '2px solid var(--warn)',
                  borderRadius: 4,
                  padding: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <strong style={{ color: ag?.color ?? 'var(--text)' }}>
                    {ag?.name ?? apr.agentId}
                  </strong>
                  <button
                    type="button"
                    onClick={() => onInspectApproval(apr)}
                    style={{ padding: '1px 6px', minHeight: 20, fontSize: 11 }}
                  >
                    Detail
                  </button>
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 12,
                    background: 'var(--ink)',
                    padding: '4px 6px',
                    borderRadius: 2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {cmd || apr.payload.reason || apr.kind}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => onRespondApproval(apr.id, true)}
                    style={{
                      flex: 1,
                      background: 'var(--signal)',
                      borderColor: 'var(--signal)',
                      color: 'var(--ink)',
                      fontWeight: 600,
                      padding: '4px 8px',
                      minHeight: 28,
                      fontSize: 12,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                    }}
                  >
                    <Check size={13} strokeWidth={1.8} />
                    <span>{language === 'id' ? 'Setujui' : 'Approve'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onRespondApproval(apr.id, false)}
                    style={{
                      flex: 1,
                      borderColor: 'var(--danger)',
                      color: 'var(--danger)',
                      padding: '4px 8px',
                      minHeight: 28,
                      fontSize: 12,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                    }}
                  >
                    <X size={13} strokeWidth={1.8} />
                    <span>{language === 'id' ? 'Tolak' : 'Deny'}</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Ringkasan Audit Keamanan Satria (ter-redaksi: hanya rule, path, line, severity) */}
      <div className="section-header">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {securityFindings.some((f) => f.severity === 'hard') ? (
            <ShieldAlert size={14} strokeWidth={1.6} color="var(--danger)" />
          ) : securityFindings.length > 0 ? (
            <ShieldAlert size={14} strokeWidth={1.6} color="var(--warn)" />
          ) : (
            <ShieldCheck size={14} strokeWidth={1.6} color="var(--ok)" />
          )}
          <span>
            {language === 'id' ? 'Audit Keamanan' : 'Security Audit'} ({securityFindings.length})
          </span>
        </span>
        <span className="mono" style={{ fontSize: 11, color: 'var(--a-satria)' }}>
          Satria
        </span>
      </div>

      <div
        style={{
          padding: 12,
          borderBottom: '1px solid var(--rule)',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          maxHeight: 164,
          overflowY: 'auto',
        }}
      >
        {securityFindings.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--ok)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>
              {language === 'id'
                ? 'Bersih — 0 temuan rahasia/kredensial aktif.'
                : 'Clean — 0 active secret/credential findings.'}
            </span>
          </div>
        ) : (
          securityFindings.map((finding, idx) => {
            const isHard = finding.severity === 'hard';
            return (
              <div
                key={`${finding.rule}_${finding.path}_${finding.line ?? 0}_${idx}`}
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--rule)',
                  borderLeft: `2px solid ${isHard ? 'var(--danger)' : 'var(--warn)'}`,
                  borderRadius: 4,
                  padding: '6px 8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                  <span
                    className="mono"
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: isHard ? 'var(--danger)' : 'var(--warn)',
                    }}
                  >
                    [{finding.severity.toUpperCase()}] {finding.rule}
                  </span>
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: 'var(--text-muted)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={`${finding.path}${finding.line ? `:${finding.line}` : ''}`}
                >
                  {finding.path}
                  {finding.line ? `:${finding.line}` : ''}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Tab pemilih Detail vs File Workspace */}
      <div className="section-header">
        <div className="seg-group">
          <button
            type="button"
            className={`seg-btn ${tab === 'detail' ? 'active' : ''}`}
            onClick={() => setTab('detail')}
          >
            {language === 'id' ? 'Detail Terpilih' : 'Selected Detail'}
          </button>
          <button
            type="button"
            className={`seg-btn ${tab === 'files' ? 'active' : ''}`}
            onClick={() => {
              setTab('files');
              void fetchFiles();
            }}
          >
            Workspace ({files.length})
          </button>
        </div>

        {tab === 'files' && (
          <button
            type="button"
            onClick={() => void fetchFiles()}
            title="Refresh workspace files"
            aria-label="Refresh workspace files"
            style={{ padding: '4px 6px', minHeight: 26 }}
          >
            <RefreshCw size={13} strokeWidth={1.5} />
          </button>
        )}
      </div>

      {tab === 'detail' ? (
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {selectedTask && (
            <div
              style={{
                paddingBottom: 14,
                borderBottom: '1px solid var(--rule)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="mono" style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                  #{selectedTask.id}
                </span>
                <span className="chip">{TASK_STATUS_LABELS[language][selectedTask.status]}</span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{selectedTask.title}</div>
              {selectedTask.details && (
                <div style={{ fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'pre-wrap' }}>
                  {selectedTask.details}
                </div>
              )}
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Assignee: <strong>{agentMap.get(selectedTask.assignee)?.name ?? selectedTask.assignee}</strong>
                {selectedTask.reviewer ? ` · Reviewer: ${selectedTask.reviewer}` : ''}
              </div>
              {selectedTask.files.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {selectedTask.files.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => {
                        setTab('files');
                        void openFile(f);
                      }}
                      className="mono"
                      style={{ padding: '2px 6px', minHeight: 22, fontSize: 11, color: 'var(--data)' }}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {selectedAgent ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 18, fontWeight: 600, color: selectedAgent.color }}>
                  {selectedAgent.name}
                </span>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {roleLabel(selectedAgent.role, language)}
                </span>
              </div>

              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Status: <strong>{STATUS_LABELS[language][selectedAgent.status]}</strong>
              </div>

              <div style={{ fontSize: 12 }}>
                <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>
                  Model: <span className="mono">{formatPublicModelName(selectedAgent.model)}</span>
                </div>
                <Tick used={selectedAgent.quota.used} cap={selectedAgent.quota.cap} />
              </div>

              <button
                type="button"
                onClick={() => onTargetAgent(selectedAgent.id)}
                style={{
                  alignSelf: 'flex-start',
                  borderColor: selectedAgent.color,
                  color: selectedAgent.color,
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {language === 'id'
                  ? `Kirim perintah ke ${selectedAgent.name}`
                  : `Message ${selectedAgent.name}`}
              </button>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>
              {language === 'id'
                ? 'Pilih kursi atau kartu tugas untuk melihat detail.'
                : 'Select a seat or task card to inspect details.'}
            </div>
          )}
        </div>
      ) : (
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
          {loadingFiles ? (
            <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>Memuat daftar file...</div>
          ) : files.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>
              {language === 'id' ? 'Belum ada file di workspace/.' : 'No files in workspace/.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {files.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => void openFile(f)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    textAlign: 'left',
                    padding: '6px 8px',
                    background: selectedFile === f ? 'var(--surface-3)' : 'var(--surface-2)',
                    borderColor: selectedFile === f ? 'var(--data)' : 'var(--rule)',
                    fontSize: 12,
                  }}
                >
                  {f.endsWith('/') ? (
                    <FolderOpen size={13} strokeWidth={1.5} color="var(--signal)" />
                  ) : (
                    <FileText size={13} strokeWidth={1.5} color="var(--data)" />
                  )}
                  <span className="mono">{f}</span>
                </button>
              ))}
            </div>
          )}

          {selectedFile && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
              <div
                className="mono"
                style={{ fontSize: 12, color: 'var(--data)', fontWeight: 600 }}
              >
                workspace/{selectedFile}
              </div>
              <pre
                className="mono"
                style={{
                  margin: 0,
                  padding: 10,
                  background: 'var(--ink)',
                  border: '1px solid var(--rule-strong)',
                  borderRadius: 4,
                  fontSize: 12,
                  maxHeight: 280,
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {fileContent}
              </pre>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
