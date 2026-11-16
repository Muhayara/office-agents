import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseOfficeConfig } from '@office/shared';
import { OfficeDb } from './db';
import { OfficeCore } from './core/office-core';
import { MAX_TURN_FAILURES, OfficeScheduler } from './core/scheduler';
import { MockDriver } from './drivers/mock-driver';
import type { AgentDriver, AgentTurnInput, AgentTurnResult } from './drivers/types';
import { nextZonedMidnight, normalizeTimeZone, zonedDayKey } from './core/time';

function createOffice(db = new OfficeDb(':memory:')) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'office-logic-test-'));
  const config = parseOfficeConfig(
    JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../office.config.json'), 'utf8')),
  );
  const core = new OfficeCore({ config, db, workspaceDir: tmpDir });
  return { core, db, tmpDir, config };
}

class FnDriver implements AgentDriver {
  constructor(private readonly fn: (input: AgentTurnInput) => Promise<AgentTurnResult>) {}
  runTurn(input: AgentTurnInput): Promise<AgentTurnResult> {
    return this.fn(input);
  }
}

describe('Zona waktu kantor (P2)', () => {
  it('hari kantor & reset kuota mengikuti Asia/Jakarta, bukan UTC', () => {
    // 18:00 UTC = 01:00 WIB keesokan hari
    expect(zonedDayKey(new Date('2026-11-16T18:00:00Z'), 'Asia/Jakarta')).toBe('2026-11-17');
    expect(zonedDayKey(new Date('2026-11-16T16:59:59Z'), 'Asia/Jakarta')).toBe('2026-11-16');
    // 17:00 WIB tanggal 16 -> reset 00:00 WIB tanggal 17 = 17:00 UTC tanggal 16
    expect(nextZonedMidnight(new Date('2026-11-16T10:00:00Z'), 'Asia/Jakarta').toISOString()).toBe(
      '2026-11-16T17:00:00.000Z',
    );
    expect(normalizeTimeZone('Mars/Olympus')).toBe('UTC');

    const { core, db } = createOffice();
    expect(core.todayKey(new Date('2026-11-16T18:00:00Z'))).toBe('2026-11-17');
    expect(core.getQuota('raka').resetAt).toMatch(/T17:00:00\.000Z$/);
    db.close();
  });
});

describe('Scheduler: pesan tidak hilang saat giliran gagal (P2)', () => {
  it('error tanpa efek samping -> pesan tetap belum terbaca + backoff; menyerah setelah batas', async () => {
    const { core, db } = createOffice();
    const scheduler = new OfficeScheduler(
      core,
      new FnDriver(async () => {
        throw new Error('Gateway mati');
      }),
      { autoWake: false },
    );
    core.handleClientCommand({ type: 'ceo.send', to: 'manager', text: 'Buat rencana sprint' });

    await scheduler.runAgentTurn(core.getAgentConfig('raka')!);
    expect(core.readInbox('raka', 10, false)).toHaveLength(1);
    const failure = scheduler.getFailureState('raka');
    expect(failure?.count).toBe(1);
    expect(failure!.retryAt).toBeGreaterThan(Date.now());

    for (let i = 1; i < MAX_TURN_FAILURES; i += 1) {
      await scheduler.runAgentTurn(core.getAgentConfig('raka')!);
    }
    expect(core.readInbox('raka', 10, false)).toHaveLength(0);
    expect(scheduler.getFailureState('raka')).toBeUndefined();
    const ceo = core.listMessages().filter((m) => m.recipient === 'ceo');
    expect(ceo.some((m) => m.body.includes('gagal menjalankan giliran'))).toBe(true);
    db.close();
  });

  it('error setelah ada aksi -> pesan ditandai terbaca (tidak diulang) dan agen diberi catatan', async () => {
    const { core, db } = createOffice();
    const scheduler = new OfficeScheduler(
      core,
      new FnDriver(async ({ agent }) => {
        await core.executeTool(agent.id, 'create_task', { title: 'Riset pasar', assignee: 'sari' });
        throw new Error('Putus di tengah');
      }),
      { autoWake: false },
    );
    core.handleClientCommand({ type: 'ceo.send', to: 'manager', text: 'Riset pasar' });
    await scheduler.runAgentTurn(core.getAgentConfig('raka')!);

    expect(core.listTasks()).toHaveLength(1);
    const unread = core.readInbox('raka', 10, false);
    expect(unread).toHaveLength(1);
    expect(unread[0]?.sender).toBe('system');
    expect(unread[0]?.body).toContain('Giliran sebelumnya terputus');
    db.close();
  });

  it('giliran sukses menandai pesan terbaca; CEO stop tidak memicu retry', async () => {
    const { core, db } = createOffice();
    const ok = new OfficeScheduler(core, new MockDriver(core), { autoWake: false });
    core.handleClientCommand({ type: 'ceo.send', to: 'manager', text: 'Buatkan sesuatu yang keren.' });
    await ok.runAgentTurn(core.getAgentConfig('raka')!);
    expect(core.readInbox('raka', 10, false)).toHaveLength(0);

    const stoppable = new OfficeScheduler(
      core,
      new FnDriver(
        ({ signal }) =>
          new Promise((_resolve, reject) => {
            signal.addEventListener('abort', () => reject(new Error('dibatalkan')), { once: true });
          }),
      ),
      { autoWake: false },
    );
    core.handleClientCommand({ type: 'ceo.send', to: 'sari', text: 'Tolong cek data' });
    const turn = stoppable.runAgentTurn(core.getAgentConfig('sari')!);
    await new Promise((r) => setTimeout(r, 10));
    core.handleClientCommand({ type: 'office.stopAgent', agentId: 'sari' });
    await turn;
    expect(core.readInbox('sari', 10, false)).toHaveLength(0);
    expect(stoppable.getFailureState('sari')).toBeUndefined();
    db.close();
  });

  it('watchdog tidak memotong giliran selama menunggu approval CEO', async () => {
    const { core, db, config } = createOffice();
    (config.limits as { turnTimeoutMs: number }).turnTimeoutMs = 1200;
    let finished: { ok: boolean; output: string } | undefined;
    const scheduler = new OfficeScheduler(
      core,
      new FnDriver(async ({ agent, signal }) => {
        finished = await core.executeTool(agent.id, 'run_command', { command: 'node', args: ['--version'] }, { signal });
        return { finalText: 'ok', modelUsed: 'test', steps: [] };
      }),
      { autoWake: false },
    );
    core.handleClientCommand({ type: 'ceo.send', to: 'bima', text: 'Cek versi node' });
    const turn = scheduler.runAgentTurn(core.getAgentConfig('bima')!);

    await new Promise((r) => setTimeout(r, 2500));
    const pending = core.listApprovals().find((a) => a.status === 'pending');
    expect(pending).toBeDefined();
    core.respondApproval(pending!.id, true);
    await turn;
    expect(finished?.ok).toBe(true);
    expect(finished?.output).toMatch(/^v\d+/);
    db.close();
  }, 10_000);
});

