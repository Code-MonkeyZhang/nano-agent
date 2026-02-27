export type StreamingState = 'idle' | 'streaming';

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
  timestamp: number;
}

export type HistoryItem =
  | HistoryItemUser
  | HistoryItemAgent
  | HistoryItemTool
  | HistoryItemThinking
  | HistoryItemError;

export interface UIState {
  history: HistoryItem[];
  streamingState: StreamingState;
  terminalWidth: number;
  terminalHeight: number;
  currentModel: string;
  currentProvider: string;
  streamingMessage?: string;
  lastToolExecution?: {
    name: string;
    status: 'running' | 'success' | 'failed';
  };
}

export interface UIActions {
  submitInput: (text: string) => Promise<void>;
  clearHistory: () => void;
}
