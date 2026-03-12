import { loadAllSkills, reloadSkillFromFile, setSkillsDir } from './loader.js';
import type { SkillId, SkillMeta, SkillEntry } from './types.js';

const skillPool = new Map<SkillId, SkillEntry>();

/**
 * Initialize the skill pool by loading all skills from the directory.
 *
 * @param skillsDirPath - Path to the skills directory (default: "./skills")
 */
export function initSkillPool(skillsDirPath = './skills'): void {
  setSkillsDir(skillsDirPath);
  skillPool.clear();

  const skills = loadAllSkills();
  for (const skill of skills) {
    if (!skillPool.has(skill.id)) {
      skillPool.set(skill.id, skill);
    }
  }
}

/**
 * List all skills with their metadata.
 */
export function listSkills(): SkillMeta[] {
  return Array.from(skillPool.values()).map((entry) => ({
    id: entry.id,
    name: entry.name,
    description: entry.description,
  }));
}

/**
 * Get a specific skill by its ID.
 */
export function getSkill(skillId: SkillId): SkillEntry | undefined {
  return skillPool.get(skillId);
}

/**
 * Reload a specific skill from its file.
 * Useful for hot-reloading during development.
 */
export function reloadSkill(skillId: SkillId): SkillEntry | null {
  const skill = reloadSkillFromFile(skillId);
  if (skill) {
    skillPool.set(skillId, skill);
    return skill;
  }
  return null;
}

/**
 * Check if a string is a valid skill ID.
 */
export function isSkillId(id: string): id is SkillId {
  return id.startsWith('skill:');
}

/**
 * Parse a skill ID to get the skill name.
 */
export function parseSkillId(skillId: SkillId): string {
  return skillId.slice(6);
}
