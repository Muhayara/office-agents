import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  type AgentConfig,
  type GitConfig,
  type GitStatusSnapshot,
  ROLE_LABELS,
  type SecurityFinding,
  type Task,
  createDefaultGitConfig,
} from '@office/shared';
import { runSecurityScan } from '../security/scanner';

const execFileAsync = promisify(execFile);

export interface CommitTaskOptions {
  task: Task;
  assignee?: AgentConfig;
  isRevision?: boolean;
}

export interface CommitTaskResult {
  committed: boolean;
  pushed: boolean;
  blocked: boolean;
  commitSha?: string;
  commitTitle?: string;
  findings: SecurityFinding[];
  error?: string;
  /** Alasan auto-commit dilewati tanpa temuan keamanan. */
  skipped?: 'not_git_repo' | 'no_files' | 'no_changes';
  status: GitStatusSnapshot;
}

export function buildConventionalCommitMessage(params: {
  task: Task;
  assignee?: AgentConfig;
  isRevision?: boolean;
}): string {
  const { task, assignee, isRevision = false } = params;
  const role = assignee?.role ?? 'coder';
  const roleLabel = ROLE_LABELS.id[role] ?? role;
  const agentName = assignee?.name ?? task.assignee;

  let prefix = 'feat';
  if (isRevision) {
    prefix = 'fix';
  } else if (role === 'writer') {
    prefix = 'docs';
  } else if (role === 'designer' || role === 'artist') {
    prefix = 'feat';
  }

  const cleanTitle = task.title
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);

  return `${prefix}(3d): ${cleanTitle} [by ${agentName} — ${roleLabel}]`;
}

export class GitService {
  private readonly repoRoot: string;
  private readonly workspaceDir: string;
  private readonly gitConfig: GitConfig;
  private statusSnapshot: GitStatusSnapshot;
  private readonly onStatusChange?: (
    status: GitStatusSnapshot,
    findings?: SecurityFinding[],
  ) => void;

  constructor(options: {
    repoRoot: string;
    workspaceDir: string;
    gitConfig?: GitConfig;
    onStatusChange?: (status: GitStatusSnapshot, findings?: SecurityFinding[]) => void;
  }) {
    this.repoRoot = path.resolve(options.repoRoot);
    this.workspaceDir = path.resolve(options.workspaceDir);
    this.gitConfig = options.gitConfig ?? createDefaultGitConfig();
    this.onStatusChange = options.onStatusChange;
    this.statusSnapshot = {
      branch: this.gitConfig.branch,
      remote: this.gitConfig.remote,
      aheadCount: 0,
      pushBlocked: false,
    };
  }

  public getStatus(): GitStatusSnapshot {
    return { ...this.statusSnapshot };
  }

  private async runGit(args: string[]): Promise<{ stdout: string; stderr: string }> {
    return execFileAsync('git', args, {
      cwd: this.repoRoot,
      timeout: 30_000,
      windowsHide: true,
    });
  }

  private isGitRepo(): boolean {
    return fs.existsSync(path.join(this.repoRoot, '.git'));
  }

  public async refreshStatus(): Promise<GitStatusSnapshot> {
    if (!this.isGitRepo()) {
      return this.getStatus();
    }
    try {
      const { stdout: branchOut } = await this.runGit(['rev-parse', '--abbrev-ref', 'HEAD']);
      const branch = branchOut.trim() || this.gitConfig.branch;

      let lastCommitSha: string | undefined;
      let lastCommitTitle: string | undefined;
      try {
        const { stdout: logOut } = await this.runGit(['log', '-1', '--format=%h|%s']);
        const [sha, title] = logOut.trim().split('|');
        if (sha) lastCommitSha = sha;
        if (title) lastCommitTitle = title;
      } catch {
        // repo belum punya commit
      }

      let aheadCount = 0;
      try {
        const { stdout: revOut } = await this.runGit([
          'rev-list',
          '--count',
          `${this.gitConfig.remote}/${branch}..HEAD`,
        ]);
        aheadCount = Number.parseInt(revOut.trim(), 10) || 0;
      } catch {
        // remote branch belum dilacak
      }

      this.statusSnapshot = {
        ...this.statusSnapshot,
        branch,
        remote: this.gitConfig.remote,
        lastCommitSha: lastCommitSha ?? this.statusSnapshot.lastCommitSha,
        lastCommitTitle: lastCommitTitle ?? this.statusSnapshot.lastCommitTitle,
        aheadCount,
      };
    } catch {
      // biarkan snapshot terakhir
    }
    return this.getStatus();
  }

