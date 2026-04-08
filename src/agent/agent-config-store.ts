/**
 * @fileoverview Agent config storage module.
 *
 * Provides CRUD operations for agent configurations:
 * - Create: createAgentConfig()
 * - Read: getAgentConfig(), listAgentConfigs(), hasAgentConfig()
 * - Update: updateAgentConfig()
 * - Delete: deleteAgentConfig()
 *
 * Each agent is stored in its own directory:
 * agents/{agentId}/
 * ├── config.json
 * ├── assets/
 * │   ├── pose/
 * │   └── backgrounds/
 * ├── sessions/
 * └── memory/
 */

import * as fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import {
  getAgentsDir,
  getAgentDir,
  getAgentConfigPath,
  getAgentAssetsDir,
  getAgentAssetsPoseDir,
  getAgentAssetsBackgroundsDir,
  getAgentSessionsDir,
  getAgentMemoryDir,
} from '../util/paths.js';
import {
  AgentConfigSchema,
  type AgentConfig,
  type AgentConfigInput,
} from './types.js';

/** Atomic write to prevent data corruption */
function writeJsonAtomic(filePath: string, data: unknown): void {
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2));
  fs.renameSync(tmpPath, filePath);
}

/** Check if an agent exists */
export function hasAgentConfig(id: string): boolean {
  return fs.existsSync(getAgentConfigPath(id));
}

/**
 * Get a single agent config by ID.
 * @param id - The unique identifier of the agent.
 * @returns The agent config object, or undefined if not found or invalid.
 */
export function getAgentConfig(id: string): AgentConfig | undefined {
  const configPath = getAgentConfigPath(id);
  if (!fs.existsSync(configPath)) {
    return undefined;
  }
  const content = fs.readFileSync(configPath, 'utf8');
  const parsed = JSON.parse(content);
  const result = AgentConfigSchema.safeParse(parsed);
  return result.success ? result.data : undefined;
}

/**
 * List all agent configs.
 * @returns An array of all agent config objects.
 */
export function listAgentConfigs(): AgentConfig[] {
  const agentsDir = getAgentsDir();
  if (!fs.existsSync(agentsDir)) {
    return [];
  }
  const agents: AgentConfig[] = [];
  const entries = fs.readdirSync(agentsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const config = getAgentConfig(entry.name);
    if (config) {
      agents.push(config);
    }
  }

  return agents;
}

/**
 * Create a new agent config.
 * assets/, assets/pose/, assets/backgrounds/, sessions/, memory/
 *
 * @param input - Agent configuration input
 * @returns Created agent configuration
 */
export function createAgentConfig(input: AgentConfigInput): AgentConfig {
  const id = randomUUID();
  const now = Date.now();

  const config: AgentConfig = {
    ...input,
    id,
    createdAt: now,
    updatedAt: now,
  };

  const agentDir = getAgentDir(id);
  if (!fs.existsSync(agentDir)) {
    fs.mkdirSync(agentDir, { recursive: true });
  }

  fs.mkdirSync(getAgentAssetsDir(id), { recursive: true });
  fs.mkdirSync(getAgentAssetsPoseDir(id), { recursive: true });
  fs.mkdirSync(getAgentAssetsBackgroundsDir(id), { recursive: true });
  fs.mkdirSync(getAgentSessionsDir(id), { recursive: true });
  fs.mkdirSync(getAgentMemoryDir(id), { recursive: true });

  writeJsonAtomic(getAgentConfigPath(id), config);
  return config;
}

/** Update an existing agent */
export function updateAgentConfig(
  id: string,
  input: AgentConfigInput
): AgentConfig {
  const existing = getAgentConfig(id);
  if (!existing) {
    throw new Error(`Agent not found: ${id}`);
  }

  const updated: AgentConfig = {
    ...existing,
    ...input,
    id,
    createdAt: existing.createdAt,
    updatedAt: Date.now(),
  };

  writeJsonAtomic(getAgentConfigPath(id), updated);
  return updated;
}

/** Delete an agent and all its data */
export function deleteAgentConfig(id: string): void {
  const agentDir = getAgentDir(id);
  if (fs.existsSync(agentDir)) {
    fs.rmSync(agentDir, { recursive: true });
  }
}
