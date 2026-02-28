import { ChildProcess, spawn } from 'child_process';
import { existsSync } from 'fs';
import { Logger } from '../util/logger.js';

interface TunnelState {
  process: ChildProcess | null;
  url: string | null;
  status: 'stopped' | 'starting' | 'running' | 'error';
  error: string | null;
}

const state: TunnelState = {
  process: null,
  url: null,
  status: 'stopped',
  error: null,
};

type StatusCallback = (status: TunnelState) => void;
let statusCallback: StatusCallback | null = null;

async function getBinaryPath(): Promise<string> {
  try {
    const cloudflared = await import('cloudflared');
    let binPath = cloudflared.bin;

    if (binPath.includes('app.asar')) {
      binPath = binPath.replace('app.asar', 'app.asar.unpacked');
    }

    return binPath;
  } catch (error) {
    throw new Error(`Failed to import cloudflared: ${error}`);
  }
}

/**
 * 启动 Cloudflare Tunnel
 * @param localPort - 本地端口号
 * @returns Tunnel 的公网 URL
 */
export async function startTunnel(localPort: number): Promise<string> {
  if (state.status === 'running') {
    return state.url!;
  }

  if (state.status === 'starting') {
    throw new Error('Tunnel is already starting');
  }

  state.status = 'starting';
  state.error = null;
  notifyStatus();

  return new Promise((resolve, reject) => {
    (async () => {
      try {
        const cloudflared = await import('cloudflared');
        const binPath = await getBinaryPath();

        Logger.log('TUNNEL', 'Starting cloudflared', { localPort });

        if (!existsSync(binPath)) {
          Logger.log('TUNNEL', 'Binary not found, installing...');
          try {
            await cloudflared.install(binPath);
          } catch (installError) {
            Logger.log(
              'TUNNEL',
              'Failed to install binary',
              String(installError)
            );
            throw new Error(
              'Failed to download cloudflared binary. ' +
                'Please check your network connection to GitHub. ' +
                'Alternatively, you can manually download from: ' +
                'https://github.com/cloudflare/cloudflared/releases'
            );
          }
        }

        const proc = spawn(
          binPath,
          [
            'tunnel',
            '--url',
            `http://localhost:${localPort}`,
            '--protocol',
            'http2',
            '--no-autoupdate',
          ],
          {
            stdio: ['ignore', 'pipe', 'pipe'],
          }
        );

        state.process = proc;

        const timeout = setTimeout(() => {
          Logger.log('TUNNEL', 'Timeout waiting for URL');
          state.status = 'error';
          state.error = 'Timeout waiting for tunnel URL';
          notifyStatus();
          proc.kill();
          reject(new Error('Timeout waiting for tunnel URL'));
        }, 30000);

        let urlFound = false;

        const tryFindUrl = (data: string) => {
          const patterns = [
            /https:\/\/[a-zA-Z0-9\-]+\.trycloudflare\.com/,
            /https?:\/\/[a-zA-Z0-9\-]+\.trycloudflare\.com/,
            /https?:\/\/[a-zA-Z0-9\-]+\.pages\.dev/,
            /Your quick Tunnel has run and reached the necessary daemon.*?https?:\/\/([^\s]+)/,
          ];

          for (const pattern of patterns) {
            const match = data.match(pattern);
            if (match && !urlFound) {
              const url = match[1] || match[0];
              Logger.log('TUNNEL', 'Got URL', url);
              urlFound = true;
              clearTimeout(timeout);
              state.url = url;
              state.status = 'running';
              notifyStatus();
              resolve(url);
              return true;
            }
          }
          return false;
        };

        proc.stderr?.on('data', (data: Buffer) => {
          tryFindUrl(data.toString());
        });

        proc.stdout?.on('data', (data: Buffer) => {
          tryFindUrl(data.toString());
        });

        proc.on('exit', (code) => {
          if (!urlFound) {
            clearTimeout(timeout);
          }
          state.process = null;
          state.url = null;
          state.status = 'stopped';
          notifyStatus();
          Logger.log('TUNNEL', 'Process exited', { code });
        });

        proc.on('error', (error: Error) => {
          Logger.log('TUNNEL', 'Process error', error.message);
          clearTimeout(timeout);
          state.error = error.message;
          state.status = 'error';
          state.process = null;
          notifyStatus();
          if (!urlFound) {
            reject(error);
          }
        });
      } catch (error: unknown) {
        const err = error as Error;
        Logger.log('TUNNEL', 'Failed to start', err.message);
        state.status = 'error';
        state.error = err.message;
        notifyStatus();
        reject(err);
      }
    })().catch(reject);
  });
}

/**
 * 停止 Cloudflare Tunnel
 */
export async function stopTunnel(): Promise<void> {
  if (state.process) {
    Logger.log('TUNNEL', 'Stopping tunnel...');

    try {
      state.process.kill('SIGTERM');
    } catch {
      try {
        state.process.kill('SIGKILL');
      } catch {
        // Ignore
      }
    }

    state.process = null;
    state.url = null;
    state.status = 'stopped';
    state.error = null;
    notifyStatus();

    Logger.log('TUNNEL', 'Tunnel stopped');
  }
}

/**
 * 注册 Tunnel 状态变化回调
 * @param callback - 状态变化时的回调函数
 */
export function onTunnelStatusChange(callback: StatusCallback): void {
  statusCallback = callback;
}

function notifyStatus(): void {
  if (statusCallback) {
    statusCallback({ ...state });
  }
}

/**
 * 获取当前 Tunnel 状态
 * @returns Tunnel 状态对象
 */
export function getTunnelState(): {
  status: 'stopped' | 'starting' | 'running' | 'error';
  url: string | null;
  error: string | null;
} {
  return {
    status: state.status,
    url: state.url,
    error: state.error,
  };
}
