/**
 * @fileoverview Tests for Cloudflare Tunnel integration.
 *
 * Covers three layers:
 * 1. Server-info helpers (readServerInfo, updateTunnelUrl, clearTunnelUrl)
 * 2. Tunnel-service core (state machine, spawn, URL parsing)
 * 3. Tunnel REST API router (POST /start, POST /stop, GET /status)
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from 'vitest';
import express, { type Express } from 'express';
import { createServer, type Server } from 'http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as net from 'node:net';
import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';

// --- Mocks (paths are relative from tests/ to src/) ---

let tempDir: string;
let serverJsonPath: string;
let cloudflaredBinPath: string;

vi.mock('../src/util/paths.js', () => ({
  getServerJsonPath: () => serverJsonPath,
  getConfigDir: () => path.dirname(serverJsonPath),
  getBinDir: () => path.dirname(cloudflaredBinPath),
  getCloudflaredBinPath: () => cloudflaredBinPath,
}));

vi.mock('../src/util/logger.js', () => ({
  Logger: {
    log: vi.fn(),
    initialize: vi.fn(),
    setEnabled: vi.fn(),
    setSessionManagers: vi.fn(),
  },
}));

/**
 * Fake ChildProcess that simulates cloudflared output.
 * Emits stderr data with a tunnel URL after a configurable delay.
 */
function createFakeChildProcess(
  url: string,
  delayMs: number
): ChildProcess & { emitStderr: (data: string) => void } {
  const emitter = new EventEmitter() as ChildProcess & {
    emitStderr: (data: string) => void;
  };

  const stderr = new EventEmitter();
  const stdout = new EventEmitter();

  emitter.stderr = stderr;
  emitter.stdout = stdout;
  emitter.kill = vi.fn(() => {
    emitter.emit('exit', 0);
  });

  emitter.emitStderr = (data: string) => {
    stderr.emit('data', Buffer.from(data));
  };

  setTimeout(() => {
    stderr.emit(
      'data',
      Buffer.from(
        `INF | Your quick Tunnel has been created! Visit it at ${url}`
      )
    );
  }, delayMs);

  return emitter;
}

/**
 * Fake ChildProcess that never emits a URL (for timeout/stuck testing).
 */
function createStuckChildProcess(): ChildProcess {
  const emitter = new EventEmitter() as ChildProcess;
  emitter.stderr = new EventEmitter();
  emitter.stdout = new EventEmitter();
  emitter.kill = vi.fn();
  return emitter;
}

let mockSpawn: ReturnType<typeof vi.fn>;

vi.mock('node:child_process', () => ({
  spawn: (...args: unknown[]) => mockSpawn(...args),
}));

// Import after mocks are set up
import {
  startTunnel,
  stopTunnel,
  getTunnelStatus,
  onStatusChange,
  offStatusChange,
  _resetState,
} from '../src/server/tunnel-service.js';
import {
  writeServerInfo,
  readServerInfo,
  updateTunnelUrl,
  clearTunnelUrl,
} from '../src/util/server-info.js';
import { createTunnelRouter } from '../src/server/routers/tunnel.js';

function findAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '0.0.0.0', () => {
      const port = (server.address() as net.AddressInfo).port;
      server.close(() => resolve(port));
    });
  });
}

