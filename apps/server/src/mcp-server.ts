import http from 'node:http';
import { TOOL_DEFINITIONS, isToolName, type ToolName } from '@office/shared';
import type { OfficeCore } from './core/office-core';

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
        const target = String(args.agentId ?? agentId);
        const exec = await core.executeTool(target, 'read_inbox', { limit: 20, markRead: true });
        return {
          jsonrpc: '2.0',
          id,
          result: { content: [{ type: 'text', text: exec.output }] },
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

export function startMcpHttpServer(core: OfficeCore, port = 7421): http.Server {
  const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Office-Agent');
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);
    if (url.pathname !== '/mcp') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found' }));
      return;
    }

    const agentId =
      url.searchParams.get('agent') ||
      (req.headers['x-office-agent'] as string | undefined) ||
      'laras';

    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const raw = Buffer.concat(chunks).toString('utf8');
    try {
      const rpc = JSON.parse(raw);
      const reply = await handleMcpJsonRpc(core, agentId, rpc);
      if (reply === null) {
        res.writeHead(202);
        res.end();
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(reply));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          jsonrpc: '2.0',
          id: null,
          error: { code: -32700, message: err instanceof Error ? err.message : 'Parse error' },
        }),
      );
    }
  });

  server.listen(port, '127.0.0.1');
  return server;
}
