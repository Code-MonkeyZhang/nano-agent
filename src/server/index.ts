import * as net from 'node:net';
import * as fs from 'node:fs';
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

/**
 * 检查指定端口是否可用
 * @param port - 要检查的端口号
 * @returns 如果端口可用返回 true，否则返回 false
 */
function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, '0.0.0.0', () => {
      server.once('close', () => resolve(true));
      server.close();
    });
    server.on('error', () => resolve(false));
  });
}

/**
 * 获取一个可用的端口号
 * 让系统自动分配一个空闲端口
 * @returns 可用的端口号，如果失败则返回默认端口 3847
 */
function getAvailablePort(): Promise<number> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(0, '0.0.0.0', () => {
      const address = server.address();
      const port =
        typeof address === 'object' && address !== null ? address.port : null;
      server.close(() => resolve(port ?? 3847));
    });
  });
}

type ServerStatusCallback = (state: ServerState) => void;

/**
 * Server 管理器
 * 负责管理 HTTP Server、WebSocket Server 和 Cloudflare Tunnel 的生命周期
 * 使用单例模式，整个程序只有一个实例
 */
class ServerManager {
  private static instance: ServerManager | null = null;
  private config: Config;
  private currentPort: number | null = null;
  private isServerRunning = false;
  private statusCallback: ServerStatusCallback | null = null;
  private enableTunnel = false;
  private tunnelFailed = false;

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

  /**
   * 获取 ServerManager 单例实例
   * @returns ServerManager 实例
   */
  static getInstance(): ServerManager {
    if (!ServerManager.instance) {
      ServerManager.instance = new ServerManager();
    }
    return ServerManager.instance;
  }

  /**
   * 注册状态变化回调函数
   * 当 server 状态发生变化时（如启动、停止、tunnel 连接成功/失败）会调用此回调
   * @param callback - 状态变化时的回调函数，接收新的 ServerState
   */
  onStatusChange(callback: ServerStatusCallback): void {
    this.statusCallback = callback;
  }

  /**
   * 获取当前 server 状态
   * @returns 包含状态、端口、URL 等信息的 ServerState 对象
   */
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

  /**
   * 获取本地访问 URL
   * @returns 本地 URL，如 http://localhost:3847，如果未启动则返回 undefined
   */
  private getLocalUrl(): string | undefined {
    if (this.currentPort) {
      return `http://localhost:${this.currentPort}`;
    }
    return undefined;
  }

  /**
   * 通知状态变化
   * 调用已注册的回调函数，通知 server 状态发生变化
   * @param state - 新的 server 状态
   */
  private notifyStatus(state: ServerState): void {
    if (this.statusCallback) {
      this.statusCallback(state);
    }
  }

  /**
   * 启动 HTTP Server
   * 会依次：设置路由 → 初始化 WebSocket → 启动 HTTP 监听 → 启动 Tunnel（可选）
   * @param options - 启动选项
   * @param options.enableTunnel - 是否启用 Cloudflare Tunnel 以获取公网访问地址
   * @returns 启动结果，包含 success 和可能的 error 信息
   */
  async start(options: {
    enableTunnel: boolean;
  }): Promise<{ success: boolean; error?: string }> {
    if (this.isServerRunning) {
      return { success: true };
    }

    this.enableTunnel = options.enableTunnel;
    this.tunnelFailed = false;

    const workspaceDir = process.cwd();

    if (this.config.logging.enableLogging) {
      Logger.initialize(undefined, 'server');
      Logger.log('SERVER', 'Starting server', {
        workspaceDir,
        enableTunnel: options.enableTunnel,
      });
    }

    if (!fs.existsSync(workspaceDir)) {
      fs.mkdirSync(workspaceDir, { recursive: true });
    }

    let port: number;
    const configPort = this.config.openaiHttpServer?.port;

    if (configPort && (await isPortAvailable(configPort))) {
      port = configPort;
    } else {
      port = await getAvailablePort();
    }

    this.currentPort = port;

    this.notifyStatus({
      status: 'starting',
      port,
      localUrl: this.getLocalUrl(),
    });

    if (this.config.logging.enableLogging) {
      Logger.log('SERVER', `Using port: ${port}`);
    }

    try {
      await setupOpenAIRoutes(this.config, workspaceDir);
      if (this.config.logging.enableLogging) {
        Logger.log('SERVER', 'OpenAI routes configured');
      }

      initWebSocket();
      if (this.config.logging.enableLogging) {
        Logger.log('SERVER', 'WebSocket initialized');
      }

      await new Promise<void>((resolve, reject) => {
        httpServer.listen(port, '0.0.0.0', () => {
          if (this.config.logging.enableLogging) {
            Logger.log('SERVER', `HTTP server listening on port ${port}`);
          }
          resolve();
        });
        httpServer.on('error', (err) => {
          reject(err);
        });
      });

      this.isServerRunning = true;

      if (options.enableTunnel) {
        try {
          const url = await startTunnel(port);
          if (this.config.logging.enableLogging) {
            Logger.log('SERVER', `Tunnel started: ${url}`);
          }
        } catch (tunnelError) {
          if (this.config.logging.enableLogging) {
            Logger.log('SERVER', `Tunnel failed: ${tunnelError}`);
          }
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
      this.isServerRunning = false;
      this.currentPort = null;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.notifyStatus({
        status: 'error',
        error: errorMessage,
      });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * 停止 HTTP Server
   * 会依次：停止 Tunnel → 关闭 HTTP Server → 关闭 WebSocket
   */
  async stop(): Promise<void> {
    if (!this.isServerRunning) {
      return;
    }

    if (this.config.logging.enableLogging) {
      Logger.log('SERVER', 'Stopping server...');
    }

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

    if (this.config.logging.enableLogging) {
      Logger.log('SERVER', 'Server stopped');
    }
  }

  /**
   * 检查 server 是否正在运行
   * @returns 如果 server 正在运行返回 true
   */
  isRunning(): boolean {
    return this.isServerRunning;
  }

  /**
   * 获取当前 server 使用的端口
   * @returns 端口号，如果 server 未运行则返回 null
   */
  getPort(): number | null {
    return this.currentPort;
  }
}

/**
 * 获取 ServerManager 单例实例
 * @returns ServerManager 实例
 */
export function getServerManager(): ServerManager {
  return ServerManager.getInstance();
}
