/**
 * @fileoverview Agent执行和IPC通信的事件类型。
 */

import type { ToolCall } from './schema.js';
import type { ToolResult } from '../tools/index.js';

/**
 * AgentEvent - AgentCore执行期间产生的内部事件。
 * 表示对话流程的各个阶段，包括工具执行。
 *
 * 事件类型：
 * - step_start: 每次ReAct循环迭代开始时触发
 * - thinking: 模型的增量思考/推理内容
 * - content: 模型的增量响应内容
 * - tool_call: 模型请求一个或多个工具调用时触发
 * - tool_start: 执行特定工具之前触发
 * - tool_result: 工具执行完成后触发
 * - error: 执行期间发生错误时触发
 */
export type AgentEvent =
  | { type: 'step_start'; step: number; maxSteps: number }
  | { type: 'thinking'; content: string }
  | { type: 'content'; content: string }
  | { type: 'tool_call'; tool_calls: ToolCall[] }
  | { type: 'tool_start'; toolCall: ToolCall }
  | {
      type: 'tool_result';
      result: ToolResult;
      toolCallId: string;
      toolName: string;
    }
  | { type: 'error'; error: string };
