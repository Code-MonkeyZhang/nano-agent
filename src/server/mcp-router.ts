/**
 * MCP Router
 *
 * Provides HTTP API endpoints for managing MCP (Model Context Protocol) servers.
 * MCP tools are loaded on-demand when an agent needs them.
 *
 * Endpoints:
 * - GET /api/mcp - List all MCP servers (with status)
 * - GET /api/mcp/:name - Get single MCP server info
 * - POST /api/mcp/:name/connect - Manually connect to MCP server
 * - GET /api/mcp/:name/tools - Get tools for an MCP server
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import {
  listMcpServers,
  getMcpServer,
  connectMcpServerByName,
  listMcpTools,
} from '../mcp-pool/index.js';
import { Logger } from '../util/logger.js';

export function createMcpRouter(): Router {
  const router = Router();

  /**
   * GET /api/mcp
   * List all MCP servers with their connection status.
   */
  router.get('/', (_req: Request, res: Response) => {
    try {
      const servers = listMcpServers();
      res.json({ servers });
    } catch (error) {
      Logger.log('MCP', 'Error listing MCP servers', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/mcp/:name
   * Get a single MCP server by name.
   */
  router.get('/:name', (req: Request, res: Response) => {
    try {
      const name = Array.isArray(req.params['name'])
        ? req.params['name'][0]
        : req.params['name'];
      if (!name) {
        res.status(400).json({ error: 'MCP server name is required' });
        return;
      }

      const server = getMcpServer(name);
      if (!server) {
        res.status(404).json({ error: 'MCP server not found' });
        return;
      }

      res.json({ server });
    } catch (error) {
      Logger.log('MCP', 'Error getting MCP server', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /api/mcp/:name/connect
   * Manually trigger connection to an MCP server.
   * This loads all tools from the server.
   */
  router.post('/:name/connect', async (req: Request, res: Response) => {
    try {
      const name = Array.isArray(req.params['name'])
        ? req.params['name'][0]
        : req.params['name'];
      if (!name) {
        res.status(400).json({ error: 'MCP server name is required' });
        return;
      }

      const server = getMcpServer(name);
      if (!server) {
        res.status(404).json({ error: 'MCP server not found' });
        return;
      }

      Logger.log('MCP', `Connecting to MCP server: ${name}`);
      const tools = await connectMcpServerByName(name);
      Logger.log('MCP', `Connected to ${name}, loaded ${tools.length} tools`);

      res.json({
        success: true,
        server: getMcpServer(name),
        tools,
      });
    } catch (error) {
      Logger.log('MCP', 'Error connecting to MCP server', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/mcp/:name/tools
   * Get the list of tools available from an MCP server.
   * Note: Server must be connected first to have tools loaded.
   */
  router.get('/:name/tools', (req: Request, res: Response) => {
    try {
      const name = Array.isArray(req.params['name'])
        ? req.params['name'][0]
        : req.params['name'];
      if (!name) {
        res.status(400).json({ error: 'MCP server name is required' });
        return;
      }

      const server = getMcpServer(name);
      if (!server) {
        res.status(404).json({ error: 'MCP server not found' });
        return;
      }

      const tools = listMcpTools(name);
      res.json({ serverName: name, tools });
    } catch (error) {
      Logger.log('MCP', 'Error listing MCP tools', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  return router;
}
