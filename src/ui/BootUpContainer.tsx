import { useState, useEffect } from 'react';
import { Box, Text, useApp } from 'ink';
import { AppContainer } from './AppContainer.js';
import { AgentCore } from '../agent.js';
import { theme } from './themes.js';
import { initBuiltinToolPool } from '../builtin-tool-pool/store.js';
import { initSkillPool } from '../skill-pool/store.js';
import { initCredentialPool } from '../credential/store.js';
import {
  initAgentConfigStore,
  listAgentConfigs,
} from '../agent-config/store.js';
import { createAgent, setDefaultWorkspaceDir } from '../agent-factory/index.js';
import { Config } from '../config.js';
import * as path from 'node:path';
import * as fs from 'node:fs';

interface BootUpContainerProps {
  config: Config;
  workspaceDir: string;
}

const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

const DATA_DIR = path.resolve(process.cwd(), 'data');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function BootUpContainer({
  config,
  workspaceDir,
}: BootUpContainerProps) {
  const [agent, setAgent] = useState<AgentCore | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [frameIndex, setFrameIndex] = useState(0);
  const { exit } = useApp();

  useEffect(() => {
    void initializeAgent();
  }, []);

  useEffect(() => {
    if (!loading) return;

    const timer = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % spinnerFrames.length);
    }, 80);

    return () => clearInterval(timer);
  }, [loading]);

  async function initializeAgent() {
    try {
      ensureDataDir();

      setDefaultWorkspaceDir(workspaceDir);

      initCredentialPool(path.join(DATA_DIR, 'credentials.json'));

      initAgentConfigStore(path.join(DATA_DIR, 'agents'));
      const agentConfigs = listAgentConfigs();
      if (agentConfigs.length === 0) {
        throw new Error('No agent configs found');
      }

      initBuiltinToolPool(workspaceDir);

      const skillsDir = config.tools.skillsDir;
      const resolvedSkillsDir = path.resolve(skillsDir);
      initSkillPool(resolvedSkillsDir);

      const defaultAgent = agentConfigs[0];
      const agentCore = await createAgent(defaultAgent.id, workspaceDir);

      setLoading(false);
      setAgent(agentCore);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setLoading(false);
      setError(errorMessage);
      setTimeout(() => exit(), 2000);
    }
  }

  if (error) {
    return (
      <Box flexDirection="column" paddingX={2}>
        <Box marginBottom={1}>
          <Text bold color={theme.text.accent}>
            Nano-Agent
          </Text>
          <Text dimColor color={theme.text.secondary}>
            {' '}
            - AI Agent with MCP Support
          </Text>
        </Box>
        <Box marginTop={1}>
          <Text color="red" bold>
            Error: {error}
          </Text>
        </Box>
      </Box>
    );
  }

  if (!agent) {
    return (
      <Box flexDirection="column" paddingX={2}>
        <Box marginBottom={1}>
          <Text bold color={theme.text.accent}>
            Nano-Agent
          </Text>
          <Text dimColor color={theme.text.secondary}>
            {' '}
            - AI Agent
          </Text>
        </Box>
        <Box>
          <Text color={theme.status.warning} bold>
            {spinnerFrames[frameIndex]}
          </Text>
          <Text> </Text>
          <Text color={theme.text.secondary}>Initializing agent...</Text>
        </Box>
      </Box>
    );
  }

  return <AppContainer agent={agent} />;
}
