/**
 * @fileoverview HTTP routes for MCP management.
 *
 * Routes:
 * - GET /api/mcp          - List all MCP servers with status and tools
 * - GET /api/mcp/:name    - Get a single MCP server's status and tools
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { listMcpServers, getMcpServer } from '../../mcp/index.js';
import { Logger } from '../../util/logger.js';
import { getParam } from './utils.js';

export function createMcpRouter(): Router {
  const router = Router();

  router.get('/', (_req: Request, res: Response) => {
    try {
      const servers = listMcpServers();
      res.json({ servers });
    } catch (error) {
      Logger.log('MCP', 'Error listing MCP servers', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  router.get('/:name', (req: Request, res: Response) => {
    try {
      const name = getParam(req.params['name']);
      if (!name) {
        res.status(400).json({ error: 'Server name is required' });
        return;
      }

      const server = getMcpServer(name);
      if (!server) {
        res.status(404).json({ error: 'MCP server not found' });
        return;
      }

      res.json({ server });
    } catch (error) {
      Logger.log('MCP', 'Error getting MCP server', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  return router;
}
