import * as net from 'node:net';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  httpServer,
  setupOpenAIRoutes,
  setGlobalAgent,
} from './http-server.js';
import { initWebSocket, shutdownWebSocket } from './websocket-server.js';
import {
  startTunnel,
  stopTunnel,
  getTunnelState,
  onTunnelStatusChange,
} from './tunnel.service.js';
import { Config } from '../config.js';
import { Logger } from '../util/logger.js';
import type { ServerState } from '../ui/types.js';
import { initBuiltinToolPool } from '../builtin-tool-pool/store.js';
import { initMcpPool } from '../mcp-pool/store.js';
import { initSkillPool } from '../skill-pool/store.js';
import { initCredentialPool } from '../credential/store.js';
import {
  initAgentConfigStore,
  listAgentConfigs,
} from '../agent-config/store.js';
import {
  createAgent,
  setDefaultWorkspaceDir,
  setGlobalRetryConfig,
} from '../agent-factory/index.js';
import { setMcpTimeoutConfig } from '../tools/index.js';

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => {
      server.close(() => resolve(false));
    });
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '0.0.0.0');
  });
}

type ServerStatusCallback = (state: ServerState) => void;

const DATA_DIR = path.resolve(process.cwd(), 'data');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

class ServerManager {
  private static instance: ServerManager | null = null;
  private config: Config;
  private currentPort: number | null = null;
  private isServerRunning = false;
  private statusCallback: ServerStatusCallback | null = null;
  private enableTunnel = false;
  private tunnelFailed = false;

  private readonly PORT_START = 3847;
  private readonly PORT_END = 3866;

  private constructor() {
    const configPath = Config.findConfigFile('config.yaml');
    this.config = Config.fromYaml(configPath!);

    onTunnelStatusChange((tunnelState) => {
      if (!this.isServerRunning) return;

      if (tunnelState.status === 'running' && tunnelState.url) {
        this.tunnelFailed = false;
        this.notifyStatus({
          status: 'running',
          port: this.currentPort ?? undefined,
          localUrl: this.getLocalUrl(),
          publicUrl: tunnelState.url,
        });
      } else if (tunnelState.status === 'error' && this.enableTunnel) {
        this.tunnelFailed = true;
        this.notifyStatus({
          status: 'local',
          port: this.currentPort ?? undefined,
          localUrl: this.getLocalUrl(),
          error: tunnelState.error ?? 'Tunnel failed',
        });
      }
    });
  }

  static getInstance(): ServerManager {
    if (!ServerManager.instance) {
      ServerManager.instance = new ServerManager();
    }
    return ServerManager.instance;
  }

  onStatusChange(callback: ServerStatusCallback): void {
    this.statusCallback = callback;
  }

  getState(): ServerState {
    if (!this.isServerRunning) {
      return { status: 'stopped' };
    }

    const tunnelState = getTunnelState();
    const baseState: ServerState = {
      status: 'starting',
      port: this.currentPort ?? undefined,
      localUrl: this.getLocalUrl(),
    };

    if (this.enableTunnel) {
      if (tunnelState.status === 'running' && tunnelState.url) {
        baseState.status = 'running';
        baseState.publicUrl = tunnelState.url;
      } else if (this.tunnelFailed) {
        baseState.status = 'local';
      } else {
        baseState.status = 'starting';
      }
    } else {
      baseState.status = 'local';
    }

    return baseState;
  }

  private getLocalUrl(): string | undefined {
    if (this.currentPort) {
      return `http://localhost:${this.currentPort}`;
    }
    return undefined;
  }

  private notifyStatus(state: ServerState): void {
    if (this.statusCallback) {
      this.statusCallback(state);
    }
  }

