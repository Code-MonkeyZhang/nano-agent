/**
 * @fileoverview HTTP server setup for nano-agent server.
 *
 */

import express from 'express';
import type { Request, Response } from 'express';
import { createServer as createHttpServer } from 'http';
import { Logger } from '../util/logger.js';
import { createProviderRouter, createAuthRouter } from './routers/auth.js';

const app = express();
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

app.use('/api/providers', createProviderRouter());
app.use('/api/auth', createAuthRouter());

const httpServer = createHttpServer(app);

export { httpServer, app };
