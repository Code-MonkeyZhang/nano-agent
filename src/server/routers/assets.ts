/**
 * @fileoverview HTTP routes for agent assets (poses & backgrounds).
 *
 * Routes:
 * - GET /api/agents/:agentId/assets/pose       - List all pose names
 * - GET /api/agents/:agentId/assets/pose/:name  - Get a specific pose image
 * - GET /api/agents/:agentId/assets/background  - Get background image
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  getAgentAssetsPoseDir,
  getAgentAssetsBackgroundsDir,
} from '../../util/paths.js';
import { Logger } from '../../util/logger.js';
import { getParam } from './utils.js';

const IMAGE_EXTENSIONS = /\.(png|jpg|jpeg|gif|webp)$/i;

const MIME_MAP: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

/**
 * 创建 Agent 资源路由。
 *
 * 挂载到 `/api/agents/:agentId/assets` 路径下，提供立绘和背景图的访问接口。
 *
 * @returns 配置好三个 GET 路由的 Express Router
 */
export function createAssetsRouter(): Router {
  const router = Router({ mergeParams: true });

  /**
   * GET /pose — 列出指定 Agent 的所有立绘表情名称。
   *
   * 从 Agent 的 pose 目录读取图片文件，去掉扩展名后作为表情名称返回。
   *
   * @returns JSON: `{ poses: string[] }`
   */
  router.get('/pose', (req: Request, res: Response) => {
    try {
      const agentId = getParam(req.params['agentId']);
      if (!agentId) {
        res.status(400).json({ error: 'Agent ID is required' });
        return;
      }

      const poseDir = getAgentAssetsPoseDir(agentId);
      if (!fs.existsSync(poseDir)) {
        res.json({ poses: [] });
        return;
      }

      const poses = fs
        .readdirSync(poseDir)
        .filter((f) => IMAGE_EXTENSIONS.test(f))
        .map((f) => path.parse(f).name);

      res.json({ poses });
    } catch (error) {
      Logger.log('ASSETS', 'Error listing poses', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /pose/:name — 获取指定名称的立绘图片文件。
   *
   * 根据 URL 中的 name 参数在 pose 目录中匹配文件名（不含扩展名），
   * 找到后以流式响应返回图片，自动设置对应的 Content-Type。
   *
   * @returns 图片文件流，或 404/400/500 错误 JSON
   */
  router.get('/pose/:name', (req: Request, res: Response) => {
    try {
      const agentId = getParam(req.params['agentId']);
      const poseName = getParam(req.params['name']);
      if (!agentId || !poseName) {
        res.status(400).json({ error: 'Agent ID and pose name are required' });
        return;
      }

      const poseDir = getAgentAssetsPoseDir(agentId);
      if (!fs.existsSync(poseDir)) {
        res.status(404).json({ error: 'Pose not found' });
        return;
      }

      const files = fs.readdirSync(poseDir);
      const matched = files.find(
        (f) => path.parse(f).name === poseName && IMAGE_EXTENSIONS.test(f)
      );

      if (!matched) {
        res.status(404).json({ error: `Pose not found: ${poseName}` });
        return;
      }

      const filePath = path.join(poseDir, matched);
      const ext = path.extname(matched).toLowerCase();
      const contentType = MIME_MAP[ext] || 'application/octet-stream';

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'no-cache');
      fs.createReadStream(filePath).pipe(res);
    } catch (error) {
      Logger.log('ASSETS', 'Error getting pose', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /background — 获取指定 Agent 的背景图片。
   *
   * 从 Agent 的 backgrounds 目录中找到第一个图片文件并以流式响应返回。
   *
   * @returns 图片文件流，或 404/400/500 错误 JSON
   */
  router.get('/background', (req: Request, res: Response) => {
    try {
      const agentId = getParam(req.params['agentId']);
      if (!agentId) {
        res.status(400).json({ error: 'Agent ID is required' });
        return;
      }

      const bgDir = getAgentAssetsBackgroundsDir(agentId);
      if (!fs.existsSync(bgDir)) {
        res.status(404).json({ error: 'No background found' });
        return;
      }

      const files = fs.readdirSync(bgDir);
      const matched = files.find((f) => IMAGE_EXTENSIONS.test(f));

      if (!matched) {
        res.status(404).json({ error: 'No background found' });
        return;
      }

      const filePath = path.join(bgDir, matched);
      const ext = path.extname(matched).toLowerCase();
      const contentType = MIME_MAP[ext] || 'application/octet-stream';

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'no-cache');
      fs.createReadStream(filePath).pipe(res);
    } catch (error) {
      Logger.log('ASSETS', 'Error getting background', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  return router;
}
