/**
 * @fileoverview 创建Agent运行时配置的工厂。
 *
 * 从AgentConfig和Session信息组装AgentRunConfig。
 */

import { getModel, type KnownProvider } from '@mariozechner/pi-ai';
import { getAuth } from '../auth/index.js';
import { getSkills } from '../skill/index.js';
import type { Skill } from '../skill/index.js';
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
 * 构建带有环境上下文和技能的系统提示。
 *
 * 输出格式：
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
 *
 * ### {skillName2}
 * {skillContent2}
 * ```
 *
 * @param basePrompt - Agent配置中的基础系统提示
 * @param workspaceDir - 当前工作目录路径
 * @param provider - LLM提供商名称（如 'openai', 'anthropic'）
 * @param modelId - 模型标识符字符串
 * @param skills - 可用的技能数组，可选
 * @returns 附加了环境上下文和技能的完整系统提示
 */
function buildSystemPrompt(
  basePrompt: string,
  workspaceDir: string,
  provider: string,
  modelId: string,
  skills?: Skill[]
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
    skills
  );

  // 添加内置工具到上下文中
  // TODO: 以后MCP是不是也放在这里?
  const tools = [
    new ReadTool(workspaceDir),
    new WriteTool(workspaceDir),
    new EditTool(workspaceDir),
    new BashTool(),
    new BashOutputTool(),
    new BashKillTool(),
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
