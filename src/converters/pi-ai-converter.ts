import type {
  Context,
  Message as PiAiMessage,
  UserMessage,
  AssistantMessage,
  ToolResultMessage,
  Tool as PiAiTool,
  TextContent,
  ThinkingContent,
  ToolCall as PiAiToolCall,
} from '@mariozechner/pi-ai';
import { Type, type TSchema } from '@sinclair/typebox';
import type { Message, ToolCall } from '../schema/index.js';
import type { Tool } from '../tools/base.js';

// pi-ai 和 nano-agent 之间的格式转换层 TODO: 以后可能要统一使用pi-ai的格式
export function convertMessages(messages: Message[]): PiAiMessage[] {
  const result: PiAiMessage[] = [];

  for (const msg of messages) {
    if (msg.role === 'user') {
      const userMsg: UserMessage = {
        role: 'user',
        content:
          typeof msg.content === 'string'
            ? msg.content
            : msg.content
                .filter((b) => b.type === 'text')
                .map((b) => ({ type: 'text', text: b.text ?? '' })),
        timestamp: Date.now(),
      };
      result.push(userMsg);
    } else if (msg.role === 'assistant') {
      const content: (TextContent | ThinkingContent | PiAiToolCall)[] = [];

      if (msg.thinking) {
        content.push({ type: 'thinking', thinking: msg.thinking });
      }

      if (msg.content) {
        content.push({ type: 'text', text: msg.content });
      }

      if (msg.tool_calls && msg.tool_calls.length > 0) {
        for (const tc of msg.tool_calls) {
          content.push({
            type: 'toolCall',
            id: tc.id,
            name: tc.function.name,
            arguments: tc.function.arguments,
          });
        }
      }

      const assistantMsg: AssistantMessage = {
        role: 'assistant',
        content,
        api: 'openai-completions',
        provider: 'openai',
        model: '',
        usage: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 0,
          cost: {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
            total: 0,
          },
        },
        stopReason: 'stop',
        timestamp: Date.now(),
      };
      result.push(assistantMsg);
    } else if (msg.role === 'tool') {
      const toolResultMsg: ToolResultMessage = {
        role: 'toolResult',
        toolCallId: msg.tool_call_id,
        toolName: msg.tool_name ?? '',
        content: [{ type: 'text', text: msg.content }],
        isError: msg.content.startsWith('Error:'),
        timestamp: Date.now(),
      };
      result.push(toolResultMsg);
    }
  }

  return result;
}

export function convertTools(tools: Tool[]): PiAiTool[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: jsonSchemaToTypeBox(tool.parameters),
  }));
}

function jsonSchemaToTypeBox(schema: Record<string, unknown>): TSchema {
  const type = schema['type'] as string | undefined;

  switch (type) {
    case 'string':
      return Type.String();
    case 'number':
    case 'integer':
      return Type.Number();
    case 'boolean':
      return Type.Boolean();
    case 'array': {
      const items = schema['items'] as Record<string, unknown> | undefined;
      if (items) {
        return Type.Array(jsonSchemaToTypeBox(items));
      }
      return Type.Array(Type.Any());
    }
    case 'object': {
      const properties = schema['properties'] as
        | Record<string, Record<string, unknown>>
        | undefined;
      const required = schema['required'] as string[] | undefined;

      if (!properties) {
        return Type.Object({});
      }

      const typeBoxProps: Record<string, TSchema> = {};
      for (const [key, value] of Object.entries(properties)) {
        typeBoxProps[key] = jsonSchemaToTypeBox(value);
      }

      return Type.Object(typeBoxProps, { required: required ?? [] });
    }
    default:
      return Type.Any();
  }
}

export function convertPiAiToolCallToNanoAgent(
  toolCall: PiAiToolCall
): ToolCall {
  return {
    id: toolCall.id,
    type: 'function',
    function: {
      name: toolCall.name,
      arguments: toolCall.arguments,
    },
  };
}

export function createContext(
  systemPrompt: string,
  messages: Message[],
  tools: Tool[]
): Context {
  return {
    systemPrompt,
    messages: convertMessages(messages),
    tools: convertTools(tools),
  };
}
