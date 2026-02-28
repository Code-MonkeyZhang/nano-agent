#!/usr/bin/env node
import { Command } from 'commander';
import { run } from './cli.js';

const program = new Command();

program
  .name('nano-agent')
  .description('Nano Agent - AI assistant with file tools and MCP support')
  .action(() => {
    run().catch((error: unknown) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
  });

program.parse();
