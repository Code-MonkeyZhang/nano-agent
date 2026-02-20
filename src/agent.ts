import * as path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Logger } from './util/logger.js';
import { LLMClient } from './llm-client/llm-client.js';
import { Config } from './config.js';
import {
  BashKillTool,
  BashOutputTool,
  BashTool,
  EditTool,
  ReadTool,
  WriteTool,
  loadMcpToolsAsync,
  setMcpTimeoutConfig,
  type Tool,
  type ToolResult,
} from './tools/index.js';
import type { Message, ToolCall, AgentEvent } from './schema/index.js';
import { SkillLoader, GetSkillTool } from './skills/index.js';

/**
 * Find the project root directory by searching for package.json.
 * Starts from the current file location and searches upward.
 *
 * @returns The absolute path to the project root directory
 * @throws Error if package.json cannot be found
 */
function findProjectRoot(): string {
  let currentDir = path.dirname(fileURLToPath(import.meta.url));

  while (true) {
    const packageJsonPath = path.join(currentDir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      return currentDir;
    }

    const parentDir = path.resolve(currentDir, '..');
    if (parentDir === currentDir) {
      throw new Error(
        'Cannot find project root (package.json not found)'
      );
    }
    currentDir = parentDir;
  }
}

/**
 * Find skills directory with fallback mechanism.
 *
 * Search order:
 * 1. Config-specified directory (relative to CWD)
 * 2. Package installation directory (built-in skills)
 *
 * @param skillsDirConfig - The skillsDir from config (default: './skills')
 * @returns The absolute path to skills directory
 */
function findSkillsDir(skillsDirConfig: string): string {
  const cwdSkillsDir = path.resolve(skillsDirConfig);
  if (fs.existsSync(cwdSkillsDir)) {
    return cwdSkillsDir;
  }

  const projectRoot = findProjectRoot();
  const packageSkillsDir = path.join(projectRoot, 'skills');

  if (fs.existsSync(packageSkillsDir)) {
    console.log(
      `[AgentCore] 📦 Using built-in skills from: ${packageSkillsDir}`
    );
    return packageSkillsDir;
  }

  return cwdSkillsDir;
}

function buildSystemPrompt(basePrompt: string, workspaceDir: string): string {
  if (basePrompt.includes('Current Workspace')) {
    return basePrompt;
  }
  return `${basePrompt}

## Current Workspace
You are currently working in: \`${workspaceDir}\`
All relative paths will be resolved relative to this directory.`;
}

export class AgentCore {
  public config: Config;
  public llmClient?: LLMClient;
  public systemPrompt: string = '';
  public maxSteps: number;
  public messages: Message[] = [];
  public workspaceDir: string;
  public tools: Map<string, Tool> = new Map();

  constructor(config: Config, workspaceDir: string) {
    this.config = config;
    this.maxSteps = config.agent.maxSteps;
    this.workspaceDir = path.resolve(workspaceDir);
  }

  async initialize(): Promise<void> {
    console.log('[AgentCore] Initializing...');

    // 1. Initialize LLM Client
    if (!this.llmClient) {
      this.llmClient = new LLMClient(
        this.config.llm.apiKey,
        this.config.llm.apiBase,
        this.config.llm.provider,
        this.config.llm.model,
        this.config.llm.retry
      );

      console.log('[AgentCore] Checking API connection...');
      const isConnected = await this.llmClient.checkConnection();
      if (isConnected) {
        console.log('[AgentCore] ✅ API connection OK');
      } else {
        console.log(
          '[AgentCore] ⚠️  API connection failed (Check API Key/Network)'
        );
      }
    }

    // 2. Load System Prompt
    let baseSystemPrompt: string;
    const systemPromptPath = Config.findConfigFile(
      this.config.agent.systemPromptPath
    );
    if (systemPromptPath && fs.existsSync(systemPromptPath)) {
      baseSystemPrompt = fs.readFileSync(systemPromptPath, 'utf8');
      console.log(`[AgentCore] ✅ Loaded system prompt`);
    } else {
      baseSystemPrompt =
        'You are Mini-Agent, an intelligent assistant powered by MiniMax M2 that can help users complete various tasks.';
      console.log('[AgentCore] ⚠️  System prompt not found, using default');
    }

    this.systemPrompt = buildSystemPrompt(baseSystemPrompt, this.workspaceDir);

    // 3. Load Tools (Built-in + MCP + Skills)
    await this.loadBuiltInTools();
    await this.loadSkills();
    await this.loadMcpTools();

    // 4. Initialize Messages
    this.messages = [{ role: 'system', content: this.systemPrompt }];
  }

  private async loadBuiltInTools(): Promise<void> {
    const builtInTools: Tool[] = [
      new ReadTool(this.workspaceDir),
      new WriteTool(this.workspaceDir),
      new EditTool(this.workspaceDir),
      new BashTool(),
      new BashOutputTool(),
      new BashKillTool(),
    ];

    for (const tool of builtInTools) {
      this.tools.set(tool.name, tool);
    }
  }

  private async loadSkills(): Promise<void> {
    console.log('[AgentCore] Loading Skills...');
    const skillsDir = findSkillsDir(this.config.tools.skillsDir);

    // Create directory if neither CWD nor package directory has skills
    if (!fs.existsSync(skillsDir)) {
      console.log(
        `[AgentCore] ⚠️  Skills directory does not exist: ${skillsDir}`
      );
      fs.mkdirSync(skillsDir, { recursive: true });
    }

    try {
      const skillLoader = new SkillLoader(skillsDir);
      const discoveredSkills = skillLoader.discoverSkills();

      if (discoveredSkills.length > 0) {
        this.tools.set('get_skill', new GetSkillTool(skillLoader));
        const skillsMetadata = skillLoader.getSkillsMetadataPrompt();
        this.systemPrompt += `\n\n${skillsMetadata}`;
        Logger.log(
          'startup',
          'Skills Loaded:',
          discoveredSkills.map((s) => s.name)
        );
        console.log(
          `[AgentCore] ✅ Loaded ${discoveredSkills.length} skill(s)`
        );
      } else {
        console.log('[AgentCore] ⚠️  No skills found in skills directory');
      }
    } catch (error) {
      console.error(`[AgentCore] ❌ Failed to load skills: ${error}`);
    }
  }

  private async loadMcpTools(): Promise<void> {
    console.log('[AgentCore] Loading MCP tools...');
    const mcpConfig = this.config.tools.mcp;

    setMcpTimeoutConfig({
      connectTimeout: mcpConfig.connectTimeout,
      executeTimeout: mcpConfig.executeTimeout,
      sseReadTimeout: mcpConfig.sseReadTimeout,
    });

    const mcpConfigPath = Config.findConfigFile(
      this.config.tools.mcpConfigPath
    );

    if (mcpConfigPath) {
      const mcpTools = await loadMcpToolsAsync(mcpConfigPath);
      if (mcpTools.length > 0) {
        for (const tool of mcpTools) {
          this.tools.set(tool.name, tool);
        }
        console.log(`[AgentCore] ✅ Loaded ${mcpTools.length} MCP tools`);
      } else {
        console.log('[AgentCore] ⚠️  No available MCP tools found');
      }
    } else {
      console.log(
        `[AgentCore] ⚠️  MCP config file not found: ${this.config.tools.mcpConfigPath}`
      );
    }
  }

  addUserMessage(content: string): void {
    Logger.log('CHAT', 'User:', content);
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

  async *runStream(): AsyncGenerator<AgentEvent, string, void> {
    if (!this.llmClient) {
      throw new Error('AgentCore not initialized. Call initialize() first.');
    }

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
