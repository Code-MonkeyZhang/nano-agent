import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import type {
  Credential,
  CredentialId,
  CreateCredentialInput,
  UpdateCredentialInput,
} from './types.js';

let credentials: Map<CredentialId, Credential> = new Map();
let dataFilePath: string | null = null;

function generateId(): CredentialId {
  return randomUUID();
}

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

  const data = JSON.parse(content) as Record<string, Credential>;
  credentials = new Map(Object.entries(data));
}

function saveToFile(): void {
  if (!dataFilePath) {
    throw new Error(
      'CredentialPool not initialized. Call initCredentialPool() first.'
    );
  }

  ensureDataDir();
  const data = Object.fromEntries(credentials);
  fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));
}

/**
 * Initialize the credential pool from a JSON file.
 */
export function initCredentialPool(filePath: string): void {
  dataFilePath = filePath;
  credentials = new Map();
  loadFromFile();
}

/**
 * Create a new credential and persist it.
 */
export function createCredential(input: CreateCredentialInput): Credential {
  const id = generateId();
  const credential: Credential = { ...input, id };
  credentials.set(id, credential);
  saveToFile();
  return credential;
}

/**
 * Update an existing credential.
 */
export function updateCredential(
  id: CredentialId,
  input: UpdateCredentialInput
): Credential {
  const existing = credentials.get(id);
  if (!existing) {
    throw new Error(`Credential not found: ${id}`);
  }

  const updated: Credential = { ...existing, ...input, id };
  credentials.set(id, updated);
  saveToFile();
  return updated;
}

/**
 * Delete a credential by ID.
 */
export function deleteCredential(id: CredentialId): void {
  if (!credentials.has(id)) {
    throw new Error(`Credential not found: ${id}`);
  }
  credentials.delete(id);
  saveToFile();
}

/**
 * Get a credential by ID.
 */
export function getCredential(id: CredentialId): Credential | undefined {
  return credentials.get(id);
}

/**
 * List all credentials.
 */
export function listCredentials(): Credential[] {
  return Array.from(credentials.values());
}

/**
 * Check if a credential exists.
 */
export function hasCredential(id: CredentialId): boolean {
  return credentials.has(id);
}

/**
 * Mask an API key for safe display.
 * Shows first 7 and last 3 characters, with *** in between.
 *
 * @param apiKey - The API key to mask
 * @returns Masked API key (e.g., "sk-abc12***xyz")
 */
export function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 10) {
    return '***';
  }
  const start = apiKey.slice(0, 7);
  const end = apiKey.slice(-3);
  return `${start}***${end}`;
}
