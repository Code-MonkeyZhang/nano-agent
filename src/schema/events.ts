/**
 * @fileoverview Event types for agent execution and IPC communication.
 */

/**
 * AgentEvent - Internal events generated during AgentCore execution.
 * Represents various stages of the conversation flow.
 */
export type AgentEvent =
  | { type: 'step_start'; step: number; maxSteps: number }
  | { type: 'thinking'; content: string }
  | { type: 'content'; content: string }
  | { type: 'error'; error: string };
