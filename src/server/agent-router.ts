/**
 * Agent Router
 *
 * Provides HTTP API endpoints for managing agent configurations.
 *
 * Endpoints:
 * - GET  /api/agents - List all agents
 * - GET  /api/agents/:id - Get single agent
 * - POST /api/agents - Create agent
 * - PUT  /api/agents/:id - Update agent
 * - DELETE /api/agents/:id - Delete agent
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import {
  listAgentConfigs,
  getAgentConfig,
  createAgentConfig,
  updateAgentConfig,
  deleteAgentConfig,
  getAgentDirPath,
} from '../agent-config/index.js';
import type { CreateAgentConfigInput } from '../agent-config/index.js';
import { Logger } from '../util/logger.js';
import type { SessionManagersMap } from './http-server.js';
import { SessionStore } from '../session/store.js';
import { SessionManager } from '../session/manager.js';

export function createAgentRouter(
  sessionManagers?: SessionManagersMap
): Router {
  const router = Router();

  /**
   * GET /api/agents
   * List all agent configurations.
   */
  router.get('/', (_req: Request, res: Response) => {
    try {
      const agents = listAgentConfigs();
      res.json({ agents });
    } catch (error) {
      Logger.log('AGENT', 'Error listing agents', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/agents/:id
   * Get a single agent configuration by ID.
   */
  router.get('/:id', (req: Request, res: Response) => {
    try {
      const id = Array.isArray(req.params['id'])
        ? req.params['id'][0]
        : req.params['id'];
      if (!id) {
        res.status(400).json({ error: 'Agent ID is required' });
        return;
      }

      const agent = getAgentConfig(id);
      if (!agent) {
        res.status(404).json({ error: 'Agent not found' });
        return;
      }

      res.json({ agent });
    } catch (error) {
      Logger.log('AGENT', 'Error getting agent', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /api/agents
   * Create a new agent configuration.
   *
   * @body { name, systemPrompt, provider, modelId, maxSteps, mcpIds, skillIds, id? }
   */
  router.post('/', (req: Request, res: Response) => {
    try {
      const input = req.body as CreateAgentConfigInput;

      if (
        !input.name ||
        !input.systemPrompt ||
        !input.provider ||
        !input.modelId
      ) {
        res.status(400).json({
          error:
            'Missing required fields: name, systemPrompt, provider, modelId',
        });
        return;
      }

      const agent = createAgentConfig(input);

      if (sessionManagers) {
        const agentBasePath = getAgentDirPath(agent.id);
        const sessionStore = new SessionStore(agentBasePath);
        const sessionManager = new SessionManager(sessionStore, agent.id);
        sessionManagers.set(agent.id, sessionManager);
        Logger.log(
          'SERVER',
          `Registered session manager for new agent: ${agent.id}`
        );
      }

      Logger.log('AGENT', `Created agent: ${agent.id}`);
      res.status(201).json({ agent });
    } catch (error) {
      Logger.log('AGENT', 'Error creating agent', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.includes('already exists')) {
        res.status(400).json({ error: message });
        return;
      }
      res.status(500).json({ error: message });
    }
  });

  /**
   * PUT /api/agents/:id
   * Update an existing agent configuration.
   *
   * @body { name?, systemPrompt?, provider?, modelId?, maxSteps?, mcpIds?, skillIds? }
   */
  router.put('/:id', (req: Request, res: Response) => {
    try {
      const id = Array.isArray(req.params['id'])
        ? req.params['id'][0]
        : req.params['id'];
      if (!id) {
        res.status(400).json({ error: 'Agent ID is required' });
        return;
      }

      const existing = getAgentConfig(id);
      if (!existing) {
        res.status(404).json({ error: 'Agent not found' });
        return;
      }

      const agent = updateAgentConfig(id, req.body);
      Logger.log('AGENT', `Updated agent: ${id}`);
      res.json({ agent });
    } catch (error) {
      Logger.log('AGENT', 'Error updating agent', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * DELETE /api/agents/:id
   * Delete an agent configuration.
   */
  router.delete('/:id', (req: Request, res: Response) => {
    try {
      const id = Array.isArray(req.params['id'])
        ? req.params['id'][0]
        : req.params['id'];
      if (!id) {
        res.status(400).json({ error: 'Agent ID is required' });
        return;
      }

      const existing = getAgentConfig(id);
      if (!existing) {
        res.status(404).json({ error: 'Agent not found' });
        return;
      }

      deleteAgentConfig(id);

      if (sessionManagers) {
        sessionManagers.delete(id);
        Logger.log(
          'SERVER',
          `Removed session manager for deleted agent: ${id}`
        );
      }

      Logger.log('AGENT', `Deleted agent: ${id}`);
      res.json({ success: true });
    } catch (error) {
      Logger.log('AGENT', 'Error deleting agent', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  return router;
}
