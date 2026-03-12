import { Logger } from './util/logger.js';
import { stream, type Model, type Api } from '@mariozechner/pi-ai';
import type { Tool, ToolResult } from './tools/index.js';
import type { Message, ToolCall, AgentEvent } from './schema/index.js';
import { getGlobalAbortController } from './server/http-server.js';
import type { AgentRunConfig } from './agent-factory/types.js';
import type { SkillEntry } from './skill-pool/types.js';
import {
  createContext,
  convertPiAiToolCallToNanoAgent,
} from './converters/pi-ai-converter.js';

function buildSystemPrompt(
  basePrompt: string,
  skills: SkillEntry[],
  workspaceDir: string
): string {
  let prompt = basePrompt;

  if (skills.length > 0) {
    const skillSections = skills
      .map((skill) => `### ${skill.name}\n\n${skill.content}`)
      .join('\n\n---\n\n');

    prompt += `

## Available Skills

${skillSections}`;
  }

  if (!prompt.includes('Current Workspace')) {
    prompt += `

## Current Workspace
You are currently working in: \`${workspaceDir}\`
All relative paths will be resolved relative to this directory.`;
  }

  return prompt;
}

/**
 * Core agent runtime that executes LLM conversations with tool calling.
 *
 * AgentCore is designed to accept pre-assembled configuration from AgentFactory.
 * It handles the ReAct loop: thinking → tool calling → result processing.
 *
 * System prompt is built internally from baseSystemPrompt + skills + workspace.
 */
export class AgentCore {
  public runConfig: AgentRunConfig;
  public model: Model<Api>;
  public apiKey: string;
  public systemPrompt: string;
  public maxSteps: number;
  public messages: Message[] = [];
  public workspaceDir: string;
  public tools: Map<string, Tool> = new Map();

  constructor(config: AgentRunConfig, workspaceDir: string) {
    this.runConfig = config;
    this.maxSteps = config.maxSteps;
    this.workspaceDir = workspaceDir;

    this.model = config.model;
    this.apiKey = config.apiKey;

    this.systemPrompt = buildSystemPrompt(
      config.baseSystemPrompt,
      config.skills,
      workspaceDir
    );

    for (const tool of config.tools) {
      this.tools.set(tool.name, tool);
    }

    this.messages = [{ role: 'system', content: this.systemPrompt }];
    Logger.log('AGENT', `AgentCore created with ${config.tools.length} tools`);
  }

  addUserMessage(content: string): void {
    Logger.log('CHAT', 'User message', content);
    this.messages.push({ role: 'user', content });
  }

  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  listTools(): Tool[] {
    return Array.from(this.tools.values());
  }

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
   * Main ReAct loop that generates LLM responses and handles tool calls.
   *
   * Yields events for thinking, content, and tool execution.
   * Returns the final response text when complete.
   */
  async *runStream(): AsyncGenerator<AgentEvent, string, void> {
    for (let step = 0; step < this.maxSteps; step++) {
      yield { type: 'step_start', step: step + 1, maxSteps: this.maxSteps };

      let fullContent = '';
      let fullThinking = '';
      const toolCalls: ToolCall[] = [];
      const toolList = this.listTools();

      const context = createContext(this.systemPrompt, this.messages, toolList);

      const eventStream = stream(this.model, context, { apiKey: this.apiKey });

      for await (const event of eventStream) {
        const abortCtrl = getGlobalAbortController();
        if (abortCtrl?.signal.aborted) {
          return '';
        }
        // 每个chunk都会转换成 nano-agent自己的event-type TODO: 以后可能要统一使用pi-ai的event
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

      // add full content to messages
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

      for (const toolCall of toolCalls) {
        const abortCtrl = getGlobalAbortController();
        if (abortCtrl?.signal.aborted) {
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

    return `Task couldn't be completed after ${this.maxSteps} steps.`;
  }
}
