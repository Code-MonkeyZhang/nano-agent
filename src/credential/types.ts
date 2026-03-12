/**
 * Supported LLM API providers.
 * - openai: OpenAI-compatible API (e.g., OpenAI, DeepSeek)
 * - anthropic: Anthropic-compatible API (e.g., Anthropic, MiniMax, ZhipuAI)
 */
export type Provider = 'openai' | 'anthropic';

/**
 * Credential identifier (UUID format)
 */
export type CredentialId = string;

/**
 * Full credential data stored in the pool.
 */
export interface Credential {
  id: CredentialId;
  name: string;
  provider: Provider;
  apiBase: string;
  apiKey: string;
}

/**
 * Data required to create a new credential.
 */
export type CreateCredentialInput = Omit<Credential, 'id'>;

/**
 * Data for updating an existing credential.
 */
export type UpdateCredentialInput = Partial<Omit<Credential, 'id'>>;
