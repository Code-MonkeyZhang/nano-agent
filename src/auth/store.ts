/**
 * @fileoverview API key storage module for managing LLM provider credentials.
 * Credentials are stored in ~/.nano-agent/data/auth.json, shared globally.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { getModels } from '@mariozechner/pi-ai';
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

let authStore: AuthStore = {} as AuthStore;
let dataFilePath: string | null = null;

/** Ensure the data directory exists */
function ensureDataDir(): void {
  if (!dataFilePath) return;
  const dir = path.dirname(dataFilePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/** Load auth info from file into memory */
function loadFromFile(): void {
  if (!dataFilePath || !fs.existsSync(dataFilePath)) {
    return;
  }

  const content = fs.readFileSync(dataFilePath, 'utf8');
  if (!content.trim()) {
    return;
  }

  const data = JSON.parse(content) as AuthStore;
  authStore = data;
}

/** Save auth info from memory to file */
function saveAuthToFile(): void {
  if (!dataFilePath) {
    throw new Error('AuthPool not initialized. Call initAuthPool() first.');
  }

  ensureDataDir();
  fs.writeFileSync(dataFilePath, JSON.stringify(authStore, null, 2));
}

/**
 * Initialize the auth pool. Must be called before using other functions.
 * @param filePath - Absolute path to the auth.json file
 */
export function initAuthPool(filePath: string): void {
  dataFilePath = filePath;
  authStore = {} as AuthStore;
  loadFromFile();
}

/**
 * Set or update auth info for a provider, immediately persists to disk.
 * @param provider - Provider identifier
 * @param auth - Auth object containing apiKey
 */
export function setAuth(provider: Provider, auth: Auth): Auth {
  authStore[provider] = auth;
  saveAuthToFile();
  return auth;
}

/**
 * Delete auth info for a provider.
 * @throws Error if auth info doesn't exist
 */
export function deleteAuth(provider: Provider): void {
  if (!authStore[provider]) {
    throw new Error(`Auth not found for provider: ${provider}`);
  }
  delete authStore[provider];
  saveAuthToFile();
}

/** Get auth info for a provider, returns undefined if not found */
export function getAuth(provider: Provider): Auth | undefined {
  return authStore[provider];
}

/** List all providers with their auth status and available models */
export function listProvidersWithAuth(): ProviderStatus[] {
  return SUPPORTED_PROVIDERS.map((p) => {
    const models = getModels(p);
    const hasAuthFlag = !!authStore[p];
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
  return !!authStore[provider];
}
