/**
 * Tool kantor — satu definisi, dua jalur.
 *
 * - `input`  : skema Zod untuk memvalidasi argumen dari model (native tool-calling
 *              maupun envelope JSON).
 * - `jsonSchema`: JSON Schema yang dikirim ke provider lewat `tools`.
 *
 * Deskripsi tool sengaja berbahasa Inggris karena model umumnya lebih andal
 * memetakan tool-calling berbahasa Inggris; prompt peran tetap ID/EN.
 *
 * `run_command` selalu `requiresApproval: true` — server wajib membuat baris
 * `approvals` sebelum mengeksekusi, di mode semi maupun penuh.
 */

import { z } from 'zod';
import {
  TaskPrioritySchema,
  TaskStatusSchema,
  TaskIdSchema,
  AgentIdSchema,
  IdSchema,
  WorkspacePathSchema,
} from './events';

/* ------------------------------------------------------------------ */
/* Input                                                               */
/* ------------------------------------------------------------------ */

const TargetSchema = z
  .string()
  .min(1)
  .max(64)
  .describe('Agent id, "ceo", or "all".');

export const SendMessageInput = z.object({
  to: TargetSchema,
  text: z.string().min(1).max(2000),
});
export type SendMessageInput = z.infer<typeof SendMessageInput>;

export const ReadInboxInput = z.object({
  limit: z.number().int().min(1).max(50).default(20),
  markRead: z.boolean().default(true),
});
export type ReadInboxInput = z.infer<typeof ReadInboxInput>;

export const ListTeamInput = z.object({});
export type ListTeamInput = z.infer<typeof ListTeamInput>;

export const CreateTaskInput = z.object({
  title: z.string().min(1).max(160),
  assignee: AgentIdSchema,
  details: z.string().max(2000).default(''),
  parentId: TaskIdSchema.optional(),
  priority: TaskPrioritySchema.default('normal'),
});
export type CreateTaskInput = z.infer<typeof CreateTaskInput>;

export const ClaimTaskInput = z.object({ taskId: TaskIdSchema });
export type ClaimTaskInput = z.infer<typeof ClaimTaskInput>;

export const UpdateTaskInput = z.object({
  taskId: TaskIdSchema,
  status: TaskStatusSchema,
  note: z.string().max(500).optional(),
});
export type UpdateTaskInput = z.infer<typeof UpdateTaskInput>;

export const ListTasksInput = z.object({
  status: TaskStatusSchema.optional(),
  assignee: AgentIdSchema.optional(),
  projectId: IdSchema.optional(),
});
export type ListTasksInput = z.infer<typeof ListTasksInput>;

export const PostReportInput = z.object({
  taskId: TaskIdSchema,
  summary: z.string().min(1).max(4000),
  files: z.array(WorkspacePathSchema).max(50).default([]),
});
export type PostReportInput = z.infer<typeof PostReportInput>;

export const RequestReviewInput = z.object({
  taskId: TaskIdSchema,
  to: AgentIdSchema,
});
export type RequestReviewInput = z.infer<typeof RequestReviewInput>;

export const AskHumanInput = z.object({
  question: z.string().min(1).max(1000),
  taskId: TaskIdSchema.optional(),
});
export type AskHumanInput = z.infer<typeof AskHumanInput>;

export const EscalateInput = z.object({
  taskId: TaskIdSchema,
  reason: z.string().min(1).max(1000),
});
export type EscalateInput = z.infer<typeof EscalateInput>;

export const WriteFileInput = z.object({
  path: WorkspacePathSchema,
  content: z.string().max(256_000),
});
export type WriteFileInput = z.infer<typeof WriteFileInput>;

export const EditFileInput = z.object({
  path: WorkspacePathSchema,
  /** Teks lama yang harus ada persis (bukan regex). */
  oldText: z.string().min(1).max(20_000),
  newText: z.string().max(20_000),
  replaceAll: z.boolean().default(false),
});
export type EditFileInput = z.infer<typeof EditFileInput>;

export const ReadFileInput = z.object({
  path: WorkspacePathSchema,
  maxBytes: z.number().int().min(1).max(1_000_000).default(65_536),
});
export type ReadFileInput = z.infer<typeof ReadFileInput>;

