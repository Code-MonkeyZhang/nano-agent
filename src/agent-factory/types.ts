import type { Tool } from '../tools/base.js';
import type { SkillEntry } from '../skill-pool/types.js';
import type { RetryConfig } from '../config.js';
import type { Model, Api } from '@mariozechner/pi-ai';

/**
 * Configuration needed to run an agent.
 * Contains all runtime parameters assembled from agent config and credential.
 *
 * System prompt is built inside AgentCore from baseSystemPrompt + skills + workspace.
 */
export interface AgentRunConfig {
  agentName: string;
  provider: string;
  modelId: string;
  model: Model<Api>;
  apiKey: string;
  baseSystemPrompt: string;
  skills: SkillEntry[];
  mcpServerNames: string[];
  maxSteps: number;
  tools: Tool[];
  retry: RetryConfig;
}

/**
 * Cached agent instance with its configuration.
 */
export interface CachedAgent {
  config: AgentRunConfig;
  agentCore: unknown;
}
