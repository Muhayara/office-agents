/**
 * Envelope JSON — fallback ketika model tidak mendukung native function-calling.
 *
 * Bentuk: `{ "say": string, "emotion": Emotion, "actions": Action[] }`
 * Setiap action dipetakan 1:1 ke tool kantor, sehingga server hanya punya
 * SATU eksekutor (`tools.ts`) untuk kedua jalur.
 */

import { z } from 'zod';
import { EmotionSchema } from './events';
import {
  AskHumanInput,
  ClaimTaskInput,
  CreateTaskInput,
  EditFileInput,
  EscalateInput,
  FinishInput,
  GitDiffInput,
  ListFilesInput,
  PostReportInput,
  ReadFileInput,
  RequestReviewInput,
  RunCommandInput,
  SearchFilesInput,
  SendMessageInput,
  UpdateTaskInput,
  WriteFileInput,
  type ToolName,
} from './tools';

/* ------------------------------------------------------------------ */
/* Aksi                                                                */
/* ------------------------------------------------------------------ */

export const EnvelopeActionSchema = z.discriminatedUnion('type', [
  SendMessageInput.extend({ type: z.literal('SEND_MESSAGE') }),
  CreateTaskInput.extend({ type: z.literal('CREATE_TASK') }),
  ClaimTaskInput.extend({ type: z.literal('CLAIM_TASK') }),
  UpdateTaskInput.extend({ type: z.literal('UPDATE_TASK') }),
  PostReportInput.extend({ type: z.literal('POST_REPORT') }),
  RequestReviewInput.extend({ type: z.literal('REQUEST_REVIEW') }),
  AskHumanInput.extend({ type: z.literal('ASK_HUMAN') }),
  EscalateInput.extend({ type: z.literal('ESCALATE') }),
  WriteFileInput.extend({ type: z.literal('WRITE_FILE') }),
  EditFileInput.extend({ type: z.literal('EDIT_FILE') }),
  ReadFileInput.extend({ type: z.literal('READ_FILE') }),
  ListFilesInput.extend({ type: z.literal('LIST_FILES') }),
  SearchFilesInput.extend({ type: z.literal('SEARCH_FILES') }),
  GitDiffInput.extend({ type: z.literal('GIT_DIFF') }),
  RunCommandInput.extend({ type: z.literal('RUN_COMMAND') }),
  FinishInput.extend({ type: z.literal('FINISH') }),
]);
export type EnvelopeAction = z.infer<typeof EnvelopeActionSchema>;
export type EnvelopeActionType = EnvelopeAction['type'];

export const ENVELOPE_MAX_ACTIONS = 12;

export const EnvelopeSchema = z.object({
  say: z.string().max(2000).default(''),
  emotion: EmotionSchema.default('neutral'),
  actions: z.array(EnvelopeActionSchema).max(ENVELOPE_MAX_ACTIONS).default([]),
});
export type Envelope = z.infer<typeof EnvelopeSchema>;

/* ------------------------------------------------------------------ */
/* Pemetaan aksi -> tool                                               */
/* ------------------------------------------------------------------ */

export const ACTION_TO_TOOL: Record<EnvelopeActionType, ToolName> = {
  SEND_MESSAGE: 'send_message',
  CREATE_TASK: 'create_task',
  CLAIM_TASK: 'claim_task',
  UPDATE_TASK: 'update_task',
  POST_REPORT: 'post_report',
  REQUEST_REVIEW: 'request_review',
  ASK_HUMAN: 'ask_human',
  ESCALATE: 'escalate',
  WRITE_FILE: 'write_file',
  EDIT_FILE: 'edit_file',
  READ_FILE: 'read_file',
  LIST_FILES: 'list_files',
  SEARCH_FILES: 'search_files',
  GIT_DIFF: 'git_diff',
  RUN_COMMAND: 'run_command',
  FINISH: 'finish',
};

export type ToolCallFromAction = {
  name: ToolName;
  input: Record<string, unknown>;
};

export function actionToToolCall(action: EnvelopeAction): ToolCallFromAction {
  const input: Record<string, unknown> = { ...action };
  delete input.type;
  return { name: ACTION_TO_TOOL[action.type], input };
}

export function actionsToToolCalls(actions: EnvelopeAction[]): ToolCallFromAction[] {
  return actions.map(actionToToolCall);
}

