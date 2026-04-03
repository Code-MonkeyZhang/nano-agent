/**
 * @fileoverview Shared utilities for router handlers.
 */

/** Helper to extract string param from Express req.params */
export function getParam(
  value: string | string[] | undefined
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
