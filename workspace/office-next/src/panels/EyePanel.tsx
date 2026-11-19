import type { AgentView, Lang, Task } from '@office/shared';
import { roleLabel } from '@office/shared';
import type { EyeInfo } from '../stage/IsometricOfficeStage';
import { STATUS_LABELS } from './InspectorPanel';

/**
 * F3 — HUD Mata Agen (rencana §4 F3): subtitle ucapan agen yang diikuti (pengganti bubble-nya) dan panel kecil
 * kiri bawah berisi nama · peran · status · ruangan · tugas (sesuai hak peran, K9) · baris bicara terakhir,
 * plus ←/→, "Goyang kepala", dan Keluar (Esc). Teks selalu lewat React (textContent), tidak pernah HTML.
 */
export interface EyePanelProps {
  info: EyeInfo;
  agent?: AgentView;
  tasks: Task[];
  /** Publik / tamu: tanpa judul tugas (K9). */
  showTask: boolean;
  language: Lang;
  headBob: boolean;
  /** `prefers-reduced-motion`: goyang kepala dimatikan sistem. */
  reducedMotion: boolean;
  onToggleBob: () => void;
  onCycle: (dir: 1 | -1) => void;
  onExit: () => void;
}

const btn: React.CSSProperties = { padding: '4px 10px', minHeight: 28, fontSize: 12 };

export function EyePanel({ info, agent, tasks, showTask, language, headBob, reducedMotion, onToggleBob, onCycle, onExit }: EyePanelProps) {
  const t = (id: string, en: string) => (language === 'id' ? id : en);
  const name = agent?.name ?? info.agentId;
  const task = showTask && agent?.currentTaskId ? tasks.find((x) => x.id === agent.currentTaskId) : undefined;
  const bobOn = headBob && !reducedMotion;
  return (
    <div
      style={{
        position: 'absolute', left: 16, right: 16, bottom: 14, zIndex: 10,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, pointerEvents: 'none',
      }}
    >
      {info.speaking && (
        <div
          role="status"
          aria-live="polite"
          style={{
            maxWidth: 'min(640px, 100%)', padding: '6px 14px', borderRadius: 6, fontSize: 14, lineHeight: 1.4,
            background: 'rgba(5, 9, 12, 0.82)', color: '#f1f5f9', textAlign: 'center',
            borderBottom: `2px solid ${agent?.color ?? 'var(--color-focus)'}`,
          }}
        >
          <strong style={{ color: agent?.color }}>{name}:</strong> {info.speaking}
        </div>
      )}
      <section
        aria-label={t(`Mata Agen: ${name}`, `Agent Eyes: ${name}`)}
        style={{
          alignSelf: 'flex-start', pointerEvents: 'auto', maxWidth: 'min(380px, 100%)',
          display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 12px',
          background: 'rgba(15, 26, 31, 0.94)', border: '1px solid var(--color-rule)', borderRadius: 8,
          borderLeft: `3px solid ${agent?.color ?? 'var(--color-focus)'}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span className="mono small" style={{ color: 'var(--color-focus)' }}>{t('MATA AGEN', 'AGENT EYES')}</span>
          <strong style={{ fontSize: 15, color: agent?.color }}>{name}</strong>
          {agent && <span className="small muted">{agent.title ?? roleLabel(agent.role, language)}</span>}
        </div>
        <div className="small">
          {agent ? STATUS_LABELS[language][agent.status] : '—'} · {info.room}
        </div>
        {task && (
          <div className="small">
            {t('Tugas: ', 'Task: ')}<strong>{task.title}</strong>
          </div>
        )}
        {info.lastLine && (
          <div className="small muted" style={{ fontStyle: 'italic' }}>“{info.lastLine}”</div>
        )}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button type="button" style={btn} onClick={() => onCycle(-1)} title={t('Agen sebelumnya (←)', 'Previous agent (←)')} aria-label={t('Agen sebelumnya', 'Previous agent')}>←</button>
          <button type="button" style={btn} onClick={() => onCycle(1)} title={t('Agen berikutnya (→)', 'Next agent (→)')} aria-label={t('Agen berikutnya', 'Next agent')}>→</button>
          <button
            type="button"
            style={btn}
            onClick={onToggleBob}
            disabled={reducedMotion}
            aria-pressed={bobOn}
            title={reducedMotion ? t('Dimatikan oleh pengaturan "kurangi gerakan" sistem', 'Disabled by the system "reduce motion" setting') : t('Ayunan kamera saat agen berjalan', 'Camera sway while the agent walks')}
          >
            {t('Goyang kepala: ', 'Head bob: ')}{bobOn ? t('Nyala', 'On') : t('Mati', 'Off')}
          </button>
          <button type="button" style={{ ...btn, borderColor: 'var(--color-focus)', color: 'var(--color-focus)' }} onClick={onExit}>
            {t('Keluar (Esc)', 'Exit (Esc)')}
          </button>
        </div>
      </section>
    </div>
  );
}
