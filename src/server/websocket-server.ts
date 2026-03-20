import { WebSocketServer, WebSocket } from 'ws';
import { httpServer } from './http-server.js';
import { Logger } from '../util/logger.js';
import { createAgent } from '../agent-factory/index.js';
import { getAgentConfig, listAgentConfigs } from '../agent-config/store.js';
import type { SessionManager } from '../session/index.js';
import type { AgentId } from '../agent-config/types.js';
import type {
  ClientMessage,
  CycleData,
  ServerMessage,
  ToolResultInfo,
} from './types/ws-message-types.js';
import type { Message } from '../schema/index.js';

let wss: WebSocketServer | null = null;
const clients = new Map<string, WebSocket>();
const activeAborts = new Map<WebSocket, AbortController>();

interface SessionInfo {
  sessionId: string;
  agentId: string;
}
const activeSessions = new Map<WebSocket, SessionInfo>();

const MAX_TITLE_LENGTH = 30;
const DEFAULT_WORKSPACE_DIR = process.cwd();

function extractTextContent(
  content: string | unknown[] | unknown
): string | null {
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .filter((b): b is { type: string; text: string } => b.type === 'text')
      .map((b) => b.text)
      .join('\n');
  }
  return null;
}

function generateTitle(messages: Message[]): string {
  for (const msg of messages) {
    if (msg.role === 'user') {
      const text = extractTextContent(msg.content);
      if (text) {
        return text.length > MAX_TITLE_LENGTH
          ? `${text.slice(0, MAX_TITLE_LENGTH)}...`
          : text;
      }
    }
  }
  return 'New Chat';
}

function sendMessage(ws: WebSocket, message: ServerMessage): void {
  ws.send(JSON.stringify(message));
}

function handleAbort(ws: WebSocket): void {
  const abortController = activeAborts.get(ws);
  if (abortController) {
    abortController.abort();
    activeAborts.delete(ws);
    sendMessage(ws, { type: 'done' });
  }
}

