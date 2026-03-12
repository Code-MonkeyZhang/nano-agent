import type { Tool } from '../tools/base.js';
import {
  ReadTool,
  WriteTool,
  EditTool,
  BashTool,
  BashOutputTool,
  BashKillTool,
} from '../tools/index.js';
import type {
  BuiltinToolId,
  BuiltinToolMeta,
  BuiltinToolEntry,
  BuiltinToolFactory,
} from './types.js';

/**
 * Registry of all built-in tool factories.
 * Tools that need workspace context use factory functions.
 */
const TOOL_FACTORIES = new Map<string, BuiltinToolFactory>([
  ['read', (workspaceDir) => new ReadTool(workspaceDir)],
  ['write', (workspaceDir) => new WriteTool(workspaceDir)],
  ['edit', (workspaceDir) => new EditTool(workspaceDir)],
]);

/**
 * Registry of built-in tools that don't require workspace context.
 */
const STATIC_TOOLS = new Map<string, Tool>([
  ['bash', new BashTool()],
  ['bash_output', new BashOutputTool()],
  ['bash_kill', new BashKillTool()],
]);

let toolPool: Map<BuiltinToolId, BuiltinToolEntry> | null = null;

/**
 * Initialize the built-in tool pool.
 * Creates tool instances with the given workspace directory context.
 *
 * @param workspaceDir - The workspace directory for path resolution in file tools
 */
export function initBuiltinToolPool(workspaceDir: string): void {
  toolPool = new Map();

  for (const [name, factory] of TOOL_FACTORIES) {
    const id: BuiltinToolId = `builtin:${name}`;
    const tool = factory(workspaceDir);
    toolPool.set(id, { id, tool });
  }

  for (const [name, tool] of STATIC_TOOLS) {
    const id: BuiltinToolId = `builtin:${name}`;
    toolPool.set(id, { id, tool });
  }
}

/**
 * Get the current tool pool, throwing if not initialized.
 */
function getPool(): Map<BuiltinToolId, BuiltinToolEntry> {
  if (!toolPool) {
    throw new Error(
      'BuiltinToolPool not initialized. Call initBuiltinToolPool() first.'
    );
  }
  return toolPool;
}

/**
 * List all built-in tools with their metadata.
 * Returns lightweight info without tool instances.
 */
export function listBuiltinTools(): BuiltinToolMeta[] {
  const pool = getPool();
  return Array.from(pool.values()).map((entry) => ({
    id: entry.id,
    name: entry.tool.name,
    description: entry.tool.description,
  }));
}

/**
 * Get a specific built-in tool instance by its ID.
 *
 * @param toolId - The built-in tool ID (e.g., "builtin:read")
 * @returns The Tool instance, or undefined if not found
 */
export function getBuiltinTool(toolId: BuiltinToolId): Tool | undefined {
  const pool = getPool();
  return pool.get(toolId)?.tool;
}

/**
 * Get all built-in tool instances.
 * Used by AgentFactory to collect all built-in tools for an agent.
 */
export function getAllBuiltinTools(): Tool[] {
  const pool = getPool();
  return Array.from(pool.values()).map((entry) => entry.tool);
}

/**
 * Check if a tool ID belongs to the built-in tool pool.
 */
export function isBuiltinToolId(toolId: string): toolId is BuiltinToolId {
  return toolId.startsWith('builtin:');
}
