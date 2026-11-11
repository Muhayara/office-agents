/**
 * @office/shared — kontrak data Office Agents.
 *
 * Satu sumber untuk: event wire, command klien, konfigurasi kursi, tool kantor,
 * dan envelope JSON fallback. Tanpa I/O, tanpa logika bisnis.
 *
 * Versi skema naik ketika bentuk wire berubah; lihat `SCHEMA_VERSION`.
 */

export * from './events';
export * from './config';
export * from './tools';
export * from './envelope';

import type { AgentRole, Lang, TaskStatus } from './events';
import { TASK_STATUSES } from './events';

/** Versi kontrak wire. Breaking change = minor, penambahan field opsional = patch. */
export const SCHEMA_VERSION = '1.1.0';

/** Nama paket; dipakai di log bootstrap. */
export const SHARED_PACKAGE_NAME = '@office/shared';

/** Urutan kolom Kanban (kiri ke kanan). */
export const TASK_STATUS_ORDER: readonly TaskStatus[] = TASK_STATUSES;

/**
 * Transisi status tugas yang sah.
 * `done` bersifat terminal; buka kembali dengan membuat tugas baru.
 */
export const TASK_TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  todo: ['in_progress', 'blocked'],
  in_progress: ['review', 'done', 'blocked'],
  review: ['in_progress', 'done', 'blocked'],
  blocked: ['todo', 'in_progress'],
  done: [],
};

export function canTransitionTask(from: TaskStatus, to: TaskStatus): boolean {
  return TASK_TRANSITIONS[from].includes(to);
}

/** Label peran untuk UI. */
export const ROLE_LABELS: Record<Lang, Record<AgentRole, string>> = {
  id: {
    manager: 'Manajer',
    researcher: 'Peneliti',
    writer: 'Penulis',
    coder: 'Programmer',
    reviewer: 'Reviewer',
    gamedev: 'Game Dev 2.5D',
    artist: 'Artis Visual',
    visual_qa: 'Penguji Visual',
    security: 'Keamanan',
    designer: 'Desainer UI/UX',
  },
  en: {
    manager: 'Manager',
    researcher: 'Researcher',
    writer: 'Writer',
    coder: 'Programmer',
    reviewer: 'Reviewer',
    gamedev: '2.5D Game Dev',
    artist: 'Technical Artist',
    visual_qa: 'Visual QA',
    security: 'Security',
    designer: 'UI/UX Designer',
  },
};

export function roleLabel(role: AgentRole, lang: Lang): string {
  return ROLE_LABELS[lang][role];
}

/**
 * Menghilangkan prefix rute gateway pertama pada ID model untuk tampilan publik/UI:
 * - "ag/gemini-3.8-flash-high" -> "gemini-3.8-flash-high"
 * - "groq/openai/gpt-oss-120b" -> "openai/gpt-oss-120b"
 */
export function formatPublicModelName(model: string): string {
  const slashIdx = model.indexOf('/');
  return slashIdx > 0 ? model.slice(slashIdx + 1) : model;
}

/** Peran yang diizinkan menulis/mengedit file di workspace (dipakai guard tool di server). */
export const FILE_WRITING_ROLES: readonly AgentRole[] = [
  'writer',
  'coder',
  'gamedev',
  'artist',
  'designer',
];

/** Peran yang diizinkan memanggil `run_command` di workspace. */
export const COMMAND_ROLES: readonly AgentRole[] = [
  'coder',
  'gamedev',
  'artist',
  'designer',
  'visual_qa',
];

/** Peran yang diizinkan memanggil `security_scan` dan memveto push. */
export const SECURITY_SCAN_ROLES: readonly AgentRole[] = ['security'];

/** Peran yang diizinkan menjalankan pemeriksaan visual Playwright ter-allowlist tanpa spam approval manual. */
export const PLAYWRIGHT_AUTO_APPROVE_ROLES: readonly AgentRole[] = ['visual_qa'];

/** Peran yang wajib ada di setiap kantor. */
export const REQUIRED_ROLES: readonly AgentRole[] = ['manager', 'reviewer'];
