/**
 * @fileoverview Factory for creating Agent runtime config.
 *
 * Assembles AgentRunConfig from AgentConfig and Session information.
 */

import { getModel, type KnownProvider } from '@mariozechner/pi-ai';
import { getAuth } from '../auth/index.js';
import type { AgentConfig, AgentRunConfig } from './types.js';
import type { Session } from '../session/types.js';

/**
 * Build system prompt with environment context.
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
 * ```
 */
function buildSystemPrompt(
  basePrompt: string,
  workspaceDir: string,
  provider: string,
  modelId: string
): string {
  const platform = process.platform;
  const date = new Date().toISOString().split('T')[0];

  return `${basePrompt}

## Environment

- Platform: ${platform}
- Date: ${date}
- Model: ${provider}/${modelId}
- Working directory: ${workspaceDir}`;
}

/**
 * Create Agent runtime config from AgentConfig and Session.
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

  const systemPrompt = buildSystemPrompt(
    agentConfig.systemPrompt,
    workspaceDir,
    provider,
    modelId
  );

  return {
    agentName: agentConfig.name,
    provider,
    modelId,
    model,
    apiKey: auth.apiKey,
    systemPrompt,
    workspaceDir,
    maxSteps: agentConfig.maxSteps,
  };
}
