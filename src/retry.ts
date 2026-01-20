import type { RetryConfig } from "./config.js";

export type { RetryConfig };

/**
 * Retry exhausted exception
 */
export class RetryExhaustedError extends Error {
  attempts: number;
  lastError: unknown;

  constructor(lastError: unknown, attempts: number) {
    super(
      `Retry failed after ${attempts} attempts. Last error: ${String(
        lastError
      )}`
    );
    this.name = "RetryExhaustedError";
    this.attempts = attempts;
    this.lastError = lastError;
  }
}

/**
 * Calculate delay time (exponential backoff)
 * @returns Delay in milliseconds
 */
export function calculateDelay(attempt: number, config: RetryConfig): number {
  // config.initialDelay and maxDelay are in seconds, convert to ms
  const delay =
    config.initialDelay * Math.pow(config.exponentialBase, attempt) * 1000;
  const maxDelayMs = config.maxDelay * 1000;
  return Math.min(delay, maxDelayMs);
}

/**
 * Async function retry wrapper
 *
 * @param fn Function to execute (must return a Promise)
 * @param config Retry configuration
 * @param onRetry Callback function on retry
 */
export async function asyncRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig,
  onRetry?: ((error: unknown, attempt: number) => void) | null
): Promise<T> {
  let lastError: unknown;

  // attempt calls: 0 (first try), 1 (retry 1), 2 (retry 2)... up to maxRetries
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // If this was the last attempt, throw
      if (attempt === config.maxRetries) {
        throw new RetryExhaustedError(lastError, attempt + 1);
      }

      // Notify callback about the failure and upcoming retry
      if (onRetry) {
        onRetry(error, attempt + 1);
      }

      // Wait before retrying
      const delay = calculateDelay(attempt, config);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Should not be reached
  throw new RetryExhaustedError(lastError, config.maxRetries + 1);
}