async function handleChat(
  ws: WebSocket,
  message: Extract<ClientMessage, { type: 'chat' }>,
  sessionManagers?: Map<string, SessionManager>
): Promise<void> {
  const abortController = new AbortController();
  activeAborts.set(ws, abortController);

  const allAgents = listAgentConfigs();
  if (allAgents.length === 0) {
    sendMessage(ws, { type: 'error', message: '请先创建 Agent' });
    activeAborts.delete(ws);
    return;
  }

  let agentId: AgentId = allAgents[0].id;
  let sessionManager: SessionManager | undefined;
  let isNewSession = false;
  let workspacePath: string | undefined;
  let sessionModelId: string | undefined;
  const sessionId = message.sessionId;

  if (sessionId && sessionManagers) {
    for (const [, manager] of sessionManagers) {
      const session = manager.getSession(sessionId);
      if (session) {
        agentId = session.agentId;
        sessionManager = manager;
        break;
      }
    }
  }

  if (!sessionManager && sessionManagers) {
    sessionManager = sessionManagers.get(agentId);
  }

  if (sessionId && sessionManager) {
    const session = sessionManager.getSession(sessionId);
    if (session) {
      agentId = session.agentId;
      if (sessionManagers) {
        sessionManager = sessionManagers.get(agentId);
      }
      isNewSession = session.messageCount === 0;
      workspacePath = session.workspacePath;
      sessionModelId = session.modelId;
    }
  }

  if (!workspacePath) {
    const agentConfig = getAgentConfig(agentId);
    workspacePath = agentConfig?.defaultWorkspacePath;
  }

  const finalWorkspaceDir = workspacePath ?? DEFAULT_WORKSPACE_DIR;

  try {
    const agent = await createAgent(agentId, finalWorkspaceDir, sessionModelId);
    agent.messages = [{ role: 'system', content: agent.systemPrompt }];

    if (sessionId && sessionManager) {
      const session = sessionManager.getSession(sessionId);
      if (session) {
        for (const msg of session.messages) {
          if (msg.role !== 'system') {
            agent.messages.push(msg);
          }
        }
      }
    }

    const historyLength = agent.messages.length;
    agent.addUserMessage(message.content);

    let currentCycle: CycleData | null = null;

    for await (const event of agent.runStream(abortController.signal)) {
      if (abortController.signal.aborted) {
        sendMessage(ws, { type: 'done' });
        activeAborts.delete(ws);
        return;
      }

      switch (event.type) {
        case 'step_start':
          if (currentCycle) {
            const cycleMsg: ServerMessage = {
              type: 'cycle_complete',
              ...currentCycle,
            };
            sendMessage(ws, cycleMsg);
          }
          currentCycle = {
            cycleIndex: event.step,
            thinking: '',
            content: '',
            toolCalls: [],
            toolResults: [],
          };
          break;

        case 'thinking':
          if (currentCycle) {
            currentCycle.thinking += event.content;
          }
          break;

        case 'content':
          if (currentCycle) {
            currentCycle.content += event.content;
          }
          break;

        case 'tool_call':
          if (currentCycle) {
            currentCycle.toolCalls.push(...event.tool_calls);
          }
          break;

        case 'tool_result':
          if (currentCycle) {
            const resultInfo: ToolResultInfo = {
              toolCallId: event.toolCallId,
              toolName: event.toolName,
              result: event.result.success
                ? event.result.content
                : (event.result.error ?? 'Unknown error'),
              success: event.result.success,
            };
            currentCycle.toolResults.push(resultInfo);
          }
          break;

        case 'error':
          sendMessage(ws, { type: 'error', message: event.error });
          break;
      }
    }

    if (currentCycle && !abortController.signal.aborted) {
      const cycleMsg: ServerMessage = {
        type: 'cycle_complete',
        ...currentCycle,
      };
      sendMessage(ws, cycleMsg);
    }

    if (!abortController.signal.aborted) {
      sendMessage(ws, { type: 'done' });

      if (sessionId && sessionManager) {
        const lastMsg = agent.messages[agent.messages.length - 1];
        if (lastMsg && lastMsg.role === 'assistant') {
          const newMessages = agent.messages.slice(historyLength);
          for (const msg of newMessages) {
            sessionManager.appendMessage(sessionId, msg);
          }

          if (isNewSession) {
            const title = generateTitle(newMessages);
            sessionManager.updateTitle(sessionId, title);
          }
        }
      }
    }

    activeSessions.set(ws, { sessionId: sessionId!, agentId });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    sendMessage(ws, { type: 'error', message: errorMessage });
  } finally {
    activeAborts.delete(ws);
  }
}

export function initWebSocket(
  sessionManagers?: Map<string, SessionManager>
): void {
  wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    const clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    clients.set(clientId, ws);

    sendMessage(ws, { type: 'connected', clientId });

    ws.on('message', (data: Buffer) => {
      void (async () => {
        try {
          const message = JSON.parse(data.toString()) as ClientMessage;
          Logger.log('WS', `Message from ${clientId}`, message.type);

          switch (message.type) {
            case 'chat':
              await handleChat(ws, message, sessionManagers);
              break;
            case 'abort':
              handleAbort(ws);
              break;
            default:
              sendMessage(ws, {
                type: 'error',
                message: `Unknown message type`,
              });
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          sendMessage(ws, { type: 'error', message: errorMessage });
        }
      })();
    });

    ws.on('close', () => {
      clients.delete(clientId);
      activeAborts.delete(ws);
      activeSessions.delete(ws);
      Logger.log('WS', `Client disconnected: ${clientId}`);
    });

    ws.on('error', (error: Error) => {
      Logger.log('ERROR', `Client error ${clientId}`, error);
      clients.delete(clientId);
      activeAborts.delete(ws);
      activeSessions.delete(ws);
    });
  });
}

export function shutdownWebSocket(): void {
  if (wss) {
    for (const [clientId, ws] of clients.entries()) {
      ws.close();
      Logger.log('WS', `Closed client ${clientId}`);
    }
    clients.clear();
    activeAborts.clear();
    activeSessions.clear();
    wss.close();
    wss = null;
    Logger.log('WS', 'WebSocket server shutdown');
  }
}
