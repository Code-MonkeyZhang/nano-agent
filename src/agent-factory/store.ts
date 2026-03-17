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
  workspaceDir?: string,
  overrideModelId?: string
): Promise<AgentCore> {
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

  const modelIdToUse = overrideModelId ?? agentConfig.modelId;
  const model = getModel(
    agentConfig.provider,
    modelIdToUse as Parameters<typeof getModel>[1]
  );

  if (!model) {
    throw new Error(`Model not found: ${agentConfig.provider}/${modelIdToUse}`);
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

  Logger.log('AGENT-FACTORY', `Agent '${agentId}' created`);

  return agentCore;
}
