import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseOfficeConfig } from '@office/shared';
import { OfficeDb } from './db';
import { OfficeCore } from './core/office-core';

function createOffice() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'office-tasks-test-'));
  const config = parseOfficeConfig(
    JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../office.config.json'), 'utf8')),
  );
  const db = new OfficeDb(':memory:');
  const core = new OfficeCore({ config, db, workspaceDir: tmpDir });
  return { core, db, tmpDir, config };
}

describe('Kepemilikan tugas & alur review (P1)', () => {
  it('hanya assignee yang boleh claim, lapor, dan minta review', async () => {
    const { core, db } = createOffice();
    const task = core.createTask({ title: 'Halaman profil', assignee: 'bima', createdBy: 'raka' });

    expect((await core.executeTool('sari', 'claim_task', { taskId: task.id })).ok).toBe(false);
    expect(
      (await core.executeTool('dimas', 'post_report', { taskId: task.id, summary: 'bukan punyaku' })).ok,
    ).toBe(false);
    expect((await core.executeTool('gita', 'request_review', { taskId: task.id, to: 'laras' })).ok).toBe(false);

    expect((await core.executeTool('bima', 'claim_task', { taskId: task.id })).ok).toBe(true);
    expect(core.getTask(task.id)?.status).toBe('in_progress');
    db.close();
  });

  it('agen lain tidak bisa menandai tugas orang lain done; tugas berisi file wajib lewat reviewer', async () => {
    const { core, db } = createOffice();
    const task = core.createTask({ title: 'Komponen grid', assignee: 'bima', createdBy: 'raka' });
    await core.executeTool('bima', 'write_file', { path: 'grid.ts', content: 'export {}' });
    await core.executeTool('bima', 'post_report', { taskId: task.id, summary: 'selesai', files: ['grid.ts'] });

    const byStranger = await core.executeTool('gita', 'update_task', { taskId: task.id, status: 'done' });
    expect(byStranger.ok).toBe(false);

    const bySelf = await core.executeTool('bima', 'update_task', { taskId: task.id, status: 'done' });
    expect(bySelf.ok).toBe(false);
    expect(bySelf.output).toContain('request_review');

    const byManager = await core.executeTool('raka', 'update_task', { taskId: task.id, status: 'done' });
    expect(byManager.ok).toBe(false);

    // Review hanya ke peran reviewer
    expect((await core.executeTool('bima', 'request_review', { taskId: task.id, to: 'gita' })).ok).toBe(false);
    expect((await core.executeTool('bima', 'request_review', { taskId: task.id, to: 'Laras' })).ok).toBe(true);
    expect(core.getTask(task.id)?.reviewer).toBe('laras');

    const acc = await core.executeTool('laras', 'update_task', { taskId: task.id, status: 'done', note: 'ACC' });
    expect(acc.ok).toBe(true);
    expect(core.getTask(task.id)?.status).toBe('done');
    db.close();
  });

  it('security boleh memveto (blocked) tugas siapa pun; tugas tanpa file boleh ditutup assignee', async () => {
    const { core, db } = createOffice();
    const task = core.createTask({ title: 'Audit', assignee: 'bima', createdBy: 'raka' });
    expect((await core.executeTool('satria', 'update_task', { taskId: task.id, status: 'blocked' })).ok).toBe(true);
    expect((await core.executeTool('satria', 'update_task', { taskId: task.id, status: 'todo' })).ok).toBe(false);

    const research = core.createTask({ title: 'Riset singkat', assignee: 'sari', createdBy: 'raka' });
    await core.executeTool('sari', 'claim_task', { taskId: research.id });
    expect((await core.executeTool('sari', 'update_task', { taskId: research.id, status: 'done' })).ok).toBe(true);
    db.close();
  });

  it('REJECT berulang mencapai revisionCycleLimit -> tugas diblokir & CEO diberi tahu', async () => {
    const { core, db, config } = createOffice();
    const task = core.createTask({ title: 'Animasi kursi', assignee: 'gita', createdBy: 'raka' });
    await core.executeTool('gita', 'claim_task', { taskId: task.id });

    for (let i = 0; i < config.limits.revisionCycleLimit; i += 1) {
      await core.executeTool('gita', 'request_review', { taskId: task.id, to: 'laras' });
      const rej = await core.executeTool('laras', 'update_task', {
        taskId: task.id,
        status: 'in_progress',
        note: `Perbaiki #${i + 1}`,
      });
      expect(rej.ok).toBe(true);
    }

    expect(core.getTask(task.id)?.status).toBe('blocked');
    expect(core.getTaskRevisionCount(task.id)).toBe(config.limits.revisionCycleLimit);
    const ceo = core.listMessages().filter((m) => m.recipient === 'ceo');
    expect(ceo.some((m) => m.body.includes('ESKALASI'))).toBe(true);
    // Catatan REJECT sampai ke pembuatnya
    const gitaInbox = core.readInbox('gita', 50, false);
    expect(gitaInbox.some((m) => m.body.includes('Perbaiki #1'))).toBe(true);
    db.close();
  });
});

