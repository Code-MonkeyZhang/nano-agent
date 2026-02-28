export interface ParsedError {
  text: string;
  code?: string;
  suggestion?: string;
}

const ERROR_CONFIGS: Record<string, { text: string; suggestion: string }> = {
  '401': {
    text: 'Invalid API key',
    suggestion: 'Check your API key configuration',
  },
  '403': {
    text: 'Access forbidden',
    suggestion: 'Check your API key permissions',
  },
  '429': {
    text: 'Rate limit exceeded',
    suggestion: 'Wait a moment and try again',
  },
  '500': {
    text: 'Server error',
    suggestion: 'Service temporarily unavailable, try again later',
  },
  '502': {
    text: 'Bad gateway',
    suggestion: 'Service temporarily unavailable, try again later',
  },
  '503': {
    text: 'Service unavailable',
    suggestion: 'Service temporarily unavailable, try again later',
  },
  '504': {
    text: 'Gateway timeout',
    suggestion: 'Service temporarily unavailable, try again later',
  },
};

function parseHttpError(message: string): ParsedError | null {
  const statusMatch = message.match(/(\d{3})/);
  if (!statusMatch) return null;

  const code = statusMatch[1];
  const config = ERROR_CONFIGS[code];
  if (!config) return null;

  return {
    text: `${code} - ${config.text}`,
    code,
    suggestion: config.suggestion,
  };
}

function parseNetworkError(message: string): ParsedError | null {
  const networkPatterns = [
    { pattern: /timeout/i, text: 'Connection timeout' },
    { pattern: /network/i, text: 'Network error' },
    { pattern: /ECONNREFUSED/i, text: 'Connection refused' },
    { pattern: /ENOTFOUND/i, text: 'Host not found' },
    { pattern: /ETIMEDOUT/i, text: 'Connection timeout' },
    { pattern: /fetch failed/i, text: 'Fetch failed' },
  ];

  for (const { pattern, text } of networkPatterns) {
    if (pattern.test(message)) {
      return {
        text,
        code: 'network',
        suggestion: 'Check your network connection',
      };
    }
  }

  return null;
}

export function parseError(error: unknown): ParsedError {
  const message = error instanceof Error ? error.message : String(error);

  const httpError = parseHttpError(message);
  if (httpError) return httpError;

  const networkError = parseNetworkError(message);
  if (networkError) return networkError;

  return { text: message };
}
