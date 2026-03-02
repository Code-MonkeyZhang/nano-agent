import { useState, useEffect } from 'react';
import { Box, Text, useApp } from 'ink';
import { AppContainer } from './AppContainer.js';
import { Config } from '../config.js';
import { AgentCore } from '../agent.js';
import * as fs from 'node:fs';
import { theme } from './themes.js';

interface BootUpContainerProps {
  config: Config;
  workspaceDir: string;
}

const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

/**
 * 启动步骤定义
 * - label: 步骤显示名称
 * - status: 步骤状态 (pending/loading/completed/error)
 */
interface ProgressStep {
  label: string;
  status: 'pending' | 'loading' | 'completed' | 'error';
}

/**
 * Nano-Agent 启动容器组件
 * 负责 Agent 初始化流程和加载界面显示
 */
export function BootUpContainer({
  config,
  workspaceDir,
}: BootUpContainerProps) {
  const [agent, setAgent] = useState<AgentCore | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Spinner 动画当前帧索引 */
  const [frameIndex, setFrameIndex] = useState(0);
  /** Ink 提供的退出函数 */
  const { exit } = useApp();

  /**
   * 启动步骤状态列表
   * 初始状态: 配置已加载, 其他步骤待处理
   */
  const [steps, setSteps] = useState<ProgressStep[]>([
    { label: 'Loading configuration', status: 'completed' },
    { label: 'Initializing LLM client', status: 'pending' },
    { label: 'Loading system prompt', status: 'pending' },
    { label: 'Loading built-in tools', status: 'pending' },
    { label: 'Loading skills', status: 'pending' },
    { label: 'Connecting to MCP servers', status: 'pending' },
  ]);

  // 组件挂载时开始初始化 Agent
  useEffect(() => {
    void initializeAgent();
  }, []);

  /**
   * Spinner 动画计时器
   * 当有步骤处于 loading 状态时,每 80ms 更新一帧
   */
  useEffect(() => {
    const hasLoading = steps.some((step) => step.status === 'loading');
    if (!hasLoading) return;

    const timer = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % spinnerFrames.length);
    }, 80);

    return () => clearInterval(timer);
  }, [steps]);

  /**
   * Agent 初始化核心函数
   */
  async function initializeAgent() {
    try {
      const agentCore = new AgentCore(config, workspaceDir);

      await updateStep(1, 'loading');
      if (!agentCore.llmClient) {
        const { LLMClient } = await import('../llm-client/llm-client.js');
        agentCore.llmClient = new LLMClient(
          config.llm.apiKey,
          config.llm.apiBase,
          config.llm.provider,
          config.llm.model,
          config.llm.retry
        );

        // 测试 API 连接
        const isConnected = await agentCore.llmClient.checkConnection();
        if (!isConnected) {
          await updateStep(1, 'error');
          setError(
            'API connection failed. Please check your API key and network.'
          );
          setTimeout(() => exit(), 2000);
          return;
        }
      }
      await updateStep(1, 'completed');

      // 加载 System Prompt
      await updateStep(2, 'loading');
      let baseSystemPrompt: string;
      const systemPromptPath = Config.findConfigFile(
        config.agent.systemPromptPath
      );
      if (systemPromptPath && fs.existsSync(systemPromptPath)) {
        baseSystemPrompt = fs.readFileSync(systemPromptPath, 'utf8');
      } else {
        // 使用默认 system prompt
        baseSystemPrompt =
          'You are Mini-Agent, an intelligent assistant powered by MiniMax M2 that can help users complete various tasks.';
      }

      // 附加工作空间信息到 system prompt
      const workspacePart = `
## Current Workspace
You are currently working in: \`${workspaceDir}\`
All relative paths will be resolved relative to this directory.`;

      agentCore.systemPrompt = baseSystemPrompt + workspacePart;
      await updateStep(2, 'completed');

      // 加载内置工具
      await updateStep(3, 'loading');
      await agentCore['loadBuiltInTools']();
      await updateStep(3, 'completed');

      // 加载 Skills
      await updateStep(4, 'loading');
      await agentCore['loadSkills']();
      await updateStep(4, 'completed');

      // 连接 MCP 服务器
      await updateStep(5, 'loading');
      await agentCore['loadMcpTools']();
      await updateStep(5, 'completed');

      // 初始化 messages 数组
      agentCore.messages = [
        { role: 'system', content: agentCore.systemPrompt },
      ];

      // 设置 Agent 实例,触发界面切换
      setAgent(agentCore);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      setTimeout(() => exit(), 2000);
    }
  }

  /**
   * 更新指定步骤的状态
   * @param index - 步骤索引
   * @param status - 新状态
   */
  async function updateStep(index: number, status: ProgressStep['status']) {
    setSteps((prev) => {
      const newSteps = [...prev];
      if (newSteps[index]) {
        newSteps[index] = {
          ...newSteps[index],
          status,
        };
      }
      return newSteps;
    });

    // loading 状态添加短暂延迟,让用户能看到进度变化
    if (status === 'loading') {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  /**
   * 根据状态获取对应的图标
   * @param status - 步骤状态
   * @returns 对应的图标字符
   */
  function getStatusIcon(status: ProgressStep['status']): string {
    switch (status) {
      case 'completed':
        return '✓';
      case 'loading':
        return spinnerFrames[frameIndex];
      case 'error':
        return '✗';
      case 'pending':
      default:
        return '○';
    }
  }

  /**
   * 根据状态获取对应的颜色
   * @param status - 步骤状态
   * @returns 对应的主题颜色
   */
  function getStatusColor(status: ProgressStep['status']): string {
    switch (status) {
      case 'completed':
        return theme.status.success;
      case 'loading':
        return theme.status.warning;
      case 'error':
        return theme.status.error;
      case 'pending':
      default:
        return theme.text.secondary;
    }
  }

  // ===== 渲染: 错误状态 =====
  if (error) {
    return (
      <Box flexDirection="column" paddingX={2}>
        {/* 标题 */}
        <Box marginBottom={1}>
          <Text bold color={theme.text.accent}>
            Nano-Agent
          </Text>
          <Text dimColor color={theme.text.secondary}>
            {' '}
            - AI Agent with MCP Support
          </Text>
        </Box>
        {/* 步骤列表 */}
        {steps.map((step, index) => (
          <Box key={index}>
            <Text
              color={getStatusColor(step.status)}
              bold={step.status === 'loading'}
            >
              {getStatusIcon(step.status)}
            </Text>
            <Text> </Text>
            <Text
              color={
                step.status === 'completed'
                  ? theme.text.primary
                  : theme.text.secondary
              }
            >
              {step.label}
            </Text>
          </Box>
        ))}
        {/* 错误信息 */}
        <Box marginTop={1}>
          <Text color="red" bold>
            Error: {error}
          </Text>
        </Box>
      </Box>
    );
  }

  // ===== 渲染: 加载状态 =====
  if (!agent) {
    return (
      <Box flexDirection="column" paddingX={2}>
        {/* 标题 */}
        <Box marginBottom={1}>
          <Text bold color={theme.text.accent}>
            Nano-Agent
          </Text>
          <Text dimColor color={theme.text.secondary}>
            {' '}
            - AI Agent
          </Text>
        </Box>
        {/* 步骤列表 */}
        {steps.map((step, index) => (
          <Box key={index}>
            <Text
              color={getStatusColor(step.status)}
              bold={step.status === 'loading'}
            >
              {getStatusIcon(step.status)}
            </Text>
            <Text> </Text>
            <Text
              color={
                step.status === 'completed'
                  ? theme.text.primary
                  : theme.text.secondary
              }
            >
              {step.label}
            </Text>
          </Box>
        ))}
      </Box>
    );
  }

  // ===== 渲染: 初始化完成,切换到主应用 =====
  return <AppContainer agent={agent} />;
}
