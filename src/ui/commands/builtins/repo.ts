import type { SlashCommand, CommandContext, CommandResult } from '../types.js';
import { CommandKind } from '../types.js';
import { execSync } from 'node:child_process';
import open from 'open';

function getGitRemoteUrl(workspaceDir: string): string | null {
  try {
    const url = execSync('git remote get-url origin', {
      cwd: workspaceDir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return url;
  } catch {
    return null;
  }
}

function convertToHttpsUrl(gitUrl: string): string | null {
  if (gitUrl.startsWith('https://')) {
    return gitUrl.replace(/\.git$/, '');
  }

  if (gitUrl.startsWith('git@')) {
    const match = gitUrl.match(/^git@([^:]+):(.+)$/);
    if (match && match[1] && match[2]) {
      const host = match[1];
      const path = match[2].replace(/\.git$/, '');
      return `https://${host}/${path}`;
    }
  }

  if (gitUrl.startsWith('ssh://')) {
    return gitUrl.replace(/^ssh:\/\//, 'https://').replace(/\.git$/, '');
  }

  return null;
}

export const repoCommand: SlashCommand = {
  name: 'repo',
  altNames: ['git', 'open'],
  description: 'Open git repository in browser',
  kind: CommandKind.BUILT_IN,
  autoExecute: true,
  action: async (context: CommandContext): Promise<CommandResult> => {
    const workspaceDir = context.agent.workspaceDir;
    const gitUrl = getGitRemoteUrl(workspaceDir);

    if (!gitUrl) {
      return {
        type: 'message',
        content:
          '❌ No git remote found. Make sure this is a git repository with a remote origin.',
        messageType: 'error',
      };
    }

    const httpsUrl = convertToHttpsUrl(gitUrl);

    if (!httpsUrl) {
      return {
        type: 'message',
        content: `❌ Could not convert git URL to HTTPS: ${gitUrl}`,
        messageType: 'error',
      };
    }

    try {
      await open(httpsUrl);
      return {
        type: 'message',
        content: `✅ Opening repository in browser: ${httpsUrl}`,
        messageType: 'info',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        type: 'message',
        content: `❌ Failed to open browser: ${errorMessage}\n\nManual URL: ${httpsUrl}`,
        messageType: 'error',
      };
    }
  },
};
