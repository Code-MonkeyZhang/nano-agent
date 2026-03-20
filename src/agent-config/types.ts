import type { Provider } from '../credential/index.js';

export type { SkillId } from '../skill-pool/index.js';

/**
 * Agent identifier (simple string ID like "adam", "eve", or UUID)
 */
export type AgentId = string;

/**
 * Full agent configuration stored in the system.
 * Each agent is saved as a separate JSON file in data/agents/
 */
export interface AgentConfig {
  id: AgentId;
  name: string;
  description?: string;
  systemPrompt: string;
  provider: Provider;
  modelId: string;
  maxSteps: number;
  mcpIds: string[];
  skillIds: string[];
  defaultWorkspacePath?: string;
  /** Avatar identifier: "avatar.png" for uploaded, "preset:avatar_X" for preset */
  avatar?: string;
}

/**
 * Data required to create a new agent config.
 */
export type CreateAgentConfigInput = Omit<AgentConfig, 'id'> & {
  id?: AgentId;
};

/**
 * Data for updating an existing agent config.
 */
export type UpdateAgentConfigInput = Partial<Omit<AgentConfig, 'id'>>;
