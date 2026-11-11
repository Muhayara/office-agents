import { type AgentConfig, activeSeats } from '@office/shared';
import type { OfficeCore } from './office-core';
import type { AgentDriver } from '../drivers/types';

export class OfficeScheduler {
  private readonly core: OfficeCore;
  private readonly driver: AgentDriver;
  private readonly runningAgents = new Map<string, AbortController>();
  private tickTimer?: NodeJS.Timeout;
  private healthTimer?: NodeJS.Timeout;
  private isTicking = false;

  constructor(core: OfficeCore, driver: AgentDriver, options?: { autoWake?: boolean }) {
    this.core = core;
    this.driver = driver;
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
      ctrl.abort();
    }
    this.runningAgents.clear();
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
          detail: 'Gateway 9router aktif',
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
    this.isTicking = true;
    try {
      const seats = activeSeats(this.core.config);
      for (const agent of seats) {
        if (this.core.isPaused()) break;
        if (this.runningAgents.has(agent.id)) continue;

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

  public async runAgentTurn(agent: AgentConfig): Promise<void> {
    if (this.runningAgents.has(agent.id) || this.core.isPaused()) return;

    const unreadMessages = this.core.readInbox(agent.id, 20, true);
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
    const timeout = setTimeout(() => controller.abort(), this.core.config.limits.turnTimeoutMs);
    this.runningAgents.set(agent.id, controller);
    this.core.registerStopHandler(agent.id, () => controller.abort());

    const runId = `run_${Date.now().toString(36)}_${agent.id}`;
    const startedAt = new Date().toISOString();

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
          ? Math.min(this.core.config.limits.maxStepsPerTurn + 4, 20)
          : this.core.config.limits.maxStepsPerTurn;

      const result = await this.driver.runTurn({
        agent,
        unreadMessages,
        activeTasks,
        recentContext: this.core.listMessages(12),
        maxSteps,
        signal: controller.signal,
      });

      const endedAt = new Date().toISOString();
      this.core.db.db
        .prepare(`UPDATE runs SET status = 'ok', model = ?, ended_at = ? WHERE id = ?`)
        .run(result.modelUsed, endedAt, runId);

      for (const step of result.steps) {
        this.core.db.db
          .prepare(
            `INSERT INTO steps (id, run_id, seq, kind, name, input_json, output_json, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            `${runId}_s${step.seq}`,
            runId,
            step.seq,
            step.kind,
            step.name ?? null,
            step.input ? JSON.stringify(step.input).slice(0, 8000) : null,
            step.output ? JSON.stringify(step.output).slice(0, 8000) : null,
            endedAt,
          );
      }

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
      const aborted = controller.signal.aborted;
      const errMsg = error instanceof Error ? error.message : String(error);

      this.core.db.db
        .prepare(`UPDATE runs SET status = ?, ended_at = ?, error = ? WHERE id = ?`)
        .run(aborted ? 'aborted' : 'error', endedAt, errMsg.slice(0, 500), runId);

      this.core.setAgentStatus(
        agent.id,
        aborted ? 'idle' : 'error',
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
      clearTimeout(timeout);
      this.runningAgents.delete(agent.id);
      this.core.unregisterStopHandler(agent.id);
    }
  }
}
