import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import type { AgentConfig, Task } from '@office/shared';
import { GitService, buildConventionalCommitMessage } from './git-service';

const VALID_GITIGNORE = [
  'node_modules/',
  '.npm-cache/',
  'dist/',
  'data/',
  '.env',
  '.env.*',
  '!.env.example',
  '*.log',
  '*.pem',
  '*.key',
  '*.sqlite',
  '*.db',
  'workspace/*',
  '!workspace/office-next/',
  '!workspace/README.md',
].join('\n');

function setupTempGitRepoWithBareRemote() {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'office-git-service-'));
  const remoteDir = path.join(baseDir, 'remote.git');
  const repoRoot = path.join(baseDir, 'repo');
  const workspaceDir = path.join(repoRoot, 'workspace');

  fs.mkdirSync(remoteDir, { recursive: true });
  fs.mkdirSync(path.join(workspaceDir, 'office-next', 'src'), { recursive: true });

  execFileSync('git', ['init', '--bare', '-b', 'main'], { cwd: remoteDir });
  execFileSync('git', ['init', '-b', 'main'], { cwd: repoRoot });
  execFileSync('git', ['config', 'user.name', 'Muhayara'], { cwd: repoRoot });
  execFileSync('git', ['config', 'user.email', 'hafizhajah777@gmail.com'], { cwd: repoRoot });

  fs.writeFileSync(path.join(repoRoot, '.gitignore'), VALID_GITIGNORE, 'utf8');
  fs.writeFileSync(path.join(workspaceDir, 'README.md'), '# Workspace\n', 'utf8');
  execFileSync('git', ['add', '.gitignore', 'workspace/README.md'], { cwd: repoRoot });
  execFileSync('git', ['commit', '-m', 'chore(repo): initial commit'], { cwd: repoRoot });
  execFileSync('git', ['remote', 'add', 'origin', remoteDir], { cwd: repoRoot });
  execFileSync('git', ['push', '-u', 'origin', 'main'], { cwd: repoRoot });

  return { baseDir, remoteDir, repoRoot, workspaceDir };
}

const gitaConfig: AgentConfig = {
  id: 'gita',
  name: 'Gita',
  role: 'gamedev',
  color: '#5B9BD5',
  desk: { x: 14, y: 3 },
  driver: 'api',
  model: 'ag/claude-opus-5-5-high',
  fallbacks: [],
  toolMode: 'tools',
  dailyCap: 250,
  escalationCap: 0,
  enabled: true,
};

function makeTask(overrides: Partial<Task> = {}): Task {
  const now = new Date().toISOString();
  return {
    id: 't_test_25d',
    projectId: 'default',
    title: 'implementasi komponen grid isometrik',
    details: 'Grid 2.5D',
    assignee: 'gita',
    status: 'done',
    priority: 'normal',
    createdBy: 'raka',
    files: ['office-next/src/grid.ts'],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('GitService (Bagian C2 — Auto-Commit & Auto-Push)', () => {
  it('formats professional conventional commit messages with agent name and role', () => {
    const task = makeTask();
    const featMsg = buildConventionalCommitMessage({
      task,
      assignee: gitaConfig,
      isRevision: false,
    });
    expect(featMsg).toBe(
      'feat(2.5d): implementasi komponen grid isometrik [by Gita — Game Dev 2.5D]',
    );

    const fixMsg = buildConventionalCommitMessage({
      task,
      assignee: gitaConfig,
      isRevision: true,
    });
    expect(fixMsg).toBe(
      'fix(2.5d): implementasi komponen grid isometrik [by Gita — Game Dev 2.5D]',
    );
  });

  it('commits and pushes cleanly to bare remote with pure Muhayara author and agent title attribution', async () => {
    const { repoRoot, workspaceDir, remoteDir } = setupTempGitRepoWithBareRemote();
    const fileFull = path.join(workspaceDir, 'office-next', 'src', 'grid.ts');
    fs.writeFileSync(fileFull, 'export const GRID_SIZE = 32;\n', 'utf8');

    const service = new GitService({ repoRoot, workspaceDir });
    const res = await service.commitAndPush({
      task: makeTask(),
      assignee: gitaConfig,
    });

    expect(res.committed).toBe(true);
    expect(res.pushed).toBe(true);
    expect(res.blocked).toBe(false);
    expect(res.commitTitle).toBe(
      'feat(2.5d): implementasi komponen grid isometrik [by Gita — Game Dev 2.5D]',
    );

    const remoteLog = execFileSync(
      'git',
      ['log', '-1', '--format=%an <%ae>|%s|%b'],
      { cwd: remoteDir, encoding: 'utf8' },
    ).trim();
    expect(remoteLog).toBe(
      'Muhayara <hafizhajah777@gmail.com>|feat(2.5d): implementasi komponen grid isometrik [by Gita — Game Dev 2.5D]|',
    );
    expect(remoteLog).not.toContain('Co-authored-by');
  });

  it('blocks commit and push when a file contains a fake secret or touches package.json', async () => {
    const { repoRoot, workspaceDir } = setupTempGitRepoWithBareRemote();
    const fakeSecret = 'sk-' + 'secret99887766554433221100aabb';
    fs.writeFileSync(
      path.join(workspaceDir, 'office-next', 'src', 'grid.ts'),
      `export const KEY = "${fakeSecret}";\n`,
      'utf8',
    );

    const service = new GitService({ repoRoot, workspaceDir });
    const blockedSecret = await service.commitAndPush({
      task: makeTask(),
      assignee: gitaConfig,
    });

    expect(blockedSecret.blocked).toBe(true);
    expect(blockedSecret.committed).toBe(false);
    expect(blockedSecret.pushed).toBe(false);
    expect(JSON.stringify(blockedSecret)).not.toContain(fakeSecret);

    // Supply-chain guard: touching package.json inside office-next is also blocked
    fs.writeFileSync(
      path.join(workspaceDir, 'office-next', 'package.json'),
      '{"name":"evil"}\n',
      'utf8',
    );
    const blockedPkg = await service.commitAndPush({
      task: makeTask({ files: ['office-next/package.json'] }),
      assignee: gitaConfig,
    });
    expect(blockedPkg.blocked).toBe(true);
    expect(blockedPkg.findings.map((f) => f.rule)).toContain('blocked-supply-chain-file');
  });

  it('preserves local commit when push to remote fails', async () => {
    const { repoRoot, workspaceDir } = setupTempGitRepoWithBareRemote();
    execFileSync('git', ['remote', 'set-url', 'origin', 'P:/non-existent-remote-path.git'], {
      cwd: repoRoot,
    });

    fs.writeFileSync(
      path.join(workspaceDir, 'office-next', 'src', 'grid.ts'),
      'export const OFFLINE_OK = true;\n',
      'utf8',
    );

    const service = new GitService({ repoRoot, workspaceDir });
    const res = await service.commitAndPush({
      task: makeTask(),
      assignee: gitaConfig,
    });

    expect(res.committed).toBe(true);
    expect(res.pushed).toBe(false);
    expect(res.blocked).toBe(false);
    expect(res.commitSha).toBeTruthy();
  });
});
