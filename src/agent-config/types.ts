import type { CredentialId } from '../credential/index.js';

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
  systemPrompt: string;
  credentialId: CredentialId | null;
  model: string;
  maxSteps: number;
  mcpIds: string[];
  skillIds: string[];
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

/**
 * Default agent definitions for Adam and Eve.
 * Used when creating default agents on first startup.
 */
export const DEFAULT_AGENTS: Array<
  Omit<AgentConfig, 'credentialId'> & { credentialId: null }
> = [
  {
    id: 'adam',
    name: 'Adam',
    systemPrompt:
      "You are Adam, a task and project management assistant. Your primary focus is helping users organize their tasks, manage projects, and keep track of notes. You have access to TickTick for task management and Notion for note-taking. Be proactive in suggesting task organization strategies and helping users stay productive. Always ask clarifying questions to better understand the user's needs before creating or modifying tasks.",
    credentialId: null,
    model: 'gpt-4o',
    maxSteps: 10,
    mcpIds: ['ticktick', 'notion'],
    skillIds: [],
  },
  {
    id: 'eve',
    name: 'Eve',
    systemPrompt:
      'You are Eve, a lifestyle and entertainment assistant. Your primary focus is helping users discover and manage music, entertainment, and leisure activities. You have access to NetEase Cloud Music for music-related tasks. Be friendly, relaxed, and engaging. Help users find the right music for their mood, discover new artists, and create playlists. Keep conversations light and enjoyable.',
    credentialId: null,
    model: 'gpt-4o',
    maxSteps: 10,
    mcpIds: ['netease-openapi-mcp'],
    skillIds: [],
  },
];
