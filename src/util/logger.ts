import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

export class Logger {
  private static logFile: string | null = null;
  private static initialized = false;
  private static mode: 'agent' | 'server' = 'agent';

  static initialize(logDir?: string, mode: 'agent' | 'server' = 'agent') {
    this.mode = mode;

    if (this.initialized) {
      console.log('[Logger] Already initialized, skipping');
      return;
    }

    const logsDir = logDir ?? this.getLogsDirectory();
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
    const prefix = mode === 'server' ? 'server' : 'agent';
    this.logFile = path.join(logsDir, `${prefix}-${timestamp}.log`);
    console.log(
      `[Logger] Initialized (${mode} mode) with file: ${this.logFile}`
    );
    this.initialized = true;
  }

  static getLogsDirectory(): string {
    const utilDir = path.dirname(fileURLToPath(import.meta.url));
    const srcDir = path.join(utilDir, '..');
    let projectRoot = path.join(srcDir, '..');

    // If we're in dist directory, go up one more level
    if (
      path.basename(projectRoot) === 'dist' ||
      utilDir.includes('dist') ||
      fs.existsSync(path.join(projectRoot, 'dist', 'src', 'util', 'logger.js'))
    ) {
      projectRoot = path.join(projectRoot, '..');
    }

    return path.join(projectRoot, 'logs');
  }

  static getMode(): 'agent' | 'server' {
    return this.mode;
  }

  static log(category: string, message: string, data?: any) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const ms = String(now.getMilliseconds()).padStart(3, '0');

    const timestamp = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${ms}Z`;

    let formattedData = '';
    if (data !== undefined && data !== null) {
      if (typeof data === 'string') {
        // Format string data with newlines and indentation
        formattedData = `\n${data
          .split('\n')
          .map((line) => `  ${line}`)
          .join('\n')}`;
      } else {
        formattedData = JSON.stringify(data, null, 2);
      }
    }

    const fileEntry = `[${timestamp}] [${category}] ${message}${formattedData}\n`;

    // Write to file if initialized
    if (this.logFile) {
      fs.appendFileSync(this.logFile, fileEntry);
    }
  }

  static debug(category: string, message: string, data?: any) {
    this.log(category, message, data);
  }

  static logLLMRequest(request: any) {
    const summary: any = {
      model: request.model,
      stream: request.stream,
      messagesCount: request.messages?.length || 0,
    };

    if (request.tools && request.tools.length > 0) {
      summary.toolCount = request.tools.length;
    }

    this.log('LLM REQUEST', 'Request summary', summary);
  }

  static logLLMResponse(response: any) {
    const summary: any = {
      model: response.model,
    };

    this.log('LLM DEBUG', 'Response structure check', {
      keys: Object.keys(response).join(', '),
      hasChoices: !!response.choices,
      choicesLength: response.choices?.length || 0,
      hasAccumulatedContent: 'accumulatedContent' in response,
      accumulatedContentType: typeof response.accumulatedContent,
      hasFinishReason: 'finishReason' in response,
    });

    if (response.choices && response.choices.length > 0) {
      summary.type = 'standard';
      summary.choiceCount = response.choices.length;
      const firstChoice = response.choices[0];
      summary.finishReason = firstChoice.finish_reason;
      const content = firstChoice.message?.content || '';
      summary.contentLength = content.length;
      if (content.length > 0) {
        summary.content = content;
      }
      const hasToolCalls = !!(
        firstChoice.message?.tool_calls &&
        firstChoice.message.tool_calls.length > 0
      );
      summary.hasToolCalls = hasToolCalls;
      if (summary.hasToolCalls) {
        summary.toolCallCount = firstChoice.message.tool_calls.length;
      }
    } else if (
      'accumulatedContent' in response ||
      'tool_calls' in response ||
      'finishReason' in response
    ) {
      summary.type = 'streaming';
      const content = response.accumulatedContent || '';
      summary.contentLength = content.length;
      if (content.length > 0) {
        summary.content = content;
      }
      const thinking = response.accumulatedThinking || '';
      if (thinking.length > 0) {
        summary.thinking = thinking;
      }
      summary.finishReason = response.finishReason;
      summary.chunkCount = response.chunkCount || 0;
      const hasToolCalls = !!(
        response.tool_calls && response.tool_calls.length > 0
      );
      summary.hasToolCalls = hasToolCalls;
      if (summary.hasToolCalls) {
        summary.toolCallCount = response.tool_calls.length;
      }
    }

    this.log('LLM RESPONSE', 'Response summary', summary);
  }
}

export const sdkLoggerAdapter = {
  debug(message: string, ...args: unknown[]) {
    Logger.log('LLM SDK', message, args.length > 0 ? args : undefined);
  },
  info(message: string, ...args: unknown[]) {
    Logger.log('LLM SDK', message, args.length > 0 ? args : undefined);
  },
  warn(message: string, ...args: unknown[]) {
    Logger.log('LLM SDK WARN', message, args.length > 0 ? args : undefined);
  },
  error(message: string, ...args: unknown[]) {
    Logger.log('LLM SDK ERROR', message, args.length > 0 ? args : undefined);
  },
};
