import type {
  ChatCompletionRequest,
  OpenAIMessage,
} from '../types/openai-types.js';
import type { Message, ToolCall } from '../../schema/index.js';

/**
 * Converts OpenAI chat completion request format to Nano-Agent internal format
 *
 * @param request - OpenAI-formatted request containing model name, messages, temperature, etc.
 * @returns Nano-Agent internal format with model, messages array, and generation options
 */
export function convertOpenAIRequest(request: ChatCompletionRequest): {
  model: string;
  messages: Message[];
  options: {
    temperature?: number;
    maxTokens?: number;
  };
} {
  // Convert OpenAI messages array to Nano-Agent internal message format
  const messages: Message[] = request.messages.map((msg) =>
    convertMessage(msg)
  );

  return {
    model: request.model,
    messages,
    options: {
      temperature: request.temperature,
      maxTokens: request.max_tokens,
    },
  };
}

/**
 * Converts a single OpenAI message to Nano-Agent internal message format
 *
 * @param msg - OpenAI message object containing role and content
 * @returns Nano-Agent internal message format
 */
function convertMessage(msg: OpenAIMessage): Message {
  switch (msg.role) {
    case 'system':
      return {
        role: 'system',
        content: msg.content || '',
      };
    case 'user':
      return {
        role: 'user',
        content: msg.content as any,
      };
    case 'assistant': {
      const toolCalls: ToolCall[] | undefined = msg.tool_calls?.map((tc) => ({
        id: tc.id,
        type: 'function',
        function: {
          name: tc.function.name,
          arguments: parseArguments(tc.function.arguments),
        },
      }));
      return {
        role: 'assistant',
        content: msg.content || '',
        tool_calls: toolCalls,
      };
    }
    case 'tool':
      return {
        role: 'tool',
        content: msg.content || '',
        tool_call_id: msg.tool_call_id || '',
        tool_name: msg.name,
      };
    default:
      const unsupportedMsg = msg as { role: string };
      throw new Error(`Unsupported role: ${unsupportedMsg.role}`);
  }
}

/**
 * Parses tool call arguments from JSON string
 *
 * @param args - JSON string of arguments
 * @returns Parsed arguments object, or empty object if parsing fails
 */
function parseArguments(args: string): Record<string, unknown> {
  try {
    return JSON.parse(args);
  } catch {
    return {};
  }
}
