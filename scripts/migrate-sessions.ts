#!/usr/bin/env bun
/**
 * Migration script to move session data from .nano-agent to data/agents/{agentId}/sessions/
 * 
 * This script:
 * 1. Creates new directory structure for each agent
 * 2. Moves agent config files to new location (data/agents/{agentId}/config.json)
 * 3. Splits sessions.json by agentId
 * 4. Moves session files to corresponding agent directories
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT_DIR = path.resolve(import.meta.dir, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const OLD_NANO_AGENT_DIR = path.join(ROOT_DIR, '.nano-agent');
const AGENTS_DIR = path.join(DATA_DIR, 'agents');

interface SessionMeta {
  id: string;
  agentId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  workspacePath?: string;
  modelId?: string;
}

function log(message: string) {
  console.log(`[MIGRATION] ${message}`);
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    log(`Created directory: ${dir}`);
  }
}

async function migrate() {
  log('Starting migration...');
  log(`Root: ${ROOT_DIR}`);

  // Step 1: Check if old data exists
  const oldSessionsIndexPath = path.join(OLD_NANO_AGENT_DIR, 'sessions.json');
  if (!fs.existsSync(oldSessionsIndexPath)) {
    log('No old session data found, nothing to migrate');
    return;
  }

  // Step 2: Read old sessions index
  const sessionsIndex: SessionMeta[] = JSON.parse(fs.readFileSync(oldSessionsIndexPath, 'utf-8'));
  log(`Found ${sessionsIndex.length} sessions in old index`);

  // Step 3: Group sessions by agentId
  const sessionsByAgent = new Map<string, SessionMeta[]>();
  for (const session of sessionsIndex) {
    const agentId = session.agentId;
    if (!sessionsByAgent.has(agentId)) {
      sessionsByAgent.set(agentId, []);
    }
    sessionsByAgent.get(agentId)!.push(session);
  }

  log(`Found sessions for ${sessionsByAgent.size} agents: ${[...sessionsByAgent.keys()].join(', ')}`);

  // Step 4: Migrate each agent
  for (const [agentId, sessions] of sessionsByAgent) {
    const agentDir = path.join(AGENTS_DIR, agentId);
    const sessionsDir = path.join(agentDir, 'sessions');

    // Create directories
    ensureDir(agentDir);
    ensureDir(sessionsDir);

    // Step 4a: Move agent config
    const oldConfigPath = path.join(AGENTS_DIR, `${agentId}.json`);
    const newConfigPath = path.join(agentDir, 'config.json');

    if (fs.existsSync(oldConfigPath)) {
      if (!fs.existsSync(newConfigPath)) {
        fs.copyFileSync(oldConfigPath, newConfigPath);
        log(`Copied config for ${agentId}: ${oldConfigPath} -> ${newConfigPath}`);
      } else {
        log(`Config already exists for ${agentId}, skipping`);
      }
    } else {
      log(`Warning: Config not found for ${agentId} at ${oldConfigPath}`);
    }

    // Step 4b: Write new sessions index
    const newIndexPath = path.join(agentDir, 'sessions.json');
    fs.writeFileSync(newIndexPath, JSON.stringify(sessions, null, 2));
    log(`Created sessions index for ${agentId}: ${sessions.length} sessions`);

    // Step 4c: Move session files
    for (const sessionMeta of sessions) {
      const oldSessionPath = path.join(OLD_NANO_AGENT_DIR, 'sessions', `${sessionMeta.id}.json`);
      const newSessionPath = path.join(sessionsDir, `${sessionMeta.id}.json`);

      if (fs.existsSync(oldSessionPath)) {
        fs.copyFileSync(oldSessionPath, newSessionPath);
      } else {
        log(`Warning: Session file not found: ${oldSessionPath}`);
      }
    }

    log(`Migrated ${sessions.length} sessions for agent ${agentId}`);
  }

  log('Migration completed successfully!');
  log('');
  log('New structure:');
  log(`  data/agents/<agentId>/config.json`);
  log(`  data/agents/<agentId>/sessions/sessions.json`);
  log(`  data/agents/<agentId>/sessions/<sessionId>.json`);
}

migrate().catch(console.error);
