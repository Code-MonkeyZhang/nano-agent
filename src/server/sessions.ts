import { Router } from 'express';
import type { Request, Response } from 'express';
import type { SessionManager } from '../session/index.js';
import { getAgentConfig } from '../agent-config/store.js';
import { Logger } from '../util/logger.js';

/**
 * Creates the session router for a specific agent.
 * Provides REST API for session CRUD:
 * - GET /agents/:agentId/sessions - List sessions for this agent
 * - POST /agents/:agentId/sessions - Create a new session
 * - GET /agents/:agentId/sessions/:id - Get a specific session
 * - PUT /agents/:agentId/sessions/:id - Update a session
 * - DELETE /agents/:agentId/sessions/:id - Delete a session
 *
 * @param manager - The SessionManager instance bound to a specific agent
 * @returns Express Router with session endpoints
 */
export function createSessionRouter(manager: SessionManager): Router {
  const router = Router();

  /**
   * List all sessions for this agent.
   * Returns session metadata sorted by most recently updated.
   *
   * @route GET /agents/:agentId/sessions
   */
  router.get('/', (req: Request, res: Response) => {
    try {
      const sessions = manager.listSessions();
      res.json({ sessions });
    } catch (error) {
      Logger.log('SESSION', 'Error listing sessions', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * Create a new session for this agent.
   *
   * @route POST /agents/:agentId/sessions
   * @body { title?: string, workspacePath?: string, modelId?: string }
   */
  router.post('/', (req: Request, res: Response) => {
    try {
      const agentIdParam = req.params['agentId'];
      const agentId = Array.isArray(agentIdParam)
        ? agentIdParam[0]
        : agentIdParam;
      const { title, workspacePath: customWorkspace, modelId } = req.body;

      const agentConfig = getAgentConfig(agentId);
      const workspacePath =
        customWorkspace ?? agentConfig?.defaultWorkspacePath;

      const session = manager.createSession({
        title,
        workspacePath,
        modelId,
      });

      Logger.log(
        'SESSION',
        `Created session: ${session.id} for agent: ${agentId}`
      );
      res.status(201).json({ session });
    } catch (error) {
      Logger.log('SESSION', 'Error creating session', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * Get a specific session by ID.
   * Returns complete session including all messages.
   *
   * @route GET /agents/:agentId/sessions/:id
   */
  router.get('/:id', (req: Request, res: Response) => {
    try {
      const id = Array.isArray(req.params['id'])
        ? req.params['id'][0]
        : req.params['id'];
      const session = manager.getSession(id);

      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      res.json({ session });
    } catch (error) {
      Logger.log('SESSION', 'Error getting session', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * Delete a session by ID.
   *
   * @route DELETE /agents/:agentId/sessions/:id
   */
  router.delete('/:id', (req: Request, res: Response) => {
    try {
      const id = Array.isArray(req.params['id'])
        ? req.params['id'][0]
        : req.params['id'];
      const deleted = manager.deleteSession(id);

      if (!deleted) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      Logger.log('SESSION', `Deleted session: ${id}`);
      res.json({ success: true });
    } catch (error) {
      Logger.log('SESSION', 'Error deleting session', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * Update a session by ID.
   * Supports updating workspacePath, title, and modelId.
   *
   * @route PUT /agents/:agentId/sessions/:id
   * @body { workspacePath?: string, title?: string, modelId?: string }
   */
  router.put('/:id', (req: Request, res: Response) => {
    try {
      const id = Array.isArray(req.params['id'])
        ? req.params['id'][0]
        : req.params['id'];
      const { workspacePath, title, modelId } = req.body;

      let session = manager.getSession(id);
      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      if (workspacePath !== undefined) {
        session = manager.updateWorkspacePath(id, workspacePath);
        Logger.log(
          'SESSION',
          `Updated session ${id} workspace: ${workspacePath}`
        );
      }

      if (title !== undefined) {
        session = manager.updateTitle(id, title);
        Logger.log('SESSION', `Updated session ${id} title: ${title}`);
      }

      if (modelId !== undefined) {
        session = manager.updateModelId(id, modelId);
        Logger.log('SESSION', `Updated session ${id} modelId: ${modelId}`);
      }

      if (
        workspacePath === undefined &&
        title === undefined &&
        modelId === undefined
      ) {
        res.status(400).json({ error: 'No valid fields to update' });
        return;
      }

      res.json({ session });
    } catch (error) {
      Logger.log('SESSION', 'Error updating session', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  return router;
}
