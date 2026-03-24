/**
 * @fileoverview HTTP routes for session management.
 *
 * Routes:
 * - GET    /api/agents/:agentId/sessions     - List sessions
 * - POST   /api/agents/:agentId/sessions     - Create session
 * - GET    /api/agents/:agentId/sessions/:id - Get session
 * - PUT    /api/agents/:agentId/sessions/:id - Update session
 * - DELETE /api/agents/:agentId/sessions/:id - Delete session
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import type { SessionManager } from '../../session/index.js';
import { Logger } from '../../util/logger.js';
import type { SessionManagersMap } from './agent.js';
import { getParam } from './utils.js';

export function createSessionRouter(
  sessionManagers: SessionManagersMap
): Router {
  const router = Router({ mergeParams: true });

  /** Helper to get manager for the current route */
  function getSessionManager(
    req: Request,
    res: Response
  ): SessionManager | null {
    const agentId = getParam(req.params['agentId']);
    if (!agentId) {
      res.status(400).json({ error: 'Agent ID is required' });
      return null;
    }
    const manager = sessionManagers.get(agentId);
    if (!manager) {
      res
        .status(404)
        .json({ error: `Session manager not found for agent: ${agentId}` });
      return null;
    }
    return manager;
  }

  /** GET /api/agents/:agentId/sessions - List all sessions */
  router.get('/', (req: Request, res: Response) => {
    try {
      const manager = getSessionManager(req, res);
      if (!manager) return;
      const sessions = manager.listSessions();
      res.json({ sessions });
    } catch (error) {
      Logger.log('SESSION', 'Error listing sessions', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /** POST /api/agents/:agentId/sessions - Create a new session */
  router.post('/', (req: Request, res: Response) => {
    try {
      const manager = getSessionManager(req, res);
      if (!manager) return;
      const agentId = getParam(req.params['agentId']);
      if (!agentId) {
        res.status(400).json({ error: 'Agent ID is required' });
        return;
      }
      const { title } = req.body;

      const session = manager.createSession({ title });

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

  /** GET /api/agents/:agentId/sessions/:id - Get a specific session */
  router.get('/:id', (req: Request, res: Response) => {
    try {
      const manager = getSessionManager(req, res);
      if (!manager) return;
      const id = getParam(req.params['id']);
      if (!id) {
        res.status(400).json({ error: 'Session ID is required' });
        return;
      }
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

  /** PUT /api/agents/:agentId/sessions/:id - Update a session */
  router.put('/:id', (req: Request, res: Response) => {
    try {
      const manager = getSessionManager(req, res);
      if (!manager) return;
      const id = getParam(req.params['id']);
      if (!id) {
        res.status(400).json({ error: 'Session ID is required' });
        return;
      }
      const { workspacePath, title, model } = req.body;

      let session = manager.getSession(id);
      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      if (workspacePath !== undefined) {
        session = manager.updateWorkspacePath(id, workspacePath);
      }
      if (title !== undefined) {
        session = manager.updateTitle(id, title);
      }
      if (model !== undefined) {
        session = manager.updateModel(id, model);
      }

      if (
        workspacePath === undefined &&
        title === undefined &&
        model === undefined
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

  /** DELETE /api/agents/:agentId/sessions/:id - Delete a session */
  router.delete('/:id', (req: Request, res: Response) => {
    try {
      const manager = getSessionManager(req, res);
      if (!manager) return;
      const id = getParam(req.params['id']);
      if (!id) {
        res.status(400).json({ error: 'Session ID is required' });
        return;
      }
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

  return router;
}
