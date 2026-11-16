import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseOfficeConfig } from '@office/shared';
import { OfficeDb } from './db';
import { OfficeCore } from './core/office-core';
import { ApiDriver } from './drivers/api-driver';
import { MockDriver } from './drivers/mock-driver';
import { OfficeScheduler } from './core/scheduler';
import { startMcpHttpServer } from './mcp-server';
import { createOfficeHttpServer } from './http-server';
import { AuthSetupError, loadAuthConfig } from './security/auth';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '../../..');

function loadEnvFile(envPath: string): void {
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = val;
    }
  }
}

loadEnvFile(path.join(ROOT_DIR, '.env'));

const configPath = path.join(ROOT_DIR, 'office.config.json');
const rawConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const config = parseOfficeConfig(rawConfig);

const port = Number(process.env.OFFICE_PORT ?? 7420);
const mcpPort = Number(process.env.OFFICE_MCP_PORT ?? 7421);
const bindHost = process.env.OFFICE_BIND_HOST ?? '127.0.0.1';

let auth;
try {
  auth = loadAuthConfig({ rootDir: ROOT_DIR, ports: [5173, 5174, port] });
} catch (err) {
  if (err instanceof AuthSetupError) {
    console.error(`[Office Server] Konfigurasi token tidak aman: ${err.message}`);
    process.exit(1);
  }
  throw err;
}

const dbPath = path.join(ROOT_DIR, 'data', 'office.db');
const workspaceDir = path.join(ROOT_DIR, 'workspace');

const db = new OfficeDb(dbPath);
const core = new OfficeCore({ config, db, workspaceDir });

const useMock = process.env.OFFICE_DRIVER === 'mock';
const driver = useMock ? new MockDriver(core) : new ApiDriver(core);
const scheduler = new OfficeScheduler(core, driver);

const { server, broadcast } = createOfficeHttpServer({ core, scheduler, auth, workspaceDir });
core.onEvent((event) => broadcast(event));

server.listen(port, bindHost, () => {
  console.log(`[Office Server] HTTP + WS listening on http://${bindHost}:${port}`);
  console.log(
    auth.tokenSource === 'env'
      ? '[Office Server] Token CEO: dari OFFICE_TOKEN di .env'
      : `[Office Server] Token CEO: tersimpan di ${path.relative(ROOT_DIR, auth.tokenFile ?? '')} (salin isinya untuk login)`,
  );
  if (auth.viewerToken) {
    console.log('[Office Server] Token pengunjung (view-only) aktif dari OFFICE_VIEWER_TOKEN');
  }
});

startMcpHttpServer({ core, auth, port: mcpPort, host: bindHost });
console.log(`[Office MCP] Streamable HTTP listening on http://${bindHost}:${mcpPort}/mcp (wajib Bearer token)`);

scheduler.start(1500);
