/**
 * Skill identifier format: "skill:{skillName}"
 * Examples: "skill:code-review", "skill:translate"
 */
export type SkillId = `skill:${string}`;

/**
 * Metadata for a skill.
 * Contains display information without the full content.
 */
export interface SkillMeta {
  id: SkillId;
  name: string;
  description: string;
}

/**
 * Full skill entry including content.
 */
export interface SkillEntry {
  id: SkillId;
  name: string;
  description: string;
  content: string;
  filePath: string;
}
