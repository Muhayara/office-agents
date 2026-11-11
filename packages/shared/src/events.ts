/**
 * Wire protocol Office Agents.
 *
 * Server -> klien: `ServerEvent` (discriminated union pada `type`).
 * Klien -> server: `ClientCommand` (discriminated union pada `type`).
 *
 * Server adalah satu-satunya penulis state. Klien tidak pernah mengirim state,
 * hanya command; snapshot penuh dikirim sekali lewat `state.snapshot`.
 */

import { z } from 'zod';

/* ------------------------------------------------------------------ */
/* Enum domain                                                         */
/* ------------------------------------------------------------------ */

export const AGENT_ROLES = [
  'manager',
  'researcher',
  'writer',
  'coder',
  'reviewer',
  'gamedev',
  'artist',
  'visual_qa',
  'security',
  'designer',
] as const;
export const AgentRoleSchema = z.enum(AGENT_ROLES);
export type AgentRole = z.infer<typeof AgentRoleSchema>;

export const AGENT_STATUSES = [
  'idle',
  'thinking',
  'working',
  'messaging',
  'meeting',
  'waiting_approval',
  'error',
  'offline',
] as const;
export const AgentStatusSchema = z.enum(AGENT_STATUSES);
export type AgentStatus = z.infer<typeof AgentStatusSchema>;

export const TASK_STATUSES = [
  'todo',
  'in_progress',
  'review',
  'done',
  'blocked',
] as const;
export const TaskStatusSchema = z.enum(TASK_STATUSES);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const TASK_PRIORITIES = ['low', 'normal', 'high'] as const;
export const TaskPrioritySchema = z.enum(TASK_PRIORITIES);
export type TaskPriority = z.infer<typeof TaskPrioritySchema>;

export const PROJECT_STATUSES = ['active', 'paused', 'done'] as const;
export const ProjectStatusSchema = z.enum(PROJECT_STATUSES);
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;

export const MODES = ['semi', 'full'] as const;
export const ModeSchema = z.enum(MODES);
export type Mode = z.infer<typeof ModeSchema>;

export const LANGS = ['id', 'en'] as const;
export const LangSchema = z.enum(LANGS);
export type Lang = z.infer<typeof LangSchema>;

export const DRIVERS = ['api', 'manual'] as const;
export const DriverSchema = z.enum(DRIVERS);
export type Driver = z.infer<typeof DriverSchema>;

export const MESSAGE_KINDS = [
  'chat',
  'handoff',
  'meeting',
  'review',
  'system',
] as const;
export const MessageKindSchema = z.enum(MESSAGE_KINDS);
export type MessageKind = z.infer<typeof MessageKindSchema>;

export const APPROVAL_STATUSES = [
  'pending',
  'approved',
  'denied',
  'expired',
] as const;
export const ApprovalStatusSchema = z.enum(APPROVAL_STATUSES);
export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;

export const APPROVAL_KINDS = [
  'run_command',
  'write_outside_workspace',
  'escalation',
  'security_block',
  'other',
] as const;
export const ApprovalKindSchema = z.enum(APPROVAL_KINDS);
export type ApprovalKind = z.infer<typeof ApprovalKindSchema>;

export const EMOTIONS = [
  'neutral',
  'focused',
  'happy',
  'concerned',
  'blocked',
  'proud',
  'confused',
] as const;
export const EmotionSchema = z.enum(EMOTIONS);
export type Emotion = z.infer<typeof EmotionSchema>;

export const GATEWAY_STATUSES = ['online', 'degraded', 'offline'] as const;
export const GatewayStatusSchema = z.enum(GATEWAY_STATUSES);
export type GatewayStatus = z.infer<typeof GatewayStatusSchema>;

/* ------------------------------------------------------------------ */
/* Skalar                                                              */
/* ------------------------------------------------------------------ */

export const IdSchema = z.string().min(1).max(64);
export const AgentIdSchema = IdSchema;
export const TaskIdSchema = IdSchema;

/** ISO-8601 (UTC). Divalidasi lewat Date.parse agar toleran terhadap offset. */
export const IsoTimestampSchema = z
  .string()
  .min(10)
  .max(40)
  .refine((v) => !Number.isNaN(Date.parse(v)), 'timestamp ISO-8601 tidak valid');

