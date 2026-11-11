import React from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Circle,
  Minus,
  Square,
  StopCircle,
  Users,
  XCircle,
} from 'lucide-react';
import {
  type AgentStatus,
  type AgentView,
  type Lang,
  formatPublicModelName,
  roleLabel,
} from '@office/shared';
import { STATUS_LABELS, statusColorVar } from '../lib/i18n';
import { Tick } from './Tick';

interface RosterRowProps {
  agent: AgentView;
  language: Lang;
  selected: boolean;
  onSelect: (agentId: string) => void;
  onPickTarget: (agentId: string) => void;
  onStopAgent: (agentId: string) => void;
}

function StatusGlyph({ status }: { status: AgentStatus }) {
  const color = statusColorVar(status);
  switch (status) {
    case 'idle':
      return <Circle size={12} strokeWidth={1.5} color={color} />;
    case 'thinking':
      return (
        <span className="pulse-thinking mono" style={{ color, fontSize: 12, fontWeight: 600 }}>
          ...
        </span>
      );
    case 'working':
      return <Square size={12} strokeWidth={1.5} fill={color} color={color} />;
    case 'messaging':
      return <ArrowUpRight size={13} strokeWidth={1.5} color={color} />;
    case 'meeting':
      return <Users size={13} strokeWidth={1.5} color={color} />;
    case 'waiting_approval':
      return <AlertTriangle size={13} strokeWidth={1.5} color={color} />;
    case 'error':
      return <XCircle size={13} strokeWidth={1.5} color={color} />;
    case 'offline':
      return <Minus size={13} strokeWidth={1.5} color={color} />;
  }
}

export function RosterRow({
  agent,
  language,
  selected,
  onSelect,
  onPickTarget,
  onStopAgent,
}: RosterRowProps) {
  const isBusy =
    agent.status === 'thinking' ||
    agent.status === 'working' ||
    agent.status === 'messaging' ||
    agent.status === 'waiting_approval';

  return (
    <div
      role="button"
      tabIndex={0}
      className={`roster-row ${selected ? 'selected' : ''} ${agent.status === 'offline' ? 'offline' : ''}`}
      onClick={() => onSelect(agent.id)}
      onDoubleClick={() => onPickTarget(agent.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSelect(agent.id);
        if (e.key === ' ') {
          e.preventDefault();
          onPickTarget(agent.id);
        }
      }}
      title={
        agent.offlineReason
          ? `${agent.name}: ${agent.offlineReason}`
          : language === 'id'
            ? 'Klik untuk detail, klik ganda untuk kirim perintah ke kursi ini'
            : 'Click for details, double-click to target in composer'
      }
    >
      <span
        className="roster-edge"
        style={{
          backgroundColor: agent.color,
          width: selected ? 4 : 3,
        }}
      />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: selected || isBusy ? agent.color : 'var(--text)',
            }}
          >
            {agent.name}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {roleLabel(agent.role, language)}
          </span>
        </div>

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <StatusGlyph status={agent.status} />
          <span style={{ fontSize: 12, color: statusColorVar(agent.status) }}>
            {STATUS_LABELS[language][agent.status]}
          </span>
          {isBusy && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onStopAgent(agent.id);
              }}
              title={language === 'id' ? 'Hentikan giliran' : 'Stop turn'}
              aria-label={language === 'id' ? `Hentikan ${agent.name}` : `Stop ${agent.name}`}
              style={{ padding: '2px 4px', minHeight: 22 }}
            >
              <StopCircle size={12} strokeWidth={1.5} color="var(--danger)" />
            </button>
          )}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <span
          className="mono"
          style={{
            fontSize: 11,
            color: 'var(--text-faint)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: 96,
          }}
        >
          {formatPublicModelName(agent.model)}
        </span>
        <Tick used={agent.quota.used} cap={agent.quota.cap} />
      </div>

      <div
        style={{
          fontSize: 12,
          color: agent.currentTaskTitle ? 'var(--text-muted)' : 'var(--text-faint)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {agent.currentTaskTitle
          ? `${language === 'id' ? 'Tugas' : 'Task'}: ${agent.currentTaskTitle}`
          : agent.offlineReason || (language === 'id' ? 'Siap menerima perintah' : 'Ready for work')}
      </div>
    </div>
  );
}
