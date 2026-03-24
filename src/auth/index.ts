/**
 * @fileoverview Public API for the auth module.
 */

export {
  setAuth,
  deleteAuth,
  getAuth,
  listProvidersWithAuth,
  hasAuth,
  type ProviderStatus,
} from './store.js';
export type { KnownProvider, Provider, Auth, AuthStore } from './types.js';
