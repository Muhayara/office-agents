import http from 'node:http';
import { TOOL_DEFINITIONS, isToolName, type ToolName } from '@office/shared';
import type { OfficeCore } from './core/office-core';
import { type AuthConfig, isAllowedHost, isAllowedOrigin, resolveRequestRole } from './security/auth';
import { HttpError, readJsonBody, sendJson } from './http-util';

/** write_file bisa membawa konten 256 KB (plus escape JSON). */
export const MCP_BODY_LIMIT = 2 * 1024 * 1024;

const CLAUDE_DESKTOP_TOOLS = [
  {
    name: 'office_overview',
    description: 'Get complete snapshot of the AI Office (agents, tasks, pending approvals).',
    inputSchema: { type: 'object', properties: {}, required: [], additionalProperties: false },
  },
  {
    name: 'office_read_inbox',
    description: 'Read unread messages in the reviewer (laras) inbox.',
    inputSchema: {
      type: 'object',
      properties: { agentId: { type: 'string', description: 'Agent ID, default "laras"' } },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'office_send_message',
    description: 'Send a message to an agent, "raka", "ceo", or "all".',
    inputSchema: {
      type: 'object',
      properties: {
        to: { type: 'string' },
        text: { type: 'string' },
      },
      required: ['to', 'text'],
      additionalProperties: false,
    },
  },
  {
    name: 'office_list_tasks',
    description: 'List tasks on the WorkOrderBoard, optionally filtered by status.',
    inputSchema: {
      type: 'object',
      properties: { status: { type: 'string' } },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'office_get_task',
    description: 'Get details of a specific task by ID.',
    inputSchema: {
      type: 'object',
      properties: { taskId: { type: 'string' } },
      required: ['taskId'],
      additionalProperties: false,
    },
  },
  {
    name: 'office_get_diff',
    description: 'Get git status and diff of the office workspace.',
    inputSchema: { type: 'object', properties: {}, required: [], additionalProperties: false },
  },
  {
    name: 'office_post_review',
    description: 'Submit an ACC (done) or REJECT (blocked) review verdict for a task.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        verdict: { type: 'string', enum: ['ACC', 'REJECT'] },
        notes: { type: 'string' },
      },
      required: ['taskId', 'verdict', 'notes'],
      additionalProperties: false,
    },
  },
];

export async function handleMcpJsonRpc(
  core: OfficeCore,
  agentId: string,
  rpc: { jsonrpc?: string; id?: unknown; method?: string; params?: Record<string, unknown> },
): Promise<unknown> {
  const { id = null, method, params = {} } = rpc;

  if (method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'office-mcp-server', version: '1.0.0' },
      },
    };
  }

  if (method === 'notifications/initialized') {
    return null;
  }

  if (method === 'tools/list') {
    const standardTools = TOOL_DEFINITIONS.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.jsonSchema,
    }));
    return {
      jsonrpc: '2.0',
      id,
      result: {
        tools: [...standardTools, ...CLAUDE_DESKTOP_TOOLS],
      },
    };
  }

  if (method === 'tools/call') {
    const toolName = String(params.name ?? '');
    const args = (params.arguments ?? {}) as Record<string, unknown>;

    if (isToolName(toolName)) {
      const exec = await core.executeTool(agentId, toolName as ToolName, args);
      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [{ type: 'text', text: exec.output }],
          isError: !exec.ok,
        },
      };
    }

    // Claude Desktop convenience tools
    switch (toolName) {
      case 'office_overview': {
        const snap = core.getSnapshot();
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: JSON.stringify(snap, null, 2) }],
          },
        };
      }
      case 'office_read_inbox': {
        const target = String(args.agentId ?? agentId).trim().toLowerCase();
        if (!core.getAgentConfig(target)) {
          return {
            jsonrpc: '2.0',
            id,
            result: {
              content: [{ type: 'text', text: `Agen "${target}" tidak terdaftar.` }],
              isError: true,
            },
          };
        }
        // Hanya inbox milik sendiri yang ditandai terbaca; mengintip inbox agen lain
        // tidak boleh membuat pesan mereka "hilang" dari giliran berikutnya.
        const exec = await core.executeTool(target, 'read_inbox', {
          limit: 20,
          markRead: target === agentId,
        });
        return {
          jsonrpc: '2.0',
          id,
          result: { content: [{ type: 'text', text: exec.output }], isError: !exec.ok },
        };
      }
      case 'office_send_message': {
        const exec = await core.executeTool(agentId, 'send_message', args);
        return {
          jsonrpc: '2.0',
          id,
          result: { content: [{ type: 'text', text: exec.output }], isError: !exec.ok },
        };
      }
      case 'office_list_tasks': {
        const exec = await core.executeTool(agentId, 'list_tasks', args);
        return {
          jsonrpc: '2.0',
          id,
          result: { content: [{ type: 'text', text: exec.output }] },
        };
      }
      case 'office_get_task': {
        const task = core.getTask(String(args.taskId ?? ''));
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: task ? JSON.stringify(task, null, 2) : 'Tugas tidak ditemukan.',
              },
            ],
            isError: !task,
          },
        };
      }
      case 'office_get_diff': {
        const exec = await core.executeTool(agentId, 'git_diff', {});
        return {
          jsonrpc: '2.0',
          id,
          result: { content: [{ type: 'text', text: exec.output }] },
        };
      }
      case 'office_post_review': {
        const taskId = String(args.taskId ?? '');
        const verdict = String(args.verdict ?? 'ACC').toUpperCase();
        const notes = String(args.notes ?? '');
        const status = verdict === 'ACC' ? 'done' : 'blocked';
        const exec = await core.executeTool(agentId, 'update_task', {
          taskId,
          status,
          note: `[${verdict}] ${notes}`,
        });
        return {
          jsonrpc: '2.0',
          id,
          result: { content: [{ type: 'text', text: exec.output }], isError: !exec.ok },
        };
      }
    }

    return {
      jsonrpc: '2.0',
      id,
      error: { code: -32601, message: `Tool tidak dikenal: ${toolName}` },
    };
  }

  return {
    jsonrpc: '2.0',
    id,
    error: { code: -32601, message: `Method MCP tidak dikenal: ${String(method)}` },
  };
}

