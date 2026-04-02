/**
 * @fileoverview HTTP routes for Cloudflare Tunnel management.
 *
 * Routes:
 * - POST /api/tunnel/start  - Start the tunnel (async, returns 202 while starting)
 * - POST /api/tunnel/stop   - Stop the tunnel
 * - GET  /api/tunnel/status - Query current tunnel state
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import {
  startTunnel,
  stopTunnel,
  getTunnelStatus,
  onStatusChange,
} from '../tunnel-service.js';
import {
  updateTunnelUrl,
  clearTunnelUrl,
  readServerInfo,
} from '../../util/server-info.js';
import { Logger } from '../../util/logger.js';

/**
 * Wire up tunnel status changes to server.json updates.
 */
onStatusChange((state) => {
  if (state.status === 'running' && state.url) {
    updateTunnelUrl(state.url);
  }
  if (state.status === 'stopped') {
    clearTunnelUrl();
  }
});

export function createTunnelRouter(): Router {
  const router = Router();

  /**
   * POST /api/tunnel/start
   * Start the cloudflared tunnel. Returns immediately with current status.
   */
  router.post('/start', async (_req: Request, res: Response) => {
    try {
      const info = readServerInfo();
      if (!info) {
        res.status(400).json({
          success: false,
          error: 'SERVER_NOT_FOUND',
          message: 'Server info not found. Is the server running?',
        });
        return;
      }

      const current = getTunnelStatus();

      if (current.status === 'running') {
        res.json({ success: true, status: 'running', url: current.url });
        return;
      }

      if (current.status === 'starting') {
        res.status(202).json({ success: true, status: 'starting' });
        return;
      }

      // Fire-and-forget: startTunnel runs async, client polls /status
      void startTunnel(info.port).catch((err: unknown) => {
        Logger.log('TUNNEL', 'Background start failed', err);
      });

      res.status(202).json({ success: true, status: 'starting' });
    } catch (error) {
      Logger.log('TUNNEL', 'Failed to handle /start', error);
      res.status(500).json({
        success: false,
        error: 'TUNNEL_START_ERROR',
        message:
          error instanceof Error ? error.message : 'Failed to start tunnel',
      });
    }
  });

  /**
   * POST /api/tunnel/stop
   * Stop the running cloudflared tunnel.
   */
  router.post('/stop', async (_req: Request, res: Response) => {
    try {
      await stopTunnel();
      res.json({ success: true });
    } catch (error) {
      Logger.log('TUNNEL', 'Failed to handle /stop', error);
      res.status(500).json({
        success: false,
        error: 'TUNNEL_STOP_ERROR',
        message:
          error instanceof Error ? error.message : 'Failed to stop tunnel',
      });
    }
  });

  /**
   * GET /api/tunnel/status
   * Return the current tunnel state for client polling.
   */
  router.get('/status', (_req: Request, res: Response) => {
    const current = getTunnelStatus();
    res.json({
      success: true,
      status: current.status,
      url: current.url,
      error: current.error,
    });
  });

  return router;
}
