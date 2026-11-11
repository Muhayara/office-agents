import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  FILE_WRITING_ROLES,
  SECURITY_SCAN_ROLES,
  type SecurityFinding,
} from '@office/shared';

export interface ScanOptions {
  /** Root direktori repositori (tempat .gitignore dan .git berada). */
  repoRoot: string;
  /** Cakupan pemindaian: 'staged' | 'workspace' | 'all'. */
  scope?: 'staged' | 'workspace' | 'all';
  /** Batasi ke satu path relatif bila diberikan. */
  targetPath?: string;
  /** Daftar eksplisit path relatif (mis. dari git-service sebelum commit). */
  explicitPaths?: string[];
}

export interface ScanResult {
  passed: boolean;
  hard: SecurityFinding[];
  medium: SecurityFinding[];
  all: SecurityFinding[];
  scannedFiles: number;
  scannedAt: string;
}

const REQUIRED_GITIGNORE_PATTERNS = [
  '.env',
  'node_modules/',
  'data/',
  '*.pem',
  '*.key',
  '*.db',
] as const;

const SECRET_RULES: ReadonlyArray<{ id: string; label: string; regex: RegExp }> = [
  {
    id: 'secret-sk-token',
    label: 'API Key (sk-...)',
    regex: /\bsk-(?!your-9router-key|your-api-key|placeholder|example)[a-zA-Z0-9_-]{12,}/,
  },
  {
    id: 'secret-google-api-key',
    label: 'Google API Key (AIza...)',
    regex: /\bAIza[0-9A-Za-z_-]{30,}/,
  },
  {
    id: 'secret-google-oauth',
    label: 'Google OAuth Client Secret (GOCSPX-...)',
    regex: /\bGOCSPX-[0-9A-Za-z_-]{15,}/,
  },
  {
    id: 'secret-groq-key',
    label: 'Groq API Key (gsk_...)',
    regex: /\bgsk_[0-9A-Za-z]{20,}/,
  },
  {
    id: 'secret-google-access-token',
    label: 'Google OAuth Access Token (ya29...)',
    regex: /\bya29\.[0-9A-Za-z_-]{20,}/,
  },
  {
    id: 'secret-github-token',
    label: 'GitHub Personal Access Token',
    regex: /\b(?:ghp|gho|ghu|ghs|ghr)_[0-9A-Za-z]{30,}|\bgithub_pat_[0-9A-Za-z_]{40,}/,
  },
  {
    id: 'secret-private-key',
    label: 'Private Key Block',
    regex: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/,
  },
];

const MEDIUM_SUSPICIOUS_RULES: ReadonlyArray<{ id: string; label: string; regex: RegExp }> = [
  {
    id: 'suspicious-prompt-override',
    label: 'Pola prompt override (ignore previous instructions)',
    regex: /\bignore\s+(?:all\s+)?previous\s+instructions\b/i,
  },
  {
    id: 'suspicious-remote-fetch-exec',
    label: 'Pola unduh/eksekusi shell (curl/wget/Invoke-WebRequest | sh/iex)',
    regex: /\b(?:curl|wget|Invoke-WebRequest)\b[^\n|]*\|\s*(?:sh|bash|pwsh|powershell|iex)\b/i,
  },
  {
    id: 'suspicious-base64-decode-exec',
    label: 'Pola decode base64 mencurigakan (base64 -d)',
    regex: /\bbase64\s+(?:-d|--decode)\b/i,
  },
];

function isForbiddenFilePath(relPath: string): boolean {
  const norm = relPath.replace(/\\/g, '/');
  const base = path.posix.basename(norm);
  if (base === '.env') return true;
  if (base.startsWith('.env.') && base !== '.env.example') return true;
  if (base.endsWith('.pem') || base.endsWith('.key')) return true;
  if (base.endsWith('.sqlite') || base.endsWith('.db')) return true;
  if (norm.startsWith('data/')) return true;
  return false;
}

function shouldSkipWalk(relPath: string): boolean {
  const norm = relPath.replace(/\\/g, '/');
  if (
    norm === '.git' ||
    norm.startsWith('.git/') ||
    norm === 'node_modules' ||
    norm.startsWith('node_modules/') ||
    norm.includes('/node_modules/') ||
    norm === '.npm-cache' ||
    norm.startsWith('.npm-cache/') ||
    norm === 'dist' ||
    norm.startsWith('dist/') ||
    norm.includes('/dist/') ||
    norm === 'data' ||
    norm.startsWith('data/')
  ) {
    return true;
  }
  return false;
}

function collectFiles(repoRoot: string, dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(repoRoot, full).replace(/\\/g, '/');
    if (shouldSkipWalk(rel)) continue;
    if (rel === '.env' || (rel.startsWith('.env.') && rel !== '.env.example')) {
      continue;
    }
    if (entry.isDirectory()) {
      collectFiles(repoRoot, full, out);
    } else if (entry.isFile()) {
      out.push(rel);
    }
  }
  return out;
}

