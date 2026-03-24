/**
 * @fileoverview Core type definitions for messages.
 * TODO: 如果支持多模态这些都要改
 */

export interface ContentBlock {
  type: string;
  text?: string;
  [key: string]: unknown;
}

export interface SystemMessage {
  role: 'system';
  content: string;
}

export interface UserMessage {
  role: 'user';
  content: string | ContentBlock[];
}

/** Assistant message with optional thinking */
export interface AssistantMessage {
  role: 'assistant';
  content?: string;
  thinking?: string;
}

export type Message = SystemMessage | UserMessage | AssistantMessage;
