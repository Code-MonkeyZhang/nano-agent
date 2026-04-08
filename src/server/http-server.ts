/**
 * @fileoverview HTTP server setup for nano-agent server.
 *
 */

import express from 'express';
import cors from 'cors';
import type { Request, Response } from 'express';
import { createServer as createHttpServer } from 'http';
import { Logger } from '../util/logger.js';
import { createProviderRouter, createAuthRouter } from './routers/auth.js';
import { createAgentRouter, type SessionManagersMap } from './routers/agent.js';
import { createSessionRouter } from './routers/session.js';
import { createChatRouter } from './routers/chat.js';
import { createConfigRouter } from './routers/config.js';
import { createSkillRouter } from './routers/skill.js';
import { createMcpRouter } from './routers/mcp.js';
import { createTunnelRouter } from './routers/tunnel.js';
import { createAssetsRouter } from './routers/assets.js';
import { initWebSocket, isWebSocketInitialized } from './websocket-server.js';

import { listAgentConfigs } from '../agent/index.js';
import { initSkillPool } from '../skill/index.js';
import { initMcpPool } from '../mcp/index.js';
import { SessionStore } from '../session/store.js';
import { SessionManager } from '../session/session-manager.js';

const app = express();
app.use(cors());
app.use(express.json());

app.use((req, _res, next) => {
  Logger.log('HTTP', `${req.method} ${req.path}`);
  next();
});

app.get('/api/status', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    message: 'Nano Agent Server is running',
  });
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    alive: true,
    timestamp: Date.now(),
  });
});

/** Global session managers map */
const sessionManagers: SessionManagersMap = new Map();

/**
 * 给所有Agent创建对应的SessionStore, 然后保存在SessionManagersMap映射关系
 */
function initSessionManagers(): void {
  const agentConfigs = listAgentConfigs();
  for (const agentConfig of agentConfigs) {
    const store = new SessionStore(agentConfig.id);
    sessionManagers.set(
      agentConfig.id,
      new SessionManager(
        store,
        agentConfig.id,
        agentConfig.defaultModel,
        agentConfig.defaultWorkspacePath
      )
    );
  }
  Logger.log('SERVER', `Initialized ${agentConfigs.length} session managers`);
}

initSessionManagers();
initSkillPool();
void initMcpPool();
Logger.setSessionManagers(sessionManagers);

app.use('/api/providers', createProviderRouter());
app.use('/api/auth', createAuthRouter());
app.use('/api/config', createConfigRouter());
app.use('/api/skills', createSkillRouter());
app.use('/api/mcp', createMcpRouter());
app.use('/api/tunnel', createTunnelRouter());
app.use('/api/agents', createAgentRouter(sessionManagers));
app.use('/api/agents/:agentId/assets', createAssetsRouter());
app.use('/api/agents/:agentId/sessions', createSessionRouter(sessionManagers));
app.use(
  '/api/agents/:agentId/sessions/:sessionId/chat',
  createChatRouter(sessionManagers)
);

const httpServer = createHttpServer(app);

// Initialize WebSocket server
if (!isWebSocketInitialized()) {
  initWebSocket(httpServer);
}

export { httpServer };
