/**
 * @fileoverview 内部类型与pi-ai格式之间的转换层。
 */

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
import type { Tool } from '../tools/index.js';

/**
 * 将内部Message数组转换为pi-ai Message数组。
 * 处理用户、助手和工具消息。
 *
 * @param messages - 内部消息对象数组
 * @returns pi-ai格式的消息数组
 */
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
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
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

/**
 * 将内部Tool数组转换为pi-ai Tool数组。
 *
 * @param tools - 内部Tool实例数组
 * @returns pi-ai格式的工具定义数组
 */
export function convertTools(tools: Tool[]): PiAiTool[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description ?? '',
    parameters: jsonSchemaToTypeBox(tool.parameters),
  }));
}

/**
 * 递归将JSON Schema转换为TypeBox Schema。
 *
 * 支持基本类型（string、number、boolean）、数组和对象。
 * 对于无法识别的类型，回退到Type.Any。
 *
 * @param schema - 要转换的JSON Schema对象
 * @returns 等价的TypeBox Schema
 */
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

/**
 * 将pi-ai ToolCall转换为内部ToolCall格式。
 *
 * @param toolCall - pi-ai ToolCall对象
 * @returns 带有function包装的内部ToolCall
 */
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

/**
 * 从系统提示、消息和工具创建pi-ai Context。
 *
 * @param systemPrompt - 模型的系统指令
 * @param messages - 对话历史
 * @param tools - 模型可用的工具
 * @returns 准备好用于流式处理的pi-ai Context对象
 */
export function convertContext(
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
