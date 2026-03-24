/**
 * @fileoverview Server configuration management.
 */

import * as yaml from 'yaml';

const DEFAULT_CONFIG = {
  enableLogging: false,
  retry: { enabled: true, maxRetries: 3 },
  mcp: { connectTimeout: 10, executeTimeout: 60, sseReadTimeout: 120 },
};

/** Generate default config YAML string for first-time creation */
export function getDefaultConfigYaml(): string {
  return yaml.stringify(DEFAULT_CONFIG);
}
