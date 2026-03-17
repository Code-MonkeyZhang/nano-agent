import type { KnownProvider } from '@mariozechner/pi-ai';

export type Provider = KnownProvider;

export interface ProviderCredential {
  apiKey: string;
}

export type CredentialsStore = Record<Provider, ProviderCredential>;
