/**
 * @fileoverview HTTP routes for skill management.
 *
 * Routes:
 * - GET /api/skills     - List all available skills (name + description only)
 * - GET /api/skills/:name - Get single skill with full content
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { listSkills, getSkill } from '../../skill/index.js';
import { Logger } from '../../util/logger.js';
import { getParam } from './utils.js';

export function createSkillRouter(): Router {
  const router = Router();

  /** GET /api/skills - List all available skills */
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

  /** GET /api/skills/:name - Get a single skill by name */
  router.get('/:name', (req: Request, res: Response) => {
    try {
      const name = getParam(req.params['name']);
      if (!name) {
        res.status(400).json({ error: 'Skill name is required' });
        return;
      }

      const skill = getSkill(name);
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

  return router;
}
