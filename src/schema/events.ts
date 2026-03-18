import type { ToolCall } from './schema.js';
import type { ToolResult } from '../tools/index.js';

export type AgentEvent =
  | { type: 'step_start'; step: number; maxSteps: number }
  | { type: 'thinking'; content: string }
  | { type: 'content'; content: string }
  | { type: 'tool_call'; tool_calls: ToolCall[] }
  | { type: 'tool_start'; toolCall: ToolCall }
  | {
      type: 'tool_result';
      result: ToolResult;
      toolCallId: string;
      toolName: string;
    }
  | { type: 'error'; error: string };

export type IPCEvent =
  | { type: 'message_start' }
  | { type: 'thinking'; delta: string }
  | { type: 'content'; delta: string }
  | {
      type: 'tool_call';
      id: string;
      name: string;
      input: Record<string, unknown>;
    }
  | { type: 'tool_start'; toolId: string }
  | {
      type: 'tool_result';
      toolId: string;
      result: string;
      success: boolean;
    }
  | { type: 'step_start'; step: number; maxSteps: number }
  | { type: 'error'; error: string }
  | { type: 'complete' }
  | { type: 'done' };
