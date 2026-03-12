import * as fs from 'node:fs';
import * as path from 'node:path';
import { Logger } from '../util/logger.js';
import type { SkillEntry, SkillId } from './types.js';

let skillsDir = './skills';

function createSkillId(name: string): SkillId {
  return `skill:${name}`;
}

/**
 * Set the skills directory path.
 */
export function setSkillsDir(dir: string): void {
  skillsDir = dir;
}

/**
 * Load all skills from the skills directory.
 * Uses the existing SKILL.md format with YAML frontmatter.
 */
export function loadAllSkills(): SkillEntry[] {
  const skills: SkillEntry[] = [];

  if (!fs.existsSync(skillsDir)) {
    Logger.log('SKILL-POOL', `Skills directory does not exist: ${skillsDir}`);
    return skills;
  }

  const skillFiles = findSkillFiles(skillsDir);

  for (const skillFile of skillFiles) {
    const skill = loadSkillFromFile(skillFile);
    if (skill) {
      skills.push(skill);
    }
  }

  Logger.log('SKILL-POOL', `Loaded ${skills.length} skills`);
  return skills;
}

/**
 * Reload a single skill from its file.
 */
export function reloadSkillFromFile(skillId: SkillId): SkillEntry | null {
  const skillName = parseSkillId(skillId);
  if (!skillName) return null;

  const skillFile = findSkillFileByName(skillsDir, skillName);
  if (!skillFile) {
    Logger.log('SKILL-POOL', `Skill file not found for: ${skillName}`);
    return null;
  }

  return loadSkillFromFile(skillFile);
}

function findSkillFiles(dir: string): string[] {
  const files: string[] = [];

  if (!fs.existsSync(dir)) return files;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findSkillFiles(fullPath));
    } else if (entry.name === 'SKILL.md') {
      files.push(fullPath);
    }
  }

  return files;
}

function findSkillFileByName(dir: string, name: string): string | null {
  if (!fs.existsSync(dir)) return null;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findSkillFileByName(fullPath, name);
      if (found) return found;
    } else if (entry.name === 'SKILL.md') {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const extracted = extractFrontmatter(content);
      if (extracted?.frontmatter['name'] === name) {
        return fullPath;
      }
    }
  }

  return null;
}

function loadSkillFromFile(filePath: string): SkillEntry | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const extracted = extractFrontmatter(content);

    if (!extracted) {
      Logger.log('SKILL-POOL', `Missing valid frontmatter: ${filePath}`);
      return null;
    }

    const { frontmatter, body } = extracted;

    if (!frontmatter['name'] || !frontmatter['description']) {
      Logger.log('SKILL-POOL', `Missing required fields in: ${filePath}`);
      return null;
    }

    const skillDir = path.dirname(filePath);
    const processedContent = processSkillPaths(body, skillDir);

    const skillName = frontmatter['name'];
    return {
      id: createSkillId(skillName),
      name: skillName,
      description: frontmatter['description'],
      content: processedContent,
      filePath,
    };
  } catch (error) {
    Logger.log('SKILL-POOL', `Failed to load skill: ${filePath}`, error);
    return null;
  }
}

interface FrontmatterResult {
  frontmatter: Record<string, string>;
  body: string;
}

function extractFrontmatter(content: string): FrontmatterResult | null {
  const firstDivider = content.indexOf('---\n');
  if (firstDivider === -1) return null;

  const secondDivider = content.indexOf('\n---\n', firstDivider + 4);
  if (secondDivider === -1) return null;

  const frontmatterText = content.substring(firstDivider + 4, secondDivider);
  const body = content.substring(secondDivider + 5);

  const frontmatter: Record<string, string> = {};
  const lines = frontmatterText.split('\n');
  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim();
      frontmatter[key] = value;
    }
  }

  return { frontmatter, body };
}

function processSkillPaths(content: string, skillDir: string): string {
  const patternDirs =
    /(python\s+|`)((?:scripts|examples|templates|reference)\/[^\s`\)]+)/g;
  content = content.replace(patternDirs, (match, prefix, relPath) => {
    const absPath = path.resolve(skillDir, relPath);
    if (fs.existsSync(absPath)) {
      return `${prefix}${absPath}`;
    }
    return match;
  });

  const patternDocs =
    /(see|read|refer to|check)\s+([a-zA-Z0-9_-]+\.(?:md|txt|json|yaml))([.,;\s])/gi;
  content = content.replace(patternDocs, (match, prefix, filename, suffix) => {
    const absPath = path.resolve(skillDir, filename);
    if (fs.existsSync(absPath)) {
      return `${prefix}\`${absPath}\` (use read_file to access)${suffix}`;
    }
    return match;
  });

  const patternMarkdown =
    /(?:(Read|See|Check|Refer to|Load|View)\s+)?\[(`?[^`\]]+`?)\]\(((?:\.)?[^)]+\.(?:md|txt|json|yaml|js|py|html))\)/gi;
  content = content.replace(
    patternMarkdown,
    (match, prefix, linkText, filepath) => {
      const cleanPath = filepath.startsWith('./')
        ? filepath.slice(2)
        : filepath;
      const absPath = path.resolve(skillDir, cleanPath);
      if (fs.existsSync(absPath)) {
        const effectivePrefix = prefix || '';
        return `${effectivePrefix}[${linkText}](\`${absPath}\`) (use read_file to access)`;
      }
      return match;
    }
  );

  return content;
}

function parseSkillId(skillId: SkillId): string | null {
  if (!skillId.startsWith('skill:')) return null;
  return skillId.slice(6) || null;
}
