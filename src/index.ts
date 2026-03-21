#!/usr/bin/env node
/**
 * @fileoverview CLI entry point for Nano Agent.
 * Provides commands for running the AI assistant and HTTP server.
 * @module nano-agent/cli
 */

import { Command } from 'commander';
import { run } from './cli.js';
import { Logger } from './util/logger.js';
import { getServerManager } from './server/index.js';

const program = new Command();

// CLI Entry
program
  .name('nano-agent')
  .description('Nano Agent - AI assistant')
  .action(() => {
    run().catch((error: unknown) => {
      Logger.log('ERROR', 'Fatal error', error);
      process.exit(1);
    });
  });

// Server Entry
program
  .command('server')
  .description('Start the HTTP server for desktop app')
  .option('--tunnel', 'Enable Cloudflare tunnel for public access', false)
  .action(async (options: { tunnel: boolean }) => {
    const manager = getServerManager();
    const result = await manager.start({ enableTunnel: options.tunnel });

    if (result.success) {
      console.log('Nano-Agent server started successfully');
      console.log(`Local URL: http://localhost:${manager.getPort()}`);

      /**
       * Shutdown the server gracefully.
       */
      const shutdown = (): void => {
        console.log('Shutting down server...');
        void manager.stop().then(() => {
          process.exit(0);
        });
      };

      // Handle termination signals
      // SIGTERM: from `kill` command
      // SIGINT: from Ctrl+C
      process.on('SIGTERM', shutdown);
      process.on('SIGINT', shutdown);
    } else {
      console.error('Failed to start server:', result.error);
      process.exit(1);
    }
  });

program.parse();
