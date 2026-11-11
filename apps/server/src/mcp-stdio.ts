import readline from 'node:readline';

const MCP_HTTP_URL = process.env.OFFICE_MCP_URL ?? 'http://127.0.0.1:7421/mcp?agent=laras';

const rl = readline.createInterface({
  input: process.stdin,
  terminal: false,
});

rl.on('line', async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  try {
    const res = await fetch(MCP_HTTP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: trimmed,
    });
    if (res.status === 202) return;
    const text = await res.text();
    if (text.trim()) {
      process.stdout.write(`${text.trim()}\n`);
    }
  } catch (err) {
    let id: unknown = null;
    try {
      id = JSON.parse(trimmed).id ?? null;
    } catch {
      // ignore
    }
    process.stdout.write(
      `${JSON.stringify({
        jsonrpc: '2.0',
        id,
        error: {
          code: -32000,
          message: `Office Server belum aktif di ${MCP_HTTP_URL}: ${err instanceof Error ? err.message : String(err)}`,
        },
      })}\n`,
    );
  }
});
