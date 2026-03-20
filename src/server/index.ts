import * as net from 'node:net';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { httpServer, setupOpenAIRoutes } from './http-server.js';
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
  setDefaultWorkspaceDir,
  setGlobalRetryConfig,
} from '../agent-factory/index.js';
import { setMcpTimeoutConfig } from '../tools/index.js';
import { SessionStore } from '../session/store.js';
import { SessionManager } from '../session/manager.js';
import type { SessionManagersMap } from './http-server.js';
import {
  getDataDir,
  getWorkspaceDir,
  getConfigDir,
  getLogsDir,
} from '../paths.js';

export const sessionManagers: SessionManagersMap = new Map();

export function registerSessionManager(
  agentId: string,
  manager: SessionManager
): void {
  sessionManagers.set(agentId, manager);
}

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

/**
 * Initialize all directories and default configuration files.
 * Creates the complete directory structure and writes default config files
 * if they don't exist. This should be called before loading any configuration.
 */
function initAllDirsAndFiles(): void {
  const configDir = getConfigDir();
  const dataDir = getDataDir();
  const workspaceDir = getWorkspaceDir();
  const logsDir = getLogsDir();
  const agentsDir = path.join(dataDir, 'agents');

  const dirs = [configDir, dataDir, agentsDir, workspaceDir, logsDir];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const configPath = path.join(configDir, 'config.yaml');
  if (!fs.existsSync(configPath)) {
    const defaultConfig = Config.createDefault();
    fs.writeFileSync(configPath, defaultConfig.toYamlString());
  }

  const mcpPath = path.join(configDir, 'mcp.json');
  if (!fs.existsSync(mcpPath)) {
    fs.writeFileSync(mcpPath, '{\n  "mcpServers": {}\n}\n');
  }

  const credentialsPath = path.join(dataDir, 'credentials.json');
  if (!fs.existsSync(credentialsPath)) {
    fs.writeFileSync(credentialsPath, '{}\n');
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
    initAllDirsAndFiles();

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

    const workspaceDir = getWorkspaceDir();

    Logger.initialize(undefined, 'server', this.config.enableLogging);
    Logger.log('SERVER', 'Starting server', {
      workspaceDir,
      enableTunnel: options.enableTunnel,
    });

    if (!fs.existsSync(workspaceDir)) {
      fs.mkdirSync(workspaceDir, { recursive: true });
    }

    let port: number;
    const envPort = process.env['PORT'];

    if (envPort) {
      const parsedPort = parseInt(envPort, 10);
      if (isNaN(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
        const errorMessage = `Invalid PORT environment variable: ${envPort}`;
        this.notifyStatus({
          status: 'error',
          error: errorMessage,
        });
        return { success: false, error: errorMessage };
      }
      port = parsedPort;
      Logger.log(
        'SERVER',
        `Using port from PORT environment variable: ${port}`
      );
    } else {
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
    }

    this.currentPort = port;

    this.notifyStatus({
      status: 'starting',
      port,
      localUrl: this.getLocalUrl(),
    });

    Logger.log('SERVER', `Using port: ${port}`);

    try {
      setDefaultWorkspaceDir(workspaceDir);

      initCredentialPool(path.join(getDataDir(), 'credentials.json'));
      initAgentConfigStore(path.join(getDataDir(), 'agents'));
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

      // Create SessionStore and SessionManager for each agent
      sessionManagers.clear();
      const agentConfigs = listAgentConfigs();
      for (const agentConfig of agentConfigs) {
        const agentBasePath = path.join(getDataDir(), 'agents', agentConfig.id);
        const sessionStore = new SessionStore(agentBasePath);
        const sessionManager = new SessionManager(sessionStore, agentConfig.id);
        registerSessionManager(agentConfig.id, sessionManager);
        Logger.log(
          'SERVER',
          `Initialized session manager for agent: ${agentConfig.id}`
        );
      }

      await setupOpenAIRoutes(sessionManagers);
      Logger.log('SERVER', 'OpenAI routes configured');

      initWebSocket(sessionManagers);
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
        const errorMessage = envPort
          ? `Port ${port} is already in use. Cannot start server on specified port ${port}.`
          : `Port ${port} is already in use`;

        Logger.log('SERVER', errorMessage);
        this.cleanupOnError();
        this.notifyStatus({
          status: 'error',
          error: errorMessage,
        });
        return { success: false, error: errorMessage };
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