export const ListFilesInput = z.object({
  dir: WorkspacePathSchema.default('.'),
  depth: z.number().int().min(1).max(6).default(2),
});
export type ListFilesInput = z.infer<typeof ListFilesInput>;

export const SearchFilesInput = z.object({
  query: z.string().min(1).max(200),
  glob: z.string().max(120).optional(),
  maxResults: z.number().int().min(1).max(200).default(50),
});
export type SearchFilesInput = z.infer<typeof SearchFilesInput>;

export const GitDiffInput = z.object({
  staged: z.boolean().default(false),
  base: z.string().max(120).optional(),
  head: z.string().max(120).optional(),
  path: WorkspacePathSchema.optional(),
});
export type GitDiffInput = z.infer<typeof GitDiffInput>;

export const RunCommandInput = z.object({
  /** Nama executable tanpa argumen, mis. "npm". */
  command: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[A-Za-z0-9._-]+$/, 'command hanya nama executable tanpa spasi'),
  args: z.array(z.string().max(200)).max(20).default([]),
  cwd: WorkspacePathSchema.optional(),
  reason: z.string().max(500).optional(),
});
export type RunCommandInput = z.infer<typeof RunCommandInput>;

export const FinishInput = z.object({
  summary: z.string().max(1000).optional(),
});
export type FinishInput = z.infer<typeof FinishInput>;

/* ------------------------------------------------------------------ */
/* Nama & kategori                                                     */
/* ------------------------------------------------------------------ */

export const TOOL_NAMES = [
  'send_message',
  'read_inbox',
  'list_team',
  'create_task',
  'claim_task',
  'update_task',
  'list_tasks',
  'post_report',
  'request_review',
  'ask_human',
  'escalate',
  'write_file',
  'edit_file',
  'read_file',
  'list_files',
  'search_files',
  'git_diff',
  'run_command',
  'finish',
] as const;
export type ToolName = (typeof TOOL_NAMES)[number];

export const TOOL_CATEGORIES = ['bus', 'task', 'file', 'shell', 'control'] as const;
export type ToolCategory = (typeof TOOL_CATEGORIES)[number];

export const TOOL_NAME_SET: ReadonlySet<string> = new Set(TOOL_NAMES);

export function isToolName(value: string): value is ToolName {
  return TOOL_NAME_SET.has(value);
}

/* ------------------------------------------------------------------ */
/* Definisi                                                            */
/* ------------------------------------------------------------------ */

export type JsonSchema = {
  type: 'object';
  properties: Record<string, unknown>;
  required: string[];
  additionalProperties: false;
};

type JsonSchemaValue = Record<string, unknown>;

const str = (description: string, extra: JsonSchemaValue = {}): JsonSchemaValue => ({
  type: 'string',
  description,
  ...extra,
});
const num = (description: string, extra: JsonSchemaValue = {}): JsonSchemaValue => ({
  type: 'number',
  description,
  ...extra,
});
const bool = (description: string): JsonSchemaValue => ({
  type: 'boolean',
  description,
});
const arr = (
  items: JsonSchemaValue,
  description: string,
  extra: JsonSchemaValue = {},
): JsonSchemaValue => ({ type: 'array', items, description, ...extra });
const obj = (
  properties: Record<string, unknown>,
  required: string[] = [],
): JsonSchema => ({ type: 'object', properties, required, additionalProperties: false });

/** Struktur minimal agar tidak bergantung pada tipe internal Zod versi tertentu. */
export interface ToolInputSchema {
  safeParse(input: unknown):
    | { success: true; data: unknown }
    | {
        success: false;
        error: {
          issues: ReadonlyArray<{
            path: ReadonlyArray<unknown>;
            message: string;
          }>;
        };
      };
}

export interface ToolDefinition {
  name: ToolName;
  description: string;
  category: ToolCategory;
  requiresApproval: boolean;
  input: ToolInputSchema;
  jsonSchema: JsonSchema;
}

