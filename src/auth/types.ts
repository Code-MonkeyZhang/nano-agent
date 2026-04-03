/**
 * @fileoverview Type definitions for auth management.
 */

import type { KnownProvider, Provider } from '@mariozechner/pi-ai';

export type { KnownProvider, Provider };

/** Api key for an LLM provider */
export interface Auth {
  apiKey: string;
}

/** Auth storage structure, maps provider identifiers to auth info */
export type AuthStore = Record<Provider, Auth>;
