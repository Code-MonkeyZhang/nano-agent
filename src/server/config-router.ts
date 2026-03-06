/**
 * Configuration Router
 *
 * Provides HTTP API endpoints for managing agent configuration.
 * This module enables the frontend to read and update the config.yaml file
 * through RESTful API calls.
 *
 * Endpoints:
 * - GET  /api/config - Retrieve current configuration
 * - PUT  /api/config - Update configuration
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { ConfigManager } from '../config-manager.js';
import { Logger } from '../util/logger.js';
import { ZodError } from 'zod';

const router = Router();
const configManager = ConfigManager.getInstance();

/**
 * GET /api/config
 *
 * Retrieves the current agent configuration from config.yaml
 *
 * @route GET /api/config
 * @returns {Object} JSON response containing:
 *   - success: boolean - Whether the operation succeeded
 *   - config: AgentConfig - The current configuration (on success)
 *   - error: string - Error code (on failure)
 *   - message: string - Error message (on failure)
 *
 * @example
 * // Success response
 * {
 *   "success": true,
 *   "config": {
 *     "apiKey": "sk-xxx",
 *     "model": "deepseek-chat",
 *     ...
 *   }
 * }
 *
 * // Error response
 * {
 *   "success": false,
 *   "error": "CONFIG_LOAD_ERROR",
 *   "message": "Configuration file not found"
 * }
 */
router.get('/', (_req: Request, res: Response) => {
  try {
    Logger.log('CONFIG', 'Loading configuration');
    const config = configManager.load();
    res.json({
      success: true,
      config,
    });
  } catch (error) {
    Logger.log('CONFIG', 'Failed to load configuration', error);
    if (error instanceof Error) {
      res.status(500).json({
        success: false,
        error: 'CONFIG_LOAD_ERROR',
        message: error.message,
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'CONFIG_LOAD_ERROR',
        message: 'Failed to load configuration',
      });
    }
  }
});

/**
 * PUT /api/config
 *
 * Updates the agent configuration and saves it to config.yaml
 *
 * @route PUT /api/config
 * @param {AgentConfig} req.body - The complete configuration object to save
 * @returns {Object} JSON response containing:
 *   - success: boolean - Whether the operation succeeded
 *   - message: string - Success or error message
 *   - error: string - Error code (on failure)
 *
 * @example
 * // Request body
 * {
 *   "apiKey": "sk-xxx",
 *   "model": "deepseek-chat",
 *   "provider": "openai",
 *   ...
 * }
 *
 * // Success response
 * {
 *   "success": true,
 *   "message": "配置已保存"
 * }
 *
 * // Validation error response
 * {
 *   "success": false,
 *   "error": "VALIDATION_ERROR",
 *   "message": "apiKey: Please configure a valid API Key"
 * }
 *
 * // File write error response
 * {
 *   "success": false,
 *   "error": "FILE_WRITE_ERROR",
 *   "message": "无法写入配置文件，请检查文件权限"
 * }
 */
router.put('/', (req: Request, res: Response) => {
  try {
    Logger.log('CONFIG', 'Saving configuration');
    const config = req.body;

    configManager.save(config);

    res.json({
      success: true,
      message: '配置已保存',
    });
  } catch (error) {
    Logger.log('CONFIG', 'Failed to save configuration', error);

    if (error instanceof ZodError) {
      const errorMessages = error.issues
        .map((err) => `${err.path.join('.')}: ${err.message}`)
        .join(', ');

      res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: errorMessages,
      });
    } else if (error instanceof Error) {
      if (
        error.message.includes('permission') ||
        error.message.includes('EACCES')
      ) {
        res.status(500).json({
          success: false,
          error: 'FILE_WRITE_ERROR',
          message: '无法写入配置文件，请检查文件权限',
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'CONFIG_SAVE_ERROR',
          message: error.message,
        });
      }
    } else {
      res.status(500).json({
        success: false,
        error: 'CONFIG_SAVE_ERROR',
        message: 'Failed to save configuration',
      });
    }
  }
});

/**
 * Creates and returns the configuration router
 *
 * This function creates an Express router with configuration management endpoints.
 * The router is typically mounted at /api/config in the main HTTP server.
 *
 * @returns {Router} Express router with GET and PUT endpoints for configuration management
 *
 * @example
 * // In http-server.ts
 * import { createConfigRouter } from './config-router.js';
 * app.use('/api/config', createConfigRouter());
 */
export function createConfigRouter(): Router {
  return router;
}
