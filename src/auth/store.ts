/**
 * @fileoverview API key storage module for managing LLM provider credentials.
 * Credentials are stored in ~/.nano-agent/data/auth.json, shared globally.
 */

import * as fs from 'node:fs';
import { getModels } from '@mariozechner/pi-ai';
import { getAuthPath } from '../util/paths.js';
import type { Auth, AuthStore, Provider, KnownProvider } from './types.js';

/** Provider status information */
export interface ProviderStatus {
  id: Provider;
  name: string;
  models: string[];
  hasAuth: boolean;
}

/** Supported providers whitelist */
const SUPPORTED_PROVIDERS: KnownProvider[] = [
  'anthropic',
  'google',
  'openai',
  'xai',
  'groq',
  'openrouter',
  'zai',
  'minimax',
  'minimax-cn',
  'opencode',
  'opencode-go',
  'kimi-coding',
];

/** Mapping of provider IDs to display names */
const PROVIDER_NAMES: Record<string, string> = {
  anthropic: 'Anthropic',
  google: 'Google',
  openai: 'OpenAI',
  xai: 'xAI',
  groq: 'Groq',
  openrouter: 'OpenRouter',
  zai: 'ZAI',
  minimax: 'MiniMax',
  'minimax-cn': 'MiniMax-CN',
  opencode: 'OpenCode',
  'opencode-go': 'OpenCode Go',
  'kimi-coding': 'Kimi Coding',
};

/** Read auth store from file */
function readAuthStore(): AuthStore {
  const filePath = getAuthPath();
  if (!fs.existsSync(filePath)) {
    return {};
  }
  const content = fs.readFileSync(filePath, 'utf8');
  if (!content.trim()) {
    return {};
  }
  return JSON.parse(content) as AuthStore;
}

/** Write auth store to file */
function writeAuthStore(store: AuthStore): void {
  fs.writeFileSync(getAuthPath(), JSON.stringify(store, null, 2));
}

/**
 * Set or update auth info for a provider, immediately persists to disk.
 * @param provider - Provider identifier
 * @param auth - Auth object containing apiKey
 */
export function setAuth(provider: Provider, auth: Auth): Auth {
  const store = readAuthStore();
  store[provider] = auth;
  writeAuthStore(store);
  return auth;
}

/**
 * Delete auth info for a provider.
 * @throws Error if auth info doesn't exist
 */
export function deleteAuth(provider: Provider): void {
  const store = readAuthStore();
  if (!store[provider]) {
    throw new Error(`Auth not found for provider: ${provider}`);
  }
  delete store[provider];
  writeAuthStore(store);
}

/** Get auth info for a provider, returns undefined if not found */
export function getAuth(provider: Provider): Auth | undefined {
  return readAuthStore()[provider];
}

/** List all providers with their auth status and available models */
export function listProvidersWithAuth(): ProviderStatus[] {
  const store = readAuthStore();
  return SUPPORTED_PROVIDERS.map((p) => {
    const models = getModels(p);
    const hasAuthFlag = !!store[p];
    return {
      id: p,
      name: PROVIDER_NAMES[p] || p,
      models: models.map((m) => m.id),
      hasAuth: hasAuthFlag,
    };
  });
}

/** Check if a provider has auth info configured */
export function hasAuth(provider: Provider): boolean {
  return !!readAuthStore()[provider];
}
