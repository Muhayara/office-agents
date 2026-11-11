import React, { useEffect, useRef, useState } from 'react';
import { ShieldAlert, X } from 'lucide-react';
import type { AgentView, Approval, Lang } from '@office/shared';

interface ApprovalModalProps {
  approval: Approval;
  agent?: AgentView;
  language: Lang;
  onRespond: (id: string, approved: boolean, reason?: string) => void;
  onClose: () => void;
}

export function ApprovalModal({
  approval,
  agent,
  language,
  onRespond,
  onClose,
}: ApprovalModalProps) {
  const approveBtnRef = useRef<HTMLButtonElement>(null);
  const [reason, setReason] = useState('');
  const [secondsLeft, setSecondsLeft] = useState<number>(() => {
    const elapsed = Math.floor((Date.now() - Date.parse(approval.createdAt)) / 1000);
    return Math.max(0, 600 - elapsed);
  });

  useEffect(() => {
    approveBtnRef.current?.focus();
    const timer = setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [approval.id]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea') {
        if (e.key === 'Escape') onClose();
        return;
      }
      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        onRespond(approval.id, true, reason || undefined);
      } else if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        onRespond(approval.id, false, reason || undefined);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [approval.id, onClose, onRespond, reason]);

  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const secs = String(secondsLeft % 60).padStart(2, '0');

  const cmdString = [approval.payload.command, ...(approval.payload.args ?? [])]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="modal-scrim" role="dialog" aria-modal="true" aria-labelledby="approval-title">
      <div className="modal-panel">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <ShieldAlert size={20} strokeWidth={1.5} color="var(--warn)" />
            <h2 id="approval-title" style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>
              {approval.kind === 'security_block'
                ? language === 'id'
                  ? 'Blokir keamanan Git push'
                  : 'Git push security block'
                : language === 'id'
                  ? 'Persetujuan perintah'
                  : 'Command approval'}
            </h2>
          </div>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <span className="mono" style={{ fontSize: 13, color: 'var(--warn)' }}>
              {mins}:{secs}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label={language === 'id' ? 'Tutup dialog' : 'Close dialog'}
              style={{ padding: '4px 6px', minHeight: 28 }}
            >
              <X size={16} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
          <strong style={{ color: agent?.color ?? 'var(--text)' }}>
            {agent?.name ?? approval.agentId}
          </strong>{' '}
          {approval.kind === 'security_block'
            ? language === 'id'
              ? 'menahan commit/push otomatis karena temuan keamanan berikut:'
              : 'blocked automatic commit/push due to the following security findings:'
            : language === 'id'
              ? 'meminta izin menjalankan perintah terminal berikut:'
              : 'requests permission to execute the following command:'}
        </div>

        <pre
          className="mono"
          style={{
            margin: 0,
            padding: '12px 14px',
            backgroundColor: 'var(--ink)',
            border: '1px solid var(--rule-strong)',
            borderRadius: 6,
            fontSize: 13,
            overflowX: 'auto',
            color: 'var(--text)',
          }}
        >
          {cmdString || approval.payload.reason || approval.kind}
        </pre>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
          {approval.payload.reason && (
            <div>
              <span style={{ color: 'var(--text-muted)' }}>
                {language === 'id' ? 'Alasan: ' : 'Reason: '}
              </span>
              <span>{approval.payload.reason}</span>
            </div>
          )}
          {approval.payload.cwd && (
            <div>
              <span style={{ color: 'var(--text-muted)' }}>
                {language === 'id' ? 'Direktori: ' : 'Directory: '}
              </span>
              <span className="mono">workspace/{approval.payload.cwd}</span>
            </div>
          )}
          {approval.payload.risk && (
            <div style={{ color: 'var(--warn)' }}>
              {language === 'id' ? 'Catatan risiko: ' : 'Risk note: '}
              {approval.payload.risk}
            </div>
          )}
        </div>

        <div>
          <label
            htmlFor="approval-reason"
            style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}
          >
            {language === 'id'
              ? 'Catatan keputusan (opsional, dikirim ke agen bila ditolak)'
              : 'Decision note (optional, sent to agent if denied)'}
          </label>
          <input
            id="approval-reason"
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              language === 'id' ? 'Misal: Jalankan setelah file selesai' : 'Optional note...'
            }
            style={{
              width: '100%',
              background: 'var(--ink)',
              border: '1px solid var(--rule-strong)',
              borderRadius: 6,
              padding: '8px 10px',
            }}
          />
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 4,
          }}
        >
          <button
            type="button"
            onClick={() => onRespond(approval.id, false, reason || undefined)}
            style={{
              borderColor: 'var(--danger)',
              color: 'var(--danger)',
              fontWeight: 600,
              padding: '8px 16px',
            }}
          >
            {language === 'id' ? 'Tolak (D)' : 'Deny (D)'}
          </button>

          <button
            ref={approveBtnRef}
            type="button"
            onClick={() => onRespond(approval.id, true, reason || undefined)}
            style={{
              backgroundColor: 'var(--signal)',
              borderColor: 'var(--signal)',
              color: 'var(--ink)',
              fontWeight: 600,
              padding: '8px 18px',
            }}
          >
            {language === 'id' ? 'Setujui (A)' : 'Approve (A)'}
          </button>
        </div>
      </div>
    </div>
  );
}
