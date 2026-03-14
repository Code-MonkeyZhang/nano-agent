import * as fs from 'node:fs';
import * as path from 'node:path';
import { getProviders, getModels } from '@mariozechner/pi-ai';
import type {
  Provider,
  ProviderCredential,
  CredentialsStore,
} from './types.js';

const PROVIDER_NAMES: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  'google-gemini-cli': 'Google Gemini CLI',
  'google-antigravity': 'Google Antigravity',
  'google-vertex': 'Google Vertex',
  'azure-openai-responses': 'Azure OpenAI',
  'openai-codex': 'OpenAI Codex',
  'github-copilot': 'GitHub Copilot',
  xai: 'xAI',
  groq: 'Groq',
  cerebras: 'Cerebras',
  openrouter: 'OpenRouter',
  'vercel-ai-gateway': 'Vercel AI Gateway',
  zai: 'ZAI',
  mistral: 'Mistral',
  minimax: 'MiniMax',
  'minimax-cn': 'MiniMax',
  huggingface: 'Hugging Face',
  opencode: 'OpenCode',
  'opencode-go': 'OpenCode Go',
  'kimi-coding': 'Kimi Coding',
  deepseek: 'DeepSeek',
  zhipu: '智谱 AI',
  moonshot: '月之暗面',
  alibaba: '阿里云',
};

let credentials: CredentialsStore = {} as CredentialsStore;
let dataFilePath: string | null = null;

function ensureDataDir(): void {
  if (!dataFilePath) return;
  const dir = path.dirname(dataFilePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadFromFile(): void {
  if (!dataFilePath || !fs.existsSync(dataFilePath)) {
    return;
  }

  const content = fs.readFileSync(dataFilePath, 'utf8');
  if (!content.trim()) {
    return;
  }

  const data = JSON.parse(content) as CredentialsStore;
  credentials = data;
}

function saveToFile(): void {
  if (!dataFilePath) {
    throw new Error(
      'CredentialPool not initialized. Call initCredentialPool() first.'
    );
  }

  ensureDataDir();
  fs.writeFileSync(dataFilePath, JSON.stringify(credentials, null, 2));
}

export function initCredentialPool(filePath: string): void {
  dataFilePath = filePath;
  credentials = {} as CredentialsStore;
  loadFromFile();
}

export function setCredential(
  provider: Provider,
  credential: ProviderCredential
): ProviderCredential {
  credentials[provider] = credential;
  saveToFile();
  return credential;
}

export function deleteCredential(provider: Provider): void {
  if (!credentials[provider]) {
    throw new Error(`Credential not found for provider: ${provider}`);
  }
  delete credentials[provider];
  saveToFile();
}

export function getCredential(
  provider: Provider
): ProviderCredential | undefined {
  return credentials[provider];
}

export interface ProviderStatus {
  id: string;
  name: string;
  apiKey?: string;
  models: string[];
  hasCredential: boolean;
}

export function listProvidersWithCredential(): ProviderStatus[] {
  const allProviders = getProviders();
  return allProviders.map((p) => {
    const models = getModels(p);
    const hasCred = !!credentials[p];
    return {
      id: p,
      name: PROVIDER_NAMES[p] || p,
      apiKey: credentials[p]?.apiKey,
      models: models.map((m) => m.id),
      hasCredential: hasCred,
    };
  });
}

export function hasCredential(provider: Provider): boolean {
  return !!credentials[provider];
}

export function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 10) {
    return '***';
  }
  const start = apiKey.slice(0, 7);
  const end = apiKey.slice(-3);
  return `${start}***${end}`;
}
