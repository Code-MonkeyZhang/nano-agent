#!/usr/bin/env node
import { Command } from 'commander';
import { run } from './cli.js';

const program = new Command();

program
  .name('nano-agent')
  .description('Nano Agent - AI assistant with file tools and MCP support');

program.action(() => {
  run('interactive', true).catch((error: unknown) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
});

// Server subcommand
program
  .command('server')
  .description('Start Nano Agent server')
  .option('--local', 'Run in local mode only (disable public tunnel)')
  .action((options) => {
    const enableTunnel = !options.local;
    run('server', enableTunnel).catch((error: unknown) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
  });

program.parse();
