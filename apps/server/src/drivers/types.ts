import type { AgentConfig, Message, Task } from '@office/shared';

export interface DriverStepRecord {
  seq: number;
  kind: 'text' | 'tool' | 'error';
  name?: string;
  input?: unknown;
  output?: unknown;
}

export interface AgentTurnInput {
  agent: AgentConfig;
  unreadMessages: Message[];
  activeTasks: Task[];
  recentContext: Message[];
  maxSteps: number;
  signal: AbortSignal;
}

export interface AgentTurnResult {
  finalText: string;
  modelUsed: string;
  steps: DriverStepRecord[];
}

export interface AgentDriver {
  runTurn(input: AgentTurnInput): Promise<AgentTurnResult>;
}
