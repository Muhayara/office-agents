import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '../../..');
const MCP_HTTP_URL = process.env.OFFICE_MCP_URL ?? 'http://127.0.0.1:7421/mcp?agent=laras';

/** Token CEO: OFFICE_TOKEN dari environment, atau file yang dibuat server di data/.office-token. */
function resolveToken(): string {
  const fromEnv = (process.env.OFFICE_TOKEN ?? '').trim();
  if (fromEnv) return fromEnv;
  const tokenFile = path.join(ROOT_DIR, 'data', '.office-token');
  try {
    return fs.readFileSync(tokenFile, 'utf8').trim();
  } catch {
    return '';
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  terminal: false,
});

function writeError(line: string, message: string): void {
  let id: unknown = null;
  try {
    id = JSON.parse(line).id ?? null;
  } catch {
    // ignore
  }
  process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32000, message } })}\n`);
}

rl.on('line', async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  const token = resolveToken();
  if (!token) {
    writeError(trimmed, 'Token CEO tidak ditemukan. Jalankan Office Server sekali atau isi OFFICE_TOKEN.');
    return;
  }
  try {
    const res = await fetch(MCP_HTTP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${token}`,
      },
      body: trimmed,
    });
    if (res.status === 202) return;
    const text = await res.text();
    if (text.trim()) {
      process.stdout.write(`${text.trim()}\n`);
    }
  } catch (err) {
    writeError(
      trimmed,
      `Office Server belum aktif di ${MCP_HTTP_URL}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
});
