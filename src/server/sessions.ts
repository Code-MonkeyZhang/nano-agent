import { Router } from 'express';
import type { Request, Response } from 'express';
import { SessionManager } from '../session/index.js';
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
 * - GET /api/sessions - List all sessions
 * - POST /api/sessions - Create a new session
 * - GET /api/sessions/:id - Get a specific session
 * - DELETE /api/sessions/:id - Delete a session
 *
 * @returns Express Router with session endpoints
 */
export function createSessionRouter(): Router {
  initGlobalSessionManager();

  const router = Router();

  /**
   * List all sessions.
   * Returns session metadata sorted by most recently updated.
   *
   * @route GET /api/sessions
   */
  router.get('/', (_req: Request, res: Response) => {
    try {
      const manager = getGlobalSessionManager();
      if (!manager) {
        res.status(500).json({ error: 'SessionManager not initialized' });
        return;
      }

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
   * Create a new session.
   *
   * @route POST /api/sessions
   * @body { title?: string } - Optional session title
   */
  router.post('/', (req: Request, res: Response) => {
    try {
      const manager = getGlobalSessionManager();
      if (!manager) {
        res.status(500).json({ error: 'SessionManager not initialized' });
        return;
      }

      const { title } = req.body;
      const session = manager.createSession(title);

      Logger.log('SESSION', `Created session: ${session.id}`);
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

  return router;
}