export const DayKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'format hari harus YYYY-MM-DD');

export const HexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'warna harus hex 6 digit, contoh #E9A23B');

/** 'ceo' | 'all' | 'system' | id agen */
export const PartySchema = z.string().min(1).max(64);

export const WorkspacePathSchema = z
  .string()
  .min(1)
  .max(512)
  .refine((v) => !v.startsWith('/') && !v.startsWith('\\'), 'path harus relatif')
  .refine((v) => !/^[a-zA-Z]:/.test(v), 'path tidak boleh absolut')
  .refine(
    (v) => !v.split(/[\\/]/).includes('..'),
    'path tidak boleh keluar dari workspace',
  );

/* ------------------------------------------------------------------ */
/* Entitas                                                             */
/* ------------------------------------------------------------------ */

export const DeskSchema = z.object({
  x: z.number().int().min(0).max(64),
  y: z.number().int().min(0).max(64),
});
export type Desk = z.infer<typeof DeskSchema>;

export const AgentQuotaSchema = z.object({
  /** 0 = tanpa batas (kursi manual). */
  used: z.number().int().min(0),
  cap: z.number().int().min(0),
  resetAt: IsoTimestampSchema,
});
export type AgentQuota = z.infer<typeof AgentQuotaSchema>;

export const AgentViewSchema = z.object({
  id: AgentIdSchema,
  name: z.string().min(1).max(40),
  role: AgentRoleSchema,
  title: z.string().max(60).optional(),
  color: HexColorSchema,
  status: AgentStatusSchema,
  driver: DriverSchema,
  model: z.string().min(1).max(120),
  desk: DeskSchema,
  currentTaskId: TaskIdSchema.optional(),
  currentTaskTitle: z.string().max(160).optional(),
  quota: AgentQuotaSchema,
  lastSeenAt: IsoTimestampSchema.optional(),
  offlineReason: z.string().max(200).optional(),
});
export type AgentView = z.infer<typeof AgentViewSchema>;

export const TaskSchema = z.object({
  id: TaskIdSchema,
  projectId: IdSchema,
  parentId: TaskIdSchema.optional(),
  title: z.string().min(1).max(160),
  details: z.string().max(2000).default(''),
  assignee: AgentIdSchema,
  reviewer: AgentIdSchema.optional(),
  status: TaskStatusSchema,
  priority: TaskPrioritySchema.default('normal'),
  createdBy: PartySchema.default('ceo'),
  files: z.array(z.string().max(512)).max(50).default([]),
  blockedReason: z.string().max(300).optional(),
  createdAt: IsoTimestampSchema,
  updatedAt: IsoTimestampSchema,
});
export type Task = z.infer<typeof TaskSchema>;

export const MessageSchema = z.object({
  id: IdSchema,
  projectId: IdSchema.optional(),
  threadId: IdSchema.optional(),
  sender: PartySchema,
  recipient: PartySchema,
  kind: MessageKindSchema.default('chat'),
  body: z.string().min(1).max(8000),
  meta: z.record(z.string(), z.unknown()).default({}),
  createdAt: IsoTimestampSchema,
  readAt: IsoTimestampSchema.optional(),
});
export type Message = z.infer<typeof MessageSchema>;

export const ProjectSchema = z.object({
  id: IdSchema,
  name: z.string().min(1).max(120),
  description: z.string().max(1000).default(''),
  status: ProjectStatusSchema.default('active'),
  createdBy: PartySchema.default('ceo'),
  createdAt: IsoTimestampSchema,
  updatedAt: IsoTimestampSchema.optional(),
});
export type Project = z.infer<typeof ProjectSchema>;

export const ApprovalPayloadSchema = z.object({
  command: z.string().max(500).optional(),
  args: z.array(z.string().max(200)).max(20).optional(),
  cwd: z.string().max(512).optional(),
  reason: z.string().max(500).optional(),
  taskId: TaskIdSchema.optional(),
  risk: z.string().max(300).optional(),
});
export type ApprovalPayload = z.infer<typeof ApprovalPayloadSchema>;

export const ApprovalSchema = z.object({
  id: IdSchema,
  agentId: AgentIdSchema,
  kind: ApprovalKindSchema,
  payload: ApprovalPayloadSchema.default({}),
  status: ApprovalStatusSchema.default('pending'),
  createdAt: IsoTimestampSchema,
  decidedAt: IsoTimestampSchema.optional(),
  decidedBy: PartySchema.optional(),
  reason: z.string().max(500).optional(),
});
export type Approval = z.infer<typeof ApprovalSchema>;