/* ------------------------------------------------------------------ */
/* Ekstraksi dari teks                                                 */
/* ------------------------------------------------------------------ */

export type EnvelopeParseResult =
  | { ok: true; envelope: Envelope; json: string }
  | { ok: false; error: string; raw: string };

/** Cari indeks `}` pasangan dari `{` di `start`, dengan sadar-string. */
function findMatchingBrace(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const char = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Ambil objek JSON pertama dari teks model.
 *
 * Toleran terhadap pagar markdown, kalimat pembuka, dan teks penutup.
 * Tidak memperbaiki JSON rusak — kegagalan dikembalikan agar server dapat
 * mengirim satu kali instruksi perbaikan.
 */
export function extractEnvelope(text: string): EnvelopeParseResult {
  const raw = text.trim();
  if (!raw) {
    return { ok: false, error: 'teks kosong', raw };
  }

  const start = raw.indexOf('{');
  if (start === -1) {
    return { ok: false, error: 'tidak ada objek JSON pada balasan', raw };
  }

  const end = findMatchingBrace(raw, start);
  if (end === -1) {
    return { ok: false, error: 'objek JSON tidak ditutup', raw };
  }

  const json = raw.slice(start, end + 1);
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `JSON tidak valid: ${message}`, raw };
  }

  const result = EnvelopeSchema.safeParse(parsed);
  if (!result.success) {
    const message = result.error.issues
      .map((issue) => {
        const path = issue.path.map((part) => String(part)).join('.');
        return path ? `${path}: ${issue.message}` : issue.message;
      })
      .join('; ');
    return { ok: false, error: `skema envelope tidak cocok: ${message}`, raw };
  }

  return { ok: true, envelope: result.data, json };
}

/* ------------------------------------------------------------------ */
/* Instruksi untuk system prompt                                       */
/* ------------------------------------------------------------------ */

export const ENVELOPE_INSTRUCTION_ID = `Mode JSON: balas HANYA satu objek, tanpa teks di luar JSON.
{"say":"ringkas","emotion":"neutral|focused|happy|concerned|blocked|proud|confused","actions":[{"type":"CREATE_TASK","title":"...","assignee":"bima","details":"..."}]}
Tipe aksi: SEND_MESSAGE, CREATE_TASK, CLAIM_TASK, UPDATE_TASK, POST_REPORT, REQUEST_REVIEW, ASK_HUMAN, ESCALATE, WRITE_FILE, EDIT_FILE, READ_FILE, LIST_FILES, SEARCH_FILES, GIT_DIFF, RUN_COMMAND, FINISH.
Maksimal 6 aksi. Jangan mengarang status atau hasil tool.`;

export const ENVELOPE_INSTRUCTION_EN = `JSON mode: reply with exactly one object and nothing outside it.
{"say":"short","emotion":"neutral|focused|happy|concerned|blocked|proud|confused","actions":[{"type":"CREATE_TASK","title":"...","assignee":"bima","details":"..."}]}
Action types: SEND_MESSAGE, CREATE_TASK, CLAIM_TASK, UPDATE_TASK, POST_REPORT, REQUEST_REVIEW, ASK_HUMAN, ESCALATE, WRITE_FILE, EDIT_FILE, READ_FILE, LIST_FILES, SEARCH_FILES, GIT_DIFF, RUN_COMMAND, FINISH.
Maximum 6 actions. Never invent status or tool results.`;

export const REPAIR_INSTRUCTION_ID =
  'JSON sebelumnya tidak valid ({error}). Kirim ulang HANYA objek JSON yang valid, tanpa penjelasan.';

export const REPAIR_INSTRUCTION_EN =
  'The previous JSON was invalid ({error}). Resend ONLY valid JSON, with no explanation.';

export function envelopeInstruction(lang: 'id' | 'en'): string {
  return lang === 'id' ? ENVELOPE_INSTRUCTION_ID : ENVELOPE_INSTRUCTION_EN;
}

export function repairInstruction(lang: 'id' | 'en', error: string): string {
  const template = lang === 'id' ? REPAIR_INSTRUCTION_ID : REPAIR_INSTRUCTION_EN;
  return template.replace('{error}', error.slice(0, 300));
}
