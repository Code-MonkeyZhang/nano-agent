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

/**
 * 生成默认配置的 YAML 字符串，用于首次创建配置文件。
 */
export function getDefaultConfigYaml(): string {
  return yaml.stringify(DEFAULT_CONFIG);
}

/**
 * 从 YAML 文件加载服务器配置。
 * @param configPath - 配置文件路径，默认为 ~/.nano-agent/config/config.yaml
 * @throws 配置文件不存在、为空或格式错误时抛出异常
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
