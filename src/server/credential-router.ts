/**
 * Credential Router
 *
 * Provides HTTP API endpoints for managing API credentials.
 * API keys are masked in responses for security.
 *
 * Endpoints:
 * - GET  /api/providers - List all supported providers
 * - GET  /api/credentials/:provider - Get provider credential (apiKey masked)
 * - PUT  /api/credentials/:provider - Set provider credential
 * - DELETE /api/credentials/:provider - Delete provider credential
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import {
  listProvidersWithCredential,
  getCredential,
  setCredential,
  deleteCredential,
  maskApiKey,
} from '../credential/index.js';
import type { Provider, ProviderCredential } from '../credential/index.js';
import { getProviders } from '@mariozechner/pi-ai';
import { Logger } from '../util/logger.js';

export function createCredentialRouter(): Router {
  const router = Router();

  /**
   * GET /api/providers
   * List all supported providers with their credential status.
   */
  router.get('/', (_req: Request, res: Response) => {
    try {
      const providers = listProvidersWithCredential();
      res.json({ providers });
    } catch (error) {
      Logger.log('CREDENTIAL', 'Error listing providers', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/providers/all
   * List all supported providers (no credential status).
   */
  router.get('/all', (_req: Request, res: Response) => {
    try {
      const providers = getProviders();
      res.json({ providers });
    } catch (error) {
      Logger.log('CREDENTIAL', 'Error listing all providers', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/credentials/:provider
   * Get a single provider's credential with masked API key.
   */
  router.get('/:provider', (req: Request, res: Response) => {
    try {
      const provider = Array.isArray(req.params['provider'])
        ? req.params['provider'][0]
        : req.params['provider'];
      if (!provider) {
        res.status(400).json({ error: 'Provider is required' });
        return;
      }

      const credential = getCredential(provider as Provider);
      if (!credential) {
        res.status(404).json({ error: 'Credential not found for provider' });
        return;
      }

      res.json({
        provider,
        apiKey: maskApiKey(credential.apiKey),
      });
    } catch (error) {
      Logger.log('CREDENTIAL', 'Error getting credential', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * PUT /api/credentials/:provider
   * Set a provider's credential.
   *
   * @body { apiKey }
   */
  router.put('/:provider', (req: Request, res: Response) => {
    try {
      const provider = Array.isArray(req.params['provider'])
        ? req.params['provider'][0]
        : req.params['provider'];
      if (!provider) {
        res.status(400).json({ error: 'Provider is required' });
        return;
      }

      const input = req.body as ProviderCredential;
      if (!input.apiKey) {
        res.status(400).json({
          error: 'Missing required field: apiKey',
        });
        return;
      }

      const credential = setCredential(provider as Provider, input);
      Logger.log('CREDENTIAL', `Set credential for provider: ${provider}`);
      res.json({
        provider,
        apiKey: maskApiKey(credential.apiKey),
      });
    } catch (error) {
      Logger.log('CREDENTIAL', 'Error setting credential', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * DELETE /api/credentials/:provider
   * Delete a provider's credential.
   */
  router.delete('/:provider', (req: Request, res: Response) => {
    try {
      const provider = Array.isArray(req.params['provider'])
        ? req.params['provider'][0]
        : req.params['provider'];
      if (!provider) {
        res.status(400).json({ error: 'Provider is required' });
        return;
      }

      const existing = getCredential(provider as Provider);
      if (!existing) {
        res.status(404).json({ error: 'Credential not found for provider' });
        return;
      }

      deleteCredential(provider as Provider);
      Logger.log('CREDENTIAL', `Deleted credential for provider: ${provider}`);
      res.json({ success: true });
    } catch (error) {
      Logger.log('CREDENTIAL', 'Error deleting credential', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  return router;
}
