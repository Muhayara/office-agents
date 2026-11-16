/**
 * Kebijakan `run_command`.
 *
 * Interpreter (node, python, npx, npm, git) pada dasarnya bisa menjalankan kode apa pun.
 * Approval CEO tetap jadi gerbang utama, tetapi kebijakan ini menutup jalan pintas:
 * - argumen dibatasi ke karakter aman, sehingga `shell: true` (wajib untuk shim .cmd
 *   di Windows) tidak bisa disuntik metakarakter seperti `&`, `|`, `%`, `^`;
 * - flag eksekusi kode inline (`node -e`, `python -c`, `npx -c`, `git -c`) diblokir;
 * - git hanya subperintah baca (commit/push tetap lewat GitService + pemindai);
 * - npx tidak boleh mengunduh paket dari registry (`--no`);
 * - argumen tidak boleh keluar dari workspace (path absolut atau `..`).
 */

export const ALLOWED_COMMANDS = ['npm', 'npx', 'node', 'git', 'python', 'tsc', 'vitest'] as const;
export type AllowedCommand = (typeof ALLOWED_COMMANDS)[number];

/** Huruf, angka, dan tanda baca yang tidak bermakna khusus di cmd.exe maupun sh. */
const SAFE_ARG = /^[A-Za-z0-9_@+=:,.~/\\-]+$/;

/** Perintah Windows yang berupa shim .cmd sehingga perlu `shell: true`. */
const WINDOWS_SHIM_COMMANDS: ReadonlySet<AllowedCommand> = new Set(['npm', 'npx', 'tsc', 'vitest']);

const NODE_FLAGS_ALLOWED = new Set(['--version', '-v', '--test', '--no-warnings', '--enable-source-maps']);
const PYTHON_FLAGS_ALLOWED = new Set(['--version', '-V', '-u', '-B']);
const PYTHON_MODULES_ALLOWED = new Set(['pytest', 'unittest']);

const GIT_READ_SUBCOMMANDS = new Set(['status', 'diff', 'log', 'show', 'ls-files', 'blame', 'rev-parse', 'branch']);
const GIT_BRANCH_FLAGS = new Set(['-a', '-r', '-v', '-vv', '--list', '--show-current']);
const GIT_BLOCKED_PREFIXES = ['--output', '--ext-diff', '--exec', '--upload-pack', '--receive-pack'];

const NPM_SUBCOMMANDS = new Set([
  'test',
  't',
  'run',
  'run-script',
  'ls',
  'list',
  'outdated',
  'audit',
  'ci',
  'install',
  'i',
  'view',
  'why',
  'explain',
  '--version',
  '-v',
]);
const NPM_BLOCKED_FLAG_PREFIXES = [
  '--prefix',
  '-C',
  '-g',
  '--global',
  '--location',
  '--registry',
  '--userconfig',
  '--globalconfig',
  '--script-shell',
  '--node-options',
  '--cache',
];
const NPX_BLOCKED_FLAGS = ['-p', '--package', '-c', '--call', '-y', '--yes', '--node-options', '--shell'];
const REMOTE_SPEC = /:\/\/|^(?:github|gitlab|bitbucket|gist|git\+[a-z]+|file|https?):/i;

export type CommandPolicyResult =
  | { ok: true; command: AllowedCommand; args: string[]; useShell: boolean; timeoutMs: number }
  | { ok: false; reason: string };

function deny(reason: string): CommandPolicyResult {
  return { ok: false, reason };
}

function escapesWorkspace(arg: string): boolean {
  if (/^[A-Za-z]:/.test(arg) || arg.startsWith('/') || arg.startsWith('\\') || arg.startsWith('~')) {
    return true;
  }
  return arg.split(/[\\/=]/).includes('..');
}

function hasBlockedPrefix(arg: string, prefixes: readonly string[]): boolean {
  return prefixes.some((p) => arg === p || arg.startsWith(`${p}=`) || (p.startsWith('--') && arg.startsWith(p)));
}

/** Flag sebelum argumen non-flag pertama (script/modul) harus ada di allowlist. */
function checkInterpreterFlags(args: string[], allowed: ReadonlySet<string>, name: string): string | null {
  for (const arg of args) {
    if (!arg.startsWith('-')) return null;
    if (!allowed.has(arg)) {
      return `Flag ${name} "${arg}" tidak diizinkan (hanya ${Array.from(allowed).join(', ')}).`;
    }
  }
  return null;
}

