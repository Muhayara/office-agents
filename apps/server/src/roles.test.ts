import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AGENT_ROLES,
  COMMAND_ROLES,
  FILE_WRITING_ROLES,
  PLAYWRIGHT_AUTO_APPROVE_ROLES,
  SCHEMA_VERSION,
  SECURITY_SCAN_ROLES,
  TOOLS_BY_NAME,
  parseOfficeConfig,
} from '@office/shared';
import { OfficeDb } from './db';
import { OfficeCore } from './core/office-core';
import { buildSystemPrompt } from './prompts';

function createTenSeatTestOffice() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'office-roles-test-'));
  const rawConfig = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../../../office.config.json'), 'utf8'),
  );
  rawConfig.agents.push(
    {
      id: 'gita',
      name: 'Gita',
      role: 'gamedev',
      color: '#5B9BD5',
      desk: { x: 14, y: 3 },
      driver: 'api',
      model: 'ag/claude-opus-5-5-high',
      fallbacks: ['ag/claude-sonnet-5-5-high'],
      toolMode: 'tools',
      dailyCap: 250,
      enabled: true,
    },
    {
      id: 'wulan',
      name: 'Wulan',
      role: 'artist',
      color: '#F29F67',
      desk: { x: 14, y: 7 },
      driver: 'api',
      model: 'ag/gemini-4-argon-high',
      fallbacks: ['ag/claude-sonnet-5-5-high'],
      toolMode: 'tools',
      dailyCap: 250,
      enabled: true,
    },
    {
      id: 'fajar',
      name: 'Fajar',
      role: 'visual_qa',
      color: '#59C3C3',
      desk: { x: 18, y: 3 },
      driver: 'api',
      model: 'ag/gemini-3.8-flash-high',
      fallbacks: ['ag/gemini-4-argon-high'],
      toolMode: 'tools',
      dailyCap: 300,
      enabled: true,
    },
    {
      id: 'satria',
      name: 'Satria',
      role: 'security',
      color: '#E05A47',
      desk: { x: 18, y: 7 },
      driver: 'api',
      model: 'ag/claude-sonnet-5-5-high',
      fallbacks: ['ag/gemini-4-argon-high'],
      toolMode: 'tools',
      dailyCap: 250,
      enabled: true,
    },
    {
      id: 'tari',
      name: 'Tari',
      role: 'designer',
      color: '#9B7EDE',
      desk: { x: 14, y: 5 },
      driver: 'api',
      model: 'ag/claude-sonnet-5-5-high',
      fallbacks: ['ag/gemini-4-argon-high'],
      toolMode: 'tools',
      dailyCap: 250,
      enabled: true,
    },
  );
  const config = parseOfficeConfig(rawConfig);
  const db = new OfficeDb(':memory:');
  const core = new OfficeCore({ config, db, workspaceDir: tmpDir });
  return { core, db, tmpDir, config };
}

describe('@office/shared v1.1.0 & 10-role permissions (Komponen B)', () => {
  it('exposes SCHEMA_VERSION 1.1.0, 10 roles, and security_scan under security category', () => {
    expect(SCHEMA_VERSION).toBe('1.1.0');
    expect(AGENT_ROLES).toHaveLength(10);
    expect(TOOLS_BY_NAME.security_scan.category).toBe('security');
    expect(FILE_WRITING_ROLES).toEqual(['writer', 'coder', 'gamedev', 'artist', 'designer']);
    expect(COMMAND_ROLES).toEqual(['coder', 'gamedev', 'artist', 'designer', 'visual_qa']);
    expect(SECURITY_SCAN_ROLES).toEqual(['security']);
    expect(PLAYWRIGHT_AUTO_APPROVE_ROLES).toEqual(['visual_qa']);
  });

  it('allows gamedev, artist, and designer to write files while blocking security and visual_qa', async () => {
    const { core, db } = createTenSeatTestOffice();

    for (const id of ['gita', 'wulan', 'tari']) {
      const res = await core.executeTool(id, 'write_file', {
        path: `${id}.txt`,
        content: `dibuat oleh ${id}`,
      });
      expect(res.ok).toBe(true);
    }

    for (const id of ['satria', 'fajar']) {
      const res = await core.executeTool(id, 'write_file', {
        path: `${id}.txt`,
        content: 'tidak boleh',
      });
      expect(res.ok).toBe(false);
    }

    db.close();
  });

  it('restricts security_scan strictly to security role (satria)', async () => {
    const { core, db } = createTenSeatTestOffice();

    const denied = await core.executeTool('bima', 'security_scan', { scope: 'all' });
    expect(denied.ok).toBe(false);

    const allowed = await core.executeTool('satria', 'security_scan', { scope: 'all' });
    expect(allowed.ok).toBe(true);

    db.close();
  });

  it('builds system prompts for all 10 roles in both Indonesian and English', () => {
    const { config, db } = createTenSeatTestOffice();
    for (const role of AGENT_ROLES) {
      const idPrompt = buildSystemPrompt({
        role,
        lang: 'id',
        config,
        maxSteps: 16,
        toolMode: 'tools',
      });
      const enPrompt = buildSystemPrompt({
        role,
        lang: 'en',
        config,
        maxSteps: 16,
        toolMode: 'tools',
      });
      expect(idPrompt.length).toBeGreaterThan(100);
      expect(enPrompt.length).toBeGreaterThan(100);
    }
    db.close();
  });
});