export const UsageSchema = z.object({
  agentId: AgentIdSchema,
  day: DayKeySchema,
  requests: z.number().int().min(0),
  tokensIn: z.number().int().min(0).default(0),
  tokensOut: z.number().int().min(0).default(0),
  cap: z.number().int().min(0).default(0),
});
export type Usage = z.infer<typeof UsageSchema>;

export const GatewayHealthSchema = z.object({
  status: GatewayStatusSchema,
  baseUrl: z.string().max(500),
  checkedAt: IsoTimestampSchema,
  latencyMs: z.number().int().min(0).optional(),
  detail: z.string().max(300).optional(),
});
export type GatewayHealth = z.infer<typeof GatewayHealthSchema>;

export const OfficeMetaSchema = z.object({
  name: z.string().min(1).max(80),
  version: z.string().min(1).max(40),
  mode: ModeSchema,
  language: LangSchema,
  paused: z.boolean(),
  timezone: z.string().min(1).max(60),
  gateway: GatewayHealthSchema,
  serverTime: IsoTimestampSchema,
});
export type OfficeMeta = z.infer<typeof OfficeMetaSchema>;

export const SecuritySeveritySchema = z.enum(['hard', 'medium']);
export type SecuritySeverity = z.infer<typeof SecuritySeveritySchema>;

/** Temuan pemindai deterministik yang sudah disamarkan (tanpa nilai rahasia). */
export const SecurityFindingSchema = z.object({
  rule: z.string().min(1).max(120),
  severity: SecuritySeveritySchema,
  path: z.string().min(1).max(512),
  line: z.number().int().min(0).optional(),
  detail: z.string().max(300).optional(),
});
export type SecurityFinding = z.infer<typeof SecurityFindingSchema>;

export const GitStatusSnapshotSchema = z.object({
  branch: z.string().min(1).max(120).default('main'),
  remote: z.string().max(120).optional(),
  lastCommitSha: z.string().max(64).optional(),
  lastCommitTitle: z.string().max(200).optional(),
  lastPushAt: IsoTimestampSchema.optional(),
  aheadCount: z.number().int().min(0).default(0),
  pushBlocked: z.boolean().default(false),
  blockedReason: z.string().max(500).optional(),
});
export type GitStatusSnapshot = z.infer<typeof GitStatusSnapshotSchema>;

/* ------------------------------------------------------------------ */
/* Snapshot                                                            */
/* ------------------------------------------------------------------ */

export const StateSnapshotSchema = z.object({
  office: OfficeMetaSchema,
  projects: z.array(ProjectSchema).max(100).default([]),
  agents: z.array(AgentViewSchema).max(32),
  tasks: z.array(TaskSchema).max(2000),
  approvals: z.array(ApprovalSchema).max(200),
  messages: z.array(MessageSchema).max(200).default([]),
  usage: z.array(UsageSchema).max(200).default([]),
  git: GitStatusSnapshotSchema.optional(),
  securityFindings: z.array(SecurityFindingSchema).max(200).optional(),
});
export type StateSnapshot = z.infer<typeof StateSnapshotSchema>;

/* ------------------------------------------------------------------ */
/* Server -> klien                                                     */
/* ------------------------------------------------------------------ */

