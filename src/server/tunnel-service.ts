/**
 * @fileoverview Cloudflare Tunnel service — manages the cloudflared subprocess lifecycle.
 *
 * State machine: stopped → starting → running → stopped
 *                                   ↘ error  → stopped
 *
 * The binary is expected at ~/.nano-agent/bin/cloudflared (no download logic in MVP).
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import type { ChildProcess } from 'node:child_process';
import { getCloudflaredBinPath } from '../util/paths.js';
import { Logger } from '../util/logger.js';

export type TunnelStatus = 'stopped' | 'starting' | 'running' | 'error';

export interface TunnelState {
  status: TunnelStatus;
  url: string | null;
  error: string | null;
}

type StatusCallback = (state: TunnelState) => void;

const state: TunnelState = {
  status: 'stopped',
  url: null,
  error: null,
};

let process_: ChildProcess | null = null;
const statusCallbacks: StatusCallback[] = [];

function notifyStatus(): void {
  const snapshot = { ...state };
  for (const cb of statusCallbacks) {
    cb(snapshot);
  }
}

/**
 * Regex patterns to extract the public URL from cloudflared stdout/stderr.
 * Matches https://xxx.trycloudflare.com and similar patterns.
 */
const URL_PATTERNS = [
  /https:\/\/[a-zA-Z0-9\-]+\.trycloudflare\.com/,
  /https?:\/\/[a-zA-Z0-9\-]+\.trycloudflare\.com/,
  /https?:\/\/[a-zA-Z0-9\-]+\.pages\.dev/,
  /Your quick Tunnel has run and reached the necessary daemon.*?https?:\/\/([^\s]+)/,
];

/**
 * Start a Cloudflare Tunnel that proxies traffic to the given local port.
 *
 * @param localPort - The local port to expose via the tunnel.
 * @returns The public tunnel URL once cloudflared outputs it.
 * @throws If the binary is missing, spawn fails, or the 30s timeout is reached.
 */
export async function startTunnel(localPort: number): Promise<string> {
  if (state.status === 'running') {
    return state.url!;
  }

  if (state.status === 'starting') {
    throw new Error('Tunnel is already starting');
  }

  const binPath = getCloudflaredBinPath();
  if (!existsSync(binPath)) {
    throw new Error(
      `cloudflared binary not found at ${binPath}. ` +
        'Please ensure it is installed before starting the tunnel.'
    );
  }

  state.status = 'starting';
  state.error = null;
  notifyStatus();

  Logger.log('TUNNEL', 'Starting cloudflared', { localPort });

  return new Promise((resolve, reject) => {
    try {
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
        { stdio: ['ignore', 'pipe', 'pipe'] }
      );

      process_ = proc;

      const timeout = setTimeout(() => {
        Logger.log('TUNNEL', 'Timeout waiting for URL');
        state.status = 'error';
        state.error = 'Timeout waiting for tunnel URL';
        notifyStatus();
        proc.kill();
        reject(new Error('Timeout waiting for tunnel URL'));
      }, 30_000);

      let urlFound = false;

      /**
       * Try to extract a public URL from a chunk of cloudflared output.
       * Resolves the start promise on the first match.
       */
      const tryFindUrl = (data: string): void => {
        for (const pattern of URL_PATTERNS) {
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
            return;
          }
        }
      };

      proc.stderr?.on('data', (data: Buffer) => tryFindUrl(data.toString()));
      proc.stdout?.on('data', (data: Buffer) => tryFindUrl(data.toString()));

      proc.on('exit', (code) => {
        if (!urlFound) {
          clearTimeout(timeout);
          reject(
            new Error(
              `cloudflared exited with code ${code} before URL was found`
            )
          );
        }
        process_ = null;
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
        process_ = null;
        notifyStatus();
        if (!urlFound) {
          reject(error);
        }
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      Logger.log('TUNNEL', 'Failed to start', err.message);
      state.status = 'error';
      state.error = err.message;
      notifyStatus();
      reject(err);
    }
  });
}

/**
 * Stop the running cloudflared subprocess.
 * Sends SIGTERM first; if the process is still alive, sends SIGKILL.
 */
export async function stopTunnel(): Promise<void> {
  if (!process_) return;

  Logger.log('TUNNEL', 'Stopping tunnel...');

  try {
    process_.kill('SIGTERM');
  } catch {
    try {
      process_.kill('SIGKILL');
    } catch {
      // Process may have already exited
    }
  }

  process_ = null;
  state.url = null;
  state.status = 'stopped';
  state.error = null;
  notifyStatus();

  Logger.log('TUNNEL', 'Tunnel stopped');
}

/**
 * Register a callback that fires whenever the tunnel state changes.
 */
export function onStatusChange(callback: StatusCallback): void {
  statusCallbacks.push(callback);
}

/**
 * Remove a previously registered status change callback. Used by tests.
 */
export function offStatusChange(callback: StatusCallback): void {
  const idx = statusCallbacks.indexOf(callback);
  if (idx !== -1) {
    statusCallbacks.splice(idx, 1);
  }
}

/**
 * Return a snapshot of the current tunnel state.
 */
export function getTunnelStatus(): TunnelState {
  return { ...state };
}

/**
 * Reset internal state — used only by tests.
 */
export function _resetState(): void {
  process_ = null;
  state.status = 'stopped';
  state.url = null;
  state.error = null;
  statusCallbacks.length = 0;
}
