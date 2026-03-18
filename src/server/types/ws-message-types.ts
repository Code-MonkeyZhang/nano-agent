import type { ToolCall } from '../../schema/index.js';

export interface ChatRequest {
  type: 'chat';
  sessionId?: string;
  content: string;
}

export interface AbortRequest {
  type: 'abort';
}

export type ClientMessage = ChatRequest | AbortRequest;

export interface ConnectedMessage {
  type: 'connected';
  clientId: string;
}

export interface ToolResultInfo {
  toolCallId: string;
  toolName: string;
  result: string;
  success: boolean;
}

export interface CycleCompleteMessage {
  type: 'cycle_complete';
  cycleIndex: number;
  thinking?: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResultInfo[];
  content?: string;
}

export interface DoneMessage {
  type: 'done';
}

export interface ErrorMessage {
  type: 'error';
  message: string;
}

export type ServerMessage =
  | ConnectedMessage
  | CycleCompleteMessage
  | DoneMessage
  | ErrorMessage;

export interface CycleData {
  cycleIndex: number;
  thinking: string;
  content: string;
  toolCalls: ToolCall[];
  toolResults: ToolResultInfo[];
}
