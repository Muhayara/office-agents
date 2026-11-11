import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  type AgentConfig,
  type AgentStatus,
  type AgentView,
  type Approval,
  type ApprovalKind,
  type ApprovalPayload,
  type ClientCommand,
  COMMAND_ROLES,
  type Emotion,
  FILE_WRITING_ROLES,
  type GatewayHealth,
  type Lang,
  type Message,
  type MessageKind,
  type Mode,
  type OfficeConfig,
  PLAYWRIGHT_AUTO_APPROVE_ROLES,
  type Project,
  SCHEMA_VERSION,
  SECURITY_SCAN_ROLES,
  type ServerEvent,
  type StateSnapshot,
  type Task,
  type TaskPriority,
  type TaskStatus,
  type ToolName,
  type Usage,
  canTransitionTask,
  managerOf,
  validateToolInput,
} from '@office/shared';
import { OfficeDb } from '../db';

const execFileAsync = promisify(execFile);

const ALLOWED_COMMANDS = new Set([
  'npm',
  'npx',
  'node',
  'git',
  'python',
  'tsc',
  'vitest',
]);

export type EventListener = (event: ServerEvent) => void;

interface PendingApprovalResolver {
  resolve: (approved: boolean) => void;
  timer: NodeJS.Timeout;
}

export class OfficeCore {
  public readonly config: OfficeConfig;
  public readonly db: OfficeDb;
  public readonly workspaceDir: string;

  private listeners = new Set<EventListener>();
  private pendingApprovals = new Map<string, PendingApprovalResolver>();
  private seqCounter = 0;
  private gatewayHealth: GatewayHealth;
  private stopAgentHandlers = new Map<string, () => void>();
  private wakeCallback?: () => void;

  constructor(options: {
    config: OfficeConfig;
    db: OfficeDb;
    workspaceDir: string;
  }) {
    this.config = options.config;
    this.db = options.db;
    this.workspaceDir = path.resolve(options.workspaceDir);
    fs.mkdirSync(this.workspaceDir, { recursive: true });

    const now = new Date().toISOString();
    this.gatewayHealth = {
      status: 'online',
      baseUrl: this.config.gateway.baseUrl,
      checkedAt: now,
    };

    this.bootstrapState();
  }

  public onWake(cb: () => void): void {
    this.wakeCallback = cb;
  }

  private triggerWake(): void {
    this.wakeCallback?.();
  }

  public registerStopHandler(agentId: string, stopFn: () => void): void {
    this.stopAgentHandlers.set(agentId, stopFn);
  }

  public unregisterStopHandler(agentId: string): void {
    this.stopAgentHandlers.delete(agentId);
  }

  private nextId(prefix: string): string {
    this.seqCounter += 1;
    const rand = Math.random().toString(36).slice(2, 6);
    return `${prefix}_${Date.now().toString(36)}_${this.seqCounter}_${rand}`;
  }

  public todayKey(): string {
    return new Date().toISOString().slice(0, 10);
  }

  public nextResetIso(): string {
    const d = new Date();
    d.setUTCHours(24, 0, 0, 0);
    return d.toISOString();
  }

  private bootstrapState(): void {
    const now = new Date().toISOString();
    if (!this.db.getKv('mode')) {
      this.db.setKv('mode', this.config.office.mode);
    }
    if (!this.db.getKv('language')) {
      this.db.setKv('language', this.config.office.language);
    }
    if (!this.db.getKv('paused')) {
      this.db.setKv('paused', 'false');
    }

    // Seed projects
    const seeds =
      this.config.projects.length > 0
        ? this.config.projects
        : [{ id: 'default', name: 'Proyek Utama Kantor', description: 'Workspace kolaborasi Office Agents' }];

    for (const p of seeds) {
      this.db.db
        .prepare(
          `INSERT INTO projects (id, name, description, status, created_by, created_at, updated_at)
           VALUES (?, ?, ?, 'active', 'ceo', ?, ?)
           ON CONFLICT(id) DO UPDATE SET name = excluded.name, description = excluded.description`,
        )
        .run(p.id, p.name, p.description ?? '', now, now);
    }

    // Seed agents
    for (const a of this.config.agents) {
      this.db.db
        .prepare(
          `INSERT INTO agents (id, name, role, title, color, status, driver, model, desk_x, desk_y, last_seen_at)
           VALUES (?, ?, ?, ?, ?, 'idle', ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             role = excluded.role,
             title = excluded.title,
             color = excluded.color,
             driver = excluded.driver,
             model = excluded.model,
             desk_x = excluded.desk_x,
             desk_y = excluded.desk_y`,
        )
        .run(
          a.id,
          a.name,
          a.role,
          a.title ?? null,
          a.color,
          a.driver,
          a.model,
          a.desk.x,
          a.desk.y,
          now,
        );
    }

    // Reset any hanging statuses from previous process crash
    this.db.db
      .prepare(`UPDATE agents SET status = 'idle' WHERE status IN ('thinking', 'working', 'messaging', 'waiting_approval')`)
      .run();
    this.db.db
      .prepare(`UPDATE runs SET status = 'aborted', ended_at = ? WHERE status = 'running'`)
      .run(now);
  }

