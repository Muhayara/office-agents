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
  type Project,
  SCHEMA_VERSION,
  SECURITY_SCAN_ROLES,
  type SecurityFinding,
  type ServerEvent,
  type StateSnapshot,
  type Task,
  type TaskPriority,
  type TaskStatus,
  type ToolName,
  type Usage,
  canTransitionTask,
  formatPublicModelName,
  managerOf,
  validateToolInput,
} from '@office/shared';
import { OfficeDb } from '../db';
import { GitService } from '../git/git-service';
import { runSecurityScan } from '../security/scanner';
import { evaluateCommand, sanitizedChildEnv } from '../security/command-policy';
import { nextZonedMidnight, normalizeTimeZone, zonedDayKey } from './time';

const execFileAsync = promisify(execFile);

export type EventListener = (event: ServerEvent) => void;

/** Tool yang mengubah state kantor/workspace (dipakai untuk menilai efek samping giliran gagal). */
const SIDE_EFFECT_TOOLS: ReadonlySet<ToolName> = new Set<ToolName>([
  'send_message',
  'create_task',
  'claim_task',
  'update_task',
  'post_report',
  'request_review',
  'ask_human',
  'escalate',
  'write_file',
  'edit_file',
  'run_command',
]);

/** Ekstensi yang dilewati search_files (biner/aset besar). */
const BINARY_EXTENSIONS: ReadonlySet<string> = new Set([
  '.glb', '.gltf', '.bin', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf',
  '.zip', '.gz', '.mp3', '.mp4', '.wav', '.woff', '.woff2', '.ttf', '.otf', '.db', '.sqlite',
]);

const EVENTS_KEEP = 5000;
const SNAPSHOT_TASK_LIMIT = 500;
const WALK_ENTRY_LIMIT = 5000;

