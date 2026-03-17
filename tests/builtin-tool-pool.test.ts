import { describe, it, expect, beforeEach } from 'vitest';
import {
  initBuiltinToolPool,
  listBuiltinTools,
  getBuiltinTool,
  getAllBuiltinTools,
  isBuiltinToolId,
} from '../src/builtin-tool-pool/index.js';

describe('BuiltinToolPool', () => {
  beforeEach(() => {
    initBuiltinToolPool('/tmp/test-workspace');
  });

  it('should list all builtin tools', () => {
    const tools = listBuiltinTools();
    expect(tools.length).toBe(6);

    const toolNames = tools.map((t) => t.name);
    expect(toolNames).toContain('read_file');
    expect(toolNames).toContain('write_file');
    expect(toolNames).toContain('edit_file');
    expect(toolNames).toContain('bash');
    expect(toolNames).toContain('bash_output');
    expect(toolNames).toContain('bash_kill');
  });

  it('should have correct tool IDs', () => {
    const tools = listBuiltinTools();
    const ids = tools.map((t) => t.id);

    expect(ids).toContain('builtin:read');
    expect(ids).toContain('builtin:write');
    expect(ids).toContain('builtin:edit');
    expect(ids).toContain('builtin:bash');
    expect(ids).toContain('builtin:bash_output');
    expect(ids).toContain('builtin:bash_kill');
  });

  it('should get a specific tool by ID', () => {
    const tool = getBuiltinTool('builtin:read');
    expect(tool).toBeDefined();
    expect(tool?.name).toBe('read_file');
  });

  it('should return undefined for non-existent tool', () => {
    const tool = getBuiltinTool('builtin:nonexistent');
    expect(tool).toBeUndefined();
  });

  it('should get all builtin tools', () => {
    const tools = getAllBuiltinTools();
    expect(tools.length).toBe(6);
  });

  it('should identify builtin tool IDs correctly', () => {
    expect(isBuiltinToolId('builtin:read')).toBe(true);
    expect(isBuiltinToolId('builtin:bash')).toBe(true);
    expect(isBuiltinToolId('mcp:server:tool')).toBe(false);
    expect(isBuiltinToolId('skill:name')).toBe(false);
    expect(isBuiltinToolId('invalid')).toBe(false);
  });
});
