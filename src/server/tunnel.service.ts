import { ChildProcess, spawn } from 'child_process';
import { existsSync } from 'fs';

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

/**
 * Get the path to the cloudflared binary
 * Handles ASAR unpacking for Electron apps
 * @returns {Promise<string>} The absolute path to the cloudflared binary
 * @throws {Error} If cloudflared cannot be imported
 */
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
 * Start a Cloudflare tunnel to expose the local server publicly
 * Automatically installs cloudflared binary if not,
 * Parses stdout/stderr to extract the public URL
 * Times out after 30 seconds if URL is not found
 *
 * @param {number} localPort - The local port to tunnel (e.g., 3847)
 * @returns {Promise<string>} The public tunnel URL (e.g., https://xxx.trycloudflare.com)
 * @throws {Error} If tunnel fails to start or times out
 *
 * @example
 * const url = await startTunnel(3847);
 * console.log(`Public URL: ${url}`);
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

        console.log('[Tunnel] Starting cloudflared...');
        console.log('[Tunnel] Binary at:', binPath);

        // Check if binary exists, skip installation if it does
        if (!existsSync(binPath)) {
          console.log('[Tunnel] Binary not found, installing...');
          try {
            await cloudflared.install(binPath);
          } catch (installError) {
            console.error('[Tunnel] Failed to install binary:', installError);
            throw new Error(
              'Failed to download cloudflared binary. ' +
              'Please check your network connection to GitHub. ' +
              'Alternatively, you can manually download from: ' +
              'https://github.com/cloudflare/cloudflared/releases'
            );
          }
        } else {
          console.log('[Tunnel] Binary already exists, skipping installation');
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
          console.error('[Tunnel] Timeout waiting for URL');
          state.status = 'error';
          state.error = 'Timeout waiting for tunnel URL';
          notifyStatus();
          proc.kill();
          reject(new Error('Timeout waiting for tunnel URL'));
        }, 30000);

        let urlFound = false;

        // Parse both stdout and stderr for the tunnel URL
        const tryFindUrl = (data: string) => {
          console.log('[Tunnel] output:', data);

          // Try multiple URL patterns
          const patterns = [
            /https:\/\/[a-zA-Z0-9\-]+\.trycloudflare\.com/, // Main URL pattern
            /https?:\/\/[a-zA-Z0-9\-]+\.trycloudflare\.com/, // Optional http/s
            /https?:\/\/[a-zA-Z0-9\-]+\.pages\.dev/, // Alternative pattern
            /Your quick Tunnel has run and reached the necessary daemon.*?https?:\/\/([^\s]+)/, // From cloudflared message
          ];

          for (const pattern of patterns) {
            const match = data.match(pattern);
            if (match && !urlFound) {
              const url = match[1] || match[0];
              console.log('[Tunnel] 🎉 Got URL:', url);
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

        // Parse stderr for the tunnel URL
        proc.stderr?.on('data', (data: Buffer) => {
          if (tryFindUrl(data.toString())) {
            return;
          }
        });

        // Parse stdout for the tunnel URL
        proc.stdout?.on('data', (data: Buffer) => {
          if (tryFindUrl(data.toString())) {
            return;
          }
        });

        proc.stdout?.on('data', (data: Buffer) => {
          console.log('[Tunnel] stdout:', data.toString());
        });

        proc.on('exit', (code) => {
          console.log('[Tunnel] Process exited with code:', code);
          if (!urlFound) {
            clearTimeout(timeout);
          }
          state.process = null;
          state.url = null;
          state.status = 'stopped';
          notifyStatus();
        });

        proc.on('error', (error: Error) => {
          console.error('[Tunnel] Process error:', error);
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
        console.error('[Tunnel] Failed to start:', err);
        state.status = 'error';
        state.error = err.message;
        notifyStatus();
        reject(err);
      }
    })().catch(reject);
  });
}

/**
 * Stop the active Cloudflare tunnel process
 * Attempts SIGTERM first, falls back to SIGKILL if needed
 * Resets tunnel state to stopped
 *
 * @returns {Promise<void>}
 */
export async function stopTunnel(): Promise<void> {
  if (state.process) {
    console.log('[Tunnel] Stopping tunnel...');

    try {
      state.process.kill('SIGTERM');
    } catch (error) {
      console.error('[Tunnel] Error stopping tunnel:', error);
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

    console.log('[Tunnel] Tunnel stopped');
  }
}

/**
 * Register a callback to be notified of tunnel status changes
 * Only one callback can be registered at a time
 *
 * @param {StatusCallback} callback - Function to call when tunnel status changes
 */
export function onTunnelStatusChange(callback: StatusCallback): void {
  statusCallback = callback;
}

function notifyStatus(): void {
  if (statusCallback) {
    statusCallback({ ...state });
  }
}
