/**
 * @fileoverview Skill Pool - global cache for loaded skills with lazy reload support.
 *
 * The pool maintains a map of all available skills and checks file modification
 * times on each access to support hot reload without explicit refresh calls.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { Logger } from '../util/logger.js';
import { getSkillsDir } from '../util/paths.js';
import { loadSkillFile, loadAllSkills } from './loader.js';
import type { Skill, SkillInfo, SkillStatusInfo } from './types.js';

let skillPool: Map<string, Skill> = new Map();
let initialized = false;

/**
 * Initialize the skill pool by loading all skills from disk.
 * Should be called once on server startup.
 */
export function initSkillPool(): void {
  skillPool = loadAllSkills();
  initialized = true;
  Logger.log('SKILL', `Initialized skill pool with ${skillPool.size} skills`);
}

/**
 * Get all available skills as SkillInfo array (without full content).
 * Checks for file modifications and reloads if necessary.
 */
export function listSkills(): SkillInfo[] {
  ensureInitialized();
  reloadModifiedSkills();
  return Array.from(skillPool.values()).map((s) => ({
    name: s.name,
    description: s.description,
  }));
}

/**
 * Get a single skill by name with lazy reload check.
 *
 * @param name - Skill name
 * @returns Skill object or undefined if not found
 */
export function getSkill(name: string): Skill | undefined {
  ensureInitialized();
  reloadSkillIfNeeded(name);
  return skillPool.get(name);
}

/**
 * Get multiple skills by names, returning only available ones.
 * Logs a warning for each unavailable skill.
 */
export function getSkills(names: string[]): Skill[] {
  ensureInitialized();
  const result: Skill[] = [];

  for (const name of names) {
    reloadSkillIfNeeded(name);
    const skill = skillPool.get(name);
    if (skill) {
      result.push(skill);
    } else {
      Logger.log('SKILL', `Skill "${name}" not found, skipping`);
    }
  }

  return result;
}

/**
 * Get skill status info for agent detail response.
 * Returns both available and unavailable skills.
 */
export function getSkillStatusInfo(names: string[]): SkillStatusInfo[] {
  ensureInitialized();
  const result: SkillStatusInfo[] = [];

  for (const name of names) {
    reloadSkillIfNeeded(name);
    const skill = skillPool.get(name);

    if (skill) {
      result.push({
        name: skill.name,
        description: skill.description,
        status: 'available',
      });
    } else {
      result.push({
        name,
        description: '',
        status: 'unavailable',
      });
    }
  }

  return result;
}

/**
 * Check if a skill exists in the pool.
 */
export function hasSkill(name: string): boolean {
  ensureInitialized();
  reloadSkillIfNeeded(name);
  return skillPool.has(name);
}

/**
 * Ensure the pool is initialized before use.
 */
function ensureInitialized(): void {
  if (!initialized) {
    initSkillPool();
  }
}

/**
 * Check all skills for modifications and reload if changed.
 */
function reloadModifiedSkills(): void {
  for (const [name, skill] of skillPool) {
    try {
      const stat = fs.statSync(skill.filePath);
      if (stat.mtimeMs > skill.mtime) {
        const reloaded = loadSkillFile(skill.filePath);
        if (reloaded) {
          skillPool.set(name, reloaded);
          Logger.log('SKILL', `Reloaded modified skill: ${name}`);
        }
      }
    } catch {
      // File may have been deleted
      skillPool.delete(name);
      Logger.log('SKILL', `Removed deleted skill: ${name}`);
    }
  }
}

/**
 * Check and reload a single skill if its file has been modified.
 */
function reloadSkillIfNeeded(name: string): void {
  const skill = skillPool.get(name);
  if (!skill) {
    // Try to load if not in pool (might be newly created)
    const skillsDir = getSkillsDir();
    const skillPath = path.join(skillsDir, name, 'SKILL.md');
    if (fs.existsSync(skillPath)) {
      const loaded = loadSkillFile(skillPath);
      if (loaded) {
        skillPool.set(name, loaded);
      }
    }
    return;
  }

  try {
    const stat = fs.statSync(skill.filePath);
    if (stat.mtimeMs > skill.mtime) {
      const reloaded = loadSkillFile(skill.filePath);
      if (reloaded) {
        skillPool.set(name, reloaded);
      }
    }
  } catch {
    skillPool.delete(name);
  }
}
