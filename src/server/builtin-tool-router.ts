/**
 * Builtin Tool Router
 *
 * Provides HTTP API endpoints for querying built-in tools.
 * Built-in tools are hardcoded and always available to all agents.
 *
 * Endpoints:
 * - GET /api/builtin-tools - List all built-in tools
 * - GET /api/builtin-tools/:id - Get single tool details
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { listBuiltinTools } from '../builtin-tool-pool/index.js';
import { Logger } from '../util/logger.js';

export function createBuiltinToolRouter(): Router {
  const router = Router();

  /**
   * GET /api/builtin-tools
   * List all built-in tools (metadata only, no instances).
   */
  router.get('/', (_req: Request, res: Response) => {
    try {
      const tools = listBuiltinTools();
      res.json({ tools });
    } catch (error) {
      Logger.log('BUILTIN-TOOL', 'Error listing builtin tools', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/builtin-tools/:id
   * Get a single built-in tool by ID.
   *
   * @param id - Tool ID (e.g., "builtin:read")
   */
  router.get('/:id', (req: Request, res: Response) => {
    try {
      const id = req.params['id'];
      if (!id) {
        res.status(400).json({ error: 'Tool ID is required' });
        return;
      }

      const tools = listBuiltinTools();
      const tool = tools.find((t) => t.id === id);

      if (!tool) {
        res.status(404).json({ error: 'Tool not found' });
        return;
      }

      res.json({ tool });
    } catch (error) {
      Logger.log('BUILTIN-TOOL', 'Error getting builtin tool', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  return router;
}
