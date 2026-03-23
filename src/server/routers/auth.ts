/**
 * @fileoverview HTTP routes for provider and auth management.
 *
 * Routes:
 * - GET  /api/providers         - List all providers with auth status
 * - GET  /api/auth/:id          - Get auth info
 * - PUT  /api/auth/:id          - Set auth info
 * - DELETE /api/auth/:id        - Delete auth info
 * - POST /api/auth/:id/verify   - Verify auth info
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import {
  listProvidersWithAuth,
  getAuth,
  setAuth,
  deleteAuth,
} from '../../auth/index.js';
import type { KnownProvider, Provider, Auth } from '../../auth/index.js';
import { getModels, completeSimple } from '@mariozechner/pi-ai';
import { Logger } from '../../util/logger.js';

/**
 * Creates router for provider management.
 *
 * Routes:
 *   GET /api/providers - List all providers with their auth status
 */
export function createProviderRouter(): Router {
  const router = Router();

  /** GET /api/providers - List all providers with auth status */
  router.get('/', (_req: Request, res: Response) => {
    try {
      const providers = listProvidersWithAuth();
      res.json({ providers });
    } catch (error) {
      Logger.log('AUTH', 'Error listing providers', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  return router;
}

/**
 * Creates router for auth management.
 *
 * Routes:
 *   GET    /api/auth/:provider        - Get auth info for a provider
 *   PUT    /api/auth/:provider        - Set auth info for a provider
 *   DELETE /api/auth/:provider        - Delete auth info for a provider
 *   POST   /api/auth/:provider/verify - Verify API key validity for a provider
 */
export function createAuthRouter(): Router {
  const router = Router();

  /** GET /api/auth/:provider - Get auth info from a provider */
  router.get('/:provider', (req: Request, res: Response) => {
    try {
      const provider = req.params['provider'];
      if (!provider) {
        res.status(400).json({ error: 'Provider is required' });
        return;
      }

      const auth = getAuth(provider as Provider);
      if (!auth) {
        res.status(404).json({ error: 'Auth not found for provider' });
        return;
      }

      res.json({
        provider,
        apiKey: auth.apiKey,
      });
    } catch (error) {
      Logger.log('AUTH', 'Error getting auth', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /** PUT /api/auth/:provider - Set auth info for a provider */
  router.put('/:provider', (req: Request, res: Response) => {
    try {
      const provider = req.params['provider'];
      if (!provider) {
        res.status(400).json({ error: 'Provider is required' });
        return;
      }

      const input = req.body as Auth;
      if (!input.apiKey) {
        res.status(400).json({
          error: 'Missing required field: apiKey',
        });
        return;
      }

      const auth = setAuth(provider as Provider, input);
      Logger.log('AUTH', `Set auth for provider: ${provider}`);
      res.json({
        provider,
        apiKey: auth.apiKey,
      });
    } catch (error) {
      Logger.log('AUTH', 'Error setting auth', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /** DELETE /api/auth/:provider - Delete auth info from a provider*/
  router.delete('/:provider', (req: Request, res: Response) => {
    try {
      const provider = req.params['provider'];
      if (!provider) {
        res.status(400).json({ error: 'Provider is required' });
        return;
      }

      const existing = getAuth(provider as Provider);
      if (!existing) {
        res.status(404).json({ error: 'Auth not found for provider' });
        return;
      }

      deleteAuth(provider as Provider);
      Logger.log('AUTH', `Deleted auth for provider: ${provider}`);
      res.json({ success: true });
    } catch (error) {
      Logger.log('AUTH', 'Error deleting auth', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /api/auth/:provider/verify - Verify auth info for a provider
   *
   * Input:
   *   Body: { apiKey?: string } - Optional. If omitted, uses stored key.
   */
  router.post('/:provider/verify', async (req: Request, res: Response) => {
    try {
      const provider = req.params['provider'];
      if (!provider) {
        res.status(400).json({ error: 'Provider is required' });
        return;
      }

      // use api key from req, if not use api key from storage
      const input = (req.body || {}) as { apiKey?: string };
      const apiKey = input.apiKey ?? getAuth(provider as Provider)?.apiKey;

      if (!apiKey) {
        res.json({
          valid: false,
          error: 'No API key provided or stored',
        });
        return;
      }

      const models = getModels(provider as KnownProvider);
      if (models.length === 0) {
        res.json({
          valid: false,
          error: 'No models found for provider',
        });
        return;
      }

      const testModel = models[0];
      if (!testModel) {
        res.json({
          valid: false,
          error: 'No test model available',
        });
        return;
      }

      // Send test request to verify API key
      let result;
      try {
        result = await completeSimple(
          testModel,
          {
            messages: [{ role: 'user', content: 'Hi', timestamp: Date.now() }],
          },
          { apiKey, maxTokens: 5 }
        );
      } catch (verifyError) {
        const errorMessage =
          verifyError instanceof Error
            ? verifyError.message
            : String(verifyError);
        Logger.log(
          'AUTH',
          `Verification failed for ${provider}:`,
          errorMessage
        );
        res.json({
          valid: false,
          error: errorMessage,
        });
        return;
      }

      if (result.stopReason === 'error' || result.errorMessage) {
        Logger.log(
          'AUTH',
          `Verification failed for ${provider}:`,
          result.errorMessage
        );
        res.json({
          valid: false,
          error: result.errorMessage || 'API request failed',
        });
        return;
      }

      res.json({
        valid: true,
        models: models.map((m) => m.id),
      });
    } catch (error) {
      Logger.log('AUTH', 'Error verifying auth', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  return router;
}