  public onEvent(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public emit(event: ServerEvent): void {
    const agentId = 'agentId' in event ? event.agentId : null;
    this.db.db
      .prepare('INSERT INTO events (ts, type, agent_id, payload_json) VALUES (?, ?, ?, ?)')
      .run(event.at, event.type, agentId ?? null, JSON.stringify(event));

    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // ignore listener errors
      }
    }
  }

  public getMode(): Mode {
    return (this.db.getKv('mode') as Mode) || this.config.office.mode;
  }

  public setMode(mode: Mode): void {
    this.db.setKv('mode', mode);
    this.emit({ type: 'office.mode', mode, at: new Date().toISOString() });
  }

  public getLanguage(): Lang {
    return (this.db.getKv('language') as Lang) || this.config.office.language;
  }

  public setLanguage(language: Lang): void {
    this.db.setKv('language', language);
    this.emit({ type: 'office.language', language, at: new Date().toISOString() });
  }

  public isPaused(): boolean {
    return this.db.getKv('paused') === 'true';
  }

  public setPaused(paused: boolean): void {
    this.db.setKv('paused', paused ? 'true' : 'false');
    if (paused) {
      for (const [agentId, stop] of this.stopAgentHandlers.entries()) {
        stop();
        this.setAgentStatus(agentId, 'idle', 'Dijeda oleh CEO');
      }
    }
    this.emit({ type: 'office.paused', paused, at: new Date().toISOString() });
    if (!paused) {
      this.triggerWake();
    }
  }

  public stopAgent(agentId: string): void {
    const stop = this.stopAgentHandlers.get(agentId);
    if (stop) {
      stop();
    }
    this.setAgentStatus(agentId, 'idle', 'Dihentikan oleh CEO');
  }

  public setGatewayHealth(health: GatewayHealth): void {
    this.gatewayHealth = health;
  }

  public getGatewayHealth(): GatewayHealth {
    return this.gatewayHealth;
  }

  public setAgentStatus(
    agentId: string,
    status: AgentStatus,
    detail?: string,
    taskId?: string,
  ): void {
    const now = new Date().toISOString();
    this.db.db
      .prepare(
        `UPDATE agents
         SET status = ?,
             current_task_id = COALESCE(?, current_task_id),
             last_seen_at = ?,
             offline_reason = ?
         WHERE id = ?`,
      )
      .run(status, taskId ?? null, now, status === 'offline' ? (detail ?? null) : null, agentId);

    this.emit({
      type: 'agent.status',
      agentId,
      status,
      detail,
      taskId,
      at: now,
    });
  }

  public agentSay(agentId: string, text: string, emotion: Emotion = 'neutral', to?: string): void {
    const clean = text.trim();
    if (!clean) return;
    this.emit({
      type: 'agent.say',
      agentId,
      text: clean.slice(0, 2000),
      emotion,
      to,
      at: new Date().toISOString(),
    });
  }

  public getAgentConfig(agentId: string): AgentConfig | undefined {
    return this.config.agents.find((a) => a.id === agentId);
  }

  public getQuota(agentId: string): { used: number; cap: number; resetAt: string } {
    const cfg = this.getAgentConfig(agentId);
    const cap = cfg ? (cfg.driver === 'manual' ? 0 : cfg.dailyCap) : 80;
    const day = this.todayKey();
    const row = this.db.db
      .prepare('SELECT requests FROM usage WHERE agent_id = ? AND day = ?')
      .get(agentId, day) as { requests: number } | undefined;
    return {
      used: row?.requests ?? 0,
      cap,
      resetAt: this.nextResetIso(),
    };
  }

  public recordUsage(agentId: string, tokensIn = 0, tokensOut = 0): Usage {
    const cfg = this.getAgentConfig(agentId);
    const cap = cfg ? (cfg.driver === 'manual' ? 0 : cfg.dailyCap) : 80;
    const day = this.todayKey();
    this.db.db
      .prepare(
        `INSERT INTO usage (agent_id, day, requests, tokens_in, tokens_out, cap)
         VALUES (?, ?, 1, ?, ?, ?)
         ON CONFLICT(agent_id, day) DO UPDATE SET
           requests = usage.requests + 1,
           tokens_in = usage.tokens_in + excluded.tokens_in,
           tokens_out = usage.tokens_out + excluded.tokens_out,
           cap = excluded.cap`,
      )
      .run(agentId, day, tokensIn, tokensOut, cap);

    const row = this.db.db
      .prepare('SELECT requests, tokens_in, tokens_out, cap FROM usage WHERE agent_id = ? AND day = ?')
      .get(agentId, day) as { requests: number; tokens_in: number; tokens_out: number; cap: number };

    const usage: Usage = {
      agentId,
      day,
      requests: row.requests,
      tokensIn: row.tokens_in,
      tokensOut: row.tokens_out,
      cap: row.cap,
    };

    this.emit({
      type: 'usage.updated',
      usage,
      at: new Date().toISOString(),
    });

    if (cap > 0 && row.requests >= cap) {
      this.setAgentStatus(agentId, 'offline', `Kuota harian habis (${row.requests}/${cap})`);
    }
    return usage;
  }

  public listAgents(): AgentView[] {
    const rows = this.db.db
      .prepare(
        `SELECT a.*, t.title AS current_task_title
         FROM agents a
         LEFT JOIN tasks t ON t.id = a.current_task_id`,
      )
      .all() as Array<{
      id: string;
      name: string;
      role: AgentView['role'];
      title: string | null;
      color: string;
      status: AgentStatus;
      driver: AgentView['driver'];
      model: string;
      desk_x: number;
      desk_y: number;
      current_task_id: string | null;
      current_task_title: string | null;
      last_seen_at: string | null;
      offline_reason: string | null;
    }>;

    const orderMap = new Map(this.config.agents.map((a, idx) => [a.id, idx]));
    rows.sort((a, b) => (orderMap.get(a.id) ?? 99) - (orderMap.get(b.id) ?? 99));

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      role: r.role,
      title: r.title ?? undefined,
      color: r.color,
      status: r.status,
      driver: r.driver,
      model: r.model,
      desk: { x: r.desk_x, y: r.desk_y },
      currentTaskId: r.current_task_id ?? undefined,
      currentTaskTitle: r.current_task_title ?? undefined,
      quota: this.getQuota(r.id),
      lastSeenAt: r.last_seen_at ?? undefined,
      offlineReason: r.offline_reason ?? undefined,
    }));
  }

  public listProjects(): Project[] {
    const rows = this.db.db.prepare('SELECT * FROM projects ORDER BY created_at ASC').all() as Array<{
      id: string;
      name: string;
      description: string;
      status: Project['status'];
      created_by: string;
      created_at: string;
      updated_at: string | null;
    }>;
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      status: r.status,
      createdBy: r.created_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at ?? undefined,
    }));
  }

  public sendMessage(params: {
    sender: string;
    to: string;
    body: string;
    kind?: MessageKind;
    projectId?: string;
    threadId?: string;
    meta?: Record<string, unknown>;
  }): Message {
    const now = new Date().toISOString();
    const managerId = managerOf(this.config).id;
    const recipient = params.to === 'manager' ? managerId : params.to;
    const projectId = params.projectId ?? 'default';
    const kind: MessageKind =
      params.kind ?? (recipient === 'all' || params.body.startsWith('/rapat') || params.body.startsWith('/meeting') ? 'meeting' : 'chat');

    const id = this.nextId('msg');
    const cleanBody = params.body.trim().slice(0, 8000);
    const meta = params.meta ?? {};

    this.db.db
      .prepare(
        `INSERT INTO messages (id, project_id, thread_id, sender, recipient, kind, body, meta_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        projectId,
        params.threadId ?? null,
        params.sender,
        recipient,
        kind,
        cleanBody,
        JSON.stringify(meta),
        now,
      );

    // If broadcast to "all", also fan out inbox copies to each agent (except sender) so each agent has an independent read_at cursor
    if (recipient === 'all') {
      for (const agent of this.config.agents) {
        if (agent.id === params.sender) continue;
        const copyId = this.nextId('msg');
        this.db.db
          .prepare(
            `INSERT INTO messages (id, project_id, thread_id, sender, recipient, kind, body, meta_json, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            copyId,
            projectId,
            params.threadId ?? id,
            params.sender,
            agent.id,
            kind,
            cleanBody,
            JSON.stringify({ ...meta, broadcastFrom: id }),
            now,
          );
      }
    }

    const message: Message = {
      id,
      projectId,
      threadId: params.threadId,
      sender: params.sender,
      recipient,
      kind,
      body: cleanBody,
      meta,
      createdAt: now,
    };

    this.emit({
      type: 'message.created',
      message,
      at: now,
    });

    this.triggerWake();
    return message;
  }

  public readInbox(agentId: string, limit = 20, markRead = true): Message[] {
    const rows = this.db.db
      .prepare(
        `SELECT * FROM messages
         WHERE recipient = ? AND read_at IS NULL
         ORDER BY created_at ASC
         LIMIT ?`,
      )
      .all(agentId, limit) as Array<{
      id: string;
      project_id: string | null;
      thread_id: string | null;
      sender: string;
      recipient: string;
      kind: MessageKind;
      body: string;
      meta_json: string;
      created_at: string;
      read_at: string | null;
    }>;

    const now = new Date().toISOString();
    if (markRead && rows.length > 0) {
      const ids = rows.map((r) => r.id);
      const stmt = this.db.db.prepare('UPDATE messages SET read_at = ? WHERE id = ?');
      for (const id of ids) {
        stmt.run(now, id);
      }
      this.emit({
        type: 'message.read',
        agentId,
        messageIds: ids,
        at: now,
      });
    }

    return rows.map((r) => ({
      id: r.id,
      projectId: r.project_id ?? undefined,
      threadId: r.thread_id ?? undefined,
      sender: r.sender,
      recipient: r.recipient,
      kind: r.kind,
      body: r.body,
      meta: JSON.parse(r.meta_json || '{}'),
      createdAt: r.created_at,
      readAt: markRead ? now : (r.read_at ?? undefined),
    }));
  }

  public listMessages(limit = 150): Message[] {
    const rows = this.db.db
      .prepare(
        `SELECT * FROM messages
         WHERE json_extract(meta_json, '$.broadcastFrom') IS NULL
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .all(limit) as Array<{
      id: string;
      project_id: string | null;
      thread_id: string | null;
      sender: string;
      recipient: string;
      kind: MessageKind;
      body: string;
      meta_json: string;
      created_at: string;
      read_at: string | null;
    }>;

    return rows.reverse().map((r) => ({
      id: r.id,
      projectId: r.project_id ?? undefined,
      threadId: r.thread_id ?? undefined,
      sender: r.sender,
      recipient: r.recipient,
      kind: r.kind,
      body: r.body,
      meta: JSON.parse(r.meta_json || '{}'),
      createdAt: r.created_at,
      readAt: r.read_at ?? undefined,
    }));
  }

  public createTask(params: {
    title: string;
    assignee: string;
    details?: string;
    parentId?: string;
    priority?: TaskPriority;
    createdBy?: string;
    projectId?: string;
  }): Task {
    const now = new Date().toISOString();
    const id = this.nextId('t');
    const projectId = params.projectId ?? 'default';
    const priority = params.priority ?? 'normal';
    const createdBy = params.createdBy ?? 'ceo';
    const details = (params.details ?? '').slice(0, 2000);

    this.db.db
      .prepare(
        `INSERT INTO tasks (id, project_id, parent_id, title, details, assignee, status, priority, created_by, files_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'todo', ?, ?, '[]', ?, ?)`,
      )
      .run(
        id,
        projectId,
        params.parentId ?? null,
        params.title.slice(0, 160),
        details,
        params.assignee,
        priority,
        createdBy,
        now,
        now,
      );

    this.db.db
      .prepare('UPDATE agents SET current_task_id = COALESCE(current_task_id, ?) WHERE id = ?')
      .run(id, params.assignee);

    const task = this.getTask(id)!;
    this.emit({ type: 'task.updated', task, at: now });

    // Notify assignee in inbox
    this.sendMessage({
      sender: createdBy,
      to: params.assignee,
      kind: 'handoff',
      body: `Tugas baru #${id}: "${task.title}". Detail: ${task.details || '(lihat papan tugas)'}`,
      projectId,
    });

    this.triggerWake();
    return task;
  }

  public getTask(taskId: string): Task | undefined {
    const r = this.db.db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as
      | {
          id: string;
          project_id: string;
          parent_id: string | null;
          title: string;
          details: string;
          assignee: string;
          reviewer: string | null;
          status: TaskStatus;
          priority: TaskPriority;
          created_by: string;
          files_json: string;
          blocked_reason: string | null;
          created_at: string;
          updated_at: string;
        }
      | undefined;

    if (!r) return undefined;
    return {
      id: r.id,
      projectId: r.project_id,
      parentId: r.parent_id ?? undefined,
      title: r.title,
      details: r.details,
      assignee: r.assignee,
      reviewer: r.reviewer ?? undefined,
      status: r.status,
      priority: r.priority,
      createdBy: r.created_by,
      files: JSON.parse(r.files_json || '[]'),
      blockedReason: r.blocked_reason ?? undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  public listTasks(filter?: {
    status?: TaskStatus;
    assignee?: string;
    projectId?: string;
  }): Task[] {
    const clauses: string[] = [];
    const args: string[] = [];
    if (filter?.status) {
      clauses.push('status = ?');
      args.push(filter.status);
    }
    if (filter?.assignee) {
      clauses.push('assignee = ?');
      args.push(filter.assignee);
    }
    if (filter?.projectId) {
      clauses.push('project_id = ?');
      args.push(filter.projectId);
    }
    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = this.db.db
      .prepare(`SELECT id FROM tasks ${where} ORDER BY created_at ASC`)
      .all(...args) as Array<{ id: string }>;

    return rows.map((r) => this.getTask(r.id)!).filter(Boolean);
  }

  public updateTask(params: {
    taskId: string;
    status: TaskStatus;
    note?: string;
    actor?: string;
    files?: string[];
    reviewer?: string;
    force?: boolean;
  }): Task {
    const existing = this.getTask(params.taskId);
    if (!existing) {
      throw new Error(`Tugas #${params.taskId} tidak ditemukan`);
    }
    if (
      !params.force &&
      existing.status !== params.status &&
      !canTransitionTask(existing.status, params.status)
    ) {
      throw new Error(`Transisi status tidak sah: ${existing.status} -> ${params.status}`);
    }

    const now = new Date().toISOString();
    const mergedFiles = params.files
      ? Array.from(new Set([...existing.files, ...params.files]))
      : existing.files;

    const blockedReason =
      params.status === 'blocked' ? (params.note ?? existing.blockedReason ?? 'Diblokir') : null;

    this.db.db
      .prepare(
        `UPDATE tasks
         SET status = ?,
             reviewer = COALESCE(?, reviewer),
             files_json = ?,
             blocked_reason = ?,
             updated_at = ?
         WHERE id = ?`,
      )
      .run(
        params.status,
        params.reviewer ?? null,
        JSON.stringify(mergedFiles),
        blockedReason,
        now,
        params.taskId,
      );

    if (params.status === 'done') {
      this.db.db
        .prepare('UPDATE agents SET current_task_id = NULL WHERE current_task_id = ?')
        .run(params.taskId);
    } else if (params.status === 'in_progress') {
      this.db.db
        .prepare('UPDATE agents SET current_task_id = ? WHERE id = ?')
        .run(params.taskId, existing.assignee);
    }

    const updated = this.getTask(params.taskId)!;
    this.emit({ type: 'task.updated', task: updated, at: now });
    this.triggerWake();
    return updated;
  }

  public incrementTaskTurn(taskId: string): number {
    this.db.db.prepare('UPDATE tasks SET turns_used = turns_used + 1 WHERE id = ?').run(taskId);
    const row = this.db.db.prepare('SELECT turns_used FROM tasks WHERE id = ?').get(taskId) as
      | { turns_used: number }
      | undefined;
    return row?.turns_used ?? 0;
  }

  public incrementTaskRevision(taskId: string): number {
    this.db.db
      .prepare('UPDATE tasks SET revisions_used = revisions_used + 1 WHERE id = ?')
      .run(taskId);
    const row = this.db.db.prepare('SELECT revisions_used FROM tasks WHERE id = ?').get(taskId) as
      | { revisions_used: number }
      | undefined;
    return row?.revisions_used ?? 0;
  }

  public listApprovals(): Approval[] {
    const rows = this.db.db
      .prepare('SELECT * FROM approvals ORDER BY created_at DESC LIMIT 100')
      .all() as Array<{
      id: string;
      agent_id: string;
      kind: ApprovalKind;
      payload_json: string;
      status: Approval['status'];
      created_at: string;
      decided_at: string | null;
      decided_by: string | null;
      reason: string | null;
    }>;

    return rows.map((r) => ({
      id: r.id,
      agentId: r.agent_id,
      kind: r.kind,
      payload: JSON.parse(r.payload_json || '{}'),
      status: r.status,
      createdAt: r.created_at,
      decidedAt: r.decided_at ?? undefined,
      decidedBy: r.decided_by ?? undefined,
      reason: r.reason ?? undefined,
    }));
  }

  public async requestApproval(params: {
    agentId: string;
    kind: ApprovalKind;
    payload: ApprovalPayload;
  }): Promise<{ approved: boolean; reason?: string }> {
    const now = new Date().toISOString();
    const id = this.nextId('apr');
    const mode = this.getMode();

    if (mode === 'full') {
      // Always record approval row even in full mode, as required by tools.ts contract
      this.db.db
        .prepare(
          `INSERT INTO approvals (id, agent_id, kind, payload_json, status, created_at, decided_at, decided_by, reason)
           VALUES (?, ?, ?, ?, 'approved', ?, ?, 'system', 'Disetujui otomatis (mode penuh)')`,
        )
        .run(id, params.agentId, params.kind, JSON.stringify(params.payload), now, now);

      const approval: Approval = {
        id,
        agentId: params.agentId,
        kind: params.kind,
        payload: params.payload,
        status: 'approved',
        createdAt: now,
        decidedAt: now,
        decidedBy: 'system',
        reason: 'Disetujui otomatis (mode penuh)',
      };
      this.emit({ type: 'approval.requested', approval, at: now });
      this.emit({
        type: 'approval.resolved',
        id,
        approved: true,
        decidedBy: 'system',
        reason: approval.reason,
        at: now,
      });
      return { approved: true };
    }

    this.db.db
      .prepare(
        `INSERT INTO approvals (id, agent_id, kind, payload_json, status, created_at)
         VALUES (?, ?, ?, ?, 'pending', ?)`,
      )
      .run(id, params.agentId, params.kind, JSON.stringify(params.payload), now);

    const approval: Approval = {
      id,
      agentId: params.agentId,
      kind: params.kind,
      payload: params.payload,
      status: 'pending',
      createdAt: now,
    };

    this.setAgentStatus(
      params.agentId,
      'waiting_approval',
      params.payload.command
        ? `Menunggu izin: ${params.payload.command} ${(params.payload.args ?? []).join(' ')}`
        : 'Menunggu persetujuan CEO',
    );
    this.emit({ type: 'approval.requested', approval, at: now });

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pendingApprovals.delete(id);
        const expiredAt = new Date().toISOString();
        this.db.db
          .prepare(
            `UPDATE approvals SET status = 'expired', decided_at = ?, decided_by = 'system', reason = 'Kedaluwarsa' WHERE id = ?`,
          )
          .run(expiredAt, id);
        this.emit({
          type: 'approval.resolved',
          id,
          approved: false,
          decidedBy: 'system',
          reason: 'Kedaluwarsa — perintah ditolak',
          at: expiredAt,
        });
        resolve({ approved: false, reason: 'Kedaluwarsa — perintah ditolak' });
      }, this.config.limits.approvalTimeoutMs);

      this.pendingApprovals.set(id, {
        resolve: (approved: boolean) => {
          const row = this.db.db
            .prepare('SELECT reason FROM approvals WHERE id = ?')
            .get(id) as { reason: string | null } | undefined;
          resolve({ approved, reason: row?.reason ?? undefined });
        },
        timer,
      });
    });
  }

  public respondApproval(id: string, approved: boolean, reason?: string, decidedBy = 'ceo'): void {
    const now = new Date().toISOString();
    const status = approved ? 'approved' : 'denied';
    this.db.db
      .prepare(
        `UPDATE approvals SET status = ?, decided_at = ?, decided_by = ?, reason = ? WHERE id = ?`,
      )
      .run(status, now, decidedBy, reason ?? null, id);

    const pending = this.pendingApprovals.get(id);
    if (pending) {
      clearTimeout(pending.timer);
      this.pendingApprovals.delete(id);
      pending.resolve(approved);
    }

    this.emit({
      type: 'approval.resolved',
      id,
      approved,
      decidedBy,
      reason,
      at: now,
    });
    this.triggerWake();
  }

  public resolveWorkspacePath(relPath: string): string {
    const target = path.resolve(this.workspaceDir, relPath);
    const rel = path.relative(this.workspaceDir, target);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      throw new Error(`Path keluar dari workspace ditolak: ${relPath}`);
    }
    return target;
  }

  public async executeTool(
    agentId: string,
    toolName: ToolName,
    rawInput: unknown,
  ): Promise<{ ok: boolean; output: string; finished?: boolean }> {
    const validated = validateToolInput(toolName, rawInput ?? {});
    if (!validated.ok) {
      return { ok: false, output: `Argumen tool ${toolName} tidak valid: ${validated.error}` };
    }
    const input = validated.data as Record<string, unknown>;
    const agentCfg = this.getAgentConfig(agentId);

    // Role guard for file writing
    if (
      (toolName === 'write_file' || toolName === 'edit_file') &&
      agentCfg &&
      !FILE_WRITING_ROLES.includes(agentCfg.role)
    ) {
      return {
        ok: false,
        output: `Peran ${agentCfg.role} tidak diizinkan mengubah file langsung. Delegasikan ke peran penulis/programmer/desainer (${FILE_WRITING_ROLES.join(', ')}).`,
      };
    }

    // Role guard for command execution
    if (
      toolName === 'run_command' &&
      agentCfg &&
      !COMMAND_ROLES.includes(agentCfg.role)
    ) {
      return {
        ok: false,
        output: `Peran ${agentCfg.role} tidak diizinkan menjalankan run_command. Hanya peran (${COMMAND_ROLES.join(', ')}) yang diizinkan.`,
      };
    }

    // Role guard for security_scan
    if (
      toolName === 'security_scan' &&
      agentCfg &&
      !SECURITY_SCAN_ROLES.includes(agentCfg.role)
    ) {
      return {
        ok: false,
        output: `Tool security_scan hanya dapat dijalankan oleh peran (${SECURITY_SCAN_ROLES.join(', ')}).`,
      };
    }

    try {
      switch (toolName) {
        case 'send_message': {
          const to = String(input.to);
          const text = String(input.text);
          this.setAgentStatus(agentId, 'messaging', `Mengirim pesan ke ${to}`);
          const msg = this.sendMessage({ sender: agentId, to, body: text });
          return { ok: true, output: `Pesan #${msg.id} terkirim ke ${msg.recipient}.` };
        }

        case 'read_inbox': {
          const limit = Number(input.limit ?? 20);
          const markRead = Boolean(input.markRead ?? true);
          const msgs = this.readInbox(agentId, limit, markRead);
          if (msgs.length === 0) {
            return { ok: true, output: 'Inbox kosong.' };
          }
          return {
            ok: true,
            output: msgs.map((m) => `[#${m.id} dari ${m.sender} (${m.kind})]: ${m.body}`).join('\n'),
          };
        }

        case 'list_team': {
          const team = this.listAgents();
          return {
            ok: true,
            output: team
              .map(
                (a) =>
                  `${a.id} (${a.name}, ${a.role}): status=${a.status}, kuota=${a.quota.used}/${a.quota.cap}${a.currentTaskId ? `, tugas=#${a.currentTaskId}` : ''}`,
              )
              .join('\n'),
          };
        }

        case 'create_task': {
          const task = this.createTask({
            title: String(input.title),
            assignee: String(input.assignee),
            details: input.details ? String(input.details) : '',
            parentId: input.parentId ? String(input.parentId) : undefined,
            priority: (input.priority as TaskPriority) ?? 'normal',
            createdBy: agentId,
          });
          return {
            ok: true,
            output: `Tugas #${task.id} "${task.title}" dibuat untuk ${task.assignee} (status: ${task.status}).`,
          };
        }

        case 'claim_task': {
          const taskId = String(input.taskId);
          const updated = this.updateTask({
            taskId,
            status: 'in_progress',
            actor: agentId,
          });
          return {
            ok: true,
            output: `Tugas #${updated.id} "${updated.title}" diambil dan berstatus in_progress.`,
          };
        }

        case 'update_task': {
          const taskId = String(input.taskId);
          const status = input.status as TaskStatus;
          const note = input.note ? String(input.note) : undefined;
          const existing = this.getTask(taskId);
          const updated = this.updateTask({
            taskId,
            status,
            note,
            actor: agentId,
            force: true,
          });
          if (note && existing) {
            const target =
              agentCfg?.role === 'reviewer'
                ? status === 'done'
                  ? managerOf(this.config).id
                  : existing.assignee
                : managerOf(this.config).id;
            this.sendMessage({
              sender: agentId,
              to: target,
              kind: agentCfg?.role === 'reviewer' ? 'review' : 'handoff',
              body: `Tugas #${taskId} -> ${status}: ${note}`,
            });
          }
          return {
            ok: true,
            output: `Tugas #${updated.id} diperbarui menjadi ${updated.status}.`,
          };
        }

        case 'list_tasks': {
          const tasks = this.listTasks({
            status: input.status as TaskStatus | undefined,
            assignee: input.assignee ? String(input.assignee) : undefined,
            projectId: input.projectId ? String(input.projectId) : undefined,
          });
          if (tasks.length === 0) {
            return { ok: true, output: 'Tidak ada tugas yang cocok.' };
          }
          return {
            ok: true,
            output: tasks
              .map(
                (t) =>
                  `#${t.id} [${t.status}] "${t.title}" (assignee=${t.assignee}${t.reviewer ? `, reviewer=${t.reviewer}` : ''}) files=[${t.files.join(', ')}]`,
              )
              .join('\n'),
          };
        }

        case 'post_report': {
          const taskId = String(input.taskId);
          const summary = String(input.summary);
          const files = (input.files as string[] | undefined) ?? [];
          const existing = this.getTask(taskId);
          if (existing) {
            this.updateTask({
              taskId,
              status: existing.status === 'todo' ? 'in_progress' : existing.status,
              files,
              actor: agentId,
              force: true,
            });
          }
          const managerId = managerOf(this.config).id;
          this.sendMessage({
            sender: agentId,
            to: managerId,
            kind: 'handoff',
            body: `Laporan tugas #${taskId}: ${summary}${files.length > 0 ? ` (File: ${files.join(', ')})` : ''}`,
          });
          return {
            ok: true,
            output: `Laporan tugas #${taskId} dikirim ke ${managerId}.`,
          };
        }

        case 'request_review': {
          const taskId = String(input.taskId);
          const to = String(input.to);
          const updated = this.updateTask({
            taskId,
            status: 'review',
            reviewer: to,
            actor: agentId,
            force: true,
          });
          this.sendMessage({
            sender: agentId,
            to,
            kind: 'review',
            body: `Mohon review tugas #${updated.id} "${updated.title}". File: ${updated.files.join(', ') || '(cek git_diff)'}. Detail: ${updated.details}`,
          });
          return {
            ok: true,
            output: `Permintaan review untuk tugas #${updated.id} dikirim ke ${to}.`,
          };
        }

        case 'ask_human': {
          const question = String(input.question);
          const taskId = input.taskId ? String(input.taskId) : undefined;
          if (taskId) {
            this.updateTask({
              taskId,
              status: 'blocked',
              note: `Menunggu jawaban CEO: ${question}`,
              actor: agentId,
              force: true,
            });
          }
          this.sendMessage({
            sender: agentId,
            to: 'ceo',
            kind: 'chat',
            body: `Pertanyaan untuk CEO${taskId ? ` (tugas #${taskId})` : ''}: ${question}`,
          });
          return {
            ok: true,
            output: 'Pertanyaan telah dikirim ke CEO. Menghentikan giliran untuk menunggu jawaban.',
            finished: true,
          };
        }

        case 'escalate': {
          const taskId = String(input.taskId);
          const reason = String(input.reason);
          this.updateTask({
            taskId,
            status: 'blocked',
            note: `Eskalasi: ${reason}`,
            actor: agentId,
            force: true,
          });
          this.sendMessage({
            sender: agentId,
            to: 'ceo',
            kind: 'system',
            body: `ESKALASI tugas #${taskId}: ${reason}`,
          });
          return {
            ok: true,
            output: `Tugas #${taskId} dieskalasi ke CEO.`,
            finished: true,
          };
        }

        case 'write_file': {
          const relPath = String(input.path);
          const content = String(input.content);
          const fullPath = this.resolveWorkspacePath(relPath);
          fs.mkdirSync(path.dirname(fullPath), { recursive: true });
          fs.writeFileSync(fullPath, content, 'utf8');
          return {
            ok: true,
            output: `File ${relPath} berhasil ditulis (${Buffer.byteLength(content, 'utf8')} byte).`,
          };
        }

        case 'edit_file': {
          const relPath = String(input.path);
          const oldText = String(input.oldText);
          const newText = String(input.newText);
          const replaceAll = Boolean(input.replaceAll ?? false);
          const fullPath = this.resolveWorkspacePath(relPath);
          if (!fs.existsSync(fullPath)) {
            return { ok: false, output: `File ${relPath} tidak ditemukan.` };
          }
          const content = fs.readFileSync(fullPath, 'utf8');
          if (!content.includes(oldText)) {
            return {
              ok: false,
              output: `oldText tidak ditemukan persis di dalam ${relPath}. Baca ulang file dengan read_file terlebih dahulu.`,
            };
          }
          const updated = replaceAll
            ? content.split(oldText).join(newText)
            : content.replace(oldText, newText);
          fs.writeFileSync(fullPath, updated, 'utf8');
          return {
            ok: true,
            output: `File ${relPath} berhasil diedit.`,
          };
        }

        case 'read_file': {
          const relPath = String(input.path);
          const maxBytes = Number(input.maxBytes ?? 65536);
          const fullPath = this.resolveWorkspacePath(relPath);
          if (!fs.existsSync(fullPath)) {
            return { ok: false, output: `File ${relPath} tidak ditemukan.` };
          }
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            return { ok: false, output: `${relPath} adalah direktori, gunakan list_files.` };
          }
          const raw = fs.readFileSync(fullPath, 'utf8');
          return {
            ok: true,
            output: raw.slice(0, maxBytes),
          };
        }

        case 'list_files': {
          const relDir = String(input.dir ?? '.');
          const depth = Number(input.depth ?? 2);
          const targetDir = this.resolveWorkspacePath(relDir);
          if (!fs.existsSync(targetDir)) {
            return { ok: false, output: `Direktori ${relDir} tidak ditemukan.` };
          }
          const items = this.walkWorkspaceDir(targetDir, depth);
          return {
            ok: true,
            output: items.length > 0 ? items.join('\n') : '(kosong)',
          };
        }

        case 'search_files': {
          const query = String(input.query);
          const maxResults = Number(input.maxResults ?? 50);
          const files = this.walkWorkspaceDir(this.workspaceDir, 5).filter(
            (f) => !f.endsWith('/'),
          );
          const matches: string[] = [];
          for (const rel of files) {
            if (matches.length >= maxResults) break;
            const full = this.resolveWorkspacePath(rel);
            try {
              const text = fs.readFileSync(full, 'utf8');
              const lines = text.split(/\r?\n/);
              lines.forEach((line, idx) => {
                if (matches.length < maxResults && line.includes(query)) {
                  matches.push(`${rel}:${idx + 1}: ${line.trim().slice(0, 160)}`);
                }
              });
            } catch {
              // ignore binary/unreadable files
            }
          }
          return {
            ok: true,
            output: matches.length > 0 ? matches.join('\n') : `Tidak ditemukan "${query}".`,
          };
        }

        case 'git_diff': {
          const args = ['diff'];
          if (input.staged) args.push('--staged');
          if (input.path) args.push('--', String(input.path));
          try {
            const { stdout: statusOut } = await execFileAsync('git', ['status', '--short'], {
              cwd: this.workspaceDir,
            });
            const { stdout: diffOut } = await execFileAsync('git', args, {
              cwd: this.workspaceDir,
            });
            const combined = `Status:\n${statusOut.trim() || '(bersih)'}\n\nDiff:\n${diffOut.trim() || '(tidak ada perubahan terhadap commit terakhir; file baru terlihat di Status)'}`;
            return { ok: true, output: combined.slice(0, 12000) };
          } catch (err) {
            return {
              ok: false,
              output: `Gagal menjalankan git diff: ${err instanceof Error ? err.message : String(err)}`,
            };
          }
        }

        case 'run_command': {
          const command = String(input.command);
          const args = (input.args as string[] | undefined) ?? [];
          const cwdRel = input.cwd ? String(input.cwd) : '.';
          const reason = input.reason ? String(input.reason) : 'Eksekusi perintah di workspace';

          if (!ALLOWED_COMMANDS.has(command.toLowerCase())) {
            return {
              ok: false,
              output: `Perintah "${command}" tidak termasuk dalam allowlist (${Array.from(ALLOWED_COMMANDS).join(', ')}).`,
            };
          }

          const isPlaywrightVisualCheck =
            agentCfg !== undefined &&
            PLAYWRIGHT_AUTO_APPROVE_ROLES.includes(agentCfg.role) &&
            command.toLowerCase() === 'npx' &&
            args[0] === 'playwright' &&
            args[1] === 'test' &&
            args.every((a) => /^[a-zA-Z0-9_./=-]+$/.test(a));

          const decision = isPlaywrightVisualCheck
            ? { approved: true, reason: 'Auto-approved narrow Playwright check for visual_qa' }
            : await this.requestApproval({
                agentId,
                kind: 'run_command',
                payload: {
                  command,
                  args,
                  cwd: cwdRel,
                  reason,
                  risk: 'Menjalankan proses lokal di dalam folder workspace/',
                },
              });

          this.setAgentStatus(agentId, 'working', `Menjalankan ${command}`);

          if (!decision.approved) {
            return {
              ok: false,
              output: `DITOLAK oleh CEO${decision.reason ? `: ${decision.reason}` : ''}`,
            };
          }

          const execCwd = this.resolveWorkspacePath(cwdRel);
          try {
            const { stdout, stderr } = await execFileAsync(command, args, {
              cwd: execCwd,
              timeout: 30000,
              windowsHide: true,
              shell: process.platform === 'win32' && (command === 'npm' || command === 'npx'),
            });
            const out = [stdout.trim(), stderr.trim()].filter(Boolean).join('\n');
            return { ok: true, output: (out || '(selesai dengan kode 0)').slice(0, 8000) };
          } catch (err) {
            return {
              ok: false,
              output: `Perintah gagal: ${err instanceof Error ? err.message : String(err)}`.slice(
                0,
                4000,
              ),
            };
          }
        }

        case 'security_scan': {
          const scope = String(input.scope ?? 'all');
          const relPath = input.path ? String(input.path) : undefined;
          return {
            ok: true,
            output: JSON.stringify({
              scope,
              path: relPath ?? '.',
              hard: [],
              medium: [],
              note: 'Pemindai deterministik siap (detail penuh diaktifkan pada Komponen C).',
            }),
          };
        }

        case 'finish': {
          const summary = input.summary ? String(input.summary) : 'Giliran selesai.';
          return { ok: true, output: summary, finished: true };
        }
      }
    } catch (error) {
      return {
        ok: false,
        output: `Error saat menjalankan ${toolName}: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  public walkWorkspaceDir(baseDir: string, maxDepth: number, currentDepth = 1): string[] {
    if (currentDepth > maxDepth || !fs.existsSync(baseDir)) return [];
    const entries = fs.readdirSync(baseDir, { withFileTypes: true });
    const results: string[] = [];
    for (const entry of entries) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      const full = path.join(baseDir, entry.name);
      const rel = path.relative(this.workspaceDir, full).replace(/\\/g, '/');
      if (entry.isDirectory()) {
        results.push(`${rel}/`);
        results.push(...this.walkWorkspaceDir(full, maxDepth, currentDepth + 1));
      } else {
        results.push(rel);
      }
    }
    return results;
  }

  public handleClientCommand(cmd: ClientCommand): void {
    switch (cmd.type) {
      case 'ceo.send': {
        this.sendMessage({
          sender: 'ceo',
          to: cmd.to,
          body: cmd.text,
          projectId: cmd.projectId ?? 'default',
        });
        break;
      }
      case 'approval.respond': {
        this.respondApproval(cmd.id, cmd.approved, cmd.reason, 'ceo');
        break;
      }
      case 'office.setMode': {
        this.setMode(cmd.mode);
        break;
      }
      case 'office.pauseAll': {
        this.setPaused(cmd.paused);
        break;
      }
      case 'office.setLanguage': {
        this.setLanguage(cmd.language);
        break;
      }
      case 'office.stopAgent': {
        this.stopAgent(cmd.agentId);
        break;
      }
      case 'task.move': {
        try {
          this.updateTask({
            taskId: cmd.taskId,
            status: cmd.status,
            actor: 'ceo',
          });
        } catch (err) {
          this.emit({
            type: 'error',
            code: 'INVALID_TASK_TRANSITION',
            message: err instanceof Error ? err.message : String(err),
            at: new Date().toISOString(),
          });
        }
        break;
      }
    }
  }

  public getSnapshot(): StateSnapshot {
    const day = this.todayKey();
    const usageRows = this.db.db
      .prepare('SELECT agent_id, day, requests, tokens_in, tokens_out, cap FROM usage WHERE day = ?')
      .all(day) as Array<{
      agent_id: string;
      day: string;
      requests: number;
      tokens_in: number;
      tokens_out: number;
      cap: number;
    }>;

    return {
      office: {
        name: this.config.office.name,
        version: SCHEMA_VERSION,
        mode: this.getMode(),
        language: this.getLanguage(),
        paused: this.isPaused(),
        timezone: this.config.office.timezone,
        gateway: this.gatewayHealth,
        serverTime: new Date().toISOString(),
      },
      projects: this.listProjects(),
      agents: this.listAgents(),
      tasks: this.listTasks(),
      approvals: this.listApprovals(),
      messages: this.listMessages(150),
      usage: usageRows.map((u) => ({
        agentId: u.agent_id,
        day: u.day,
        requests: u.requests,
        tokensIn: u.tokens_in,
        tokensOut: u.tokens_out,
        cap: u.cap,
      })),
    };
  }
}
