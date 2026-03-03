#!/usr/bin/env node
import { Command } from 'commander';
import { run } from './cli.js';
import { Logger } from './util/logger.js';
import { getServerManager } from './server/index.js';

const program = new Command();

program
  .name('nano-agent')
  .description('Nano Agent - AI assistant')
  .action(() => {
    run().catch((error: unknown) => {
      Logger.log('ERROR', 'Fatal error', error);
      process.exit(1);
    });
  });

program
  .command('server')
  .description('Start the HTTP server for desktop app')
  .option('--tunnel', 'Enable Cloudflare tunnel for public access', false)
  .action(async (options) => {
    const manager = getServerManager();

    const result = await manager.start({ enableTunnel: options.tunnel });

    if (result.success) {
      console.log('Nano-Agent server started successfully');
      console.log(`Local URL: http://localhost:${manager.getPort()}`);

      const shutdown = () => {
        console.log('Shutting down server...');
        void manager.stop().then(() => {
          process.exit(0);
        });
      };

      process.on('SIGTERM', shutdown);
      process.on('SIGINT', shutdown);
    } else {
      console.error('Failed to start server:', result.error);
      process.exit(1);
    }
  });

program.parse();
