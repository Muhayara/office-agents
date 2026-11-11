import type { OfficeCore } from '../core/office-core';
import type { AgentDriver, AgentTurnInput, AgentTurnResult, DriverStepRecord } from './types';

/**
 * Deterministic MockDriver for zero-quota unit & end-to-end tests.
 * Simulates the full chain:
 * - Raka (manager): asks human on ambiguous prompt, creates subtasks on clear prompt, or summarizes reports to CEO.
 * - Sari (researcher): posts 3-point honest report.
 * - Dimas (writer): writes requested markdown/copy file and posts report.
 * - Bima (coder): writes/edits requested code file, checks git_diff, and requests review from laras.
 * - Laras (reviewer): inspects task and marks it done (ACC) + notifies raka.
 */
export class MockDriver implements AgentDriver {
  private readonly core: OfficeCore;

  constructor(core: OfficeCore) {
    this.core = core;
  }

  public async runTurn(input: AgentTurnInput): Promise<AgentTurnResult> {
    const { agent, unreadMessages, activeTasks } = input;
    const steps: DriverStepRecord[] = [];
    this.core.recordUsage(agent.id, 50, 30);

    const combinedInbox = unreadMessages.map((m) => m.body).join('\n');

    if (agent.role === 'manager') {
      // Negative test: ambiguous instruction
      if (combinedInbox.toLowerCase().includes('sesuatu yang keren')) {
        const res = await this.core.executeTool(agent.id, 'ask_human', {
          question: 'Produk atau halaman apa yang ingin dibuat secara spesifik?',
        });
        steps.push({ seq: 1, kind: 'tool', name: 'ask_human', output: res.output });
        return { finalText: res.output, modelUsed: 'mock/manager', steps };
      }

      // If all tasks are done or report arrived from reviewer/coder, summarize to CEO
      const allTasks = this.core.listTasks();
      if (
        allTasks.length > 0 &&
        allTasks.every((t) => t.status === 'done') &&
        unreadMessages.some((m) => m.sender !== 'ceo')
      ) {
        const summary = `Semua tugas selesai (${allTasks.map((t) => t.title).join(', ')}).`;
        const res = await this.core.executeTool(agent.id, 'send_message', {
          to: 'ceo',
          text: summary,
        });
        steps.push({ seq: 1, kind: 'tool', name: 'send_message', output: res.output });
        this.core.agentSay(agent.id, summary, 'proud', 'ceo');
        return { finalText: summary, modelUsed: 'mock/manager', steps };
      }

      // If CEO sent a new instruction and no tasks exist yet, delegate to bima
      if (unreadMessages.some((m) => m.sender === 'ceo')) {
        const res = await this.core.executeTool(agent.id, 'create_task', {
          title: 'Implementasi permintaan CEO di workspace',
          assignee: 'bima',
          details: combinedInbox.slice(0, 300),
          priority: 'normal',
        });
        steps.push({ seq: 1, kind: 'tool', name: 'create_task', output: res.output });
        this.core.agentSay(agent.id, 'Saya delegasikan tugas ini ke Bima.', 'focused', 'bima');
        return { finalText: res.output, modelUsed: 'mock/manager', steps };
      }
    }

    if (agent.role === 'coder') {
      const task = activeTasks.find((t) => t.status === 'todo' || t.status === 'in_progress');
      if (task) {
        await this.core.executeTool(agent.id, 'claim_task', { taskId: task.id });
        const fileName = task.details.includes('profil.html') ? 'profil.html' : 'hello.html';
        const writeRes = await this.core.executeTool(agent.id, 'write_file', {
          path: fileName,
          content: `<!doctype html><html><body><h1>${task.title}</h1><p>${task.details}</p></body></html>`,
        });
        steps.push({ seq: 1, kind: 'tool', name: 'write_file', output: writeRes.output });

        const reportRes = await this.core.executeTool(agent.id, 'post_report', {
          taskId: task.id,
          summary: `File ${fileName} selesai dibuat.`,
          files: [fileName],
        });
        steps.push({ seq: 2, kind: 'tool', name: 'post_report', output: reportRes.output });

        const revRes = await this.core.executeTool(agent.id, 'request_review', {
          taskId: task.id,
          to: 'laras',
        });
        steps.push({ seq: 3, kind: 'tool', name: 'request_review', output: revRes.output });
        this.core.agentSay(agent.id, `File ${fileName} siap direview Laras.`, 'happy', 'laras');
        return { finalText: revRes.output, modelUsed: 'mock/coder', steps };
      }
    }

    if (agent.role === 'reviewer') {
      const reviewTasks = this.core.listTasks({ status: 'review' });
      const task = reviewTasks[0];
      if (task) {
        const upRes = await this.core.executeTool(agent.id, 'update_task', {
          taskId: task.id,
          status: 'done',
          note: 'ACC: File sesuai spesifikasi dan bersih.',
        });
        steps.push({ seq: 1, kind: 'tool', name: 'update_task', output: upRes.output });
        this.core.agentSay(agent.id, `ACC untuk tugas #${task.id}.`, 'happy', 'raka');
        return { finalText: upRes.output, modelUsed: 'mock/reviewer', steps };
      }
    }

    if (agent.role === 'researcher' || agent.role === 'writer') {
      const task = activeTasks[0];
      if (task) {
        const upRes = await this.core.executeTool(agent.id, 'update_task', {
          taskId: task.id,
          status: 'done',
          note: `Selesai oleh ${agent.name}.`,
        });
        steps.push({ seq: 1, kind: 'tool', name: 'update_task', output: upRes.output });
        return { finalText: upRes.output, modelUsed: `mock/${agent.role}`, steps };
      }
    }

    return { finalText: 'Idle.', modelUsed: 'mock/noop', steps };
  }
}
