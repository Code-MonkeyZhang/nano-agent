/**
 * @fileoverview HTTP server setup for nano-agent server.
 *
 * Provides Express application and HTTP server with:
 * - JSON body parsing
 * - Request logging middleware
 * - Health check endpoints: /api/status, /health
 */

import express from 'express';
import type { Request, Response } from 'express';
import { createServer as createHttpServer } from 'http';
import { Logger } from '../util/logger.js';

const app = express();
app.use(express.json());

app.use((req, _res, next) => {
  Logger.log('HTTP', `${req.method} ${req.path}`); // 记录每次请求方法和路径
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

const httpServer = createHttpServer(app);

export { httpServer, app };