describe('Cloudflare Tunnel Integration', () => {
  let app: Express;
  let httpServer: Server;
  let PORT: number;
  let BASE_URL: string;

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tunnel-test-'));
    serverJsonPath = path.join(tempDir, 'server.json');
    cloudflaredBinPath = path.join(tempDir, 'bin', 'cloudflared');

    fs.mkdirSync(path.dirname(cloudflaredBinPath), { recursive: true });
    fs.writeFileSync(cloudflaredBinPath, 'fake-binary');

    app = express();
    app.use(express.json());
    app.use('/api/tunnel', createTunnelRouter());

    PORT = await findAvailablePort();
    BASE_URL = `http://localhost:${PORT}`;

    httpServer = createServer(app);
    await new Promise<void>((resolve) => {
      httpServer.listen(PORT, '0.0.0.0', () => resolve());
    });
  });

  afterAll(() => {
    httpServer.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    _resetState();
    mockSpawn = vi.fn();

    if (fs.existsSync(serverJsonPath)) {
      fs.unlinkSync(serverJsonPath);
    }
  });

  // ================================================================
  // 1. Server-info helpers
  // ================================================================
  describe('Server Info Helpers', () => {
    it('readServerInfo returns null when file does not exist', () => {
      expect(readServerInfo()).toBeNull();
    });

    it('readServerInfo returns parsed ServerInfo', () => {
      writeServerInfo(3000);
      const info = readServerInfo();
      expect(info).not.toBeNull();
      expect(info!.port).toBe(3000);
      expect(info!.pid).toBe(process.pid);
    });

    it('updateTunnelUrl writes tunnelUrl into server.json', () => {
      writeServerInfo(3000);
      updateTunnelUrl('https://abc.trycloudflare.com');

      const info = readServerInfo();
      expect(info!.tunnelUrl).toBe('https://abc.trycloudflare.com');
    });

    it('clearTunnelUrl sets tunnelUrl to null', () => {
      writeServerInfo(3000);
      updateTunnelUrl('https://abc.trycloudflare.com');
      clearTunnelUrl();

      const info = readServerInfo();
      expect(info!.tunnelUrl).toBeNull();
    });

    it('updateTunnelUrl is a no-op when server.json does not exist', () => {
      expect(() =>
        updateTunnelUrl('https://x.trycloudflare.com')
      ).not.toThrow();
    });
  });

  // ================================================================
  // 2. Tunnel-service core logic
  // ================================================================
  describe('Tunnel Service', () => {
    it('startTunnel throws if cloudflared binary is missing', async () => {
      fs.unlinkSync(cloudflaredBinPath);

      await expect(startTunnel(3000)).rejects.toThrow(
        'cloudflared binary not found'
      );

      fs.writeFileSync(cloudflaredBinPath, 'fake-binary');
    });

    it('startTunnel returns URL from cloudflared stderr', async () => {
      const fakeUrl = 'https://test-tunnel.trycloudflare.com';
      const fake = createFakeChildProcess(fakeUrl, 50);
      mockSpawn.mockReturnValue(fake);

      const url = await startTunnel(3000);
      expect(url).toBe(fakeUrl);
      expect(getTunnelStatus().status).toBe('running');
      expect(getTunnelStatus().url).toBe(fakeUrl);
    });

    it('startTunnel returns existing URL when already running', async () => {
      const fakeUrl = 'https://already-running.trycloudflare.com';
      const fake = createFakeChildProcess(fakeUrl, 50);
      mockSpawn.mockReturnValue(fake);

      const url1 = await startTunnel(3000);
      const url2 = await startTunnel(3000);
      expect(url1).toBe(fakeUrl);
      expect(url2).toBe(fakeUrl);
    });

    it('startTunnel rejects when already starting', async () => {
      const fake = createStuckChildProcess();
      mockSpawn.mockReturnValue(fake);

      const promise = startTunnel(3000);

      // Give the event loop a tick so the state transitions to 'starting'
      await new Promise((r) => setTimeout(r, 10));

      await expect(startTunnel(3000)).rejects.toThrow(
        'Tunnel is already starting'
      );

      // Clean up: unblock the stuck promise
      fake.emit('exit', 1);
      await promise.catch(() => {});
    });

    it('stopTunnel resets state to stopped', async () => {
      const fakeUrl = 'https://to-be-stopped.trycloudflare.com';
      const fake = createFakeChildProcess(fakeUrl, 50);
      mockSpawn.mockReturnValue(fake);

      await startTunnel(3000);
      expect(getTunnelStatus().status).toBe('running');

      await stopTunnel();
      expect(getTunnelStatus().status).toBe('stopped');
      expect(getTunnelStatus().url).toBeNull();
    });

    it('stopTunnel is a no-op when already stopped', async () => {
      await expect(stopTunnel()).resolves.toBeUndefined();
    });

    it('onStatusChange fires callback on state transitions', async () => {
      const fakeUrl = 'https://callback-test.trycloudflare.com';
      const fake = createFakeChildProcess(fakeUrl, 50);
      mockSpawn.mockReturnValue(fake);

      const states: string[] = [];
      const cb = (s: { status: string }) => states.push(s.status);
      onStatusChange(cb);

      await startTunnel(3000);
      expect(states).toContain('starting');
      expect(states).toContain('running');

      offStatusChange(cb);
    });

    it('process exit resets state to stopped', async () => {
      const fakeUrl = 'https://exit-test.trycloudflare.com';
      const fake = createFakeChildProcess(fakeUrl, 50);
      mockSpawn.mockReturnValue(fake);

      await startTunnel(3000);
      expect(getTunnelStatus().status).toBe('running');

      fake.emit('exit', 1);
      expect(getTunnelStatus().status).toBe('stopped');
    });

    it('spawn error is reflected in tunnel state', async () => {
      const fake = new EventEmitter() as ChildProcess;
      fake.stderr = new EventEmitter();
      fake.stdout = new EventEmitter();
      fake.kill = vi.fn();

      mockSpawn.mockReturnValue(fake);

      setTimeout(
        () => fake.emit('error', new Error('spawn ENOENT')),
        10
      );

      await expect(startTunnel(3000)).rejects.toThrow('spawn ENOENT');
      expect(getTunnelStatus().status).toBe('error');
    });

    it('getTunnelStatus returns a snapshot', () => {
      const s1 = getTunnelStatus();
      const s2 = getTunnelStatus();
      expect(s1).toEqual(s2);
      expect(s1).not.toBe(s2);
    });
  });

  // ================================================================
  // 3. Tunnel REST API
  // ================================================================
  describe('Tunnel REST API', () => {
    it('POST /start returns 400 when server.json is missing', async () => {
      const res = await fetch(`${BASE_URL}/api/tunnel/start`, {
        method: 'POST',
      });
      expect(res.status).toBe(400);
      const data = (await res.json()) as { error: string };
      expect(data.error).toBe('SERVER_NOT_FOUND');
    });

    it('POST /start returns 202 and starts tunnel', async () => {
      writeServerInfo(3000);

      const fakeUrl = 'https://api-test.trycloudflare.com';
      const fake = createFakeChildProcess(fakeUrl, 50);
      mockSpawn.mockReturnValue(fake);

      const res = await fetch(`${BASE_URL}/api/tunnel/start`, {
        method: 'POST',
      });
      expect(res.status).toBe(202);
      const data = (await res.json()) as { status: string };
      expect(data.status).toBe('starting');

      await new Promise((r) => setTimeout(r, 150));

      const statusRes = await fetch(`${BASE_URL}/api/tunnel/status`);
      const status = (await statusRes.json()) as {
        status: string;
        url: string;
      };
      expect(status.status).toBe('running');
      expect(status.url).toBe(fakeUrl);
    });

    it('POST /start returns running URL when already running', async () => {
      writeServerInfo(3000);

      const fakeUrl = 'https://already-api.trycloudflare.com';
      const fake = createFakeChildProcess(fakeUrl, 50);
      mockSpawn.mockReturnValue(fake);

      await startTunnel(3000);

      const res = await fetch(`${BASE_URL}/api/tunnel/start`, {
        method: 'POST',
      });
      expect(res.status).toBe(200);
      const data = (await res.json()) as { status: string; url: string };
      expect(data.status).toBe('running');
      expect(data.url).toBe(fakeUrl);
    });

    it('POST /stop returns 200', async () => {
      const res = await fetch(`${BASE_URL}/api/tunnel/stop`, {
        method: 'POST',
      });
      expect(res.status).toBe(200);
      const data = (await res.json()) as { success: boolean };
      expect(data.success).toBe(true);
    });

    it('GET /status returns current state', async () => {
      const res = await fetch(`${BASE_URL}/api/tunnel/status`);
      expect(res.status).toBe(200);
      const data = (await res.json()) as { status: string; url: null };
      expect(data.status).toBe('stopped');
      expect(data.url).toBeNull();
    });

    it('tunnel URL is persisted to server.json', async () => {
      // Re-register the router's callback (cleared by _resetState in beforeEach)
      onStatusChange((s) => {
        if (s.status === 'running' && s.url) {
          updateTunnelUrl(s.url);
        }
        if (s.status === 'stopped') {
          clearTunnelUrl();
        }
      });

      writeServerInfo(3000);

      const fakeUrl = 'https://persist-test.trycloudflare.com';
      const fake = createFakeChildProcess(fakeUrl, 50);
      mockSpawn.mockReturnValue(fake);

      await startTunnel(3000);
      await new Promise((r) => setTimeout(r, 100));

      const info = readServerInfo();
      expect(info!.tunnelUrl).toBe(fakeUrl);
    });
  });
});
