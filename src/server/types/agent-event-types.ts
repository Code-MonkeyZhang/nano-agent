export interface AgentStepEvent {
  type: 'step_start';
  step: number;
  maxSteps: number;
}

export interface AgentThoughtEvent {
  id: string;
  type: 'thinking';
  content: string;
  isStreaming: boolean;
}

export interface AgentContentEvent {
  id: string;
  type: 'content';
  content: string;
  isStreaming: boolean;
}

export interface AgentToolCallEvent {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface AgentToolResultEvent {
  toolId: string;
  name: string;
  success: true;
  output: string;
}

export interface AgentToolErrorEvent {
  toolId: string;
  name: string;
  success: false;
  error: string;
}

export type AgentToolResultOrErrorEvent =
  | AgentToolResultEvent
  | AgentToolErrorEvent;

export interface BaseAgentToolResultEvent {
  toolId: string;
  name: string;
  success: boolean;
  output?: string;
  error?: string;
}

export interface AgentErrorEvent {
  id: string;
  type: 'error';
  message: string;
}
