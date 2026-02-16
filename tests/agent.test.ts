import { describe, it, expect } from 'vitest';
import { Agent } from '../src/agent.js';
import type { LLMClient } from '../src/llm-client/llm-client.js';
import type { Tool, ToolResult } from '../src/tools/index.js';
import type { ToolCall, AgentEvent } from '../src/schema/index.js';

// Mock Tool
class MockTool implements Tool {
  name = 'mock_tool';
  description = 'A mock tool';
  parameters = { type: 'object', properties: {} };
  async execute(params: Record<string, unknown>) {
    return {
      success: true,
      content: `Executed with ${JSON.stringify(params)}`,
    };
  }
}

// Mock LLM Client
interface MockChunk {
  thinking?: string;
  content?: string;
  tool_calls?: ToolCall[];
  done?: boolean;
}

class MockLLMClient {
  constructor(private responses: MockChunk[][]) {}

  async *generateStream(_messages: unknown[], _tools: unknown[]) {
    const response = this.responses.shift();
    if (response) {
      for (const chunk of response) {
        yield chunk;
      }
    }
  }
}

describe('Agent (Refactored)', () => {
  it('should stream thinking and content events', async () => {
    const mockChunks = [
      { thinking: 'Thinking...' },
      { content: 'Hello ' },
      { content: 'World' },
      { done: true },
    ];

    const mockLLM = new MockLLMClient([mockChunks]) as unknown as LLMClient;
    const agent = new Agent(
      mockLLM,
      'System prompt',
      [],
      1, // 1 step
      '/tmp'
    );

    const events: AgentEvent[] = [];
    for await (const event of agent.runStream()) {
      events.push(event);
    }

    expect(events).toEqual([
      { type: 'step_start', step: 1, maxSteps: 1 },
      { type: 'thinking', content: 'Thinking...' },
      { type: 'content', content: 'Hello ' },
      { type: 'content', content: 'World' },
    ]);
  });

  it('should handle tool calls', async () => {
    const toolCall: ToolCall = {
      id: 'call_1',
      type: 'function',
      function: {
        name: 'mock_tool',
        arguments: { key: 'value' },
      },
    };

    const mockChunks = [
      { thinking: 'I need to use a tool.' },
      { tool_calls: [toolCall] },
      { done: true },
    ];

    const mockLLM = new MockLLMClient([mockChunks]) as unknown as LLMClient;
    const mockTool = new MockTool();

    const agent = new Agent(mockLLM, 'System prompt', [mockTool], 1, '/tmp');

    const events: AgentEvent[] = [];
    for await (const event of agent.runStream()) {
      events.push(event);
    }

    // Filter dynamic fields like duration or check structure
    expect(events[0]).toEqual({ type: 'step_start', step: 1, maxSteps: 1 });
    expect(events[1]).toEqual({
      type: 'thinking',
      content: 'I need to use a tool.',
    });
    // Updated property: toolCalls -> tool_calls
    expect(events[2]).toEqual({ type: 'tool_call', tool_calls: [toolCall] });
    expect(events[3]).toEqual({ type: 'tool_start', toolCall });

    const resultEvent = events[4] as {
      type: 'tool_result';
      toolCallId: string;
      toolName: string;
      result: ToolResult;
    };
    expect(resultEvent.type).toBe('tool_result');
    expect(resultEvent.toolCallId).toBe(toolCall.id);
    expect(resultEvent.toolName).toBe(toolCall.function.name);
    expect(resultEvent.result.success).toBe(true);
    expect(resultEvent.result.content).toContain(
      'Executed with {"key":"value"}'
    );
  });
});