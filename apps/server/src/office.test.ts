import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseOfficeConfig } from '@office/shared';
import { OfficeDb } from './db';
import { OfficeCore } from './core/office-core';
import { MockDriver } from './drivers/mock-driver';
import { parseGatewayPayload } from './drivers/api-driver';
import { OfficeScheduler } from './core/scheduler';

function createTestOffice() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'office-test-'));
  const rawConfig = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../../../office.config.json'), 'utf8'),
  );
  const config = parseOfficeConfig(rawConfig);
  const db = new OfficeDb(':memory:');
  const core = new OfficeCore({ config, db, workspaceDir: tmpDir });
  return { core, db, tmpDir, config };
}

describe('OfficeCore + MockDriver Suite', () => {
  it('validates office.config.json and initializes all 10 seats with public model names', () => {
    const { core, db } = createTestOffice();
    const snap = core.getSnapshot();
    expect(snap.agents).toHaveLength(10);
    expect(snap.agents.map((a) => a.id)).toEqual([
      'raka',
      'sari',
      'dimas',
      'bima',
      'gita',
      'tari',
      'wulan',
      'laras',
      'fajar',
      'satria',
    ]);
    expect(snap.agents.every((a) => !a.model.startsWith('ag/'))).toBe(true);
    db.close();
  });

  it('routes messages to manager, specific agent, and broadcast all', () => {
    const { core, db } = createTestOffice();
    core.sendMessage({ sender: 'ceo', to: 'manager', body: 'Halo Manajer' });
    const rakaInbox = core.readInbox('raka', 10, true);
    expect(rakaInbox).toHaveLength(1);
    expect(rakaInbox[0]?.body).toBe('Halo Manajer');

    core.sendMessage({ sender: 'ceo', to: 'all', body: '/rapat Evaluasi mingguan' });
    expect(core.readInbox('sari', 10, true)).toHaveLength(1);
    expect(core.readInbox('bima', 10, true)).toHaveLength(1);
    db.close();
  });

  it('enforces role guard on write_file and allows coder/writer to write inside workspace', async () => {
    const { core, db } = createTestOffice();
    const denied = await core.executeTool('raka', 'write_file', {
      path: 'test.txt',
      content: 'halo',
    });
    expect(denied.ok).toBe(false);

    const allowed = await core.executeTool('bima', 'write_file', {
      path: 'test.txt',
      content: 'halo bima',
    });
    expect(allowed.ok).toBe(true);

    const readBack = await core.executeTool('sari', 'read_file', { path: 'test.txt' });
    expect(readBack.ok).toBe(true);
    expect(readBack.output).toBe('halo bima');
    db.close();
  });

  it('handles approval gate in semi vs full mode', async () => {
    const { core, db } = createTestOffice();
    core.setMode('full');
    const auto = await core.requestApproval({
      agentId: 'bima',
      kind: 'run_command',
      payload: { command: 'git', args: ['status'] },
    });
    expect(auto.approved).toBe(true);

    core.setMode('semi');
    const pendingPromise = core.requestApproval({
      agentId: 'bima',
      kind: 'run_command',
      payload: { command: 'npm', args: ['test'] },
    });
    const pendingList = core.listApprovals().filter((a) => a.status === 'pending');
    expect(pendingList).toHaveLength(1);
    core.respondApproval(pendingList[0]!.id, false, 'Belum waktunya');
    const decision = await pendingPromise;
    expect(decision.approved).toBe(false);
    db.close();
  });

  it('executes full end-to-end chain CEO -> Raka -> Bima -> Laras -> Raka with MockDriver', async () => {
    const { core, db, tmpDir } = createTestOffice();
    const driver = new MockDriver(core);
    const scheduler = new OfficeScheduler(core, driver, { autoWake: false });

    core.handleClientCommand({
      type: 'ceo.send',
      to: 'manager',
      text: 'Buat file profil.html berisi kartu nama Muhayara',
    });

    // Step 1: Raka processes CEO message and creates task for Bima
    await scheduler.runAgentTurn(core.getAgentConfig('raka')!);
    expect(core.listTasks()).toHaveLength(1);
    expect(core.listTasks()[0]?.assignee).toBe('bima');

    // Step 2: Bima claims task, writes profil.html, posts report, requests review from Laras
    await scheduler.runAgentTurn(core.getAgentConfig('bima')!);
    expect(fs.existsSync(path.join(tmpDir, 'profil.html'))).toBe(true);
    expect(core.listTasks()[0]?.status).toBe('review');

    // Step 3: Laras reviews and marks task done (ACC)
    await scheduler.runAgentTurn(core.getAgentConfig('laras')!);
    expect(core.listTasks()[0]?.status).toBe('done');

    // Step 4: Raka summarizes completion back to CEO
    await scheduler.runAgentTurn(core.getAgentConfig('raka')!);
    const ceoMessages = core.listMessages().filter((m) => m.recipient === 'ceo');
    expect(ceoMessages.some((m) => m.body.includes('Semua tugas selesai'))).toBe(true);
    db.close();
  });

  it('passes negative test: Raka calls ask_human on ambiguous command without creating tasks', async () => {
    const { core, db } = createTestOffice();
    const driver = new MockDriver(core);
    const scheduler = new OfficeScheduler(core, driver, { autoWake: false });

    core.handleClientCommand({
      type: 'ceo.send',
      to: 'manager',
      text: 'Buatkan sesuatu yang keren.',
    });

    await scheduler.runAgentTurn(core.getAgentConfig('raka')!);
    expect(core.listTasks()).toHaveLength(0);
    const ceoMessages = core.listMessages().filter((m) => m.recipient === 'ceo');
    expect(ceoMessages.length).toBeGreaterThan(0);
    db.close();
  });

  it('parses both single JSON and SSE stream payloads from 9router', () => {
    const jsonParsed = parseGatewayPayload(
      JSON.stringify({
        choices: [{ message: { content: 'PONG' } }],
        usage: { prompt_tokens: 10, completion_tokens: 2 },
      }),
    );
    expect(jsonParsed.text).toBe('PONG');

    const sseParsed = parseGatewayPayload(
      `data: {"choices":[{"delta":{"content":"PO"}}]}\ndata: {"choices":[{"delta":{"content":"NG"}}]}\ndata: [DONE]`,
    );
    expect(sseParsed.text).toBe('PONG');
  });
});
