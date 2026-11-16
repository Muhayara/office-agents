import { randomUUID } from 'node:crypto';
import { type AgentConfig, activeSeats } from '@office/shared';
import type { OfficeCore } from './office-core';
import type { AgentDriver } from '../drivers/types';

/** Alasan pembatalan giliran (dibawa lewat AbortSignal.reason). */
export const ABORT_STOPPED = 'stopped';
export const ABORT_TIMEOUT = 'timeout';

const BACKOFF_BASE_MS = 15_000;
const BACKOFF_MAX_MS = 5 * 60_000;
/** Setelah sekian kali gagal beruntun, pesan ditandai terbaca dan CEO diberi tahu. */
export const MAX_TURN_FAILURES = 5;

interface FailureState {
  count: number;
  retryAt: number;
  lastError: string;
}

export class OfficeScheduler {
  public readonly maxParallelSeats: number;
  private readonly core: OfficeCore;
  private readonly driver: AgentDriver;
  private readonly runningAgents = new Map<string, AbortController>();
  private readonly failures = new Map<string, FailureState>();
  private tickTimer?: NodeJS.Timeout;
  private healthTimer?: NodeJS.Timeout;
  private isTicking = false;

  constructor(
    core: OfficeCore,
    driver: AgentDriver,
    options?: { autoWake?: boolean; maxParallelSeats?: number },
  ) {
    this.core = core;
    this.driver = driver;
    this.maxParallelSeats = options?.maxParallelSeats ?? 3;
    if (options?.autoWake ?? true) {
      this.core.onWake(() => {
        void this.tick();
      });
    }
  }

  public start(intervalMs = 1500): void {
    if (this.tickTimer) return;
    this.tickTimer = setInterval(() => {
      void this.tick();
    }, intervalMs);
    void this.checkGatewayHealth();
    this.healthTimer = setInterval(() => {
      void this.checkGatewayHealth();
    }, 20000);
  }