  /**
   * Path relatif terhadap repoRoot dari daftar file tugas.
   * Sengaja TIDAK ada fallback "semua perubahan di scope": itu bisa ikut meng-commit
   * pekerjaan tugas lain atau file setengah jadi.
   */
  private resolveCandidatePaths(task: Task): string[] {
    const wsRelToRoot = path
      .relative(this.repoRoot, this.workspaceDir)
      .replace(/\\/g, '/');

    const resolved: string[] = [];
    for (const f of task.files ?? []) {
      const clean = path.posix.normalize(f.replace(/\\/g, '/').replace(/^\.\//, ''));
      if (clean.startsWith('..') || clean.startsWith('/') || /^[A-Za-z]:/.test(clean)) continue;
      const repoRel = clean.startsWith('workspace/')
        ? clean
        : path.posix.join(wsRelToRoot || 'workspace', clean);
      const full = path.resolve(this.repoRoot, repoRel);
      if (fs.existsSync(full) && !resolved.includes(repoRel)) {
        resolved.push(repoRel);
      }
    }
    return resolved;
  }

  /** Path yang diabaikan .gitignore (dan belum dilacak) tidak boleh di-commit paksa. */
  private async findIgnoredPaths(paths: string[]): Promise<Set<string>> {
    if (paths.length === 0) return new Set();
    try {
      const { stdout } = await this.runGit(['check-ignore', '--', ...paths]);
      return new Set(
        stdout
          .split(/\r?\n/)
          .map((l) => l.trim().replace(/\\/g, '/'))
          .filter(Boolean),
      );
    } catch (err) {
      // exit code 1 = tidak ada yang diabaikan
      if ((err as { code?: number }).code === 1) return new Set();
      throw err;
    }
  }

  public async commitAndPush(options: CommitTaskOptions): Promise<CommitTaskResult> {
    const { task, assignee, isRevision = false } = options;

    if (!this.isGitRepo()) {
      return {
        committed: false,
        pushed: false,
        blocked: false,
        findings: [],
        error: 'Repositori git belum diinisialisasi di repoRoot.',
        skipped: 'not_git_repo',
        status: this.getStatus(),
      };
    }

    const candidatePaths = this.resolveCandidatePaths(task);
    if (candidatePaths.length === 0) {
      return {
        committed: false,
        pushed: false,
        blocked: false,
        findings: [],
        skipped: 'no_files',
        error:
          'Tugas tidak mencantumkan file yang ada (isi "files" di post_report); auto-commit dilewati.',
        status: await this.refreshStatus(),
      };
    }

    // 1. Cek aturan scope dan blockedFiles (package.json / package-lock.json tidak boleh di-auto-commit)
    const scopePrefix = this.gitConfig.scope.replace(/\\/g, '/').replace(/\/+$/, '');
    const supplyChainFindings: SecurityFinding[] = [];

    for (const relPath of candidatePaths) {
      const norm = relPath.replace(/\\/g, '/');
      const base = path.posix.basename(norm);

      if (this.gitConfig.blockedFiles.includes(base)) {
        supplyChainFindings.push({
          rule: 'blocked-supply-chain-file',
          severity: 'hard',
          path: norm,
          detail: `File "${base}" tidak boleh di-auto-commit tanpa persetujuan langsung CEO.`,
        });
      }

      if (
        scopePrefix &&
        norm !== 'workspace/README.md' &&
        !norm.startsWith(`${scopePrefix}/`) &&
        norm !== scopePrefix
      ) {
        supplyChainFindings.push({
          rule: 'outside-allowed-git-scope',
          severity: 'hard',
          path: norm,
          detail: `Path berada di luar cakupan auto-commit yang diizinkan (${scopePrefix}).`,
        });
      }
    }

    // 2. Jalankan pemindai keamanan deterministik sebelum stage & commit
    const preCommitScan = runSecurityScan({
      repoRoot: this.repoRoot,
      explicitPaths: candidatePaths,
    });

    const allHard = [...supplyChainFindings, ...preCommitScan.hard];
    const allFindings = [...supplyChainFindings, ...preCommitScan.all];

    if (allHard.length > 0) {
      const reason = `Auto-commit/push diblokir oleh ${allHard.length} temuan keamanan KERAS (${allHard.map((f) => `${f.rule}@${f.path}`).join(', ')}).`;
      this.statusSnapshot = {
        ...this.statusSnapshot,
        pushBlocked: true,
        blockedReason: reason,
      };
      this.onStatusChange?.(this.getStatus(), allFindings);
      return {
        committed: false,
        pushed: false,
        blocked: true,
        findings: allFindings,
        error: reason,
        status: this.getStatus(),
      };
    }

    // 3. Buang file yang di-.gitignore (tanpa `git add -f`), lalu stage hanya file kandidat
    const ignored = await this.findIgnoredPaths(candidatePaths);
    for (const ign of ignored) {
      allFindings.push({
        rule: 'ignored-file-skipped',
        severity: 'medium',
        path: ign,
        detail: 'File diabaikan .gitignore sehingga tidak ikut di-commit.',
      });
    }
    const stagePaths = candidatePaths.filter((p) => !ignored.has(p));
    if (stagePaths.length === 0) {
      return {
        committed: false,
        pushed: false,
        blocked: false,
        findings: allFindings,
        skipped: 'no_changes',
        status: await this.refreshStatus(),
      };
    }

    await this.runGit(['add', '--', ...stagePaths]);

    const { stdout: stagedOut } = await this.runGit([
      'diff',
      '--cached',
      '--name-only',
      '--',
      ...stagePaths,
    ]);
    if (!stagedOut.trim()) {
      return {
        committed: false,
        pushed: false,
        blocked: false,
        findings: allFindings,
        skipped: 'no_changes',
        status: await this.refreshStatus(),
      };
    }

    // 4. Buat commit dengan identitas murni Muhayara dan judul profesional [by <Nama> — <Peran>]
    const commitTitle = buildConventionalCommitMessage({
      task,
      assignee,
      isRevision,
    });
    const authorStr = `${this.gitConfig.authorName} <${this.gitConfig.authorEmail}>`;

    await this.runGit([
      '-c',
      `user.name=${this.gitConfig.authorName}`,
      '-c',
      `user.email=${this.gitConfig.authorEmail}`,
      'commit',
      `--author=${authorStr}`,
      '-m',
      commitTitle,
      '--',
      ...stagePaths,
    ]);

    const { stdout: shaOut } = await this.runGit(['rev-parse', '--short', 'HEAD']);
    const commitSha = shaOut.trim();

    this.statusSnapshot = {
      ...this.statusSnapshot,
      lastCommitSha: commitSha,
      lastCommitTitle: commitTitle,
      pushBlocked: false,
      blockedReason: undefined,
    };

    // 5. Pemindaian sekali lagi sebelum push ke remote
    const prePushScan = runSecurityScan({
      repoRoot: this.repoRoot,
      explicitPaths: stagePaths,
    });
    if (prePushScan.hard.length > 0) {
      const reason = `Push diblokir setelah pemeriksaan pra-push (${prePushScan.hard.map((f) => f.rule).join(', ')}).`;
      this.statusSnapshot = {
        ...this.statusSnapshot,
        pushBlocked: true,
        blockedReason: reason,
      };
      await this.refreshStatus();
      this.onStatusChange?.(this.getStatus(), prePushScan.all);
      return {
        committed: true,
        pushed: false,
        blocked: true,
        commitSha,
        commitTitle,
        findings: prePushScan.all,
        error: reason,
        status: this.getStatus(),
      };
    }

    // 6. Push ke remote bila autoPush aktif
    let pushed = false;
    let pushError: string | undefined;
    if (this.gitConfig.autoPush) {
      try {
        await this.runGit(['push', this.gitConfig.remote, this.gitConfig.branch]);
        pushed = true;
        this.statusSnapshot = {
          ...this.statusSnapshot,
          lastPushAt: new Date().toISOString(),
          aheadCount: 0,
        };
      } catch (err) {
        pushError = `Commit lokal #${commitSha} berhasil, tetapi push ke ${this.gitConfig.remote}/${this.gitConfig.branch} tertunda: ${err instanceof Error ? err.message : String(err)}`;
      }
    }

    await this.refreshStatus();
    this.onStatusChange?.(this.getStatus(), allFindings);

    return {
      committed: true,
      pushed,
      blocked: false,
      commitSha,
      commitTitle,
      findings: allFindings,
      error: pushError,
      status: this.getStatus(),
    };
  }
}
