/**
 * @fileoverview Auto-generate session titles from the first user message.
 *
 * Calls the LLM with a dedicated system prompt (no tools) to produce a short
 * title, then cleans up the raw output (strips think tags, truncates, etc.).
 */

import { stream, getModel, type KnownProvider } from '@mariozechner/pi-ai';
import { getAuth } from '../auth/index.js';
import { Logger } from '../util/logger.js';

const TITLE_SYSTEM_PROMPT = `You are a title generator. Based on the user's message, generate a short conversation title.
Rules:
- Use the same language as the user's message
- No more than 50 characters
- Output only one line of title, no explanation
- Focus on the user's main topic
- Preserve technical terms, filenames, and other key information`;

/**
 * Post-process the raw LLM output into a clean title string.
 *
 * Steps: strip <think/> tags, take first non-empty line, truncate to 100 chars.
 * Returns empty string when the output contains nothing useful.
 */
function cleanTitle(raw: string): string {
  const withoutThink = raw.replace(/<think[\s\S]*?<\/think>/g, '');
  const firstLine = withoutThink.split('\n').find((l) => l.trim().length > 0);
  if (!firstLine) return '';
  const trimmed = firstLine.trim();
  return trimmed.length > 100 ? `${trimmed.slice(0, 100)}...` : trimmed;
}

/**
 * Generate a session title by calling the LLM with the user's first message.
 *
 * Reuses the same provider/model/apiKey that the session is already configured
 * with. The call is intentionally lightweight: no tools, a short system prompt,
 * and only a single user message.
 *
 * @returns The generated title, or an empty string if generation failed.
 */
export async function generateTitle(
  userMessage: string,
  provider: string,
  modelId: string
): Promise<string> {
  const auth = getAuth(provider as KnownProvider);
  if (!auth) return '';

  const model = getModel(
    provider as KnownProvider,
    modelId as Parameters<typeof getModel>[1]
  );
  if (!model) return '';

  const context = {
    systemPrompt: TITLE_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user' as const,
        content: userMessage,
        timestamp: Date.now(),
      },
    ],
  };

  let raw = '';
  try {
    const eventStream = stream(model, context, { apiKey: auth.apiKey });
    for await (const event of eventStream) {
      if (event.type === 'text_delta') {
        raw += (event as { delta: string }).delta;
      }
      if (event.type === 'done' || event.type === 'error') break;
    }
  } catch (err) {
    Logger.log('TITLE', 'Generation failed', {
      error: (err as Error).message,
    });
    return '';
  }

  return cleanTitle(raw);
}