export const TOOL_DEFINITIONS: readonly ToolDefinition[] = [
  {
    name: 'send_message',
    description: 'Send a short message to another agent, "ceo", or "all".',
    category: 'bus',
    requiresApproval: false,
    input: SendMessageInput,
    jsonSchema: obj(
      {
        to: str('Agent id, "ceo", or "all".'),
        text: str('Message body, at most 2000 characters.'),
      },
      ['to', 'text'],
    ),
  },
  {
    name: 'read_inbox',
    description: 'Read unread messages for this agent and mark them as read.',
    category: 'bus',
    requiresApproval: false,
    input: ReadInboxInput,
    jsonSchema: obj({
      limit: num('Maximum messages to return (1-50).'),
      markRead: bool('Mark returned messages as read.'),
    }),
  },
  {
    name: 'list_team',
    description: 'List every employee with role, status, and current task.',
    category: 'bus',
    requiresApproval: false,
    input: ListTeamInput,
    jsonSchema: obj({}),
  },
  {
    name: 'create_task',
    description: 'Create a small child task and assign it to one employee.',
    category: 'task',
    requiresApproval: false,
    input: CreateTaskInput,
    jsonSchema: obj(
      {
        title: str('Specific, actionable title (max 160).'),
        assignee: str('Agent id that will do the work.'),
        details: str('Context and acceptance criteria (max 2000).'),
        parentId: str('Parent task id, if this is a subtask.'),
        priority: str('low, normal, or high.', { enum: ['low', 'normal', 'high'] }),
      },
      ['title', 'assignee'],
    ),
  },
  {
    name: 'claim_task',
    description: 'Claim a task in "todo" status so you own it.',
    category: 'task',
    requiresApproval: false,
    input: ClaimTaskInput,
    jsonSchema: obj({ taskId: str('Task id.') }, ['taskId']),
  },
  {
    name: 'update_task',
    description: 'Move a task to another status with an optional note.',
    category: 'task',
    requiresApproval: false,
    input: UpdateTaskInput,
    jsonSchema: obj(
      {
        taskId: str('Task id.'),
        status: str('todo, in_progress, review, done, or blocked.', {
          enum: ['todo', 'in_progress', 'review', 'done', 'blocked'],
        }),
        note: str('Short explanation for the status change.'),
      },
      ['taskId', 'status'],
    ),
  },
  {
    name: 'list_tasks',
    description: 'List tasks, optionally filtered by status, assignee, or project.',
    category: 'task',
    requiresApproval: false,
    input: ListTasksInput,
    jsonSchema: obj({
      status: str('Filter by status.', {
        enum: ['todo', 'in_progress', 'review', 'done', 'blocked'],
      }),
      assignee: str('Filter by agent id.'),
      projectId: str('Filter by project id.'),
    }),
  },
  {
    name: 'post_report',
    description: 'Post a work report for a task, including produced files.',
    category: 'task',
    requiresApproval: false,
    input: PostReportInput,
    jsonSchema: obj(
      {
        taskId: str('Task id.'),
        summary: str('What was done, what changed, what is left (max 4000).'),
        files: arr(str('Relative path inside the workspace.'), 'Files produced.'),
      },
      ['taskId', 'summary'],
    ),
  },
  {
    name: 'request_review',
    description: 'Request a review for a task from a specific reviewer.',
    category: 'task',
    requiresApproval: false,
    input: RequestReviewInput,
    jsonSchema: obj(
      {
        taskId: str('Task id.'),
        to: str('Reviewer agent id.'),
      },
      ['taskId', 'to'],
    ),
  },
  {
    name: 'ask_human',
    description: 'Ask the CEO a question when the request is ambiguous or blocked.',
    category: 'bus',
    requiresApproval: false,
    input: AskHumanInput,
    jsonSchema: obj(
      {
        question: str('One clear question.'),
        taskId: str('Related task id, if any.'),
      },
      ['question'],
    ),
  },
  {
    name: 'escalate',
    description: 'Escalate a stuck task to the CEO with a reason.',
    category: 'bus',
    requiresApproval: false,
    input: EscalateInput,
    jsonSchema: obj(
      {
        taskId: str('Task id.'),
        reason: str('Why escalation is needed.'),
      },
      ['taskId', 'reason'],
    ),
  },
  {
    name: 'write_file',
    description: 'Create or replace a file inside your workspace.',
    category: 'file',
    requiresApproval: false,
    input: WriteFileInput,
    jsonSchema: obj(
      {
        path: str('Relative path inside the workspace.'),
        content: str('Full file content (max 256 KB).'),
      },
      ['path', 'content'],
    ),
  },
  {
    name: 'edit_file',
    description: 'Replace an exact substring in a file; safer than rewriting it.',
    category: 'file',
    requiresApproval: false,
    input: EditFileInput,
    jsonSchema: obj(
      {
        path: str('Relative path inside the workspace.'),
        oldText: str('Exact text that must exist in the file.'),
        newText: str('Replacement text; may be empty to delete.'),
        replaceAll: bool('Replace every occurrence instead of the first.'),
      },
      ['path', 'oldText', 'newText'],
    ),
  },
  {
    name: 'read_file',
    description: 'Read a file from your workspace.',
    category: 'file',
    requiresApproval: false,
    input: ReadFileInput,
    jsonSchema: obj(
      {
        path: str('Relative path inside the workspace.'),
        maxBytes: num('Maximum bytes to return (1-1000000).'),
      },
      ['path'],
    ),
  },
  {
    name: 'list_files',
    description: 'List files and directories under a workspace path.',
    category: 'file',
    requiresApproval: false,
    input: ListFilesInput,
    jsonSchema: obj({
      dir: str('Relative directory; defaults to "."'),
      depth: num('Recursion depth (1-6).'),
    }),
  },
  {
    name: 'search_files',
    description: 'Search file contents in the workspace for a literal string.',
    category: 'file',
    requiresApproval: false,
    input: SearchFilesInput,
    jsonSchema: obj(
      {
        query: str('Literal text to search for.'),
        glob: str('Optional glob filter, e.g. "**/*.ts".'),
        maxResults: num('Maximum matches (1-200).'),
      },
      ['query'],
    ),
  },
  {
    name: 'git_diff',
    description: 'Show the current git diff of the workspace.',
    category: 'file',
    requiresApproval: false,
    input: GitDiffInput,
    jsonSchema: obj({
      staged: bool('Show staged changes only.'),
      base: str('Base revision or branch.'),
      head: str('Head revision or branch.'),
      path: str('Limit the diff to one relative path.'),
    }),
  },
  {
    name: 'run_command',
    description: 'Run a terminal command in the workspace. Requires CEO approval.',
    category: 'shell',
    requiresApproval: true,
    input: RunCommandInput,
    jsonSchema: obj(
      {
        command: str('Executable name only, no spaces (e.g. "npm").'),
        args: arr(str('One argument.'), 'Arguments passed to the executable.'),
        cwd: str('Working directory inside the workspace.'),
        reason: str('Why this command is needed.'),
      },
      ['command'],
    ),
  },
  {
    name: 'finish',
    description: 'End your turn. Call this when your part is done.',
    category: 'control',
    requiresApproval: false,
    input: FinishInput,
    jsonSchema: obj({
      summary: str('One-line summary of what you did.'),
    }),
  },
];

