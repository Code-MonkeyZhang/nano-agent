import * as fs from 'node:fs';
import * as path from 'node:path';
import { getProviders } from '@mariozechner/pi-ai';
import type {
  Provider,
  ProviderCredential,
  CredentialsStore,
} from './types.js';

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
  provider: Provider;
  hasCredential: boolean;
  apiKey?: string;
}

export function listProvidersWithCredential(): ProviderStatus[] {
  const allProviders = getProviders();
  return allProviders.map((p) => ({
    provider: p,
    hasCredential: !!credentials[p],
    apiKey: credentials[p]?.apiKey
      ? maskApiKey(credentials[p].apiKey)
      : undefined,
  }));
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
