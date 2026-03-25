/**
 * @fileoverview 核心Agent运行时，执行LLM对话并支持工具调用。
 *
 */

import { stream } from '@mariozechner/pi-ai';
import type { Message, AgentEvent, ToolCall } from '../schema/index.js';
import type { AgentRunConfig } from './types.js';
import type { Tool, ToolResult } from '../tools/index.js';
import {
  convertContext,
  convertPiAiToolCallToNanoAgent,
} from '../converters/index.js';

export class AgentCore {
  public runConfig: AgentRunConfig;
  public messages: Message[] = [];
  public tools: Map<string, Tool> = new Map();

  constructor(config: AgentRunConfig) {
    this.runConfig = config;
    this.messages = [{ role: 'system', content: config.systemPrompt }];

    // add tools to map
    for (const tool of config.tools) {
      this.tools.set(tool.name, tool);
    }
  }

  /**
   * 向对话历史添加用户消息。
   *
   * @param content - 用户消息文本
   * TODO: 如果要支持多模态这个要改
   */
  addUserMessage(content: string): void {
    this.messages.push({
      role: 'user',
      content,
    });
  }

  /**
   * 根据名称和参数执行工具。
   *
   * @param name - 要执行的工具名称
   * @param params - 传递给工具execute方法的参数
   * @returns ToolResult，包含成功状态、内容和可选的错误信息
   */
  async executeTool(
    name: string,
    params: Record<string, unknown>
  ): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        success: false,
        content: '',
        error: `Unknown tool: ${name}`,
      };
    }

    try {
      return await tool.execute(params);
    } catch (error) {
      const err = error as Error;
      return {
        success: false,
        content: '',
        error: `Tool execution failed: ${err.message}`,
      };
    }
  }

  /**
   * 主ReAct循环。
   *
   * 产出思考、内容和工具执行的事件。
   * 持续运行直到模型不再产生工具调用或达到最大步数。
   *
   * @param signal - 可选的AbortSignal用于取消流
   * @yields AgentEvent - 表示执行不同阶段的事件
   * @returns 任务完成或超过最大步数时的最终内容字符串
   */
  async *runStream(
    signal?: AbortSignal
  ): AsyncGenerator<AgentEvent, string, void> {
    for (let step = 0; step < this.runConfig.maxSteps; step++) {
      yield {
        type: 'step_start',
        step: step + 1,
        maxSteps: this.runConfig.maxSteps,
      };

      let fullContent = '';
      let fullThinking = '';
      const toolCalls: ToolCall[] = [];
      const toolList = Array.from(this.tools.values());

      // convert tools & messages to pi-ai format
      const context = convertContext(
        this.runConfig.systemPrompt,
        this.messages,
        toolList
      );

      // Accumulate content chunk
      const eventStream = stream(this.runConfig.model, context, {
        apiKey: this.runConfig.apiKey,
      });

      for await (const event of eventStream) {
        if (signal?.aborted) {
          return '';
        }
        if (event.type === 'thinking_delta') {
          yield { type: 'thinking', content: event.delta };
          fullThinking += event.delta;
        }
        if (event.type === 'text_delta') {
          yield { type: 'content', content: event.delta };
          fullContent += event.delta;
        }
        if (event.type === 'toolcall_end') {
          const nanoToolCall = convertPiAiToolCallToNanoAgent(event.toolCall);
          toolCalls.push(nanoToolCall);
        }
        if (event.type === 'done' || event.type === 'error') {
          break;
        }
      }

      // 将生成Message加入对话历史
      this.messages.push({
        role: 'assistant',
        content: fullContent,
        thinking: fullThinking || undefined,
        tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
      });

      if (toolCalls.length === 0) {
        return fullContent;
      }

      yield { type: 'tool_call', tool_calls: toolCalls };

      // 执行每个tool calls
      for (const toolCall of toolCalls) {
        if (signal?.aborted) {
          return '';
        }

        const toolCallId = toolCall.id;
        const functionName = toolCall.function.name;
        const args = toolCall.function.arguments || {};

        yield { type: 'tool_start', toolCall };

        const result = await this.executeTool(functionName, args);

        yield {
          type: 'tool_result',
          result,
          toolCallId,
          toolName: functionName,
        };

        this.messages.push({
          role: 'tool',
          content: result.success
            ? result.content
            : `Error: ${result.error ?? 'Unknown error'}`,
          tool_call_id: toolCallId,
          tool_name: functionName,
        });
      }
    }

    return `Task couldn't be completed after ${this.runConfig.maxSteps} steps.`;
  }
}
