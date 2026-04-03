/**
 * @fileoverview Skill 模块单元测试
 * 测试 Skill 的文件加载、解析和缓存池功能
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  mock,
} from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

let tempDir: string;
let skillsDir: string;

mock.module('../src/util/paths.js', () => ({
  getSkillsDir: () => skillsDir,
}));

mock.module('../src/util/logger.js', () => ({
  Logger: {
    log: () => {},
  },
}));

import {
  loadSkillFile,
  loadAllSkills,
  toSkillInfo,
} from '../src/skill/loader.js';
import {
  initSkillPool,
  listSkills,
  getSkill,
  getSkills,
  getSkillStatusInfo,
  hasSkill,
} from '../src/skill/pool.js';
import type { Skill } from '../src/skill/types.js';

function createSkillFile(
  skillDir: string,
  name: string,
  description: string,
  content: string
): string {
  const skillPath = path.join(skillDir, 'SKILL.md');
  const fileContent = `---
name: ${name}
description: ${description}
---

${content}`;
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(skillPath, fileContent);
  return skillPath;
}

describe('Skill Loader', () => {
  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-test-'));
    skillsDir = path.join(tempDir, 'skills');
  });

  afterAll(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('loadSkillFile', () => {
    it('should parse valid skill file', () => {
      const skillDir = path.join(skillsDir, 'test-skill');
      createSkillFile(skillDir, 'test-skill', 'A test skill', 'Test content');

      const skill = loadSkillFile(path.join(skillDir, 'SKILL.md'));

      expect(skill).toBeDefined();
      expect(skill?.name).toBe('test-skill');
      expect(skill?.description).toBe('A test skill');
      expect(skill?.content).toBe('Test content');
    });

    it('should return null for non-existent file', () => {
      const skill = loadSkillFile('/non/existent/path/SKILL.md');
      expect(skill).toBeNull();
    });

    it('should return null for file without frontmatter', () => {
      const skillDir = path.join(skillsDir, 'no-frontmatter');
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(path.join(skillDir, 'SKILL.md'), 'No frontmatter here');

      const skill = loadSkillFile(path.join(skillDir, 'SKILL.md'));
      expect(skill).toBeNull();
    });

    it('should return null for file with invalid metadata', () => {
      const skillDir = path.join(skillsDir, 'invalid-meta');
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(
        path.join(skillDir, 'SKILL.md'),
        `---
invalid: metadata
---

Content`
      );

      const skill = loadSkillFile(path.join(skillDir, 'SKILL.md'));
      expect(skill).toBeNull();
    });

    it('should handle skill without description', () => {
      const skillDir = path.join(skillsDir, 'no-desc');
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(
        path.join(skillDir, 'SKILL.md'),
        `---
name: no-desc
---

Content without description`
      );

      const skill = loadSkillFile(path.join(skillDir, 'SKILL.md'));
      expect(skill).toBeDefined();
      expect(skill?.name).toBe('no-desc');
      expect(skill?.description).toBe('');
    });
  });

  describe('loadAllSkills', () => {
    beforeEach(() => {
      if (fs.existsSync(skillsDir)) {
        fs.rmSync(skillsDir, { recursive: true, force: true });
      }
    });

    it('should return empty map when no skills exist', () => {
      const skills = loadAllSkills();
      expect(skills.size).toBe(0);
    });

    it('should load all valid skills', () => {
      createSkillFile(
        path.join(skillsDir, 'skill-a'),
        'skill-a',
        'Skill A',
        'Content A'
      );
      createSkillFile(
        path.join(skillsDir, 'skill-b'),
        'skill-b',
        'Skill B',
        'Content B'
      );

      const skills = loadAllSkills();

      expect(skills.size).toBe(2);
      expect(skills.has('skill-a')).toBe(true);
      expect(skills.has('skill-b')).toBe(true);
    });

    it('should skip non-directory entries', () => {
      createSkillFile(
        path.join(skillsDir, 'valid-skill'),
        'valid-skill',
        'Valid',
        'Content'
      );
      fs.writeFileSync(path.join(skillsDir, 'file.txt'), 'not a skill');

      const skills = loadAllSkills();
      expect(skills.size).toBe(1);
      expect(skills.has('valid-skill')).toBe(true);
    });
  });

  describe('toSkillInfo', () => {
    it('should convert skill to info', () => {
      const skill: Skill = {
        name: 'test',
        description: 'Test description',
        content: 'Full content',
        filePath: '/path/to/SKILL.md',
        mtime: Date.now(),
      };

      const info = toSkillInfo(skill);

      expect(info.name).toBe('test');
      expect(info.description).toBe('Test description');
    });
  });
});

describe('Skill Pool', () => {
  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-pool-test-'));
    skillsDir = path.join(tempDir, 'skills');
  });

  afterAll(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    if (fs.existsSync(skillsDir)) {
      fs.rmSync(skillsDir, { recursive: true, force: true });
    }
  });

  describe('initSkillPool', () => {
    it('should initialize pool with available skills', () => {
      createSkillFile(
        path.join(skillsDir, 'init-skill'),
        'init-skill',
        'Init',
        'Content'
      );

      initSkillPool();

      const skill = getSkill('init-skill');
      expect(skill).toBeDefined();
      expect(skill?.name).toBe('init-skill');
    });
  });

  describe('listSkills', () => {
    it('should return skill info array', () => {
      createSkillFile(
        path.join(skillsDir, 'list-skill'),
        'list-skill',
        'List',
        'Content'
      );
      initSkillPool();

      const skills = listSkills();

      expect(skills.length).toBe(1);
      expect(skills[0].name).toBe('list-skill');
      expect(skills[0].description).toBe('List');
    });
  });

  describe('getSkill', () => {
    it('should return skill by name', () => {
      createSkillFile(
        path.join(skillsDir, 'get-skill'),
        'get-skill',
        'Get',
        'Content'
      );
      initSkillPool();

      const skill = getSkill('get-skill');

      expect(skill).toBeDefined();
      expect(skill?.name).toBe('get-skill');
    });

    it('should return undefined for non-existent skill', () => {
      initSkillPool();

      const skill = getSkill('non-existent');
      expect(skill).toBeUndefined();
    });
  });

  describe('getSkills', () => {
    it('should return available skills', () => {
      createSkillFile(
        path.join(skillsDir, 'multi-a'),
        'multi-a',
        'A',
        'Content A'
      );
      createSkillFile(
        path.join(skillsDir, 'multi-b'),
        'multi-b',
        'B',
        'Content B'
      );
      initSkillPool();

      const skills = getSkills(['multi-a', 'multi-b']);

      expect(skills.length).toBe(2);
      expect(skills.map((s) => s.name).sort()).toEqual(['multi-a', 'multi-b']);
    });

    it('should skip unavailable skills', () => {
      createSkillFile(
        path.join(skillsDir, 'available'),
        'available',
        'Available',
        'Content'
      );
      initSkillPool();

      const skills = getSkills(['available', 'unavailable']);

      expect(skills.length).toBe(1);
      expect(skills[0].name).toBe('available');
    });
  });

  describe('getSkillStatusInfo', () => {
    it('should return status for all skill names', () => {
      createSkillFile(
        path.join(skillsDir, 'status-avail'),
        'status-avail',
        'Available',
        'Content'
      );
      initSkillPool();

      const statuses = getSkillStatusInfo(['status-avail', 'status-unavail']);

      expect(statuses.length).toBe(2);
      const avail = statuses.find((s) => s.name === 'status-avail');
      const unavail = statuses.find((s) => s.name === 'status-unavail');

      expect(avail?.status).toBe('available');
      expect(avail?.description).toBe('Available');
      expect(unavail?.status).toBe('unavailable');
      expect(unavail?.description).toBe('');
    });
  });

  describe('hasSkill', () => {
    it('should return true for existing skill', () => {
      createSkillFile(
        path.join(skillsDir, 'has-skill'),
        'has-skill',
        'Has',
        'Content'
      );
      initSkillPool();

      expect(hasSkill('has-skill')).toBe(true);
    });

    it('should return false for non-existent skill', () => {
      initSkillPool();

      expect(hasSkill('non-existent')).toBe(false);
    });
  });
});