describe('Validasi & kebersihan data (P2)', () => {
  it('penerima pesan dan assignee dinormalisasi; yang tidak dikenal ditolak', async () => {
    const { core, db } = createOffice();
    const msg = core.sendMessage({ sender: 'ceo', to: 'Bima', body: 'Halo' });
    expect(msg.recipient).toBe('bima');
    expect(() => core.sendMessage({ sender: 'ceo', to: 'bimo', body: 'Halo' })).toThrow(/tidak dikenal/);
    expect(() => core.handleClientCommand({ type: 'ceo.send', to: 'siapa', text: 'x' })).toThrow();

    const task = core.createTask({ title: 'Dokumen', assignee: 'Dimas', createdBy: 'raka' });
    expect(task.assignee).toBe('dimas');
    const bad = await core.executeTool('raka', 'create_task', { title: 'X', assignee: 'hantu' });
    expect(bad.ok).toBe(false);
    db.close();
  });

  it('approval pending yatim kedaluwarsa saat server restart (security_block tetap)', async () => {
    const db = new OfficeDb(':memory:');
    const first = createOffice(db);
    void first.core.requestApproval({ agentId: 'bima', kind: 'run_command', payload: { command: 'npm' } });
    db.db
      .prepare(
        `INSERT INTO approvals (id, agent_id, kind, payload_json, status, created_at)
         VALUES ('apr_sec', 'satria', 'security_block', '{}', 'pending', ?)`,
      )
      .run(new Date().toISOString());

    const second = createOffice(db);
    const statuses = Object.fromEntries(second.core.listApprovals().map((a) => [a.kind, a.status]));
    expect(statuses.run_command).toBe('expired');
    expect(statuses.security_block).toBe('pending');
    db.close();
  });

  it('batas global kantor per hari ditegakkan', async () => {
    const { core, db, config } = createOffice();
    (config.limits as { globalReqPerDay: number }).globalReqPerDay = 2;
    core.recordUsage('raka');
    expect(core.isGlobalDailyCapReached()).toBe(false);
    core.recordUsage('sari');
    expect(core.isGlobalDailyCapReached()).toBe(true);
    await expect(core.waitForRateSlot()).rejects.toThrow(/Batas harian kantor/);
    db.close();
  });

  it('tabel events dipangkas dan snapshot tugas dibatasi', () => {
    const { core, db } = createOffice();
    for (let i = 0; i < 5600; i += 1) {
      core.emit({ type: 'office.paused', paused: false, at: new Date().toISOString() });
    }
    const count = (db.db.prepare('SELECT COUNT(*) AS n FROM events').get() as { n: number }).n;
    expect(count).toBeLessThanOrEqual(5500);

    for (let i = 0; i < 510; i += 1) {
      core.createTask({ title: `Tugas ${i}`, assignee: 'sari', createdBy: 'raka' });
    }
    const snap = core.getSnapshot();
    expect(snap.tasks.length).toBe(500);
    db.close();
  });

  it('riwayat run & langkah tool tersedia untuk panel inspektur', async () => {
    const { core, db } = createOffice();
    const scheduler = new OfficeScheduler(core, new MockDriver(core), { autoWake: false });
    core.handleClientCommand({ type: 'ceo.send', to: 'manager', text: 'Buat file profil.html' });
    await scheduler.runAgentTurn(core.getAgentConfig('raka')!);
    const runs = core.listRuns({ agentId: 'raka' });
    expect(runs).toHaveLength(1);
    expect(runs[0]?.status).toBe('ok');
    expect(runs[0]?.steps[0]?.name).toBe('create_task');
    db.close();
  });
});