export function evaluateCommand(
  rawCommand: string,
  rawArgs: readonly string[],
  platform: NodeJS.Platform = process.platform,
): CommandPolicyResult {
  const command = rawCommand.trim().toLowerCase() as AllowedCommand;
  if (!(ALLOWED_COMMANDS as readonly string[]).includes(command)) {
    return deny(`Perintah "${rawCommand}" tidak termasuk allowlist (${ALLOWED_COMMANDS.join(', ')}).`);
  }

  const args = [...rawArgs];
  for (const arg of args) {
    if (!SAFE_ARG.test(arg)) {
      return deny(
        `Argumen "${arg}" memuat karakter yang tidak diizinkan. Gunakan huruf, angka, dan ._-/:=@+,~ tanpa spasi atau tanda kutip.`,
      );
    }
    if (escapesWorkspace(arg)) {
      return deny(`Argumen "${arg}" menunjuk ke luar workspace (path absolut atau "..").`);
    }
  }

  switch (command) {
    case 'node': {
      const err = checkInterpreterFlags(args, NODE_FLAGS_ALLOWED, 'node');
      if (err) return deny(`${err} Eksekusi kode inline (-e/-p/--eval/--require/--import) diblokir.`);
      break;
    }
    case 'python': {
      if (args[0] === '-m') {
        if (!args[1] || !PYTHON_MODULES_ALLOWED.has(args[1])) {
          return deny(`python -m hanya untuk modul ${Array.from(PYTHON_MODULES_ALLOWED).join(', ')}.`);
        }
        break;
      }
      const err = checkInterpreterFlags(args, PYTHON_FLAGS_ALLOWED, 'python');
      if (err) return deny(`${err} Eksekusi kode inline (-c) diblokir.`);
      break;
    }
    case 'git': {
      const sub = args[0];
      if (!sub || !GIT_READ_SUBCOMMANDS.has(sub)) {
        return deny(
          `git hanya untuk subperintah baca (${Array.from(GIT_READ_SUBCOMMANDS).join(', ')}). Commit & push dilakukan otomatis setelah ACC reviewer.`,
        );
      }
      if (args.some((a) => hasBlockedPrefix(a, GIT_BLOCKED_PREFIXES))) {
        return deny('Opsi git yang menulis file atau menjalankan program eksternal diblokir.');
      }
      if (sub === 'branch' && args.slice(1).some((a) => !GIT_BRANCH_FLAGS.has(a))) {
        return deny('git branch hanya untuk melihat daftar branch.');
      }
      break;
    }
    case 'npm': {
      const sub = args[0];
      if (!sub || !NPM_SUBCOMMANDS.has(sub)) {
        return deny(`Subperintah npm "${sub ?? ''}" tidak diizinkan (${Array.from(NPM_SUBCOMMANDS).join(', ')}).`);
      }
      if (args.some((a) => hasBlockedPrefix(a, NPM_BLOCKED_FLAG_PREFIXES))) {
        return deny('Opsi npm yang mengubah lokasi instalasi/registry/konfigurasi diblokir.');
      }
      if (args.slice(1).some((a) => REMOTE_SPEC.test(a))) {
        return deny('Instal paket dari URL/git/file diblokir; gunakan nama paket dari registry.');
      }
      break;
    }
    case 'npx': {
      if (args.some((a) => hasBlockedPrefix(a, NPX_BLOCKED_FLAGS))) {
        return deny('Opsi npx -p/-c/--yes diblokir.');
      }
      if (!args[0] || args[0].startsWith('-')) {
        return deny('npx wajib diikuti nama binary lokal, mis. "npx vite build".');
      }
      if (REMOTE_SPEC.test(args[0])) {
        return deny('npx dari URL/git diblokir.');
      }
      // Hanya binary yang sudah terpasang lokal: larang unduhan otomatis dari registry.
      args.unshift('--no');
      break;
    }
    case 'tsc':
    case 'vitest':
      break;
  }

  const heavy = command === 'npm' || command === 'npx' || command === 'vitest' || command === 'tsc';
  return {
    ok: true,
    command,
    args,
    useShell: platform === 'win32' && WINDOWS_SHIM_COMMANDS.has(command),
    timeoutMs: heavy ? 90_000 : 30_000,
  };
}

const SECRET_ENV_PATTERN = /(TOKEN|SECRET|PASSWORD|PASSWD|API_?KEY|PRIVATE|CREDENTIAL|_KEY$)/i;

/**
 * Environment untuk proses anak tanpa rahasia server (kunci gateway, token CEO).
 * Tanpa ini, skrip buatan agen bisa membaca dan mencetak `process.env.NINEROUTER_KEY`.
 */
export function sanitizedChildEnv(
  env: NodeJS.ProcessEnv,
  extraSecretKeys: readonly string[] = [],
): NodeJS.ProcessEnv {
  const extra = new Set(extraSecretKeys.map((k) => k.toUpperCase()));
  const out: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) continue;
    if (extra.has(key.toUpperCase()) || SECRET_ENV_PATTERN.test(key)) continue;
    out[key] = value;
  }
  return out;
}