  public stop(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = undefined;
    }
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = undefined;
    }
    for (const ctrl of this.runningAgents.values()) {
      ctrl.abort(ABORT_STOPPED);
    }
    this.runningAgents.clear();
  }

  /** Status backoff kursi (untuk test/diagnostik). */
  public getFailureState(agentId: string): Readonly<FailureState> | undefined {
    return this.failures.get(agentId);
  }

  public async checkGatewayHealth(): Promise<void> {
    const baseUrl = this.core.config.gateway.baseUrl.replace(/\/$/, '');
    const apiKey = process.env[this.core.config.gateway.apiKeyEnv] ?? '';
    const t0 = Date.now();
    try {
      const headers: Record<string, string> = {};
      if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
      const res = await fetch(`${baseUrl}/models`, {
        headers,
        signal: AbortSignal.timeout(5000),
      });
      const latencyMs = Date.now() - t0;
      if (res.ok) {
        this.core.setGatewayHealth({
          status: 'online',
          baseUrl: this.core.config.gateway.baseUrl,
          checkedAt: new Date().toISOString(),
          latencyMs,
          detail: 'Gateway aktif',
        });
      } else {
        this.core.setGatewayHealth({
          status: 'degraded',
          baseUrl: this.core.config.gateway.baseUrl,
          checkedAt: new Date().toISOString(),
          latencyMs,
          detail: `HTTP ${res.status}`,
        });
      }
    } catch (err) {
      this.core.setGatewayHealth({
        status: 'offline',
        baseUrl: this.core.config.gateway.baseUrl,
        checkedAt: new Date().toISOString(),
        detail: err instanceof Error ? err.message : 'Gateway tidak merespons',
      });
    }
  }

  public async tick(): Promise<void> {
    if (this.isTicking || this.core.isPaused()) return;
    // Batas harian kantor: jangan mulai giliran baru; pesan tetap menunggu sampai besok.
    if (this.core.isGlobalDailyCapReached()) return;
    this.isTicking = true;
    try {
      const seats = activeSeats(this.core.config);
      const now = Date.now();
      for (const agent of seats) {
        if (this.core.isPaused()) break;
        if (this.runningAgents.size >= this.maxParallelSeats) break;
        if (this.runningAgents.has(agent.id)) continue;

        const failure = this.failures.get(agent.id);
        if (failure && failure.retryAt > now) continue;

        const quota = this.core.getQuota(agent.id);
        if (quota.cap > 0 && quota.used >= quota.cap) {
          continue;
        }

        const unread = this.core.readInbox(agent.id, 10, false);
        if (unread.length === 0) continue;

        // Launch agent turn asynchronously (1 process per agent)
        void this.runAgentTurn(agent);
      }
    } finally {
      this.isTicking = false;
    }
  }

  private recordFailure(agent: AgentConfig, error: string, messageIds: string[]): void {
    const prev = this.failures.get(agent.id);
    const count = (prev?.count ?? 0) + 1;
    if (count >= MAX_TURN_FAILURES) {
      // Menyerah: tandai terbaca agar tidak berulang tanpa akhir, dan beri tahu CEO.
      this.failures.delete(agent.id);
      this.core.markMessagesRead(agent.id, messageIds);
      this.core.sendMessage({
        sender: 'system',
        to: 'ceo',
        kind: 'system',
        body: `${agent.name} gagal menjalankan giliran ${count}x beruntun${
          messageIds.length > 0 ? `; ${messageIds.length} pesan ditandai terbaca agar tidak berulang` : ''
        }. Error terakhir: ${error.slice(0, 240)}`,
      });
      return;
    }
    const delay = Math.min(BACKOFF_BASE_MS * 2 ** (count - 1), BACKOFF_MAX_MS);
    this.failures.set(agent.id, { count, retryAt: Date.now() + delay, lastError: error });
  }

  public async runAgentTurn(agent: AgentConfig): Promise<void> {
    if (
      this.runningAgents.has(agent.id) ||
      this.runningAgents.size >= this.maxParallelSeats ||
      this.core.isPaused()
    ) {
      return;
    }

    // Intip dulu; pesan baru ditandai terbaca setelah giliran berhasil diproses,
    // supaya gateway yang mati di tengah giliran tidak menghilangkan perintah CEO.
    const unreadMessages = this.core.readInbox(agent.id, 20, false);
    const unreadIds = unreadMessages.map((m) => m.id);
    const activeTasks =
      agent.role === 'reviewer'
        ? this.core.listTasks({ status: 'review' })
        : this.core
            .listTasks({ assignee: agent.id })
            .filter((t) => t.status === 'todo' || t.status === 'in_progress');

    if (unreadMessages.length === 0 && activeTasks.length === 0) {
      return;
    }

    // Check task turn limit before running
    const primaryTask = activeTasks[0];
    if (primaryTask) {
      const turns = this.core.incrementTaskTurn(primaryTask.id);
      const maxTurns =
        this.core.getMode() === 'full'
          ? this.core.config.limits.maxTurnsPerTask * 3
          : this.core.config.limits.maxTurnsPerTask;
      if (turns > maxTurns) {
        this.core.updateTask({
          taskId: primaryTask.id,
          status: 'blocked',
          note: `Melewati batas giliran (${maxTurns})`,
          force: true,
        });
        this.core.markMessagesRead(agent.id, unreadIds);
        this.core.sendMessage({
          sender: agent.id,
          to: 'ceo',
          kind: 'system',
          body: `Tugas #${primaryTask.id} dihentikan karena melewati batas ${maxTurns} giliran.`,
        });
        return;
      }
    }

    const controller = new AbortController();
    this.runningAgents.set(agent.id, controller);
    this.core.registerStopHandler(agent.id, () => controller.abort(ABORT_STOPPED));

    // Watchdog: anggaran waktu giliran tidak berkurang selama menunggu keputusan CEO,
    // sehingga approval (maks approvalTimeoutMs) tidak dipotong oleh turnTimeoutMs.
    let budgetMs = this.core.config.limits.turnTimeoutMs;
    let lastTick = Date.now();
    const watchdog = setInterval(() => {
      const now = Date.now();
      if (!this.core.hasPendingApprovalFor(agent.id)) budgetMs -= now - lastTick;
      lastTick = now;
      if (budgetMs <= 0 && !controller.signal.aborted) controller.abort(ABORT_TIMEOUT);
    }, 1000);
    watchdog.unref?.();

    const runId = `run_${Date.now().toString(36)}_${agent.id}_${randomUUID().slice(0, 8)}`;
    const startedAt = new Date().toISOString();
    const toolCallsBefore = this.core.getToolCallCount(agent.id);

    this.core.db.db
      .prepare(
        `INSERT INTO runs (id, agent_id, task_id, driver, model, status, started_at)
         VALUES (?, ?, ?, ?, ?, 'running', ?)`,
      )
      .run(runId, agent.id, primaryTask?.id ?? null, agent.driver, agent.model, startedAt);

    this.core.emit({
      type: 'run.started',
      runId,
      agentId: agent.id,
      taskId: primaryTask?.id,
      at: startedAt,
    });
    this.core.setAgentStatus(agent.id, 'thinking', 'Memproses giliran', primaryTask?.id);

    try {
      const maxSteps =
        this.core.getMode() === 'full'
          ? Math.min(this.core.config.limits.maxStepsPerTurn + 4, 30)
          : this.core.config.limits.maxStepsPerTurn;

      const result = await this.driver.runTurn({
        agent,
        unreadMessages,
        activeTasks,
        recentContext: this.core.listMessages(12),
        maxSteps,
        signal: controller.signal,
      });

      this.core.markMessagesRead(agent.id, unreadIds);
      this.failures.delete(agent.id);

      const endedAt = new Date().toISOString();
      this.core.db.db
        .prepare(`UPDATE runs SET status = 'ok', model = ?, ended_at = ? WHERE id = ?`)
        .run(result.modelUsed, endedAt, runId);

      this.saveSteps(runId, result.steps, endedAt);

      this.core.setAgentStatus(agent.id, 'idle');
      this.core.emit({
        type: 'run.finished',
        runId,
        agentId: agent.id,
        status: 'ok',
        at: endedAt,
      });
    } catch (error) {
      const endedAt = new Date().toISOString();
      const reason = controller.signal.aborted ? String(controller.signal.reason) : '';
      const stoppedByCeo = reason === ABORT_STOPPED;
      const aborted = controller.signal.aborted;
      const errMsg =
        reason === ABORT_TIMEOUT
          ? `Melewati batas waktu giliran (${Math.round(this.core.config.limits.turnTimeoutMs / 1000)} dtk)`
          : error instanceof Error
            ? error.message
            : String(error);
      const hadSideEffects = this.core.getToolCallCount(agent.id) > toolCallsBefore;

      if (stoppedByCeo) {
        // CEO sengaja menghentikan: jangan diulang otomatis.
        this.core.markMessagesRead(agent.id, unreadIds);
      } else {
        if (hadSideEffects) {
          // Sebagian aksi sudah terjadi: jangan ulang pesan yang sama (bisa menggandakan tugas/file),
          // cukup beri catatan agar agen memeriksa keadaan sebelum melanjutkan.
          this.core.markMessagesRead(agent.id, unreadIds);
          this.core.sendMessage({
            sender: 'system',
            to: agent.id,
            kind: 'system',
            body: `Giliran sebelumnya terputus (${errMsg.slice(0, 200)}). Periksa list_tasks / read_file sebelum melanjutkan agar tidak mengulang pekerjaan.`,
          });
        }
        this.recordFailure(agent, errMsg, hadSideEffects ? [] : unreadIds);
      }

      this.core.db.db
        .prepare(`UPDATE runs SET status = ?, ended_at = ?, error = ? WHERE id = ?`)
        .run(aborted ? 'aborted' : 'error', endedAt, errMsg.slice(0, 500), runId);

      this.core.setAgentStatus(
        agent.id,
        stoppedByCeo ? 'idle' : 'error',
        errMsg.slice(0, 200),
      );
      this.core.emit({
        type: 'run.finished',
        runId,
        agentId: agent.id,
        status: aborted ? 'aborted' : 'error',
        error: errMsg.slice(0, 500),
        at: endedAt,
      });
    } finally {
      clearInterval(watchdog);
      this.runningAgents.delete(agent.id);
      this.core.unregisterStopHandler(agent.id);
    }
  }

  private saveSteps(
    runId: string,
    steps: Awaited<ReturnType<AgentDriver['runTurn']>>['steps'],
    at: string,
  ): void {
    const stmt = this.core.db.db.prepare(
      `INSERT INTO steps (id, run_id, seq, kind, name, input_json, output_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const step of steps) {
      stmt.run(
        `${runId}_s${step.seq}`,
        runId,
        step.seq,
        step.kind,
        step.name ?? null,
        step.input ? JSON.stringify(step.input).slice(0, 8000) : null,
        step.output ? JSON.stringify(step.output).slice(0, 8000) : null,
        at,
      );
    }
  }
}
