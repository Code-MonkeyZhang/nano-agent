/**
 * Credential Router
 *
 * Provides HTTP API endpoints for managing API credentials.
 * API keys are masked in responses for security.
 *
 * Endpoints:
 * - GET  /api/credentials - List all credentials (apiKey masked)
 * - GET  /api/credentials/:id - Get single credential (apiKey masked)
 * - POST /api/credentials - Create credential
 * - PUT  /api/credentials/:id - Update credential
 * - DELETE /api/credentials/:id - Delete credential
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import {
  listCredentials,
  getCredential,
  createCredential,
  updateCredential,
  deleteCredential,
  maskApiKey,
} from '../credential/index.js';
import type { CreateCredentialInput, Credential } from '../credential/index.js';
import { Logger } from '../util/logger.js';

/**
 * Masks the apiKey in a credential for safe API responses.
 */
function toSafeCredential(cred: Credential) {
  return {
    ...cred,
    apiKey: maskApiKey(cred.apiKey),
  };
}

export function createCredentialRouter(): Router {
  const router = Router();

  /**
   * GET /api/credentials
   * List all credentials with masked API keys.
   */
  router.get('/', (_req: Request, res: Response) => {
    try {
      const credentials = listCredentials();
      res.json({
        credentials: credentials.map(toSafeCredential),
      });
    } catch (error) {
      Logger.log('CREDENTIAL', 'Error listing credentials', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/credentials/:id
   * Get a single credential by ID with masked API key.
   */
  router.get('/:id', (req: Request, res: Response) => {
    try {
      const id = Array.isArray(req.params['id'])
        ? req.params['id'][0]
        : req.params['id'];
      if (!id) {
        res.status(400).json({ error: 'Credential ID is required' });
        return;
      }

      const credential = getCredential(id);
      if (!credential) {
        res.status(404).json({ error: 'Credential not found' });
        return;
      }

      res.json({ credential: toSafeCredential(credential) });
    } catch (error) {
      Logger.log('CREDENTIAL', 'Error getting credential', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /api/credentials
   * Create a new credential.
   *
   * @body { name, provider, apiBase, apiKey }
   */
  router.post('/', (req: Request, res: Response) => {
    try {
      const input = req.body as CreateCredentialInput;

      if (!input.name || !input.provider || !input.apiBase || !input.apiKey) {
        res.status(400).json({
          error: 'Missing required fields: name, provider, apiBase, apiKey',
        });
        return;
      }

      const credential = createCredential(input);
      Logger.log('CREDENTIAL', `Created credential: ${credential.id}`);
      res.status(201).json({ credential: toSafeCredential(credential) });
    } catch (error) {
      Logger.log('CREDENTIAL', 'Error creating credential', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * PUT /api/credentials/:id
   * Update an existing credential.
   *
   * @body { name?, provider?, apiBase?, apiKey? }
   */
  router.put('/:id', (req: Request, res: Response) => {
    try {
      const id = Array.isArray(req.params['id'])
        ? req.params['id'][0]
        : req.params['id'];
      if (!id) {
        res.status(400).json({ error: 'Credential ID is required' });
        return;
      }

      const existing = getCredential(id);
      if (!existing) {
        res.status(404).json({ error: 'Credential not found' });
        return;
      }

      const credential = updateCredential(id, req.body);
      Logger.log('CREDENTIAL', `Updated credential: ${id}`);
      res.json({ credential: toSafeCredential(credential) });
    } catch (error) {
      Logger.log('CREDENTIAL', 'Error updating credential', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * DELETE /api/credentials/:id
   * Delete a credential.
   */
  router.delete('/:id', (req: Request, res: Response) => {
    try {
      const id = Array.isArray(req.params['id'])
        ? req.params['id'][0]
        : req.params['id'];
      if (!id) {
        res.status(400).json({ error: 'Credential ID is required' });
        return;
      }

      const existing = getCredential(id);
      if (!existing) {
        res.status(404).json({ error: 'Credential not found' });
        return;
      }

      deleteCredential(id);
      Logger.log('CREDENTIAL', `Deleted credential: ${id}`);
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
