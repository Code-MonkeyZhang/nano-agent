import express from 'express';
import type { Request, Response } from 'express';
import { createServer as createHttpServer } from 'http';
import cors from 'cors';
import { AgentCore } from '../agent.js';
import { createChatRouter } from './chat.js';
import { createSessionRouter } from './sessions.js';
import { createConfigRouter } from './config-router.js';
import { createCredentialRouter } from './credential-router.js';
import { createAgentRouter } from './agent-router.js';
import { createBuiltinToolRouter } from './builtin-tool-router.js';
import { createMcpRouter } from './mcp-router.js';
import { createSkillRouter } from './skill-router.js';
import { Logger } from '../util/logger.js';

const app = express();

let globalAgent: AgentCore | null = null;
let globalAbortController: AbortController | null = null;

export function getGlobalAgent(): AgentCore | null {
  return globalAgent;
}

export function getGlobalAbortController(): AbortController | null {
  return globalAbortController;
}

export function createGlobalAbortController(): AbortController {
  globalAbortController = new AbortController();
  return globalAbortController;
}

export function clearGlobalAbortController(): void {
  globalAbortController = null;
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const allowedOrigins = [
        'http://localhost:5173',
        'http://localhost:5174',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:5174',
      ];
      const isLocalhost =
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:');
      if (allowedOrigins.includes(origin) || isLocalhost) {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json());

app.use((req, _res, next) => {
  Logger.log('HTTP', `${req.method} ${req.path}`);
  next();
});

/**
 * Set the global agent instance.
 * Called during server startup after creating agent via AgentFactory.
 */
export function setGlobalAgent(agent: AgentCore): void {
  globalAgent = agent;
  Logger.log('HTTP', 'Global agent set');
}

/**
 * Setup OpenAI compatible routes and management APIs.
 */
export async function setupOpenAIRoutes(): Promise<void> {
  app.use('/v1/chat', createChatRouter());
  app.use('/api/sessions', createSessionRouter());
  app.use('/api/config', createConfigRouter());
  app.use('/api/credentials', createCredentialRouter());
  app.use('/api/providers', createCredentialRouter());
  app.use('/api/agents', createAgentRouter());
  app.use('/api/builtin-tools', createBuiltinToolRouter());
  app.use('/api/mcp', createMcpRouter());
  app.use('/api/skills', createSkillRouter());
  Logger.log('HTTP', 'Routes configured');
}

/**
 * Status endpoint - Returns server status and information
 */
app.get('/api/status', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    message: 'Nano Agent Server is running',
  });
});

/**
 * Health check endpoint - Simple liveness check
 */
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    alive: true,
    timestamp: Date.now(),
  });
});

/**
 * Abort endpoint - Abort LLM stream
 */
app.post('/api/control/abort', (_req: Request, res: Response) => {
  Logger.log('HTTP', 'Abort request received');

  if (globalAbortController) {
    globalAbortController.abort();
    globalAbortController = null;
    Logger.log('HTTP', 'Generation aborted');
  }

  res.json({ success: true });
});

const httpServer = createHttpServer(app);
export { httpServer, app };
