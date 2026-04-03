/**
 * @fileoverview HTTP routes for configuration management.
 *
 * Routes:
 * - GET /api/config - Get current configuration
 * - PUT /api/config - Update configuration
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { loadConfig, saveConfig, type AppConfig } from '../../config/index.js';
import { getConfigPath } from '../../util/paths.js';
import { Logger } from '../../util/logger.js';

export function createConfigRouter(): Router {
  const router = Router();
  const configPath = getConfigPath();

  /**
   * GET /api/config
   * Retrieves the current configuration from config.yaml
   */
  router.get('/', (_req: Request, res: Response) => {
    try {
      const config = loadConfig(configPath);
      res.json({ success: true, config });
    } catch (error) {
      Logger.log('CONFIG', 'Failed to load configuration', error);
      res.status(500).json({
        success: false,
        error: 'CONFIG_LOAD_ERROR',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to load configuration',
      });
    }
  });

  /**
   * PUT /api/config
   * Updates the configuration and saves to config.yaml.
   * After saving, immediately updates Logger's enabled state.
   */
  router.put('/', (req: Request, res: Response) => {
    try {
      const { enableLogging } = req.body;

      if (typeof enableLogging !== 'boolean') {
        res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'enableLogging must be a boolean',
        });
        return;
      }

      const config: AppConfig = { enableLogging };
      saveConfig(configPath, config);

      // Dynamically update Logger's enabled state
      Logger.setEnabled(enableLogging);

      res.json({ success: true, message: '配置已保存' });
    } catch (error) {
      Logger.log('CONFIG', 'Failed to save configuration', error);
      res.status(500).json({
        success: false,
        error: 'CONFIG_SAVE_ERROR',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to save configuration',
      });
    }
  });

  return router;
}
