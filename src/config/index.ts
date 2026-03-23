/**
 * @fileoverview Server configuration management.
 */

import * as fs from 'node:fs';
import * as yaml from 'yaml';
import { z } from 'zod';
import { getConfigPath } from '../util/paths.js';

const DEFAULT_CONFIG = {
  enableLogging: false,
  retry: { enabled: true, maxRetries: 3 },
  mcp: { connectTimeout: 10, executeTimeout: 60, sseReadTimeout: 120 },
};

const ConfigSchema = z.object({
  enableLogging: z.boolean().default(DEFAULT_CONFIG.enableLogging),
  retry: z
    .object({
      enabled: z.boolean().default(DEFAULT_CONFIG.retry.enabled),
      maxRetries: z.number().default(DEFAULT_CONFIG.retry.maxRetries),
    })
    .default(DEFAULT_CONFIG.retry),
  mcp: z
    .object({
      connectTimeout: z.number().default(DEFAULT_CONFIG.mcp.connectTimeout),
      executeTimeout: z.number().default(DEFAULT_CONFIG.mcp.executeTimeout),
      sseReadTimeout: z.number().default(DEFAULT_CONFIG.mcp.sseReadTimeout),
    })
    .default(DEFAULT_CONFIG.mcp),
});

export type ServerConfig = z.infer<typeof ConfigSchema>;

/** Generate default config YAML string for first-time creation */
export function getDefaultConfigYaml(): string {
  return yaml.stringify(DEFAULT_CONFIG);
}

/**
 * Load server config from YAML file.
 * @param configPath - Config file path, defaults to ~/.nano-agent/config/config.yaml
 * @throws Error if file doesn't exist, is empty, or has invalid format
 */
export function loadConfig(configPath?: string): ServerConfig {
  const filePath = configPath ?? getConfigPath();

  if (!fs.existsSync(filePath)) {
    throw new Error(`Configuration file does not exist: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  if (!content.trim()) {
    throw new Error('Configuration file is empty');
  }

  return ConfigSchema.parse(yaml.parse(content));
}
