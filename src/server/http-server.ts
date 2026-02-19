import express from 'express';
import type { Request, Response } from 'express';
import { createServer as createHttpServer } from 'http';
import { Config } from '../config.js';
import { AgentCore } from '../agent.js';
import { createChatRouter } from './routes/chat.js';

const app = express();

let globalAgent: AgentCore | null = null;

export function getGlobalAgent(): AgentCore | null {
  return globalAgent;
}

app.use(express.json());

/**
 * Setup OpenAI compatible routes to chat router
 * @param config - The agent configuration
 * @param workspaceDir - The workspace directory
 */
export async function setupOpenAIRoutes(config: Config, workspaceDir: string) {
  // init agent core
  globalAgent = new AgentCore(config, workspaceDir);
  await globalAgent.initialize();

  app.use('/v1/chat', createChatRouter());
}

/**
 * Status endpoint - Returns server status and information
 * @route GET /api/status
 * @param req - Express request object
 * @param res - Express response object
 * @returns {Object} JSON response with status, timestamp, and message
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
 * @route GET /health
 * @param req - Express request object
 * @param res - Express response object
 * @returns {Object} JSON response with alive status and timestamp
 */
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    alive: true,
    timestamp: Date.now(),
  });
});

const httpServer = createHttpServer(app);
export { httpServer, app };
