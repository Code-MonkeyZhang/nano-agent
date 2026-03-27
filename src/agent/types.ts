/**
 * @fileoverview Agent配置的类型定义。
 */

import { z } from 'zod';
import type { Model, Api } from '@mariozechner/pi-ai';
import type { Tool } from '../tools/index.js';

/** 模型配置Schema */
export const ModelConfigSchema = z.object({
  provider: z.string(),
  model: z.string(),
});

/** 模型配置类型 */
export type ModelConfig = z.infer<typeof ModelConfigSchema>;

/** Agent配置Schema */
export const AgentConfigSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  systemPrompt: z.string(),
  defaultModel: ModelConfigSchema,
  maxSteps: z.number().int().positive(),
  defaultWorkspacePath: z.string().optional(),
  skillNames: z.array(z.string()).default([]),
  createdAt: z.number(),
  updatedAt: z.number(),
});

/** Agent配置类型 */
export type AgentConfig = z.infer<typeof AgentConfigSchema>;

/**
 * 创建/更新Agent的输入Schema。
 * 从AgentConfigSchema中移除系统管理的字段（id、createdAt、updatedAt）。
 */
export const AgentConfigInputSchema = AgentConfigSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

/** 创建/更新Agent的输入类型 */
export type AgentConfigInput = z.infer<typeof AgentConfigInputSchema>;

/** AgentCore的运行时配置 */
export interface AgentRunConfig {
  agentName: string;
  provider: string;
  modelId: string;
  model: Model<Api>;
  apiKey: string;
  systemPrompt: string;
  workspaceDir: string;
  maxSteps: number;
  tools: Tool[];
}