  async start(options: {
    enableTunnel: boolean;
  }): Promise<{ success: boolean; error?: string }> {
    if (this.isServerRunning) {
      return { success: true };
    }

    this.enableTunnel = options.enableTunnel;
    this.tunnelFailed = false;

    const workspaceDir = process.cwd();

    Logger.initialize(undefined, 'server', this.config.enableLogging);
    Logger.log('SERVER', 'Starting server', {
      workspaceDir,
      enableTunnel: options.enableTunnel,
    });

    if (!fs.existsSync(workspaceDir)) {
      fs.mkdirSync(workspaceDir, { recursive: true });
    }

    let port: number;
    try {
      port = await this.findAvailablePort(this.PORT_START);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'No available ports';
      this.notifyStatus({
        status: 'error',
        error: errorMessage,
      });
      return { success: false, error: errorMessage };
    }

    this.currentPort = port;

    this.notifyStatus({
      status: 'starting',
      port,
      localUrl: this.getLocalUrl(),
    });

    Logger.log('SERVER', `Using port: ${port}`);

    try {
      ensureDataDir();
      setDefaultWorkspaceDir(workspaceDir);

      initCredentialPool(path.join(DATA_DIR, 'credentials.json'));
      initAgentConfigStore(path.join(DATA_DIR, 'agents'));
      initBuiltinToolPool(workspaceDir);
      setGlobalRetryConfig(this.config.retry);

      const skillsDir = this.config.tools.skillsDir;
      const resolvedSkillsDir = path.resolve(skillsDir);
      initSkillPool(resolvedSkillsDir);

      const mcpConfigPath = Config.findConfigFile(
        this.config.tools.mcpConfigPath
      );
      if (mcpConfigPath) {
        setMcpTimeoutConfig(this.config.tools.mcp);
        await initMcpPool(mcpConfigPath);
      }

      const agentConfigs = listAgentConfigs();
      if (agentConfigs.length === 0) {
        throw new Error('No agent configs found');
      }

      const defaultAgent = agentConfigs[0];
      const agentCore = await createAgent(defaultAgent.id, workspaceDir);
      setGlobalAgent(agentCore);

      Logger.log('SERVER', `Agent '${defaultAgent.name}' created`);

      await setupOpenAIRoutes();
      Logger.log('SERVER', 'OpenAI routes configured');

      initWebSocket();
      Logger.log('SERVER', 'WebSocket initialized');

      await this.listenOnPort(port);

      this.isServerRunning = true;

      if (options.enableTunnel) {
        try {
          const url = await startTunnel(port);
          Logger.log('SERVER', `Tunnel started: ${url}`);
        } catch (tunnelError) {
          Logger.log('SERVER', `Tunnel failed: ${tunnelError}`);
          this.tunnelFailed = true;
          this.notifyStatus({
            status: 'local',
            port,
            localUrl: this.getLocalUrl(),
            error:
              tunnelError instanceof Error
                ? tunnelError.message
                : 'Tunnel failed',
          });
        }
      } else {
        this.notifyStatus({
          status: 'local',
          port,
          localUrl: this.getLocalUrl(),
        });
      }

      return { success: true };
    } catch (error) {
      const err = error as NodeJS.ErrnoException;

      if (err.code === 'EADDRINUSE') {
        Logger.log('SERVER', `Port ${port} still in use, trying ${port + 1}`);
        this.cleanupOnError();

        const nextPort = port + 1;
        if (nextPort <= this.PORT_END) {
          return this.start(options);
        } else {
          const errorMessage = `All ports in range ${this.PORT_START}-${this.PORT_END} are occupied`;
          this.notifyStatus({
            status: 'error',
            error: errorMessage,
          });
          return { success: false, error: errorMessage };
        }
      }

      this.cleanupOnError();
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.notifyStatus({
        status: 'error',
        error: errorMessage,
      });
      return { success: false, error: errorMessage };
    }
  }

  async stop(): Promise<void> {
    if (!this.isServerRunning) {
      return;
    }

    Logger.log('SERVER', 'Stopping server...');

    await stopTunnel();

    await new Promise<void>((resolve) => {
      httpServer.close(() => {
        resolve();
      });
    });

    shutdownWebSocket();
    this.isServerRunning = false;
    this.currentPort = null;
    this.tunnelFailed = false;

    this.notifyStatus({ status: 'stopped' });

    Logger.log('SERVER', 'Server stopped');
  }

  isRunning(): boolean {
    return this.isServerRunning;
  }

  getPort(): number | null {
    return this.currentPort;
  }

  private async findAvailablePort(startPort: number): Promise<number> {
    for (let port = startPort; port <= this.PORT_END; port++) {
      const available = await isPortAvailable(port);
      if (available) {
        return port;
      }
    }
    throw new Error(
      `No available ports in range ${this.PORT_START}-${this.PORT_END}`
    );
  }

  private cleanupOnError(): void {
    shutdownWebSocket();

    try {
      httpServer.removeAllListeners('error');
      httpServer.close();
    } catch {
      // Ignore errors during cleanup
    }

    this.isServerRunning = false;
    this.currentPort = null;
    this.tunnelFailed = false;
  }

  private async listenOnPort(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      httpServer.listen(port, '0.0.0.0', () => {
        Logger.log('SERVER', `HTTP server listening on port ${port}`);
        resolve();
      });

      httpServer.once('error', (err: NodeJS.ErrnoException) => {
        reject(err);
      });
    });
  }
}

export function getServerManager(): ServerManager {
  return ServerManager.getInstance();
}
