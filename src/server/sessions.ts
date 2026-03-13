import { Router } from 'express';
import type { Request, Response } from 'express';
import { SessionManager } from '../session/index.js';
import { getAgentConfig } from '../agent-config/store.js';
import { Logger } from '../util/logger.js';

let globalSessionManager: SessionManager | null = null;

/**
 * Gets the global SessionManager instance.
 *
 * @returns SessionManager instance or null if not initialized
 */
export function getGlobalSessionManager(): SessionManager | null {
  return globalSessionManager;
}

/**
 * Initializes the global SessionManager instance.
 */
export function initGlobalSessionManager(): void {
  if (!globalSessionManager) {
    globalSessionManager = new SessionManager();
    Logger.log('SESSION', 'SessionManager initialized');
  }
}

/**
 * Creates the session router
 * Provides REST API for session CRUD:
 * - GET /api/sessions - List all sessions (optionally filtered by agentId)
 * - POST /api/sessions - Create a new session (requires agentId)
 * - GET /api/sessions/:id - Get a specific session
 * - PUT /api/sessions/:id - Update a session (supports workspacePath)
 * - DELETE /api/sessions/:id - Delete a session
 *
 * @returns Express Router with session endpoints
 */
export function createSessionRouter(): Router {
  initGlobalSessionManager();

  const router = Router();

  /**
   * List all sessions or sessions for a specific agent.
   * Returns session metadata sorted by most recently updated.
   *
   * @route GET /api/sessions
   * @query agentId - Optional agent ID to filter sessions
   */
  router.get('/', (req: Request, res: Response) => {
    try {
      const manager = getGlobalSessionManager();
      if (!manager) {
        res.status(500).json({ error: 'SessionManager not initialized' });
        return;
      }

      const agentId = req.query['agentId'] as string | undefined;
      const sessions = agentId
        ? manager.listSessionsByAgent(agentId)
        : manager.listSessions();
      res.json({ sessions });
    } catch (error) {
      Logger.log('SESSION', 'Error listing sessions', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * Create a new session bound to a specific agent.
   *
   * @route POST /api/sessions
   * @body { agentId: string, title?: string } - Agent ID is required
   */
  router.post('/', (req: Request, res: Response) => {
    try {
      const manager = getGlobalSessionManager();
      if (!manager) {
        res.status(500).json({ error: 'SessionManager not initialized' });
        return;
      }

      const { agentId, title, workspacePath: customWorkspace } = req.body;
      if (!agentId) {
        res.status(400).json({ error: 'agentId is required' });
        return;
      }

      const agentConfig = getAgentConfig(agentId);
      const workspacePath =
        customWorkspace ?? agentConfig?.defaultWorkspacePath;

      const session = manager.createSession(agentId, { title, workspacePath });

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
   * @route GET /api/sessions/:id
   */
  router.get('/:id', (req: Request, res: Response) => {
    try {
      const manager = getGlobalSessionManager();
      if (!manager) {
        res.status(500).json({ error: 'SessionManager not initialized' });
        return;
      }

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
   * @route DELETE /api/sessions/:id
   */
  router.delete('/:id', (req: Request, res: Response) => {
    try {
      const manager = getGlobalSessionManager();
      if (!manager) {
        res.status(500).json({ error: 'SessionManager not initialized' });
        return;
      }

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
   * Currently supports updating workspacePath.
   *
   * @route PUT /api/sessions/:id
   * @body { workspacePath?: string } - Fields to update
   */
  router.put('/:id', (req: Request, res: Response) => {
    try {
      const manager = getGlobalSessionManager();
      if (!manager) {
        res.status(500).json({ error: 'SessionManager not initialized' });
        return;
      }

      const id = Array.isArray(req.params['id'])
        ? req.params['id'][0]
        : req.params['id'];
      const { workspacePath, title } = req.body;

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

      if (workspacePath === undefined && title === undefined) {
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
