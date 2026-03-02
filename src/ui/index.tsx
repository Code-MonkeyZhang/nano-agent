/**
 * UI 模块入口文件
 */

import { render } from 'ink';
import { BootUpContainer } from './BootUpContainer.js';
import type { Config } from '../config.js';

/**
 * 启动交互式 UI
 * 使用 Ink 库将 React 组件渲染到终端
 *
 * @param config - 配置对象
 * @param workspaceDir - 工作目录路径
 * @returns Promise<void> - 等待 UI 退出
 */
export async function runInteractiveUI(
  config: Config,
  workspaceDir: string
): Promise<void> {
  // 使用 Ink 的 render 函数渲染 BootUpContainer 组件
  const { waitUntilExit } = render(
    <BootUpContainer config={config} workspaceDir={workspaceDir} />
  );

  // 等待 UI 退出 (用户按下 Ctrl+C 或程序结束)
  await waitUntilExit();
}
