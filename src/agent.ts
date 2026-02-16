import * as path from 'node:path';
import * as fs from 'node:fs';
import { Logger } from './util/logger.js';
import { LLMClient } from './llm-client/llm-client.js';
import type { Message, ToolCall } from './schema/index.js';
import type { AgentEvent } from './schema/index.js';
import type { Tool, ToolResult } from './tools/index.js';

function buildSystemPrompt(basePrompt: string, workspaceDir: string): string {
  if (basePrompt.includes('Current Workspace')) {
    return basePrompt;
  }
  return `${basePrompt}

## Current Workspace
You are currently working in: \`${workspaceDir}\`
All relative paths will be resolved relative to this directory.`;
}

export class Agent {
  public llmClient: LLMClient;
  public systemPrompt: string;
  public maxSteps: number;
  public messages: Message[];
  public workspaceDir: string;
  public tools: Map<string, Tool>;

  constructor(
    llmClient: LLMClient,
    systemPrompt: string,
    tools: Tool[],
    maxSteps: number,
    workspaceDir: string
  ) {
    this.llmClient = llmClient;
    this.maxSteps = maxSteps;
    this.tools = new Map();

    // Ensure workspace exists
    this.workspaceDir = path.resolve(workspaceDir);
    fs.mkdirSync(this.workspaceDir, { recursive: true });

    // Inject workspace dir into system prompt
    this.systemPrompt = buildSystemPrompt(systemPrompt, workspaceDir);
    this.messages = [{ role: 'system', content: this.systemPrompt }];

    // Register tools with the agent
    for (const tool of tools) {
      this.registerTool(tool);
    }
  }

  addUserMessage(content: string): void {
    Logger.log('CHAT', 'User:', content);
    this.messages.push({ role: 'user', content });
  }

  registerTool(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  listTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Executes a tool by name with the given parameters.
   *
   * Validates tool existence, executes the tool with error handling, and returns
   * a structured result. Errors during execution are caught and wrapped in a
   * ToolResult object with error details.
   *
   * @param {string} name - The registered name of the tool to execute
   * @param {Record<string, unknown>} params - Parameters to pass to the tool's execute method
   * @returns {Promise<ToolResult>} Result object containing success status, content, and optional error message
   */
  async executeTool(
    name: string,
    params: Record<string, unknown>
  ): Promise<ToolResult> {
    const tool = this.getTool(name);
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
      const details = err?.message ? err.message : String(error);
      const stack = err?.stack ? `\n\nStack:\n${err.stack}` : '';
      return {
        success: false,
        content: '',
        error: `Tool execution failed: ${details}${stack}`,
      };
    }
  }

  /**
   * Core execution loop that yields events for each phase of the agent's operation.
   *
   * This method iterates through up to `maxSteps` iterations, each consisting of:
   * 1. LLM generation (thinking + content) with streaming events
   * 2. Tool execution (if tool calls are requested)
   *
   * Events are yielded in real-time to allow UI decoupling from agent logic.
   *
   * @yields {AgentEvent} Sequential events representing:
   *   - `step_start` - Beginning of a new iteration
   *   - `thinking` - LLM thinking process (streamed)
   *   - `content` - LLM response content (streamed)
   *   - `tool_call` - Batch of tool calls to execute
   *   - `tool_start` - Execution start for a specific tool
   *   - `tool_result` - Result of a tool execution
   * @returns {string} Final response text when the task completes or max steps reached
   */
  async *runStream(): AsyncGenerator<AgentEvent, string, void> {
    for (let step = 0; step < this.maxSteps; step++) {
      yield { type: 'step_start', step: step + 1, maxSteps: this.maxSteps };

      let fullContent = '';
      let fullThinking = '';
      let toolCalls: ToolCall[] | null = null;

      const toolList = this.listTools();
      for await (const chunk of this.llmClient.generateStream(
        this.messages,
        toolList
      )) {
        if (chunk.thinking) {
          yield { type: 'thinking', content: chunk.thinking };
          fullThinking += chunk.thinking;
        }

        if (chunk.content) {
          yield { type: 'content', content: chunk.content };
          fullContent += chunk.content;
        }

        if (chunk.tool_calls) {
          toolCalls = chunk.tool_calls;
        }
      }

      this.messages.push({
        role: 'assistant',
        content: fullContent,
        thinking: fullThinking || undefined,
        tool_calls: toolCalls || undefined,
      });

      if (!toolCalls || toolCalls.length === 0) {
        return fullContent;
      }

      yield { type: 'tool_call', tool_calls: toolCalls };

      for (const toolCall of toolCalls) {
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

    return `Task couldn't be completed after ${this.maxSteps} steps.`;
  }
}