function getStagedFiles(repoRoot: string): string[] {
  try {
    const stdout = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return stdout
      .split(/\r?\n/)
      .map((s) => s.trim().replace(/\\/g, '/'))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function isEnvIgnoredByGit(repoRoot: string): boolean {
  const gitignorePath = path.join(repoRoot, '.gitignore');
  if (!fs.existsSync(gitignorePath)) return false;
  const content = fs.readFileSync(gitignorePath, 'utf8');
  const lines = content.split(/\r?\n/).map((l) => l.trim());
  const hasEnvRule = lines.includes('.env');
  if (!hasEnvRule) return false;

  const gitDir = path.join(repoRoot, '.git');
  if (fs.existsSync(gitDir)) {
    try {
      execFileSync('git', ['check-ignore', '-q', '.env'], {
        cwd: repoRoot,
        stdio: 'ignore',
      });
      return true;
    } catch {
      return false;
    }
  }
  return true;
}

/**
 * Menjalankan pemindaian keamanan deterministik lokal.
 * Keluaran DIJAMIN tidak pernah memuat nilai rahasia asli.
 */
export function runSecurityScan(options: ScanOptions): ScanResult {
  const { repoRoot, scope = 'all', targetPath, explicitPaths } = options;
  const findings: SecurityFinding[] = [];

  // 1. Periksa .gitignore memuat semua pola wajib
  const gitignorePath = path.join(repoRoot, '.gitignore');
  if (!fs.existsSync(gitignorePath)) {
    findings.push({
      rule: 'gitignore-missing',
      severity: 'hard',
      path: '.gitignore',
      detail: 'File .gitignore tidak ditemukan di root repositori.',
    });
  } else {
    const rawIgnore = fs.readFileSync(gitignorePath, 'utf8');
    const lines = rawIgnore
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('#'));

    for (const reqPattern of REQUIRED_GITIGNORE_PATTERNS) {
      if (!lines.includes(reqPattern)) {
        findings.push({
          rule: 'gitignore-missing-pattern',
          severity: 'hard',
          path: '.gitignore',
          detail: `Pola wajib "${reqPattern}" belum ada di .gitignore.`,
        });
      }
    }
  }

  // 2. Pastikan .env diabaikan oleh Git
  if (!isEnvIgnoredByGit(repoRoot)) {
    findings.push({
      rule: 'env-not-ignored',
      severity: 'hard',
      path: '.env',
      detail: 'File .env tidak diabaikan oleh Git (git check-ignore gagal).',
    });
  }

  // 3. Periksa integritas matriks izin peran
  const forbiddenWriters = ['manager', 'researcher', 'reviewer', 'security', 'visual_qa'] as const;
  for (const role of forbiddenWriters) {
    if ((FILE_WRITING_ROLES as readonly string[]).includes(role)) {
      findings.push({
        rule: 'role-permission-violation',
        severity: 'hard',
        path: 'packages/shared/src/index.ts',
        detail: `Peran "${role}" tidak boleh memiliki izin tulis file.`,
      });
    }
  }
  if (SECURITY_SCAN_ROLES.length !== 1 || SECURITY_SCAN_ROLES[0] !== 'security') {
    findings.push({
      rule: 'role-permission-violation',
      severity: 'hard',
      path: 'packages/shared/src/index.ts',
      detail: 'SECURITY_SCAN_ROLES hanya boleh berisi peran "security".',
    });
  }

  // 4. Kumpulkan daftar file yang akan dipindai
  let candidateRelPaths: string[] = [];
  if (explicitPaths && explicitPaths.length > 0) {
    candidateRelPaths = explicitPaths.map((p) => p.replace(/\\/g, '/'));
  } else if (scope === 'staged') {
    candidateRelPaths = getStagedFiles(repoRoot);
  } else if (scope === 'workspace') {
    const wsDir = targetPath
      ? path.resolve(repoRoot, 'workspace', targetPath)
      : path.join(repoRoot, 'workspace');
    candidateRelPaths = collectFiles(repoRoot, wsDir);
  } else {
    const startDir = targetPath ? path.resolve(repoRoot, targetPath) : repoRoot;
    if (fs.existsSync(startDir) && fs.statSync(startDir).isFile()) {
      candidateRelPaths = [path.relative(repoRoot, startDir).replace(/\\/g, '/')];
    } else {
      candidateRelPaths = collectFiles(repoRoot, startDir);
    }
  }

  // 5. Pindai setiap file kandidat
  let scannedFiles = 0;
  for (const rel of candidateRelPaths) {
    if (isForbiddenFilePath(rel)) {
      findings.push({
        rule: 'forbidden-file-tracked',
        severity: 'hard',
        path: rel,
        detail: 'File rahasia/database terlarang berada dalam daftar target commit.',
      });
      continue;
    }

    const full = path.resolve(repoRoot, rel);
    if (!fs.existsSync(full)) continue;
    let stat: fs.Stats;
    try {
      stat = fs.statSync(full);
    } catch {
      continue;
    }
    if (!stat.isFile() || stat.size > 2 * 1024 * 1024) continue;

    let content: string;
    try {
      content = fs.readFileSync(full, 'utf8');
    } catch {
      continue;
    }
    scannedFiles += 1;

    const lines = content.split(/\r?\n/);
    lines.forEach((line, idx) => {
      const lineNo = idx + 1;

      for (const secretRule of SECRET_RULES) {
        if (secretRule.regex.test(line)) {
          findings.push({
            rule: secretRule.id,
            severity: 'hard',
            path: rel,
            line: lineNo,
            detail: `${secretRule.label} terdeteksi (nilai disamarkan).`,
          });
        }
      }

      for (const medRule of MEDIUM_SUSPICIOUS_RULES) {
        if (medRule.regex.test(line)) {
          findings.push({
            rule: medRule.id,
            severity: 'medium',
            path: rel,
            line: lineNo,
            detail: medRule.label,
          });
        }
      }
    });
  }

  const hard = findings.filter((f) => f.severity === 'hard');
  const medium = findings.filter((f) => f.severity === 'medium');

  return {
    passed: hard.length === 0,
    hard,
    medium,
    all: findings,
    scannedFiles,
    scannedAt: new Date().toISOString(),
  };
}
