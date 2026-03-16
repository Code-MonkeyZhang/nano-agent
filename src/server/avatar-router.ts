/**
 * Avatar Router
 *
 * Provides HTTP API endpoints for agent avatar management.
 *
 * Endpoints:
 * - GET    /api/agents/:id/avatar   - Get agent avatar image
 * - POST   /api/agents/:id/avatar   - Upload avatar
 * - DELETE /api/agents/:id/avatar   - Delete avatar
 * - GET    /api/presets/avatars     - List preset avatars
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import multer from 'multer';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  getAgentConfig,
  getAgentDirPath,
  updateAgentConfig,
} from '../agent-config/index.js';
import { processAvatar } from '../lib/avatar-processor.js';
import { Logger } from '../util/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PRESETS_DIR = path.resolve(__dirname, '..', '..', 'resources', 'avatars');

const PRESET_AVATARS = [
  'avatar_0',
  'avatar_3',
  'avatar_5',
  'avatar_7',
  'avatar_10',
  'avatar_15',
];

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  },
});

function getAvatarPath(agentId: string): string {
  return path.join(getAgentDirPath(agentId), 'avatar.png');
}

function getParamId(req: Request): string | undefined {
  const id = req.params['id'];
  return Array.isArray(id) ? id[0] : id;
}

export function createAvatarRouter(): Router {
  const router = Router();

  /**
   * GET /api/presets/avatars
   * Returns list of available preset avatar IDs.
   */
  router.get('/presets/avatars', (_req: Request, res: Response) => {
    res.json({ presets: PRESET_AVATARS });
  });

  /**
   * GET /api/agents/:id/avatar
   * Returns avatar image for the agent.
   */
  router.get('/agents/:id/avatar', (req: Request, res: Response) => {
    try {
      const id = getParamId(req);
      if (!id) {
        res.status(400).json({ error: 'Agent ID is required' });
        return;
      }

      const agent = getAgentConfig(id);
      if (!agent) {
        res.status(404).json({ error: 'Agent not found' });
        return;
      }

      if (!agent.avatar) {
        res.status(404).json({ error: 'No avatar set' });
        return;
      }

      if (agent.avatar.startsWith('preset:')) {
        const presetId = agent.avatar.substring(7);
        const presetPath = path.join(PRESETS_DIR, `${presetId}.png`);
        if (!fs.existsSync(presetPath)) {
          res.status(404).json({ error: 'Preset avatar not found' });
          return;
        }
        res.sendFile(presetPath);
        return;
      }

      const avatarPath = getAvatarPath(id);
      if (!fs.existsSync(avatarPath)) {
        res.status(404).json({ error: 'Avatar file not found' });
        return;
      }
      res.sendFile(avatarPath);
    } catch (error) {
      Logger.log('AVATAR', 'Error getting avatar', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /api/agents/:id/avatar
   * Upload and process a new avatar image.
   *
   * Body: multipart/form-data with "avatar" file field
   * Query: ?preset=avatar_X to select preset instead of upload
   */
  router.post(
    '/agents/:id/avatar',
    upload.single('avatar'),
    async (req: Request, res: Response) => {
      try {
        const id = getParamId(req);
        if (!id) {
          res.status(400).json({ error: 'Agent ID is required' });
          return;
        }

        const agent = getAgentConfig(id);
        if (!agent) {
          res.status(404).json({ error: 'Agent not found' });
          return;
        }

        const preset = req.query['preset'] as string | undefined;

        if (preset) {
          if (!PRESET_AVATARS.includes(preset)) {
            res.status(400).json({ error: 'Invalid preset avatar' });
            return;
          }
          updateAgentConfig(id, { avatar: `preset:${preset}` });
          res.json({ success: true, avatar: `preset:${preset}` });
          return;
        }

        if (!req.file) {
          res.status(400).json({ error: 'No file uploaded' });
          return;
        }

        const processed = await processAvatar(req.file.buffer);
        const avatarPath = getAvatarPath(id);
        fs.writeFileSync(avatarPath, processed);

        updateAgentConfig(id, { avatar: 'avatar.png' });
        res.json({ success: true, avatar: 'avatar.png' });
      } catch (error) {
        Logger.log('AVATAR', 'Error uploading avatar', error);
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  /**
   * DELETE /api/agents/:id/avatar
   * Remove avatar from agent.
   */
  router.delete('/agents/:id/avatar', (req: Request, res: Response) => {
    try {
      const id = getParamId(req);
      if (!id) {
        res.status(400).json({ error: 'Agent ID is required' });
        return;
      }

      const agent = getAgentConfig(id);
      if (!agent) {
        res.status(404).json({ error: 'Agent not found' });
        return;
      }

      if (agent.avatar && !agent.avatar.startsWith('preset:')) {
        const avatarPath = getAvatarPath(id);
        if (fs.existsSync(avatarPath)) {
          fs.unlinkSync(avatarPath);
        }
      }

      updateAgentConfig(id, { avatar: undefined });
      res.json({ success: true });
    } catch (error) {
      Logger.log('AVATAR', 'Error deleting avatar', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  return router;
}
