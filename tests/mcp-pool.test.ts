import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  initMcpPool,
  listMcpServers,
  getMcpServer,
  parseMcpToolId,
  isMcpToolId,
  cleanupMcpPool,
} from '../src/mcp-pool/index.js';

const TEST_CONFIG_DIR = '/tmp/mcp-pool-test';
const TEST_CONFIG_PATH = path.join(TEST_CONFIG_DIR, 'mcp.json');

function createTestConfig(): void {
  if (!fs.existsSync(TEST_CONFIG_DIR)) {
    fs.mkdirSync(TEST_CONFIG_DIR, { recursive: true });
  }

  const config = {
    mcpServers: {
      'test-server': {
        command: '/usr/bin/test-command',
        args: ['--arg1', '--arg2'],
        env: {
          TEST_VAR: 'test-value',
        },
      },
      'disabled-server': {
        command: '/usr/bin/disabled',
        disabled: true,
      },
      'another-server': {
        url: 'https://example.com/mcp',
        type: 'sse',
      },
    },
  };

  fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config, null, 2));
}

function cleanupTestConfig(): void {
  if (fs.existsSync(TEST_CONFIG_DIR)) {
    fs.rmSync(TEST_CONFIG_DIR, { recursive: true, force: true });
  }
}

describe('McpPool', () => {
  beforeEach(async () => {
    createTestConfig();
    await initMcpPool(TEST_CONFIG_PATH);
  });

  afterEach(async () => {
    await cleanupMcpPool();
    cleanupTestConfig();
  });

  it('should load MCP server configs from file', async () => {
    const servers = listMcpServers();
    expect(servers.length).toBe(2);

    const names = servers.map((s) => s.name);
    expect(names).toContain('test-server');
    expect(names).toContain('another-server');
    expect(names).not.toContain('disabled-server');
  });

  it('should not include disabled servers', async () => {
    const servers = listMcpServers();
    const disabledServer = servers.find((s) => s.name === 'disabled-server');
    expect(disabledServer).toBeUndefined();
  });

  it('should have correct initial status (disconnected)', async () => {
    const servers = listMcpServers();
    for (const server of servers) {
      expect(server.status).toBe('disconnected');
      expect(server.tools).toEqual([]);
    }
  });

  it('should get a specific server by name', () => {
    const server = getMcpServer('test-server');
    expect(server).toBeDefined();
    expect(server?.name).toBe('test-server');
    expect(server?.config.command).toBe('/usr/bin/test-command');
    expect(server?.config.args).toEqual(['--arg1', '--arg2']);
    expect(server?.config.env?.['TEST_VAR']).toBe('test-value');
  });

  it('should return undefined for non-existent server', () => {
    const server = getMcpServer('non-existent');
    expect(server).toBeUndefined();
  });

  it('should handle missing config file gracefully', async () => {
    await cleanupMcpPool();
    cleanupTestConfig();

    await initMcpPool('/non/existent/path/mcp.json');
    const servers = listMcpServers();
    expect(servers).toEqual([]);
  });

  it('should handle empty config gracefully', async () => {
    await cleanupMcpPool();
    fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify({}));

    await initMcpPool(TEST_CONFIG_PATH);
    const servers = listMcpServers();
    expect(servers).toEqual([]);
  });
});

describe('parseMcpToolId', () => {
  it('should parse valid MCP tool IDs', () => {
    expect(parseMcpToolId('mcp:server:tool')).toEqual({
      serverName: 'server',
      toolName: 'tool',
    });

    expect(parseMcpToolId('mcp:ticktick:get_tasks')).toEqual({
      serverName: 'ticktick',
      toolName: 'get_tasks',
    });

    expect(parseMcpToolId('mcp:notion:create_page')).toEqual({
      serverName: 'notion',
      toolName: 'create_page',
    });
  });

  it('should handle tool names with colons', () => {
    expect(parseMcpToolId('mcp:server:tool:with:colons')).toEqual({
      serverName: 'server',
      toolName: 'tool:with:colons',
    });
  });

  it('should return null for invalid IDs', () => {
    expect(parseMcpToolId('builtin:read')).toBeNull();
    expect(parseMcpToolId('skill:name')).toBeNull();
    expect(parseMcpToolId('invalid')).toBeNull();
    expect(parseMcpToolId('mcp:server')).toBeNull();
    expect(parseMcpToolId('')).toBeNull();
  });
});

describe('isMcpToolId', () => {
  it('should return true for MCP tool IDs', () => {
    expect(isMcpToolId('mcp:server:tool')).toBe(true);
    expect(isMcpToolId('mcp:ticktick:get_tasks')).toBe(true);
    expect(isMcpToolId('mcp:a:b')).toBe(true);
  });

  it('should return false for non-MCP tool IDs', () => {
    expect(isMcpToolId('builtin:read')).toBe(false);
    expect(isMcpToolId('skill:name')).toBe(false);
    expect(isMcpToolId('invalid')).toBe(false);
    expect(isMcpToolId('')).toBe(false);
  });
});