export const TOOLS_BY_NAME: Record<ToolName, ToolDefinition> = Object.fromEntries(
  TOOL_DEFINITIONS.map((tool) => [tool.name, tool]),
) as Record<ToolName, ToolDefinition>;

export const APPROVAL_REQUIRED_TOOLS: readonly ToolName[] = TOOL_DEFINITIONS.filter(
  (tool) => tool.requiresApproval,
).map((tool) => tool.name);

/* ------------------------------------------------------------------ */
/* Helper                                                              */
/* ------------------------------------------------------------------ */

export type ValidateToolResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string };

export function validateToolInput(name: ToolName, input: unknown): ValidateToolResult {
  const definition = TOOLS_BY_NAME[name];
  const result = definition.input.safeParse(input);
  if (result.success) {
    return { ok: true, data: result.data };
  }
  const message = result.error.issues
    .map((issue) => {
      const path = issue.path.map((part) => String(part)).join('.');
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join('; ');
  return { ok: false, error: message || 'input tidak valid' };
}

export type OpenAITool = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: JsonSchema;
  };
};

/** Bentuk `tools` untuk OpenAI-compatible chat completions. */
export function toOpenAITools(
  tools: readonly ToolDefinition[] = TOOL_DEFINITIONS,
): OpenAITool[] {
  return tools.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.jsonSchema,
    },
  }));
}
