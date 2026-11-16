import {
  type AgentConfig,
  type ToolName,
  actionsToToolCalls,
  extractEnvelope,
  isToolName,
  managerOf,
  repairInstruction,
  toOpenAITools,
} from '@office/shared';
import type { OfficeCore } from '../core/office-core';
import { buildSystemPrompt, buildTurnPrompt } from '../prompts';
import type { AgentDriver, AgentTurnInput, AgentTurnResult, DriverStepRecord } from './types';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

interface ParsedCompletion {
  text: string;
  toolCalls: Array<{
    id: string;
    name: string;
    arguments: string;
  }>;
  tokensIn: number;
  tokensOut: number;
  error?: string;
}

/**
 * Dual-mode parser: handles both standard JSON chat.completion and SSE `data:` streams
 * returned by 9router providers.
 */
export function parseGatewayPayload(raw: string): ParsedCompletion {
  const trimmed = raw.trim();
  if (trimmed.startsWith('{') && !trimmed.includes('\ndata:')) {
    try {
      const obj = JSON.parse(trimmed) as {
        error?: unknown;
        choices?: Array<{
          message?: {
            content?: string | null;
            reasoning_content?: string | null;
            tool_calls?: Array<{
              id?: string;
              function?: { name?: string; arguments?: string };
            }>;
          };
        }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      if (obj.error) {
        return {
          text: '',
          toolCalls: [],
          tokensIn: 0,
          tokensOut: 0,
          error: typeof obj.error === 'string' ? obj.error : JSON.stringify(obj.error),
        };
      }
      const msg = obj.choices?.[0]?.message;
      const toolCalls = (msg?.tool_calls ?? []).map((tc, idx) => ({
        id: tc.id || `call_${idx}`,
        name: tc.function?.name || '',
        arguments: tc.function?.arguments || '{}',
      }));
      return {
        text: (msg?.content ?? '').trim(),
        toolCalls,
        tokensIn: obj.usage?.prompt_tokens ?? 0,
        tokensOut: obj.usage?.completion_tokens ?? 0,
      };
    } catch {
      // fall through to line-by-line SSE parser
    }
  }

  let text = '';
  let tokensIn = 0;
  let tokensOut = 0;
  let error: string | undefined;
  const tcMap = new Map<number, { id: string; name: string; arguments: string }>();

  for (const line of trimmed.split(/\r?\n/)) {
    const clean = line.startsWith('data:') ? line.slice(5).trim() : line.trim();
    if (!clean || clean === '[DONE]') continue;
    try {
      const obj = JSON.parse(clean) as {
        error?: unknown;
        choices?: Array<{
          delta?: {
            content?: string;
            tool_calls?: Array<{
              index?: number;
              id?: string;
              function?: { name?: string; arguments?: string };
            }>;
          };
          message?: {
            content?: string;
            tool_calls?: Array<{
              id?: string;
              function?: { name?: string; arguments?: string };
            }>;
          };
        }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      if (obj.error) {
        error = typeof obj.error === 'string' ? obj.error : JSON.stringify(obj.error);
      }
      if (obj.usage) {
        tokensIn = obj.usage.prompt_tokens ?? tokensIn;
        tokensOut = obj.usage.completion_tokens ?? tokensOut;
      }
      const delta = obj.choices?.[0]?.delta ?? obj.choices?.[0]?.message;
      if (delta?.content) {
        text += delta.content;
      }
      if (delta?.tool_calls) {
        delta.tool_calls.forEach((tc, i) => {
          const idx = 'index' in tc && typeof tc.index === 'number' ? tc.index : i;
          const prev = tcMap.get(idx) ?? { id: tc.id || `call_${idx}`, name: '', arguments: '' };
          if (tc.id) prev.id = tc.id;
          if (tc.function?.name) prev.name += tc.function.name;
          if (tc.function?.arguments) prev.arguments += tc.function.arguments;
          tcMap.set(idx, prev);
        });
      }
    } catch {
      // ignore non-JSON lines
    }
  }

  return {
    text: text.trim(),
    toolCalls: Array.from(tcMap.values()).filter((t) => t.name.length > 0),
    tokensIn,
    tokensOut,
    error,
  };
}

export class ApiDriver implements AgentDriver {
  private readonly core: OfficeCore;
  private readonly apiKey: string;

  constructor(core: OfficeCore, apiKey?: string) {
    this.core = core;
    const envName = core.config.gateway.apiKeyEnv;
    this.apiKey = apiKey ?? process.env[envName] ?? '';
  }

  public async runTurn(input: AgentTurnInput): Promise<AgentTurnResult> {
    const { agent, unreadMessages, activeTasks, recentContext, maxSteps, signal } = input;
    const lang = this.core.getLanguage();
    const quota = this.core.getQuota(agent.id);

    const systemPrompt = buildSystemPrompt({
      role: agent.role,
      lang,
      config: this.core.config,
      maxSteps,
      toolMode: agent.toolMode,
    });

    const userPrompt = buildTurnPrompt({
      lang,
      unreadMessages,
      activeTasks,
      recentContext,
      maxSteps,
      quotaUsed: quota.used,
      quotaCap: quota.cap,
    });

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const steps: DriverStepRecord[] = [];
    let finalText = '';
    let modelUsed = agent.model;
    let repairUsed = false;
    let anyToolExecuted = false;

    for (let step = 1; step <= maxSteps; step += 1) {
      if (signal.aborted) {
        throw new Error('Turn dibatalkan (AbortSignal)');
      }

      const currentQuota = this.core.getQuota(agent.id);
      if (currentQuota.cap > 0 && currentQuota.used >= currentQuota.cap) {
        this.core.setAgentStatus(
          agent.id,
          'offline',
          `Kuota harian habis (${currentQuota.used}/${currentQuota.cap})`,
        );
        break;
      }

      this.core.setAgentStatus(agent.id, 'thinking', `Langkah ${step}/${maxSteps}`);

      // Batas global kantor (limits.globalReqPerMin / globalReqPerDay) berlaku untuk semua kursi.
      await this.core.waitForRateSlot(signal);
      const callResult = await this.callWithFallbacks(agent, messages, signal);
      modelUsed = callResult.modelUsed;
      const { parsed } = callResult;

      this.core.recordUsage(agent.id, parsed.tokensIn, parsed.tokensOut);

      // Case 1: Native tool_calls returned
      if (parsed.toolCalls.length > 0) {
        if (parsed.text) {
          finalText = parsed.text;
          this.core.agentSay(agent.id, parsed.text, 'focused');
        }

        messages.push({
          role: 'assistant',
          content: parsed.text || null,
          tool_calls: parsed.toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function',
            function: { name: tc.name, arguments: tc.arguments },
          })),
        });

        let turnFinished = false;
        for (const tc of parsed.toolCalls) {
          let parsedArgs: unknown = {};
          try {
            parsedArgs = tc.arguments ? JSON.parse(tc.arguments) : {};
          } catch {
            parsedArgs = {};
          }

          if (!isToolName(tc.name)) {
            const errMsg = `Tool "${tc.name}" tidak dikenal.`;
            steps.push({ seq: steps.length + 1, kind: 'error', name: tc.name, output: errMsg });
            messages.push({ role: 'tool', tool_call_id: tc.id, content: errMsg });
            continue;
          }

          this.core.setAgentStatus(agent.id, 'working', `Menjalankan ${tc.name}`);
          const execResult = await this.core.executeTool(agent.id, tc.name as ToolName, parsedArgs, {
            signal,
          });
          anyToolExecuted = true;
          steps.push({
            seq: steps.length + 1,
            kind: 'tool',
            name: tc.name,
            input: parsedArgs,
            output: execResult.output,
          });

          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: execResult.output,
          });

          if (execResult.finished) {
            turnFinished = true;
            if (!finalText) finalText = execResult.output;
            break;
          }
        }

        if (turnFinished) break;
        continue;
      }

      // Case 2: Text returned without native tool_calls — try JSON envelope extraction first
      const envResult = extractEnvelope(parsed.text);
      if (envResult.ok && (envResult.envelope.actions.length > 0 || envResult.envelope.say)) {
        const { envelope } = envResult;
        if (envelope.say) {
          finalText = envelope.say;
          this.core.agentSay(agent.id, envelope.say, envelope.emotion);
        }
        messages.push({ role: 'assistant', content: parsed.text });

        const mappedCalls = actionsToToolCalls(envelope.actions);
        if (mappedCalls.length === 0) {
          break;
        }

        const toolFeedback: string[] = [];
        let turnFinished = false;
        for (const mc of mappedCalls) {
          this.core.setAgentStatus(agent.id, 'working', `Menjalankan ${mc.name}`);
          const execResult = await this.core.executeTool(agent.id, mc.name, mc.input, { signal });
          anyToolExecuted = true;
          steps.push({
            seq: steps.length + 1,
            kind: 'tool',
            name: mc.name,
            input: mc.input,
            output: execResult.output,
          });
          toolFeedback.push(`[${mc.name}]: ${execResult.output}`);
          if (execResult.finished) {
            turnFinished = true;
            break;
          }
        }
        if (turnFinished) break;
        messages.push({ role: 'user', content: `Hasil tool:\n${toolFeedback.join('\n')}` });
        continue;
      }

      // If seat requires JSON envelope mode and failed parsing, try 1x repair
      if (agent.toolMode === 'json' && !envResult.ok && !repairUsed) {
        repairUsed = true;
        messages.push({ role: 'assistant', content: parsed.text });
        messages.push({ role: 'user', content: repairInstruction(lang, envResult.error) });
        continue;
      }

      // Plain text response: emit speech and if no tool was called yet, deliver as a message to sender/CEO
      if (parsed.text) {
        finalText = parsed.text;
        steps.push({ seq: steps.length + 1, kind: 'text', output: parsed.text });
        this.core.agentSay(agent.id, parsed.text, 'neutral');
        if (!anyToolExecuted) {
          // Balas ke pengirim manusia/agen terakhir; catatan "system" tidak bisa dibalas.
          const lastSender =
            [...unreadMessages].reverse().find((m) => m.sender !== 'system' && m.sender !== agent.id)
              ?.sender ?? (agent.role === 'manager' ? 'ceo' : managerOf(this.core.config).id);
          this.core.sendMessage({
            sender: agent.id,
            to: lastSender,
            body: parsed.text,
          });
        }
      }
      break;
    }

    return {
      finalText: finalText || 'Selesai.',
      modelUsed,
      steps,
    };
  }

  private async callWithFallbacks(
    agent: AgentConfig,
    messages: ChatMessage[],
    signal: AbortSignal,
  ): Promise<{ parsed: ParsedCompletion; modelUsed: string }> {
    const candidates = [agent.model, ...agent.fallbacks];
    let lastError = 'Tidak ada model kandidat';

    for (const model of candidates) {
      try {
        const parsed = await this.callSingleModel(model, agent.toolMode === 'tools', messages, signal);
        if (!parsed.error) {
          return { parsed, modelUsed: model };
        }
        lastError = `[${model}] ${parsed.error}`;
      } catch (err) {
        lastError = `[${model}] ${err instanceof Error ? err.message : String(err)}`;
      }
    }

    throw new Error(`Semua model gagal untuk ${agent.id}: ${lastError}`);
  }

  private async callSingleModel(
    model: string,
    includeTools: boolean,
    messages: ChatMessage[],
    signal: AbortSignal,
  ): Promise<ParsedCompletion> {
    const url = `${this.core.config.gateway.baseUrl.replace(/\/$/, '')}/chat/completions`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }

    const body: Record<string, unknown> = {
      model,
      stream: false,
      max_tokens: 1500,
      temperature: 0.2,
      messages,
    };

    if (includeTools) {
      body.tools = toOpenAITools();
      body.tool_choice = 'auto';
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    });

    const raw = await res.text();
    if (!res.ok) {
      // If model rejected `tools` parameter with 400, automatically retry once in envelope mode
      if (res.status === 400 && includeTools && raw.toLowerCase().includes('tool')) {
        return this.callSingleModel(model, false, messages, signal);
      }
      return {
        text: '',
        toolCalls: [],
        tokensIn: 0,
        tokensOut: 0,
        error: `HTTP ${res.status}: ${raw.slice(0, 240)}`,
      };
    }

    return parseGatewayPayload(raw);
  }
}
