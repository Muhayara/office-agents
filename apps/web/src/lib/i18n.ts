import type { AgentStatus, Lang, TaskStatus } from '@office/shared';

export const STATUS_LABELS: Record<Lang, Record<AgentStatus, string>> = {
  id: {
    idle: 'Menganggur',
    thinking: 'Berpikir',
    working: 'Bekerja',
    messaging: 'Mengirim pesan',
    meeting: 'Rapat',
    waiting_approval: 'Menunggu izin',
    error: 'Gagal',
    offline: 'Offline',
  },
  en: {
    idle: 'Idle',
    thinking: 'Thinking',
    working: 'Working',
    messaging: 'Messaging',
    meeting: 'In meeting',
    waiting_approval: 'Waiting approval',
    error: 'Error',
    offline: 'Offline',
  },
};

export const TASK_STATUS_LABELS: Record<Lang, Record<TaskStatus, string>> = {
  id: {
    todo: 'Antre (todo)',
    in_progress: 'Dikerjakan (doing)',
    review: 'Periksa (review)',
    done: 'Selesai (done)',
    blocked: 'Tertahan (blocked)',
  },
  en: {
    todo: 'Todo',
    in_progress: 'In progress',
    review: 'Review',
    done: 'Done',
    blocked: 'Blocked',
  },
};

export function statusColorVar(status: AgentStatus): string {
  switch (status) {
    case 'idle':
    case 'offline':
      return 'var(--text-faint)';
    case 'thinking':
      return 'var(--data)';
    case 'working':
      return 'var(--ok)';
    case 'messaging':
      return 'var(--signal)';
    case 'meeting':
      return 'var(--a-sari)';
    case 'waiting_approval':
      return 'var(--warn)';
    case 'error':
      return 'var(--danger)';
  }
}

export function formatTimeShort(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return '--:--:--';
  }
}
