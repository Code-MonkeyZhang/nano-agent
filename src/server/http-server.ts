import express from 'express';
import type { Request, Response } from 'express';
import { createServer as createHttpServer } from 'http';
import cors from 'cors';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSessionRouter } from './sessions.js';
import { createConfigRouter } from './config-router.js';
import { createCredentialRouter } from './credential-router.js';
import { createAgentRouter } from './agent-router.js';
import { createBuiltinToolRouter } from './builtin-tool-router.js';
import { createMcpRouter } from './mcp-router.js';
import { createSkillRouter } from './skill-router.js';
import { createAvatarRouter } from './avatar-router.js';
import { Logger } from '../util/logger.js';
import type { SessionManager } from '../session/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PRESETS_DIR = path.resolve(__dirname, '..', '..', 'resources', 'avatars');

const app = express();

app.use(
  cors({
    origin: (_origin, callback) => {
      callback(null, true);
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

export type SessionManagersMap = Map<string, SessionManager>;

export async function setupOpenAIRoutes(
  sessionManagers?: SessionManagersMap
): Promise<void> {
  if (sessionManagers) {
    app.use(
      '/api/agents/:agentId/sessions',
      createSessionRouter(sessionManagers)
    );
    Logger.log('HTTP', 'Registered dynamic session router for agents');
  }

  app.use('/api/config', createConfigRouter());
  app.use('/api/credentials', createCredentialRouter());
  app.use('/api/providers', createCredentialRouter());
  app.use('/api/agents', createAgentRouter(sessionManagers));
  app.use('/api/builtin-tools', createBuiltinToolRouter());
  app.use('/api/mcp', createMcpRouter());
  app.use('/api/skills', createSkillRouter());
  app.use('/api', createAvatarRouter());
  app.use('/presets/avatars', express.static(PRESETS_DIR));
  Logger.log('HTTP', 'Routes configured');
}

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
