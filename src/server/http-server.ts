import express from 'express';
import type { Request, Response } from 'express';
import { createServer as createHttpServer } from 'http';
import cors from 'cors';
import { LLMClient } from '../llm-client/llm-client.js';
import { createChatRouter } from './routes/chat.js';

const app = express();

app.use(cors());
app.use(express.json());

/**
 * Setup OpenAI compatible routes to chat router
 * @param llmClient - LLM Client instance
 * @param systemPrompt - The system prompt to use for agents
 */
export function setupOpenAIRoutes(llmClient: LLMClient, systemPrompt: string) {
  app.use('/v1/chat', createChatRouter(llmClient, systemPrompt));
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