export const ServerEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('state.snapshot'), state: StateSnapshotSchema, at: IsoTimestampSchema }),
  z.object({
    type: z.literal('agent.status'),
    agentId: AgentIdSchema,
    status: AgentStatusSchema,
    detail: z.string().max(200).optional(),
    taskId: TaskIdSchema.optional(),
    at: IsoTimestampSchema,
  }),
  z.object({
    type: z.literal('agent.say'),
    agentId: AgentIdSchema,
    text: z.string().min(1).max(2000),
    to: PartySchema.optional(),
    emotion: EmotionSchema.default('neutral'),
    at: IsoTimestampSchema,
  }),
  z.object({ type: z.literal('message.created'), message: MessageSchema, at: IsoTimestampSchema }),
  z.object({ type: z.literal('message.read'), agentId: AgentIdSchema, messageIds: z.array(IdSchema).max(100), at: IsoTimestampSchema }),
  z.object({ type: z.literal('task.updated'), task: TaskSchema, at: IsoTimestampSchema }),
  z.object({ type: z.literal('project.updated'), project: ProjectSchema, at: IsoTimestampSchema }),
  z.object({ type: z.literal('approval.requested'), approval: ApprovalSchema, at: IsoTimestampSchema }),
  z.object({
    type: z.literal('approval.resolved'),
    id: IdSchema,
    approved: z.boolean(),
    decidedBy: PartySchema.optional(),
    reason: z.string().max(500).optional(),
    at: IsoTimestampSchema,
  }),
  z.object({ type: z.literal('usage.updated'), usage: UsageSchema, at: IsoTimestampSchema }),
  z.object({ type: z.literal('office.mode'), mode: ModeSchema, at: IsoTimestampSchema }),
  z.object({ type: z.literal('office.paused'), paused: z.boolean(), at: IsoTimestampSchema }),
  z.object({ type: z.literal('office.language'), language: LangSchema, at: IsoTimestampSchema }),
  z.object({
    type: z.literal('run.started'),
    runId: IdSchema,
    agentId: AgentIdSchema,
    taskId: TaskIdSchema.optional(),
    at: IsoTimestampSchema,
  }),
  z.object({
    type: z.literal('run.finished'),
    runId: IdSchema,
    agentId: AgentIdSchema,
    status: z.enum(['ok', 'error', 'aborted']),
    error: z.string().max(500).optional(),
    at: IsoTimestampSchema,
  }),
  z.object({
    type: z.literal('git.updated'),
    git: GitStatusSnapshotSchema,
    at: IsoTimestampSchema,
  }),
  z.object({
    type: z.literal('security.findings'),
    findings: z.array(SecurityFindingSchema).max(200),
    at: IsoTimestampSchema,
  }),
  z.object({
    type: z.literal('error'),
    code: z.string().max(60).optional(),
    message: z.string().min(1).max(500),
    at: IsoTimestampSchema,
  }),
]);
export type ServerEvent = z.infer<typeof ServerEventSchema>;

export const SERVER_EVENT_TYPES = [
  'state.snapshot',
  'agent.status',
  'agent.say',
  'message.created',
  'message.read',
  'task.updated',
  'project.updated',
  'approval.requested',
  'approval.resolved',
  'usage.updated',
  'office.mode',
  'office.paused',
  'office.language',
  'run.started',
  'run.finished',
  'git.updated',
  'security.findings',
  'error',
] as const;

/* ------------------------------------------------------------------ */
/* Klien -> server                                                     */
/* ------------------------------------------------------------------ */

export const ClientCommandSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('ceo.send'),
    /** 'manager' | 'all' | agentId */
    to: z.string().min(1).max(64),
    text: z.string().min(1).max(4000),
    projectId: IdSchema.optional(),
  }),
  z.object({
    type: z.literal('approval.respond'),
    id: IdSchema,
    approved: z.boolean(),
    reason: z.string().max(500).optional(),
  }),
  z.object({ type: z.literal('office.setMode'), mode: ModeSchema }),
  z.object({ type: z.literal('office.pauseAll'), paused: z.boolean() }),
  z.object({ type: z.literal('office.setLanguage'), language: LangSchema }),
  z.object({ type: z.literal('office.stopAgent'), agentId: AgentIdSchema }),
  z.object({ type: z.literal('task.move'), taskId: TaskIdSchema, status: TaskStatusSchema }),
]);
export type ClientCommand = z.infer<typeof ClientCommandSchema>;

export const CLIENT_COMMAND_TYPES = [
  'ceo.send',
  'approval.respond',
  'office.setMode',
  'office.pauseAll',
  'office.setLanguage',
  'office.stopAgent',
  'task.move',
] as const;

/* ------------------------------------------------------------------ */
/* Parser                                                              */
/* ------------------------------------------------------------------ */

export function parseServerEvent(input: unknown) {
  return ServerEventSchema.safeParse(input);
}

export function parseClientCommand(input: unknown) {
  return ClientCommandSchema.safeParse(input);
}

/** Pesan error ringkas untuk log/UI. */
export function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.map((part) => String(part)).join('.');
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join('; ');
}
