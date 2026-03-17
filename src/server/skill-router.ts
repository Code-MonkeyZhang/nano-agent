/**
 * Skill Router
 *
 * Provides HTTP API endpoints for managing skills.
 * Skills are loaded from the skills/ directory at startup.
 *
 * Endpoints:
 * - GET /api/skills - List all skills
 * - GET /api/skills/:id - Get single skill details
 * - POST /api/skills/:id/reload - Reload a skill from disk
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import {
  listSkills,
  getSkill,
  reloadSkill,
  isSkillId,
} from '../skill-pool/index.js';
import type { SkillId } from '../skill-pool/index.js';
import { Logger } from '../util/logger.js';

/**
 * Extract and validate skill ID from request params.
 * Returns the validated SkillId or null if invalid.
 */
function extractSkillId(param: string | string[] | undefined): SkillId | null {
  if (!param) return null;
  const id = Array.isArray(param) ? param[0] : param;
  if (!id || !isSkillId(id)) return null;
  return id;
}

export function createSkillRouter(): Router {
  const router = Router();

  /**
   * GET /api/skills
   * List all available skills.
   */
  router.get('/', (_req: Request, res: Response) => {
    try {
      const skills = listSkills();
      res.json({ skills });
    } catch (error) {
      Logger.log('SKILL', 'Error listing skills', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/skills/:id
   * Get a single skill by ID (includes full content).
   *
   * @param id - Skill ID (e.g., "skill:code-review")
   */
  router.get('/:id', (req: Request, res: Response) => {
    try {
      const id = extractSkillId(req.params['id']);
      if (!id) {
        res.status(400).json({ error: 'Invalid skill ID format' });
        return;
      }

      const skill = getSkill(id);
      if (!skill) {
        res.status(404).json({ error: 'Skill not found' });
        return;
      }

      res.json({ skill });
    } catch (error) {
      Logger.log('SKILL', 'Error getting skill', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /api/skills/:id/reload
   * Reload a skill from disk (useful after editing skill files).
   */
  router.post('/:id/reload', (req: Request, res: Response) => {
    try {
      const id = extractSkillId(req.params['id']);
      if (!id) {
        res.status(400).json({ error: 'Invalid skill ID format' });
        return;
      }

      const existing = getSkill(id);
      if (!existing) {
        res.status(404).json({ error: 'Skill not found' });
        return;
      }

      const skill = reloadSkill(id);
      if (!skill) {
        res.status(500).json({ error: 'Failed to reload skill' });
        return;
      }

      Logger.log('SKILL', `Reloaded skill: ${id}`);
      res.json({ skill });
    } catch (error) {
      Logger.log('SKILL', 'Error reloading skill', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  return router;
}
