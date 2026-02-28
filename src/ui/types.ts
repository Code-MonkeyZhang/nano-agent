export type StreamingState = 'idle' | 'streaming';

export type ServerStatusValue =
  | 'stopped'
  | 'starting'
  | 'running'
  | 'local'
  | 'error';

export interface ServerState {
  status: ServerStatusValue;
  port?: number;
  localUrl?: string;
  publicUrl?: string;
  error?: string;
}

export interface HistoryItemUser {
  type: 'user';
  text: string;
  timestamp: number;
}

export interface HistoryItemAgent {
  type: 'agent';
  text: string;
  timestamp: number;
}

export interface HistoryItemTool {
  type: 'tool';
  name: string;
  args: Record<string, unknown>;
  result: string;
  success: boolean;
  timestamp: number;
}

export interface HistoryItemThinking {
  type: 'thinking';
  text: string;
  timestamp: number;
}

export interface HistoryItemError {
  type: 'error';
  text: string;
  code?: string;
  suggestion?: string;
  timestamp: number;
}

export interface HistoryItemCommand {
  type: 'command';
  content: string;
  messageType: 'info' | 'error';
  timestamp: number;
}

export interface HistoryItemHelp {
  type: 'help';
  timestamp: number;
}

export interface HistoryItemAbout {
  type: 'about';
  timestamp: number;
}

export interface HistoryItemMcp {
  type: 'mcp';
  timestamp: number;
}

export interface HistoryItemSkill {
  type: 'skill';
  timestamp: number;
}

export interface HistoryItemServerStatus {
  type: 'server_status';
  state: ServerState;
  timestamp: number;
}

export type HistoryItem =
  | HistoryItemUser
  | HistoryItemAgent
  | HistoryItemTool
  | HistoryItemThinking
  | HistoryItemError
  | HistoryItemCommand
  | HistoryItemHelp
  | HistoryItemAbout
  | HistoryItemMcp
  | HistoryItemSkill
  | HistoryItemServerStatus;

export interface UIState {
  history: HistoryItem[];
  streamingState: StreamingState;
  terminalWidth: number;
  currentModel: string;
  serverState: ServerState;
}

export interface UIActions {
  submitInput: (text: string) => Promise<void>;
}
