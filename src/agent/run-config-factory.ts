/**
 * @fileoverview Factory for creating Agent runtime configuration.
 *
 * Assembles AgentRunConfig from AgentConfig and Session information.
 */

import { getModel, type KnownProvider } from '@mariozechner/pi-ai';
import { getAuth } from '../auth/index.js';
import { getSkills } from '../skill/index.js';
import type { Skill } from '../skill/index.js';
import { getMcpToolsForServers, getMcpPromptInfo } from '../mcp/index.js';
import {
  ReadTool,
  WriteTool,
  EditTool,
  BashTool,
  BashOutputTool,
  BashKillTool,
} from '../tools/index.js';
import type { AgentConfig, AgentRunConfig } from './types.js';
import type { Session } from '../session/types.js';

/**
 * Build a system prompt with environment context, skills, and MCP server info.
 *
 * Output format:
 * ```
 * {basePrompt}
 *
 * ## Environment
 *
 * - Platform: {darwin|linux|win32}
 * - Date: {YYYY-MM-DD}
 * - Model: {provider}/{modelId}
 * - Working directory: {workspaceDir}
 *
 * ## Available Skills
 *
 * ### {skillName1}
 * {skillContent1}
 * ```
 *
 * @param basePrompt - Base system prompt from agent configuration
 * @param workspaceDir - Current working directory path
 * @param provider - LLM provider name (e.g. 'openai', 'anthropic')
 * @param modelId - Model identifier string
 * @param skills - Available skills array, optional
 * @param mcpNames - MCP server names for status display, optional
 * @returns Complete system prompt with environment context and skills
 */
function buildSystemPrompt(
  basePrompt: string,
  workspaceDir: string,
  provider: string,
  modelId: string,
  skills?: Skill[],
  mcpNames?: string[]
): string {
  const platform = process.platform;
  const date = new Date().toISOString().split('T')[0];

  let prompt = `${basePrompt}

## Environment

- Platform: ${platform}
- Date: ${date}
- Model: ${provider}/${modelId}
- Working directory: ${workspaceDir}`;

  if (skills && skills.length > 0) {
    prompt += `

## Available Skills`;

    for (const skill of skills) {
      prompt += `

### ${skill.name}

${skill.content}`;
    }
  }

  if (mcpNames && mcpNames.length > 0) {
    const mcpInfo = getMcpPromptInfo(mcpNames);
    prompt += `

## MCP Servers`;

    for (const { name, status } of mcpInfo) {
      prompt += `
- ${name}: ${status}`;
    }
  }

  return prompt;
}

/**
 * 从AgentConfig和Session创建Agent运行时配置。
 *
 * @param agentConfig - 静态Agent配置（名称、提示、最大步数等）
 * @param session - 包含模型配置和工作区路径的Session
 * @param workspaceDir - 文件操作的目录路径
 * @returns 完整的AgentRunConfig，可用于实例化AgentCore
 * @throws 如果提供商未配置API密钥则抛出Error
 * @throws 如果模型未知则抛出Error
 */
export function createAgentRunConfig(
  agentConfig: AgentConfig,
  session: Session,
  workspaceDir: string
): AgentRunConfig {
  const modelConfig = session.model;
  const provider = modelConfig.provider as KnownProvider;
  const modelId = modelConfig.model;

  const auth = getAuth(provider);
  if (!auth) {
    throw new Error(`No API key configured for provider: ${provider}`);
  }

  const model = getModel(provider, modelId as Parameters<typeof getModel>[1]);
  if (!model) {
    throw new Error(`Unknown model: ${provider}/${modelId}`);
  }

  // Load available skills from the pool, skipping unavailable ones
  const skills = agentConfig.skillNames?.length
    ? getSkills(agentConfig.skillNames)
    : [];

  const systemPrompt = buildSystemPrompt(
    agentConfig.systemPrompt,
    workspaceDir,
    provider,
    modelId,
    skills,
    agentConfig.mcpNames
  );

  const mcpTools = agentConfig.mcpNames?.length
    ? getMcpToolsForServers(agentConfig.mcpNames)
    : [];

  const tools = [
    new ReadTool(workspaceDir),
    new WriteTool(workspaceDir),
    new EditTool(workspaceDir),
    new BashTool(),
    new BashOutputTool(),
    new BashKillTool(),
    ...mcpTools,
  ];

  return {
    agentName: agentConfig.name,
    provider,
    modelId,
    model,
    apiKey: auth.apiKey,
    systemPrompt,
    workspaceDir,
    maxSteps: agentConfig.maxSteps,
    tools,
  };
}