interface TaskRow {
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

function rowToTask(r: TaskRow): Task {
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

export interface RunStepView {
  seq: number;
  kind: string;
  name?: string;
  input?: string;
  output?: string;
}

export interface RunView {
  id: string;
  agentId: string;
  taskId?: string;
  model: string;
  status: string;
  startedAt: string;
  endedAt?: string;
  error?: string;
  steps: RunStepView[];
}

interface PendingApprovalResolver {
  agentId: string;
  resolve: (approved: boolean) => void;
  timer: NodeJS.Timeout;
}

export class OfficeCore {
  public readonly config: OfficeConfig;
  public readonly db: OfficeDb;
  public readonly workspaceDir: string;
  public readonly repoRoot: string;
  public readonly gitService: GitService;

  private listeners = new Set<EventListener>();
  private pendingApprovals = new Map<string, PendingApprovalResolver>();
  private seqCounter = 0;
  private gatewayHealth: GatewayHealth;
  private securityFindings: SecurityFinding[] = [];
  private stopAgentHandlers = new Map<string, () => void>();
  private wakeCallback?: () => void;
  private readonly timeZone: string;
  private toolCallCounts = new Map<string, number>();
  private recentRequestTimes: number[] = [];
  private emitsSincePrune = 0;

  constructor(options: {
    config: OfficeConfig;
    db: OfficeDb;
    workspaceDir: string;
    repoRoot?: string;
  }) {
    this.config = options.config;
    this.db = options.db;
    this.timeZone = normalizeTimeZone(this.config.office.timezone);
    this.workspaceDir = path.resolve(options.workspaceDir);
    const parentDir = path.resolve(this.workspaceDir, '..');
    this.repoRoot = options.repoRoot
      ? path.resolve(options.repoRoot)
      : fs.existsSync(path.join(parentDir, '.gitignore')) ||
          fs.existsSync(path.join(parentDir, 'office.config.json'))
        ? parentDir
        : this.workspaceDir;
    fs.mkdirSync(this.workspaceDir, { recursive: true });

    this.gitService = new GitService({
      repoRoot: this.repoRoot,
      workspaceDir: this.workspaceDir,
      gitConfig: this.config.git,
      onStatusChange: (gitStatus, findings) => {
        const now = new Date().toISOString();
        this.emit({ type: 'git.updated', git: gitStatus, at: now });
        if (findings) {
          this.securityFindings = findings;
          this.emit({ type: 'security.findings', findings, at: now });
        }
      },
    });

    const now = new Date().toISOString();
    this.gatewayHealth = {
      status: 'online',
      baseUrl: this.config.gateway.baseUrl,
      checkedAt: now,
    };

    this.bootstrapState();
    void this.gitService.refreshStatus();
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

  /** Hari kantor menurut `office.timezone` (kuota reset tengah malam waktu lokal). */
  public todayKey(now = new Date()): string {
    return zonedDayKey(now, this.timeZone);
  }

  public nextResetIso(now = new Date()): string {
    return nextZonedMidnight(now, this.timeZone).toISOString();
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

    // Approval yang menunggu saat server mati tidak punya resolver lagi -> kedaluwarsa.
    // security_block tetap pending: itu catatan yang harus dikonfirmasi CEO.
    this.db.db
      .prepare(
        `UPDATE approvals SET status = 'expired', decided_at = ?, decided_by = 'system',
           reason = 'Kedaluwarsa — server dimulai ulang'
         WHERE status = 'pending' AND kind != 'security_block'`,
      )
      .run(now);

    this.pruneHistory();
  }

  /** Batasi pertumbuhan tabel log: event terbaru saja, langkah run 30 hari terakhir. */
  public pruneHistory(): void {
    this.db.db
      .prepare('DELETE FROM events WHERE id <= (SELECT MAX(id) FROM events) - ?')
      .run(EVENTS_KEEP);
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    this.db.db
      .prepare('DELETE FROM steps WHERE run_id IN (SELECT id FROM runs WHERE started_at < ?)')
      .run(cutoff);
    this.db.db.prepare('DELETE FROM runs WHERE started_at < ?').run(cutoff);
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
    this.emitsSincePrune += 1;
    if (this.emitsSincePrune >= 500) {
      this.emitsSincePrune = 0;
      this.pruneHistory();
    }

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
    if (!this.getAgentConfig(agentId)) {
      throw new Error(`Agen "${agentId}" tidak terdaftar`);
    }
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
    this.recentRequestTimes.push(Date.now());
    return usage;
  }

  /** Total request semua kursi hari ini (dibandingkan dengan limits.globalReqPerDay). */
  public totalRequestsToday(): number {
    const row = this.db.db
      .prepare('SELECT COALESCE(SUM(requests), 0) AS total FROM usage WHERE day = ?')
      .get(this.todayKey()) as { total: number };
    return Number(row.total);
  }

  public isGlobalDailyCapReached(): boolean {
    return this.totalRequestsToday() >= this.config.limits.globalReqPerDay;
  }

  private requestsInLastMinute(now = Date.now()): number {
    const since = now - 60_000;
    while (this.recentRequestTimes.length > 0 && this.recentRequestTimes[0]! < since) {
      this.recentRequestTimes.shift();
    }
    return this.recentRequestTimes.length;
  }

  public isGlobalMinuteCapReached(): boolean {
    return this.requestsInLastMinute() >= this.config.limits.globalReqPerMin;
  }

  /**
   * Tunggu sampai ada slot di batas global per menit (limits.globalReqPerMin).
   * Melempar error bila batas harian kantor (limits.globalReqPerDay) tercapai.
   */
  public async waitForRateSlot(signal?: AbortSignal): Promise<void> {
    if (this.isGlobalDailyCapReached()) {
      throw new Error(
        `Batas harian kantor tercapai (${this.config.limits.globalReqPerDay} request); lanjut besok.`,
      );
    }
    while (this.isGlobalMinuteCapReached()) {
      if (signal?.aborted) throw new Error('Turn dibatalkan (AbortSignal)');
      const oldest = this.recentRequestTimes[0] ?? Date.now();
      const waitMs = Math.max(250, oldest + 60_000 - Date.now());
      await new Promise((resolve) => setTimeout(resolve, Math.min(waitMs, 5000)));
    }
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

    const usedToday = new Map(
      (
        this.db.db
          .prepare('SELECT agent_id, requests FROM usage WHERE day = ?')
          .all(this.todayKey()) as Array<{ agent_id: string; requests: number }>
      ).map((u) => [u.agent_id, u.requests]),
    );
    const resetAt = this.nextResetIso();
    const capFor = (agentId: string) => {
      const cfg = this.getAgentConfig(agentId);
      return cfg ? (cfg.driver === 'manual' ? 0 : cfg.dailyCap) : 80;
    };

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      role: r.role,
      title: r.title ?? undefined,
      color: r.color,
      status: r.status,
      driver: r.driver,
      model: formatPublicModelName(r.model),
      desk: { x: r.desk_x, y: r.desk_y },
      currentTaskId: r.current_task_id ?? undefined,
      currentTaskTitle: r.current_task_title ?? undefined,
      quota: { used: usedToday.get(r.id) ?? 0, cap: capFor(r.id), resetAt },
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
    const recipient = this.resolveRecipient(params.to);
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

  /**
   * Normalisasi penerima: "manager" -> id manajer, nama ("Bima") -> id ("bima"),
   * "ceo"/"all" apa adanya. Penerima tak dikenal ditolak agar pesan tidak hilang diam-diam.
   */
  public resolveRecipient(to: string): string {
    const key = to.trim().toLowerCase();
    if (key === 'manager') return managerOf(this.config).id;
    if (key === 'ceo' || key === 'all') return key;
    const agent = this.resolveAgent(key);
    if (agent) return agent.id;
    const options = ['ceo', 'all', 'manager', ...this.config.agents.map((a) => a.id)].join(', ');
    throw new Error(`Penerima "${to}" tidak dikenal. Pilihan: ${options}`);
  }

  /** Tandai pesan terbaca setelah giliran agen benar-benar selesai diproses. */
  public markMessagesRead(agentId: string, messageIds: string[]): void {
    if (messageIds.length === 0) return;
    const now = new Date().toISOString();
    const stmt = this.db.db.prepare(
      'UPDATE messages SET read_at = ? WHERE id = ? AND recipient = ? AND read_at IS NULL',
    );
    const changed: string[] = [];
    for (const id of messageIds) {
      if (Number(stmt.run(now, id, agentId).changes) > 0) changed.push(id);
    }
    if (changed.length > 0) {
      this.emit({ type: 'message.read', agentId, messageIds: changed.slice(0, 100), at: now });
    }
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
    const assigneeCfg = this.resolveAgent(params.assignee);
    if (!assigneeCfg || !assigneeCfg.enabled) {
      throw new Error(
        `Assignee "${params.assignee}" tidak dikenal atau nonaktif. Pilihan: ${this.config.agents
          .filter((a) => a.enabled)
          .map((a) => a.id)
          .join(', ')}`,
      );
    }
    params = { ...params, assignee: assigneeCfg.id };

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
    const r = this.db.db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as TaskRow | undefined;
    return r ? rowToTask(r) : undefined;
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
      .prepare(`SELECT * FROM tasks ${where} ORDER BY created_at ASC`)
      .all(...args) as unknown as TaskRow[];
    return rows.map(rowToTask);
  }

  /** Tugas untuk snapshot UI: semua yang belum selesai + yang selesai paling baru. */
  private listTasksForSnapshot(): Task[] {
    const rows = this.db.db
      .prepare(
        `SELECT * FROM (
           SELECT * FROM tasks ORDER BY (status = 'done') ASC, updated_at DESC LIMIT ?
         ) ORDER BY created_at ASC`,
      )
      .all(SNAPSHOT_TASK_LIMIT) as unknown as TaskRow[];
    return rows.map(rowToTask);
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

  public getTaskRevisionCount(taskId: string): number {
    const row = this.db.db.prepare('SELECT revisions_used FROM tasks WHERE id = ?').get(taskId) as
      | { revisions_used: number }
      | undefined;
    return row?.revisions_used ?? 0;
  }

  private requireTask(taskId: string): Task {
    const task = this.getTask(taskId);
    if (!task) throw new Error(`Tugas #${taskId} tidak ditemukan`);
    return task;
  }

  /** Cari kursi lewat id atau nama (tanpa peka huruf besar/kecil), mis. "Bima" -> bima. */
  public resolveAgent(idOrName: string): AgentConfig | undefined {
    const key = idOrName.trim().toLowerCase();
    if (!key) return undefined;
    return (
      this.config.agents.find((a) => a.id.toLowerCase() === key) ??
      this.config.agents.find((a) => a.name.toLowerCase() === key)
    );
  }

  /**
   * Siapa boleh mengubah status tugas:
   * - reviewer: semua transisi sah (ACC/REJECT);
   * - security: boleh memblokir tugas apa pun (veto);
   * - manager: boleh mengatur tugas, tapi tugas yang berisi file wajib lewat review sebelum done;
   * - assignee: tugasnya sendiri, dengan aturan done yang sama;
   * - selain itu ditolak.
   */
  private checkTaskStatusPermission(
    actor: AgentConfig,
    task: Task,
    nextStatus: TaskStatus,
  ): string | null {
    if (actor.role === 'reviewer') return null;
    if (actor.role === 'security' && nextStatus === 'blocked') return null;

    const isManager = actor.role === 'manager';
    const isAssignee = task.assignee === actor.id;
    if (!isManager && !isAssignee) {
      return `Tugas #${task.id} milik ${task.assignee}; hanya assignee, manajer, atau reviewer yang boleh mengubah statusnya.`;
    }
    if (nextStatus === 'done' && task.files.length > 0) {
      return `Tugas #${task.id} berisi file; ajukan request_review ke reviewer, hanya reviewer yang boleh menandai done.`;
    }
    return null;
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
    /** Dibatalkan bila giliran agen dihentikan (stop/pause/timeout). */
    signal?: AbortSignal;
  }): Promise<{ approved: boolean; reason?: string }> {
    const now = new Date().toISOString();
    const id = this.nextId('apr');
    const mode = this.getMode();

    if (params.signal?.aborted) {
      return { approved: false, reason: 'Giliran sudah dibatalkan' };
    }

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
      let settled = false;
      const finish = (result: { approved: boolean; reason?: string }) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        params.signal?.removeEventListener('abort', onAbort);
        this.pendingApprovals.delete(id);
        resolve(result);
      };

      const timer = setTimeout(() => {
        this.expireApproval(id, 'Kedaluwarsa — perintah ditolak');
        finish({ approved: false, reason: 'Kedaluwarsa — perintah ditolak' });
      }, this.config.limits.approvalTimeoutMs);

      // Giliran dihentikan saat menunggu izin -> izin ikut dibatalkan, perintah tidak akan jalan.
      const onAbort = () => {
        this.expireApproval(id, 'Dibatalkan — giliran agen dihentikan');
        finish({ approved: false, reason: 'Dibatalkan — giliran agen dihentikan' });
      };
      params.signal?.addEventListener('abort', onAbort, { once: true });

      this.pendingApprovals.set(id, {
        agentId: params.agentId,
        resolve: (approved: boolean) => {
          const row = this.db.db
            .prepare('SELECT reason FROM approvals WHERE id = ?')
            .get(id) as { reason: string | null } | undefined;
          finish({ approved, reason: row?.reason ?? undefined });
        },
        timer,
      });
    });
  }

  /** Menandai approval pending sebagai kedaluwarsa (tanpa memutuskan approval yang sudah final). */
  private expireApproval(id: string, reason: string): void {
    const at = new Date().toISOString();
    const res = this.db.db
      .prepare(
        `UPDATE approvals SET status = 'expired', decided_at = ?, decided_by = 'system', reason = ?
         WHERE id = ? AND status = 'pending'`,
      )
      .run(at, reason, id);
    if (Number(res.changes) > 0) {
      this.emit({ type: 'approval.resolved', id, approved: false, decidedBy: 'system', reason, at });
    }
  }

  /** Apakah agen sedang menunggu keputusan CEO (dipakai watchdog giliran). */
  public hasPendingApprovalFor(agentId: string): boolean {
    for (const pending of this.pendingApprovals.values()) {
      if (pending.agentId === agentId) return true;
    }
    return false;
  }

  public respondApproval(id: string, approved: boolean, reason?: string, decidedBy = 'ceo'): void {
    const now = new Date().toISOString();
    const row = this.db.db.prepare('SELECT status FROM approvals WHERE id = ?').get(id) as
      | { status: Approval['status'] }
      | undefined;
    if (!row) {
      throw new Error(`Approval #${id} tidak ditemukan`);
    }
    if (row.status !== 'pending') {
      // Jejak audit approval final (disetujui/ditolak/kedaluwarsa) tidak boleh ditimpa.
      throw new Error(`Approval #${id} sudah diputuskan (${row.status})`);
    }

    const status = approved ? 'approved' : 'denied';
    this.db.db
      .prepare(
        `UPDATE approvals SET status = ?, decided_at = ?, decided_by = ?, reason = ? WHERE id = ? AND status = 'pending'`,
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
    options: { signal?: AbortSignal } = {},
  ): Promise<{ ok: boolean; output: string; finished?: boolean }> {
    const validated = validateToolInput(toolName, rawInput ?? {});
    if (!validated.ok) {
      return { ok: false, output: `Argumen tool ${toolName} tidak valid: ${validated.error}` };
    }
    const input = validated.data as Record<string, unknown>;
    const agentCfg = this.getAgentConfig(agentId);

    // Tolak-secara-default: hanya kursi terdaftar & aktif yang boleh memakai tool.
    // Tanpa ini, agentId palsu (mis. dari MCP ?agent=x) melewati semua guard peran.
    if (!agentCfg || !agentCfg.enabled) {
      return {
        ok: false,
        output: `Agen "${agentId}" tidak terdaftar atau nonaktif; tool ${toolName} ditolak.`,
      };
    }

    // Role guard for file writing
    if (
      (toolName === 'write_file' || toolName === 'edit_file') &&
      !FILE_WRITING_ROLES.includes(agentCfg.role)
    ) {
      return {
        ok: false,
        output: `Peran ${agentCfg.role} tidak diizinkan mengubah file langsung. Delegasikan ke peran penulis/programmer/desainer (${FILE_WRITING_ROLES.join(', ')}).`,
      };
    }

    // Role guard for command execution
    if (toolName === 'run_command' && !COMMAND_ROLES.includes(agentCfg.role)) {
      return {
        ok: false,
        output: `Peran ${agentCfg.role} tidak diizinkan menjalankan run_command. Hanya peran (${COMMAND_ROLES.join(', ')}) yang diizinkan.`,
      };
    }

    // Role guard for security_scan
    if (toolName === 'security_scan' && !SECURITY_SCAN_ROLES.includes(agentCfg.role)) {
      return {
        ok: false,
        output: `Tool security_scan hanya dapat dijalankan oleh peran (${SECURITY_SCAN_ROLES.join(', ')}).`,
      };
    }

    const result = await this.runTool(agentId, agentCfg, toolName, input, options);
    if (result.ok && SIDE_EFFECT_TOOLS.has(toolName)) {
      this.toolCallCounts.set(agentId, this.getToolCallCount(agentId) + 1);
    }
    return result;
  }

  private async runTool(
    agentId: string,
    agentCfg: AgentConfig,
    toolName: ToolName,
    input: Record<string, unknown>,
    options: { signal?: AbortSignal },
  ): Promise<{ ok: boolean; output: string; finished?: boolean }> {
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
          const task = this.requireTask(String(input.taskId));
          if (task.assignee !== agentId) {
            return {
              ok: false,
              output: `Tugas #${task.id} milik ${task.assignee}; hanya assignee yang boleh mengambilnya.`,
            };
          }
          const updated = this.updateTask({
            taskId: task.id,
            status: 'in_progress',
            actor: agentId,
          });
          return {
            ok: true,
            output: `Tugas #${updated.id} "${updated.title}" diambil dan berstatus in_progress.`,
          };
        }

        case 'update_task': {
          const status = input.status as TaskStatus;
          const note = input.note ? String(input.note) : undefined;
          const existing = this.requireTask(String(input.taskId));
          const denied = this.checkTaskStatusPermission(agentCfg, existing, status);
          if (denied) return { ok: false, output: denied };

          const isReject =
            agentCfg.role === 'reviewer' &&
            existing.status === 'review' &&
            (status === 'in_progress' || status === 'blocked');

          const updated = this.updateTask({
            taskId: existing.id,
            status,
            note,
            actor: agentId,
          });

          if (note) {
            const target =
              agentCfg.role === 'reviewer'
                ? status === 'done'
                  ? managerOf(this.config).id
                  : existing.assignee
                : managerOf(this.config).id;
            if (target !== agentId) {
              this.sendMessage({
                sender: agentId,
                to: target,
                kind: agentCfg.role === 'reviewer' ? 'review' : 'handoff',
                body: `Tugas #${existing.id} -> ${status}: ${note}`,
              });
            }
          }

          if (isReject) {
            const revisions = this.incrementTaskRevision(existing.id);
            const limit = this.config.limits.revisionCycleLimit;
            if (revisions >= limit) {
              const blocked =
                updated.status === 'blocked'
                  ? updated
                  : this.updateTask({
                      taskId: existing.id,
                      status: 'blocked',
                      note: `Ditolak ${revisions}x (batas ${limit}); butuh keputusan CEO.`,
                      actor: 'system',
                    });
              this.sendMessage({
                sender: agentId,
                to: 'ceo',
                kind: 'system',
                body: `ESKALASI: tugas #${blocked.id} "${blocked.title}" sudah ${revisions}x ditolak review (batas ${limit}).`,
              });
            }
          }

          // Commit & push hanya saat ACC reviewer; hasil REJECT tidak boleh masuk ke main.
          if (agentCfg.role === 'reviewer' && status === 'done') {
            await this.handleTaskGitCommit(updated, this.getTaskRevisionCount(updated.id) > 0);
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
          const summary = String(input.summary);
          const files = (input.files as string[] | undefined) ?? [];
          const existing = this.requireTask(String(input.taskId));
          if (existing.assignee !== agentId) {
            return {
              ok: false,
              output: `Hanya assignee (${existing.assignee}) yang boleh melapor untuk tugas #${existing.id}.`,
            };
          }
          if (existing.status === 'done') {
            return {
              ok: false,
              output: `Tugas #${existing.id} sudah selesai; buat tugas baru untuk perubahan lanjutan.`,
            };
          }
          this.updateTask({
            taskId: existing.id,
            status: existing.status === 'todo' ? 'in_progress' : existing.status,
            files,
            actor: agentId,
          });
          const managerId = managerOf(this.config).id;
          this.sendMessage({
            sender: agentId,
            to: managerId,
            kind: 'handoff',
            body: `Laporan tugas #${existing.id}: ${summary}${files.length > 0 ? ` (File: ${files.join(', ')})` : ''}`,
          });
          return {
            ok: true,
            output: `Laporan tugas #${existing.id} dikirim ke ${managerId}.`,
          };
        }

        case 'request_review': {
          const existing = this.requireTask(String(input.taskId));
          const reviewerCfg = this.resolveAgent(String(input.to));
          if (existing.assignee !== agentId) {
            return {
              ok: false,
              output: `Hanya assignee (${existing.assignee}) yang boleh meminta review tugas #${existing.id}.`,
            };
          }
          if (!reviewerCfg || reviewerCfg.role !== 'reviewer') {
            const reviewers = this.config.agents.filter((a) => a.role === 'reviewer').map((a) => a.id);
            return {
              ok: false,
              output: `Review hanya bisa diminta ke peran reviewer (${reviewers.join(', ')}).`,
            };
          }
          if (existing.status === 'todo') {
            this.updateTask({ taskId: existing.id, status: 'in_progress', actor: agentId });
          }
          const updated = this.updateTask({
            taskId: existing.id,
            status: 'review',
            reviewer: reviewerCfg.id,
            actor: agentId,
          });
          this.sendMessage({
            sender: agentId,
            to: reviewerCfg.id,
            kind: 'review',
            body: `Mohon review tugas #${updated.id} "${updated.title}". File: ${updated.files.join(', ') || '(cek git_diff)'}. Detail: ${updated.details}`,
          });
          return {
            ok: true,
            output: `Permintaan review untuk tugas #${updated.id} dikirim ke ${reviewerCfg.id}.`,
          };
        }

        case 'ask_human': {
          const question = String(input.question);
          const taskId = input.taskId ? String(input.taskId) : undefined;
          if (taskId) {
            const task = this.requireTask(taskId);
            const denied = this.checkTaskStatusPermission(agentCfg, task, 'blocked');
            if (denied) return { ok: false, output: denied };
            this.updateTask({
              taskId,
              status: 'blocked',
              note: `Menunggu jawaban CEO: ${question}`,
              actor: agentId,
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
          const reason = String(input.reason);
          const task = this.requireTask(String(input.taskId));
          const denied = this.checkTaskStatusPermission(agentCfg, task, 'blocked');
          if (denied) return { ok: false, output: denied };
          this.updateTask({
            taskId: task.id,
            status: 'blocked',
            note: `Eskalasi: ${reason}`,
            actor: agentId,
          });
          this.sendMessage({
            sender: agentId,
            to: 'ceo',
            kind: 'system',
            body: `ESKALASI tugas #${task.id}: ${reason}`,
          });
          return {
            ok: true,
            output: `Tugas #${task.id} dieskalasi ke CEO.`,
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
            (f) => !f.endsWith('/') && !BINARY_EXTENSIONS.has(path.extname(f).toLowerCase()),
          );
          const matches: string[] = [];
          // Asinkron & dibatasi agar pencarian besar tidak membekukan event loop server.
          for (const rel of files.slice(0, 3000)) {
            if (matches.length >= maxResults) break;
            const full = this.resolveWorkspacePath(rel);
            try {
              const stat = await fs.promises.stat(full);
              if (stat.size > 1024 * 1024) continue;
              const text = await fs.promises.readFile(full, 'utf8');
              const lines = text.split(/\r?\n/);
              for (let idx = 0; idx < lines.length && matches.length < maxResults; idx += 1) {
                if (lines[idx]!.includes(query)) {
                  matches.push(`${rel}:${idx + 1}: ${lines[idx]!.trim().slice(0, 160)}`);
                }
              }
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
          const targetRel = input.path ? String(input.path) : '.';
          const args = ['diff'];
          if (input.staged) args.push('--staged');
          args.push('--', targetRel);
          try {
            const { stdout: statusOut } = await execFileAsync(
              'git',
              ['status', '--short', '--', targetRel],
              {
                cwd: this.workspaceDir,
              },
            );
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
          const cwdRel = input.cwd ? String(input.cwd) : '.';
          const reason = input.reason ? String(input.reason) : 'Eksekusi perintah di workspace';

          const policy = evaluateCommand(
            String(input.command),
            (input.args as string[] | undefined) ?? [],
          );
          if (!policy.ok) {
            return { ok: false, output: `Perintah ditolak kebijakan keamanan: ${policy.reason}` };
          }
          const { command, args } = policy;
          const execCwd = this.resolveWorkspacePath(cwdRel);

          // Tidak ada lagi persetujuan otomatis per peran: perintah apa pun bisa menjalankan
          // kode yang ditulis agen lain (mis. config/test Playwright), jadi CEO harus melihatnya.
          const decision = await this.requestApproval({
            agentId,
            kind: 'run_command',
            payload: {
              command,
              args,
              cwd: cwdRel,
              reason,
              risk: 'Menjalankan proses lokal di dalam folder workspace/ (bisa mengeksekusi kode proyek)',
            },
            signal: options.signal,
          });

          if (!decision.approved) {
            return {
              ok: false,
              output: `DITOLAK oleh CEO${decision.reason ? `: ${decision.reason}` : ''}`,
            };
          }
          if (options.signal?.aborted) {
            return { ok: false, output: 'Giliran dibatalkan; perintah tidak dijalankan.' };
          }

          this.setAgentStatus(agentId, 'working', `Menjalankan ${command}`);
          try {
            const { stdout, stderr } = await execFileAsync(command, args, {
              cwd: execCwd,
              timeout: policy.timeoutMs,
              windowsHide: true,
              shell: policy.useShell,
              env: sanitizedChildEnv(process.env, [this.config.gateway.apiKeyEnv]),
              maxBuffer: 4 * 1024 * 1024,
              signal: options.signal,
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
          const scope = (input.scope as 'staged' | 'workspace' | 'all' | undefined) ?? 'all';
          const relPath = input.path ? String(input.path) : undefined;
          const result = runSecurityScan({
            repoRoot: this.repoRoot,
            scope,
            targetPath: relPath,
          });
          this.securityFindings = result.all;
          this.emit({
            type: 'security.findings',
            findings: result.all,
            at: result.scannedAt,
          });
          return {
            ok: true,
            output: JSON.stringify({
              passed: result.passed,
              scannedFiles: result.scannedFiles,
              hard: result.hard,
              medium: result.medium,
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

  public walkWorkspaceDir(
    baseDir: string,
    maxDepth: number,
    currentDepth = 1,
    results: string[] = [],
  ): string[] {
    if (currentDepth > maxDepth || !fs.existsSync(baseDir)) return results;
    const entries = fs.readdirSync(baseDir, { withFileTypes: true });
    for (const entry of entries) {
      if (results.length >= WALK_ENTRY_LIMIT) break;
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      const full = path.join(baseDir, entry.name);
      const rel = path.relative(this.workspaceDir, full).replace(/\\/g, '/');
      if (entry.isDirectory()) {
        results.push(`${rel}/`);
        this.walkWorkspaceDir(full, maxDepth, currentDepth + 1, results);
      } else {
        results.push(rel);
      }
    }
    return results;
  }

  /** Riwayat giliran agen (run + langkah tool) untuk panel inspektur CEO. */
  public listRuns(filter: { agentId?: string; limit?: number } = {}): RunView[] {
    const limit = Math.min(Math.max(filter.limit ?? 10, 1), 50);
    const runs = (
      filter.agentId
        ? this.db.db
            .prepare('SELECT * FROM runs WHERE agent_id = ? ORDER BY started_at DESC LIMIT ?')
            .all(filter.agentId, limit)
        : this.db.db.prepare('SELECT * FROM runs ORDER BY started_at DESC LIMIT ?').all(limit)
    ) as Array<{
      id: string;
      agent_id: string;
      task_id: string | null;
      model: string;
      status: string;
      started_at: string;
      ended_at: string | null;
      error: string | null;
    }>;
    const stepStmt = this.db.db.prepare(
      'SELECT seq, kind, name, input_json, output_json FROM steps WHERE run_id = ? ORDER BY seq ASC LIMIT 40',
    );
    const clip = (v: string | null) => (v ? v.slice(0, 600) : undefined);
    return runs.map((r) => ({
      id: r.id,
      agentId: r.agent_id,
      taskId: r.task_id ?? undefined,
      model: formatPublicModelName(r.model),
      status: r.status,
      startedAt: r.started_at,
      endedAt: r.ended_at ?? undefined,
      error: r.error ?? undefined,
      steps: (
        stepStmt.all(r.id) as Array<{
          seq: number;
          kind: string;
          name: string | null;
          input_json: string | null;
          output_json: string | null;
        }>
      ).map((st) => ({
        seq: st.seq,
        kind: st.kind,
        name: st.name ?? undefined,
        input: clip(st.input_json),
        output: clip(st.output_json),
      })),
    }));
  }

  public getToolCallCount(agentId: string): number {
    return this.toolCallCounts.get(agentId) ?? 0;
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
      tasks: this.listTasksForSnapshot(),
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
      git: this.gitService.getStatus(),
      securityFindings: this.securityFindings,
    };
  }

  private async handleTaskGitCommit(task: Task, isRevision: boolean): Promise<void> {
    const assigneeCfg = this.getAgentConfig(task.assignee);
    const result = await this.gitService.commitAndPush({
      task,
      assignee: assigneeCfg,
      isRevision,
    });

    if (result.blocked) {
      const securityAgent =
        this.config.agents.find((a) => a.role === 'security')?.id ??
        managerOf(this.config).id;
      const managerId = managerOf(this.config).id;
      const hardSummary = result.findings
        .filter((f) => f.severity === 'hard')
        .map((f) => `${f.rule} di ${f.path}${f.line ? `:${f.line}` : ''}`)
        .join('; ');

      const alertBody = `[BLOKIR KEAMANAN PUSH] Tugas #${task.id} ("${task.title}") diblokir oleh pemindai deterministik: ${hardSummary || result.error}`;

      this.sendMessage({
        sender: securityAgent,
        to: managerId,
        kind: 'system',
        body: alertBody,
      });
      this.sendMessage({
        sender: securityAgent,
        to: 'ceo',
        kind: 'system',
        body: alertBody,
      });

      const approvalId = this.nextId('apr');
      const now = new Date().toISOString();
      const payload: ApprovalPayload = {
        taskId: task.id,
        reason: alertBody.slice(0, 500),
        risk: 'Temuan keamanan KERAS memblokir auto-commit/push ke GitHub.',
      };
      this.db.db
        .prepare(
          `INSERT INTO approvals (id, agent_id, kind, payload_json, status, created_at)
           VALUES (?, ?, 'security_block', ?, 'pending', ?)`,
        )
        .run(approvalId, securityAgent, JSON.stringify(payload), now);

      this.emit({
        type: 'approval.requested',
        approval: {
          id: approvalId,
          agentId: securityAgent,
          kind: 'security_block',
          payload,
          status: 'pending',
          createdAt: now,
        },
        at: now,
      });
      return;
    }

    // Kegagalan non-keamanan dulu hilang diam-diam; sekarang manajer/CEO diberi tahu.
    const managerId = managerOf(this.config).id;
    if (result.skipped === 'no_files') {
      this.sendMessage({
        sender: 'system',
        to: managerId,
        kind: 'system',
        body: `Tugas #${task.id} ("${task.title}") di-ACC tetapi tidak di-commit: ${result.error ?? 'tidak ada daftar file'}. Minta ${task.assignee} melaporkan ulang daftar file lewat tugas revisi.`,
      });
    } else if (result.committed && !result.pushed && result.error) {
      this.sendMessage({
        sender: 'system',
        to: 'ceo',
        kind: 'system',
        body: `[GIT] ${result.error}`,
      });
    }
  }
}
