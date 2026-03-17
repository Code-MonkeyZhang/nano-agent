import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  initSkillPool,
  listSkills,
  getSkill,
  reloadSkill,
  isSkillId,
  parseSkillId,
} from '../src/skill-pool/index.js';

const TEST_SKILLS_DIR = path.join(__dirname, 'test-skills');

function createTestSkill(
  name: string,
  description: string,
  content: string
): void {
  const skillDir = path.join(TEST_SKILLS_DIR, name);
  fs.mkdirSync(skillDir, { recursive: true });
  const skillFile = path.join(skillDir, 'SKILL.md');
  fs.writeFileSync(
    skillFile,
    `---
name: ${name}
description: ${description}
---

${content}
`
  );
}

function cleanupTestSkills(): void {
  if (fs.existsSync(TEST_SKILLS_DIR)) {
    fs.rmSync(TEST_SKILLS_DIR, { recursive: true, force: true });
  }
}

describe('SkillPool', () => {
  beforeEach(() => {
    cleanupTestSkills();
  });

  afterEach(() => {
    cleanupTestSkills();
  });

  describe('initSkillPool', () => {
    it('should initialize with empty directory', () => {
      fs.mkdirSync(TEST_SKILLS_DIR, { recursive: true });
      initSkillPool(TEST_SKILLS_DIR);
      expect(listSkills()).toEqual([]);
    });

    it('should initialize with non-existent directory', () => {
      initSkillPool('/non/existent/path');
      expect(listSkills()).toEqual([]);
    });

    it('should load skills from directory', () => {
      createTestSkill('test-skill', 'A test skill', 'Test content');
      initSkillPool(TEST_SKILLS_DIR);

      const skills = listSkills();
      expect(skills).toHaveLength(1);
      expect(skills[0]).toEqual({
        id: 'skill:test-skill',
        name: 'test-skill',
        description: 'A test skill',
      });
    });

    it('should load multiple skills', () => {
      createTestSkill('skill-a', 'Skill A', 'Content A');
      createTestSkill('skill-b', 'Skill B', 'Content B');
      initSkillPool(TEST_SKILLS_DIR);

      const skills = listSkills();
      expect(skills).toHaveLength(2);
      expect(skills.map((s) => s.name)).toContain('skill-a');
      expect(skills.map((s) => s.name)).toContain('skill-b');
    });
  });

  describe('getSkill', () => {
    it('should return skill by id', () => {
      createTestSkill('my-skill', 'My skill', 'My content');
      initSkillPool(TEST_SKILLS_DIR);

      const skill = getSkill('skill:my-skill');
      expect(skill).toBeDefined();
      expect(skill?.name).toBe('my-skill');
      expect(skill?.description).toBe('My skill');
      expect(skill?.content).toContain('My content');
    });

    it('should return undefined for non-existent skill', () => {
      initSkillPool(TEST_SKILLS_DIR);
      const skill = getSkill('skill:non-existent');
      expect(skill).toBeUndefined();
    });
  });

  describe('reloadSkill', () => {
    it('should reload skill from file', () => {
      createTestSkill('reload-test', 'Original desc', 'Original content');
      initSkillPool(TEST_SKILLS_DIR);

      const skillFile = path.join(TEST_SKILLS_DIR, 'reload-test', 'SKILL.md');
      fs.writeFileSync(
        skillFile,
        `---
name: reload-test
description: Updated desc
---

Updated content
`
      );

      const reloaded = reloadSkill('skill:reload-test');
      expect(reloaded).toBeDefined();
      expect(reloaded?.description).toBe('Updated desc');
      expect(reloaded?.content).toContain('Updated content');
    });

    it('should return null for non-existent skill', () => {
      initSkillPool(TEST_SKILLS_DIR);
      const result = reloadSkill('skill:non-existent');
      expect(result).toBeNull();
    });
  });

  describe('isSkillId', () => {
    it('should return true for valid skill IDs', () => {
      expect(isSkillId('skill:test')).toBe(true);
      expect(isSkillId('skill:my-skill')).toBe(true);
      expect(isSkillId('skill:skill_name')).toBe(true);
    });

    it('should return false for invalid skill IDs', () => {
      expect(isSkillId('builtin:test')).toBe(false);
      expect(isSkillId('mcp:server:tool')).toBe(false);
      expect(isSkillId('test')).toBe(false);
    });
  });

  describe('parseSkillId', () => {
    it('should extract skill name from ID', () => {
      expect(parseSkillId('skill:my-skill')).toBe('my-skill');
      expect(parseSkillId('skill:test')).toBe('test');
    });
  });
});
