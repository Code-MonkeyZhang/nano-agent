import { Logger } from '../util/logger.js';
import { AgentCore } from '../agent.js';
import { Config } from '../config.js';
import { getAgentConfig } from '../agent-config/store.js';
import { getCredential } from '../credential/store.js';
import { getAllBuiltinTools } from '../builtin-tool-pool/store.js';
import { getMcpToolsForServers } from '../mcp-pool/store.js';
import { getSkill } from '../skill-pool/store.js';
import { getModel } from '@mariozechner/pi-ai';
import type { AgentId } from '../agent-config/types.js';
import type { SkillId } from '../skill-pool/types.js';
import type { AgentRunConfig } from './types.js';

const agentCache = new Map<AgentId, AgentCore>();
let defaultWorkspaceDir = process.cwd();
let globalRetryConfig = Config.fromYaml(
  Config.findConfigFile('config.yaml')!
).retry;

export function setDefaultWorkspaceDir(dir: string): void {
  defaultWorkspaceDir = dir;
}

export function setGlobalRetryConfig(retry: AgentRunConfig['retry']): void {
  globalRetryConfig = retry;
}

/**
 * Collect Skill objects for the given skill IDs.
 */
function collectSkills(skillIds: string[]): AgentRunConfig['skills'] {
  const skills: AgentRunConfig['skills'] = [];

  for (const rawId of skillIds) {
    const skillId = rawId as SkillId;
    const skill = getSkill(skillId);
    if (skill) {
      skills.push(skill);
    } else {
      Logger.log('AGENT-FACTORY', `Skill not found: ${skillId}`);
    }
  }

  return skills;
}

/**
 * Create an AgentCore instance from an agent configuration.
 *
 * The factory collects resources (credential, tools, skills) and assembles
 * AgentRunConfig. System prompt building happens inside AgentCore.
 */
export async function createAgent(
  agentId: AgentId,
  workspaceDir?: string
): Promise<AgentCore> {
  const cached = agentCache.get(agentId);
  if (cached) {
    return cached;
  }

  const agentConfig = getAgentConfig(agentId);
  if (!agentConfig) {
    throw new Error(`Agent not found: ${agentId}`);
  }

  const credential = getCredential(agentConfig.provider);
  if (!credential) {
    throw new Error(
      `No credential found for provider '${agentConfig.provider}'. ` +
        `Please configure your API key in agent settings.`
    );
  }

  const model = getModel(
    agentConfig.provider,
    agentConfig.modelId as Parameters<typeof getModel>[1]
  );

  if (!model) {
    throw new Error(
      `Model not found: ${agentConfig.provider}/${agentConfig.modelId}`
    );
  }

  Logger.log(
    'AGENT-FACTORY',
    `Creating agent '${agentConfig.name}' with model ${model.id} (${model.provider})`
  );

  const builtinTools = getAllBuiltinTools();
  Logger.log('AGENT-FACTORY', `Loaded ${builtinTools.length} builtin tools`);

  const mcpTools = await getMcpToolsForServers(agentConfig.mcpIds);
  Logger.log(
    'AGENT-FACTORY',
    `Loaded ${mcpTools.length} MCP tools from servers: ${agentConfig.mcpIds.join(', ')}`
  );

  const allTools = [...builtinTools, ...mcpTools];

  const skills = collectSkills(agentConfig.skillIds);
  Logger.log('AGENT-FACTORY', `Loaded ${skills.length} skills`);

  const runConfig: AgentRunConfig = {
    agentName: agentConfig.name,
    provider: agentConfig.provider,
    modelId: model.id,
    model: model,
    apiKey: credential.apiKey,
    baseSystemPrompt: agentConfig.systemPrompt,
    skills,
    mcpServerNames: agentConfig.mcpIds,
    maxSteps: agentConfig.maxSteps,
    tools: allTools,
    retry: globalRetryConfig,
  };

  const wsDir = workspaceDir ?? defaultWorkspaceDir;
  const agentCore = new AgentCore(runConfig, wsDir);

  agentCache.set(agentId, agentCore);
  Logger.log('AGENT-FACTORY', `Agent '${agentId}' created and cached`);

  return agentCore;
}

/**
 * Get a cached agent instance without creating a new one.
 */
export function getCachedAgent(agentId: AgentId): AgentCore | undefined {
  return agentCache.get(agentId);
}

/**
 * Clear a specific agent from cache.
 * Call this when agent config is updated.
 */
export function clearAgentCache(agentId: AgentId): void {
  agentCache.delete(agentId);
  Logger.log('AGENT-FACTORY', `Cleared cache for agent '${agentId}'`);
}

/**
 * Clear all cached agents.
 */
export function clearAllAgentCache(): void {
  agentCache.clear();
  Logger.log('AGENT-FACTORY', 'Cleared all agent cache');
}

/**
 * Check if an agent is currently cached.
 */
export function isAgentCached(agentId: AgentId): boolean {
  return agentCache.has(agentId);
}

/**
 * Reload an agent by clearing its cache and recreating.
 * Useful when agent config or credential changes.
 */
export async function reloadAgent(
  agentId: AgentId,
  workspaceDir?: string
): Promise<AgentCore> {
  clearAgentCache(agentId);
  return createAgent(agentId, workspaceDir);
}
