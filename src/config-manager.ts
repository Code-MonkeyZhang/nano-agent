/**
 * Configuration Manager
 *
 * Manages the agent configuration lifecycle including loading, caching, and saving.
 * Implements the Singleton pattern to ensure consistent configuration state across the application.
 */

import * as fs from 'node:fs';
import * as yaml from 'yaml';
import { Config } from './config.js';
import { z } from 'zod';

const RetrySchema = z.object({
  enabled: z.boolean(),
  maxRetries: z.number(),
});

const MCPSchema = z.object({
  connectTimeout: z.number(),
  executeTimeout: z.number(),
  sseReadTimeout: z.number(),
});

const ToolsSchema = z.object({
  skillsDir: z.string(),
  mcpConfigPath: z.string(),
  mcp: MCPSchema,
});

const ConfigSchema = z.object({
  enableLogging: z.boolean().optional().default(false),
  retry: RetrySchema.optional().default({ enabled: true, maxRetries: 3 }),
  tools: ToolsSchema.optional().default({
    skillsDir: './skills',
    mcpConfigPath: 'mcp.json',
    mcp: { connectTimeout: 10, executeTimeout: 60, sseReadTimeout: 120 },
  }),
});

export type AgentConfig = z.infer<typeof ConfigSchema>;

/**
 * ConfigManager
 * This class provides a centralized way to load, cache, and save configuration.
 */
export class ConfigManager {
  private static instance: ConfigManager | null = null;
  private configPath: string | null = null;
  private config: AgentConfig | null = null;

  private constructor() {}

  /**
   * Gets the singleton instance of ConfigManager
   *
   * @returns {ConfigManager} The singleton instance
   */
  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * Loads the configuration from config.yaml
   *
   * If the configuration is already loaded and cached, returns the cached version.
   * Otherwise, locates the config file, reads it, validates it, and caches it.
   *
   * @returns {AgentConfig} The loaded and validated configuration
   * @throws {Error} If config file is not found, doesn't exist, is empty, or fails validation
   */
  load(): AgentConfig {
    if (this.config) {
      return this.config;
    }

    this.configPath = Config.findConfigFile('config.yaml');

    if (!this.configPath) {
      throw new Error('Configuration file not found');
    }

    if (!fs.existsSync(this.configPath)) {
      throw new Error(`Configuration file does not exist: ${this.configPath}`);
    }

    const content = fs.readFileSync(this.configPath, 'utf8');
    if (!content || !content.trim()) {
      throw new Error('Configuration file is empty');
    }

    const rawData = yaml.parse(content);
    const validatedData = ConfigSchema.parse(rawData);

    this.config = validatedData;
    return this.config;
  }

  /**
   * Saves the configuration to config.yaml
   *
   * Validates the configuration using Zod schema, then writes it to the config file.
   * Uses atomic write operation (write to temp file, then rename) to prevent corruption.
   * Updates the cached configuration on successful save.
   *
   * @param {AgentConfig} config - The configuration object to save
   * @throws {ZodError} If configuration validation fails
   * @throws {Error} If config file path cannot be determined or write operation fails
   */
  save(config: AgentConfig): void {
    const validatedConfig = ConfigSchema.parse(config);

    if (!this.configPath) {
      this.configPath = Config.findConfigFile('config.yaml');
    }

    if (!this.configPath) {
      throw new Error('Configuration file not found');
    }

    const tempPath = `${this.configPath}.tmp`;
    const yamlContent = yaml.stringify(validatedConfig);

    try {
      fs.writeFileSync(tempPath, yamlContent, 'utf8');
      fs.renameSync(tempPath, this.configPath);
      this.config = validatedConfig;
    } catch (error) {
      if (fs.existsSync(tempPath)) {
        try {
          fs.unlinkSync(tempPath);
        } catch (cleanupError) {
          console.error('Failed to cleanup temp file:', cleanupError);
        }
      }
      throw error;
    }
  }

  /**
   * Gets the path to the configuration file
   *
   * @returns {string | null} The absolute path to config.yaml, or null if not yet determined
   */
  getConfigPath(): string | null {
    return this.configPath;
  }

  /**
   * Clears the cached configuration
   *
   * Forces the next load() call to read from the file again.
   * Useful when the configuration file has been modified externally.
   */
  clearCache(): void {
    this.config = null;
  }
}
