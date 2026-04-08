/**
 * @fileoverview AI 陪伴形象的立绘表情管理工具。
 *
 * 提供两个工具供 Agent 在对话中自主切换和查询表情：
 * - ShowPoseTool: 将立绘切换到指定表情
 * - GetCurrentPoseTool: 查询当前正在显示的表情
 *
 * PoseStateManager 作为单例维护每个 Agent 当前的表情状态，
 * 负责从文件系统读取可用表情列表及初始化默认表情。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { getAgentAssetsPoseDir } from '../util/paths.js';
import type { Tool, ToolResult } from './base.js';

type ShowPoseInput = {
  pose: string;
};

type GetCurrentPoseInput = Record<string, unknown>;

/**
 * 每个 Agent 的当前表情状态管理器。
 *
 * 以 agentId 为 key 维护一个内存 Map，记录各 Agent 当前显示的表情名称。
 * 提供初始化、读取、更新和查询可用表情列表的能力。
 */
class PoseStateManager {
  private state = new Map<string, string>();

  /**
   * 获取指定 Agent 当前的表情名称。
   *
   * @param agentId - Agent 唯一标识
   * @returns 当前表情名称，未初始化时返回 undefined
   */
  get(agentId: string): string | undefined {
    return this.state.get(agentId);
  }

  /**
   * 设置指定 Agent 的当前表情。
   *
   * @param agentId - Agent 唯一标识
   * @param poseName - 要设置的表情名称
   */
  set(agentId: string, poseName: string): void {
    this.state.set(agentId, poseName);
  }

  /**
   * 初始化指定 Agent 的表情状态。
   *
   * 从文件系统的 pose 目录读取可用表情，优先选择名为 "default" 的表情，
   * 不存在则取第一个。初始化成功后会将结果写入内存状态。
   *
   * @param agentId - Agent 唯一标识
   * @returns 初始化后的默认表情名称，目录不存在或无表情文件时返回 undefined
   */
  init(agentId: string): string | undefined {
    const poseDir = getAgentAssetsPoseDir(agentId);
    if (!fs.existsSync(poseDir)) return undefined;

    const files = fs
      .readdirSync(poseDir)
      .filter((f) => /\.(png|jpg|jpeg|gif|webp)$/i.test(f));
    if (files.length === 0) return undefined;

    const names = files.map((f) => path.parse(f).name);
    const defaultPose = names.find((n) => n === 'default') || names[0];
    this.state.set(agentId, defaultPose);
    return defaultPose;
  }

  /**
   * 获取指定 Agent 所有可用的表情名称列表。
   *
   * @param agentId - Agent 唯一标识
   * @returns 表情名称数组（不含文件扩展名），目录不存在时返回空数组
   */
  getAvailablePoses(agentId: string): string[] {
    const poseDir = getAgentAssetsPoseDir(agentId);
    if (!fs.existsSync(poseDir)) return [];

    return fs
      .readdirSync(poseDir)
      .filter((f) => /\.(png|jpg|jpeg|gif|webp)$/i.test(f))
      .map((f) => path.parse(f).name);
  }
}

export const poseStateManager = new PoseStateManager();

/**
 * 切换立绘表情的工具。
 *
 * 初始化时读取该 Agent 目录下的所有表情文件，将名称列表写入 description，
 * 使 LLM 在工具列表中即可看到可用的表情选项。
 * 执行时校验请求的表情是否存在，存在则更新 PoseStateManager。
 */
export class ShowPoseTool implements Tool<ShowPoseInput> {
  public name = 'show_pose';
  public description: string;
  public parameters = {
    type: 'object' as const,
    properties: {
      pose: {
        type: 'string',
        description: '要切换的表情名称',
      },
    },
    required: ['pose'],
  };

  /**
   * 创建 ShowPoseTool 实例。
   *
   * @param agentId - 关联的 Agent 唯一标识，用于读取可用表情列表
   */
  constructor(private agentId: string) {
    const poses = poseStateManager.getAvailablePoses(agentId);
    const poseList = poses.length > 0 ? poses.join('、') : '（无可用表情）';
    this.description =
      `切换你的立绘表情。你可以在对话中根据情绪和语境主动调用此工具来切换表情。\n` +
      `当前可用的表情：${poseList}`;
  }

  /**
   * 执行表情切换。
   *
   * 校验指定表情是否在可用列表中，通过则更新内存状态并返回成功，
   * 否则返回包含可用列表的错误信息。
   *
   * @param params - 包含目标表情名称的参数对象
   * @returns 操作结果，成功时 content 为切换确认信息
   */
  async execute(params: ShowPoseInput): Promise<ToolResult> {
    const available = poseStateManager.getAvailablePoses(this.agentId);

    if (available.length === 0) {
      return {
        success: false,
        content: '',
        error: '当前 Agent 没有配置任何表情资源',
      };
    }

    if (!available.includes(params.pose)) {
      return {
        success: false,
        content: '',
        error: `表情 "${params.pose}" 不存在。可用表情：${available.join('、')}`,
      };
    }

    poseStateManager.set(this.agentId, params.pose);
    return {
      success: true,
      content: `已切换表情为：${params.pose}`,
    };
  }
}

/**
 * 查询当前表情的工具。
 *
 * 返回该 Agent 当前正在显示的表情名称。
 * 若内存中尚无记录，会尝试从文件系统初始化默认表情。
 */
export class GetCurrentPoseTool implements Tool<GetCurrentPoseInput> {
  public name = 'get_current_pose';
  public description = '查询当前正在显示的表情名称。调用后返回当前表情的名字。';
  public parameters = {
    type: 'object' as const,
    properties: {},
  };

  /**
   * 创建 GetCurrentPoseTool 实例。
   *
   * @param agentId - 关联的 Agent 唯一标识
   */
  constructor(private agentId: string) {}

  /**
   * 执行表情查询。
   *
   * 优先从内存读取当前表情，未初始化时尝试从文件系统初始化。
   *
   * @param _params - 无实际参数
   * @returns 操作结果，成功时 content 包含当前表情名称
   */
  async execute(_params: GetCurrentPoseInput): Promise<ToolResult> {
    const current =
      poseStateManager.get(this.agentId) ?? poseStateManager.init(this.agentId);

    if (!current) {
      return {
        success: false,
        content: '',
        error: '当前 Agent 没有配置任何表情资源',
      };
    }

    return {
      success: true,
      content: `当前表情：${current}`,
    };
  }
}
