/**
 * Server configuration module
 *
 * Provides configuration loading for server-level settings.
 * Agent and credential configurations are handled separately.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'yaml';
import { z } from 'zod';
import { getConfigDir } from './paths.js';

const DEFAULTS = {
  LOGGING: {
    enableLogging: false,
  },
  RETRY: {
    enabled: true,
    maxRetries: 3,
  },
  TOOLS: {
    skillsDir: './skills',
    mcpConfigPath: 'mcp.json',
  },
  MCP: {
    connectTimeout: 10.0,
    executeTimeout: 60.0,
    sseReadTimeout: 120.0,
  },
};

const RetrySchema = z.object({
  enabled: z.boolean().default(DEFAULTS.RETRY.enabled),
  maxRetries: z.number().default(DEFAULTS.RETRY.maxRetries),
});

const MCPSchema = z.object({
  connectTimeout: z.number().default(DEFAULTS.MCP.connectTimeout),
  executeTimeout: z.number().default(DEFAULTS.MCP.executeTimeout),
  sseReadTimeout: z.number().default(DEFAULTS.MCP.sseReadTimeout),
});

const ToolsSchema = z.object({
  skillsDir: z.string().default(DEFAULTS.TOOLS.skillsDir),
  mcpConfigPath: z.string().default(DEFAULTS.TOOLS.mcpConfigPath),
  mcp: MCPSchema,
});

const ConfigSchema = z.object({
  enableLogging: z.boolean().default(DEFAULTS.LOGGING.enableLogging),
  retry: RetrySchema,
  tools: ToolsSchema,
});

export type RetryConfig = z.infer<typeof RetrySchema>;
export type MCPTimeoutConfig = z.infer<typeof MCPSchema>;
export type ToolsConfig = z.infer<typeof ToolsSchema>;

export class Config {
  enableLogging: boolean;
  retry: RetryConfig;
  tools: ToolsConfig;

  constructor(data: z.infer<typeof ConfigSchema>) {
    this.enableLogging = data.enableLogging;
    this.retry = data.retry;
    this.tools = data.tools;
  }

  static fromYaml(configPath: string): Config {
    if (!fs.existsSync(configPath)) {
      throw new Error(`Configuration file does not exist: ${configPath}`);
    }

    const content = fs.readFileSync(configPath, 'utf8');
    if (!content || !content.trim()) {
      throw new Error('Configuration file is empty');
    }

    const rawData = yaml.parse(content);
    const parsedData = ConfigSchema.parse(rawData);

    return new Config(parsedData);
  }

  static findConfigFile(filename: string): string | null {
    const configDir = getConfigDir();
    const configPath = path.join(configDir, filename);
    if (fs.existsSync(configPath)) {
      return configPath;
    }

    return null;
  }
}
