import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import {
  formatZodError,
  parseClientCommand,
  parseOfficeConfig,
  type ServerEvent,
} from '@office/shared';
import { OfficeDb } from './db';
import { OfficeCore } from './core/office-core';
import { ApiDriver } from './drivers/api-driver';
import { MockDriver } from './drivers/mock-driver';
import { OfficeScheduler } from './core/scheduler';
import { startMcpHttpServer } from './mcp-server';

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

const dbPath = path.join(ROOT_DIR, 'data', 'office.db');
const workspaceDir = path.join(ROOT_DIR, 'workspace');

const db = new OfficeDb(dbPath);
const core = new OfficeCore({ config, db, workspaceDir });

const useMock = process.env.OFFICE_DRIVER === 'mock';
const driver = useMock ? new MockDriver(core) : new ApiDriver(core);
const scheduler = new OfficeScheduler(core, driver);

const port = Number(process.env.OFFICE_PORT ?? 7420);
const mcpPort = Number(process.env.OFFICE_MCP_PORT ?? 7421);

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);

  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        ok: true,
        gateway: core.getGatewayHealth(),
        serverTime: new Date().toISOString(),
      }),
    );
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/state') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(core.getSnapshot()));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/files') {
    const files = core.walkWorkspaceDir(workspaceDir, 4);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ files }));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/file') {
    const relPath = url.searchParams.get('path') ?? '';
    try {
      const full = core.resolveWorkspacePath(relPath);
      if (!fs.existsSync(full) || fs.statSync(full).isDirectory()) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'File tidak ditemukan' }));
        return;
      }
      const content = fs.readFileSync(full, 'utf8').slice(0, 128000);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ path: relPath, content }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/command') {
    const chunks: Buffer[] = [];
    for await (const c of req) {
      chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
    }
    try {
      const raw = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      const parsed = parseClientCommand(raw);
      if (!parsed.success) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: formatZodError(parsed.error) }));
        return;
      }
      core.handleClientCommand(parsed.data);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }));
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/gateway/check') {
    await scheduler.checkGatewayHealth();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(core.getGatewayHealth()));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not Found' }));
});

const wss = new WebSocketServer({ server, path: '/ws' });

function broadcast(event: ServerEvent): void {
  const payload = JSON.stringify(event);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

core.onEvent((event) => {
  broadcast(event);
});

wss.on('connection', (ws) => {
  const snapshotEvent: ServerEvent = {
    type: 'state.snapshot',
    state: core.getSnapshot(),
    at: new Date().toISOString(),
  };
  ws.send(JSON.stringify(snapshotEvent));

  ws.on('message', (data) => {
    try {
      const parsedJson = JSON.parse(data.toString());
      const parsedCmd = parseClientCommand(parsedJson);
      if (!parsedCmd.success) {
        const errEvent: ServerEvent = {
          type: 'error',
          code: 'INVALID_COMMAND',
          message: formatZodError(parsedCmd.error),
          at: new Date().toISOString(),
        };
        ws.send(JSON.stringify(errEvent));
        return;
      }
      core.handleClientCommand(parsedCmd.data);
    } catch (err) {
      const errEvent: ServerEvent = {
        type: 'error',
        code: 'PARSE_ERROR',
        message: err instanceof Error ? err.message : 'JSON tidak valid',
        at: new Date().toISOString(),
      };
      ws.send(JSON.stringify(errEvent));
    }
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`[Office Server] HTTP + WS listening on http://127.0.0.1:${port}`);
});

startMcpHttpServer(core, mcpPort);
console.log(`[Office MCP] Streamable HTTP listening on http://127.0.0.1:${mcpPort}/mcp`);

scheduler.start(1500);
