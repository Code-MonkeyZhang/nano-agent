import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import type {
  AgentConfig,
  AgentId,
  CreateAgentConfigInput,
  UpdateAgentConfigInput,
} from './types.js';
import { DEFAULT_AGENTS } from './types.js';

let agentConfigs: Map<AgentId, AgentConfig> = new Map();
let agentsDir: string | null = null;

function generateId(): AgentId {
  return randomUUID();
}

function ensureDataDir(): void {
  if (!agentsDir) return;
  if (!fs.existsSync(agentsDir)) {
    fs.mkdirSync(agentsDir, { recursive: true });
  }
}

function getAgentFilePath(id: AgentId): string {
  if (!agentsDir) {
    throw new Error(
      'AgentConfigStore not initialized. Call initAgentConfigStore() first.'
    );
  }
  return path.join(agentsDir, `${id}.json`);
}

function loadAgentFromFile(id: AgentId): AgentConfig | undefined {
  const filePath = getAgentFilePath(id);
  if (!fs.existsSync(filePath)) {
    return undefined;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(content) as AgentConfig;
}

function saveAgentToFile(config: AgentConfig): void {
  ensureDataDir();
  const filePath = getAgentFilePath(config.id);
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
}

function deleteAgentFile(id: AgentId): void {
  const filePath = getAgentFilePath(id);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

function loadAllFromDirectory(): void {
  if (!agentsDir || !fs.existsSync(agentsDir)) {
    return;
  }

  const files = fs.readdirSync(agentsDir);
  for (const file of files) {
    if (file.endsWith('.json')) {
      const filePath = path.join(agentsDir, file);
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const config = JSON.parse(content) as AgentConfig;
        agentConfigs.set(config.id, config);
      } catch {
        // Skip invalid files
      }
    }
  }
}

/**
 * Create default agents (Adam and Eve) if no agents exist.
 */
function createDefaultAgentsIfNeeded(): void {
  if (agentConfigs.size === 0) {
    for (const defaultConfig of DEFAULT_AGENTS) {
      const config: AgentConfig = { ...defaultConfig };
      agentConfigs.set(config.id, config);
      saveAgentToFile(config);
    }
  }
}

/**
 * Initialize the agent config store from a directory.
 * Each agent config is stored as a separate JSON file.
 * If no agents exist, creates default Adam and Eve agents.
 */
export function initAgentConfigStore(directory: string): void {
  agentsDir = directory;
  agentConfigs = new Map();
  loadAllFromDirectory();
  createDefaultAgentsIfNeeded();
}

/**
 * Create a new agent config and persist it.
 */
export function createAgentConfig(input: CreateAgentConfigInput): AgentConfig {
  const id = input.id ?? generateId();

  if (agentConfigs.has(id)) {
    throw new Error(`Agent already exists: ${id}`);
  }

  const config: AgentConfig = { ...input, id };
  agentConfigs.set(id, config);
  saveAgentToFile(config);
  return config;
}

/**
 * Update an existing agent config.
 */
export function updateAgentConfig(
  id: AgentId,
  input: UpdateAgentConfigInput
): AgentConfig {
  const existing = agentConfigs.get(id);
  if (!existing) {
    throw new Error(`Agent not found: ${id}`);
  }

  const updated: AgentConfig = { ...existing, ...input, id };
  agentConfigs.set(id, updated);
  saveAgentToFile(updated);
  return updated;
}

/**
 * Delete an agent config by ID.
 */
export function deleteAgentConfig(id: AgentId): void {
  if (!agentConfigs.has(id)) {
    throw new Error(`Agent not found: ${id}`);
  }
  agentConfigs.delete(id);
  deleteAgentFile(id);
}

/**
 * Get an agent config by ID.
 */
export function getAgentConfig(id: AgentId): AgentConfig | undefined {
  return agentConfigs.get(id);
}

/**
 * List all agent configs.
 */
export function listAgentConfigs(): AgentConfig[] {
  return Array.from(agentConfigs.values());
}

/**
 * Check if an agent exists.
 */
export function hasAgentConfig(id: AgentId): boolean {
  return agentConfigs.has(id);
}

/**
 * Reload an agent config from file (useful for external changes).
 */
export function reloadAgentConfig(id: AgentId): AgentConfig | undefined {
  const config = loadAgentFromFile(id);
  if (config) {
    agentConfigs.set(id, config);
  } else {
    agentConfigs.delete(id);
  }
  return config;
}