export function startMcpHttpServer(options: {
  core: OfficeCore;
  auth: AuthConfig;
  port?: number;
  host?: string;
}): http.Server {
  const server = createMcpHttpServer(options);
  server.listen(options.port ?? 7421, options.host ?? '127.0.0.1');
  return server;
}

export function createMcpHttpServer(options: { core: OfficeCore; auth: AuthConfig }): http.Server {
  const { core, auth } = options;

  const server = http.createServer((req, res) => {
    void handle(req, res).catch((err) => {
      if (res.headersSent) {
        res.destroy();
        return;
      }
      const status = err instanceof HttpError ? err.status : 400;
      sendJson(res, status, {
        jsonrpc: '2.0',
        id: null,
        error: {
          code: status === 400 ? -32700 : -32600,
          message: err instanceof Error ? err.message : 'Parse error',
        },
      });
    });
  });

  async function handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    // Spesifikasi MCP Streamable HTTP: validasi Origin untuk mencegah DNS rebinding.
    if (!isAllowedHost(auth, req)) {
      sendJson(res, 421, { error: 'Host tidak diizinkan' });
      return;
    }
    if (!isAllowedOrigin(auth, req)) {
      sendJson(res, 403, { error: 'Origin tidak diizinkan' });
      return;
    }

    const url = new URL(req.url ?? '/', 'http://office.local');
    if (url.pathname !== '/mcp') {
      sendJson(res, 404, { error: 'Not Found' });
      return;
    }
    if (req.method !== 'POST') {
      res.writeHead(405, { Allow: 'POST' });
      res.end();
      return;
    }

    // MCP hanya untuk klien non-browser: wajib Bearer token CEO, cookie tidak diterima.
    const role = resolveRequestRole(auth, req, { allowCookie: false });
    if (role !== 'ceo') {
      sendJson(
        res,
        401,
        {
          jsonrpc: '2.0',
          id: null,
          error: { code: -32001, message: 'Wajib header Authorization: Bearer <OFFICE_TOKEN>' },
        },
        { 'WWW-Authenticate': 'Bearer' },
      );
      return;
    }

    const rawAgent =
      url.searchParams.get('agent') ||
      (req.headers['x-office-agent'] as string | undefined) ||
      'laras';
    const agentId = rawAgent.trim().toLowerCase();
    const agentCfg = core.getAgentConfig(agentId);

    const rpc = (await readJsonBody(req, MCP_BODY_LIMIT)) as Parameters<typeof handleMcpJsonRpc>[2];
    if (!agentCfg || !agentCfg.enabled) {
      sendJson(res, 403, {
        jsonrpc: '2.0',
        id: (rpc as { id?: unknown })?.id ?? null,
        error: { code: -32002, message: `Agen "${agentId}" tidak terdaftar atau nonaktif.` },
      });
      return;
    }

    const reply = await handleMcpJsonRpc(core, agentId, rpc);
    if (reply === null) {
      res.writeHead(202);
      res.end();
      return;
    }
    sendJson(res, 200, reply);
  }

  return server;
}