describe('Approval run_command (P1)', () => {
  it('visual_qa tidak lagi disetujui otomatis; perintah menunggu CEO', async () => {
    const { core, db } = createOffice();
    const pending = core.executeTool('fajar', 'run_command', { command: 'npx', args: ['playwright', 'test'] });
    await new Promise((r) => setTimeout(r, 10));
    const approvals = core.listApprovals().filter((a) => a.status === 'pending');
    expect(approvals).toHaveLength(1);
    expect(approvals[0]?.payload.args).toEqual(['--no', 'playwright', 'test']);

    core.respondApproval(approvals[0]!.id, false, 'Tidak sekarang');
    const res = await pending;
    expect(res.ok).toBe(false);
    expect(res.output).toContain('DITOLAK');
    db.close();
  });

  it('perintah yang melanggar kebijakan ditolak sebelum meminta approval', async () => {
    const { core, db } = createOffice();
    const res = await core.executeTool('bima', 'run_command', { command: 'node', args: ['-e', 'require("fs")'] });
    expect(res.ok).toBe(false);
    expect(core.listApprovals()).toHaveLength(0);
    db.close();
  });

  it('approval yang sudah diputuskan tidak bisa diputuskan ulang (jejak audit aman)', async () => {
    const { core, db } = createOffice();
    const pending = core.requestApproval({ agentId: 'bima', kind: 'run_command', payload: { command: 'npm' } });
    const id = core.listApprovals()[0]!.id;
    core.respondApproval(id, false, 'Tidak');
    await pending;
    expect(() => core.respondApproval(id, true)).toThrow(/sudah diputuskan/);
    expect(core.listApprovals()[0]?.status).toBe('denied');
    db.close();
  });

  it('giliran yang dihentikan membatalkan approval sehingga perintah tidak pernah jalan', async () => {
    const { core, db, tmpDir } = createOffice();
    const controller = new AbortController();
    const pending = core.executeTool(
      'bima',
      'run_command',
      { command: 'node', args: ['make-file.js'] },
      { signal: controller.signal },
    );
    await new Promise((r) => setTimeout(r, 10));
    expect(core.hasPendingApprovalFor('bima')).toBe(true);
    controller.abort();
    const res = await pending;
    expect(res.ok).toBe(false);
    expect(core.hasPendingApprovalFor('bima')).toBe(false);
    expect(core.listApprovals()[0]?.status).toBe('expired');

    // CEO yang telat menekan "setujui" tidak lagi menjalankan apa pun
    expect(() => core.respondApproval(core.listApprovals()[0]!.id, true)).toThrow();
    expect(fs.readdirSync(tmpDir)).toHaveLength(0);
    db.close();
  });
});
