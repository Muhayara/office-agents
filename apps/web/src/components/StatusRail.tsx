import React, { useEffect, useState } from 'react';
import { GitBranch, Pause, Play, RefreshCw, ShieldAlert } from 'lucide-react';
import type { GatewayHealth, GitStatusSnapshot, Lang, Mode } from '@office/shared';
import { formatTimeShort } from '../lib/i18n';

interface StatusRailProps {
  officeName: string;
  gateway: GatewayHealth;
  gitStatus?: GitStatusSnapshot;
  mode: Mode;
  paused: boolean;
  language: Lang;
  pendingApprovalCount: number;
  wsConnected: boolean;
  role: 'ceo' | 'viewer';
  onLogout: () => void;
  onSetMode: (mode: Mode) => void;
  onTogglePause: () => void;
  onSetLanguage: (lang: Lang) => void;
  onCheckGateway: () => void;
  onOpenApprovals: () => void;
}

export function StatusRail({
  officeName,
  gateway,
  gitStatus,
  mode,
  paused,
  language,
  pendingApprovalCount,
  wsConnected,
  role,
  onLogout,
  onSetMode,
  onTogglePause,
  onSetLanguage,
  onCheckGateway,
  onOpenApprovals,
}: StatusRailProps) {
  const [clock, setClock] = useState<string>(() =>
    new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }),
  );

  useEffect(() => {
    const t = setInterval(() => {
      setClock(
        new Date().toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }),
      );
    }, 10000);
    return () => clearInterval(t);
  }, []);

  const gwColor =
    !wsConnected || gateway.status === 'offline'
      ? 'var(--danger)'
      : gateway.status === 'degraded'
        ? 'var(--warn)'
        : 'var(--ok)';

  const gwLabel = !wsConnected
    ? language === 'id'
      ? 'Server terputus'
      : 'Server disconnected'
    : gateway.status === 'online'
      ? `Gateway OK${gateway.latencyMs ? ` (${gateway.latencyMs}ms)` : ''}`
      : gateway.status === 'degraded'
        ? 'Gateway melambat'
        : 'Gateway offline';

  return (
    <header className="status-rail">
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{officeName}</span>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 13,
            color: 'var(--text-muted)',
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 8,
              height: 8,
              backgroundColor: gwColor,
              display: 'inline-block',
            }}
          />
          <span>{gwLabel}</span>
          <button
            type="button"
            onClick={onCheckGateway}
            title={language === 'id' ? 'Periksa ulang gateway' : 'Recheck gateway'}
            aria-label={language === 'id' ? 'Periksa ulang gateway' : 'Recheck gateway'}
            style={{ padding: '4px 6px', minHeight: 26 }}
          >
            <RefreshCw size={14} strokeWidth={1.5} />
          </button>
        </div>

        {gitStatus && (
          <div
            className="chip mono"
            title={
              gitStatus.pushBlocked || gitStatus.blockedReason
                ? `${language === 'id' ? 'Push tertahan' : 'Push blocked'}: ${gitStatus.blockedReason ?? 'Security block'}`
                : gitStatus.lastCommitTitle
                  ? `${gitStatus.lastCommitSha ?? ''} — ${gitStatus.lastCommitTitle}`
                  : gitStatus.lastPushAt
                    ? `${language === 'id' ? 'Push terakhir' : 'Last push'}: ${gitStatus.lastPushAt}`
                    : language === 'id'
                      ? 'Sinkronisasi Git aktif'
                      : 'Git sync active'
            }
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '3px 8px',
              fontSize: 12,
              backgroundColor: 'var(--surface-2)',
              borderColor:
                gitStatus.pushBlocked || gitStatus.blockedReason
                  ? 'var(--danger)'
                  : gitStatus.aheadCount > 0
                    ? 'var(--warn)'
                    : 'var(--rule-strong)',
              color:
                gitStatus.pushBlocked || gitStatus.blockedReason
                  ? 'var(--danger)'
                  : 'var(--text-muted)',
            }}
          >
            <GitBranch
              size={13}
              strokeWidth={1.6}
              color={
                gitStatus.pushBlocked || gitStatus.blockedReason
                  ? 'var(--danger)'
                  : gitStatus.aheadCount > 0
                    ? 'var(--warn)'
                    : 'var(--ok)'
              }
            />
            <span style={{ color: 'var(--text)', fontWeight: 600 }}>{gitStatus.branch}</span>
            {gitStatus.lastCommitSha && (
              <span style={{ color: 'var(--data)' }}>{gitStatus.lastCommitSha.slice(0, 7)}</span>
            )}
            {gitStatus.aheadCount > 0 && (
              <span style={{ color: 'var(--warn)' }}>↑{gitStatus.aheadCount}</span>
            )}
            {gitStatus.pushBlocked || gitStatus.blockedReason ? (
              <span style={{ color: 'var(--danger)', fontWeight: 600 }}>
                {language === 'id' ? 'Tertahan' : 'Blocked'}
              </span>
            ) : gitStatus.lastPushAt ? (
              <span style={{ color: 'var(--text-faint)' }}>
                {formatTimeShort(gitStatus.lastPushAt)}
              </span>
            ) : null}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {pendingApprovalCount > 0 && (
          <button
            type="button"
            onClick={onOpenApprovals}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              backgroundColor: 'var(--surface-3)',
              borderColor: 'var(--warn)',
              color: 'var(--warn)',
              fontSize: 13,
              fontWeight: 600,
              padding: '4px 10px',
            }}
          >
            <ShieldAlert size={15} strokeWidth={1.5} />
            <span>
              {language === 'id' ? 'Izin menunggu' : 'Pending approval'}:{' '}
              <span className="mono">{pendingApprovalCount}</span>
            </span>
          </button>
        )}

        <div
          className="seg-group"
          role="group"
          aria-label={language === 'id' ? 'Mode otonomi kantor' : 'Office autonomy mode'}
        >
          <button
            type="button"
            className={`seg-btn ${mode === 'semi' ? 'active' : ''}`}
            onClick={() => onSetMode('semi')}
          >
            Semi
          </button>
          <button
            type="button"
            className={`seg-btn ${mode === 'full' ? 'active' : ''}`}
            onClick={() => onSetMode('full')}
          >
            {language === 'id' ? 'Penuh' : 'Full'}
          </button>
        </div>

        <button
          type="button"
          onClick={onTogglePause}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            borderColor: paused ? 'var(--signal)' : 'var(--rule-strong)',
            color: paused ? 'var(--signal)' : 'var(--text)',
            fontSize: 13,
            padding: '4px 10px',
          }}
        >
          {paused ? <Play size={14} strokeWidth={1.5} /> : <Pause size={14} strokeWidth={1.5} />}
          <span>
            {paused
              ? language === 'id'
                ? 'Lanjutkan'
                : 'Resume'
              : language === 'id'
                ? 'Jeda semua'
                : 'Pause all'}
          </span>
        </button>

        <div className="seg-group" role="group" aria-label="Bahasa / Language">
          <button
            type="button"
            className={`seg-btn ${language === 'id' ? 'active' : ''}`}
            onClick={() => onSetLanguage('id')}
          >
            ID
          </button>
          <button
            type="button"
            className={`seg-btn ${language === 'en' ? 'active' : ''}`}
            onClick={() => onSetLanguage('en')}
          >
            EN
          </button>
        </div>

        <span className="mono" style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {clock}
        </span>

        <span className="role-chip" title={language === 'id' ? 'Peran sesi ini' : 'Session role'}>
          {role === 'ceo' ? 'CEO' : language === 'id' ? 'Pengunjung' : 'Viewer'}
        </span>
        <button type="button" onClick={onLogout} style={{ fontSize: 13, padding: '4px 10px' }}>
          {language === 'id' ? 'Keluar' : 'Sign out'}
        </button>
      </div>
    </header>
  );
}
