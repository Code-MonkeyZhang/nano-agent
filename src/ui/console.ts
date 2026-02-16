/* eslint-disable no-console */
import { Colors, drawStepHeader } from '../util/terminal.js';
import type { AgentEvent } from '../schema/index.js';

/**
 * Consumes and renders agent event stream to console terminal.
 *
 * This function is the UI layer bridges Agent streams with. It iteratesevents yielded by Agent.runStream() and render based on event type
 *
 * @param {AsyncGenerator<AgentEvent, string, void>} eventStream - The generator yielding AgentEvent objects from Agent.runStream()
 * @returns {Promise<string>} The final return value from Agent.runStream() (complete response or failure message)
 */
export async function renderConsoleEvents(
  eventStream: AsyncGenerator<AgentEvent, string, void>
): Promise<string> {
  const iterator = eventStream[Symbol.asyncIterator]();
  let result = await iterator.next(); // start iteration

  let isThinkingPrinted = false;
  let currentStepContent = '';

  while (!result.done) {
    const event = result.value;

    switch (event.type) {
      case 'step_start':
        console.log();
        console.log(drawStepHeader(event.step, event.maxSteps));
        isThinkingPrinted = false;
        currentStepContent = '';
        break;

      case 'thinking':
        if (!isThinkingPrinted) {
          console.log();
          console.log(`${Colors.DIM}─${'─'.repeat(60)}${Colors.RESET}`);
          console.log();
          console.log(
            `${Colors.BOLD}${Colors.BRIGHT_MAGENTA}🧠 Thinking:${Colors.RESET}`
          );
          isThinkingPrinted = true;
        }
        process.stdout.write(event.content);
        break;

      case 'content':
        if (!isThinkingPrinted && currentStepContent === '') {
          // No thinking, just content
          console.log();
          console.log(
            `${Colors.BOLD}${Colors.BRIGHT_BLUE}📝 Response:${Colors.RESET}`
          );
        } else if (isThinkingPrinted && currentStepContent === '') {
          // Had thinking, transitioning to content
          console.log();
          console.log();
          console.log(`${Colors.DIM}─${'─'.repeat(60)}${Colors.RESET}`);
          console.log();
          console.log(
            `${Colors.BOLD}${Colors.BRIGHT_BLUE}📝 Response:${Colors.RESET}`
          );
        }
        process.stdout.write(event.content);
        currentStepContent += event.content;
        break;

      case 'tool_call':
        // No output for the decision itself, handled by tool_start
        break;

      case 'tool_start': {
        const { toolCall } = event;
        const functionName = toolCall.function.name;
        const args = toolCall.function.arguments || {};

        // Tool Header
        console.log(
          `\n${Colors.BOLD}${Colors.BRIGHT_YELLOW}🔧 Tool: ${functionName}${Colors.RESET}`
        );

        // Arguments
        console.log(`${Colors.DIM}   Arguments:${Colors.RESET}`);
        const truncatedArgs: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(args)) {
          const valueStr = String(value);
          if (valueStr.length > 200) {
            truncatedArgs[key] = `${valueStr.slice(0, 200)}...`;
          } else {
            truncatedArgs[key] = value;
          }
        }
        const argsJson = JSON.stringify(truncatedArgs, null, 2);
        for (const line of argsJson.split('\n')) {
          console.log(`   ${Colors.DIM}${line}${Colors.RESET}`);
        }
        break;
      }

      case 'tool_result': {
        const { result } = event;
        if (result.success) {
          let resultText = result.content;
          const MAX_LENGTH = 300;
          if (resultText.length > MAX_LENGTH) {
            resultText = `${resultText.slice(
              0,
              MAX_LENGTH
            )}${Colors.DIM}...${Colors.RESET}`;
          }
          console.log(
            `${Colors.BRIGHT_GREEN}✓${Colors.RESET} ${Colors.BOLD}${Colors.BRIGHT_GREEN}Success:${Colors.RESET} ${resultText}\n`
          );
        } else {
          console.log(
            `${Colors.BRIGHT_RED}✗${Colors.RESET} ${Colors.BOLD}${Colors.BRIGHT_RED}Error:${Colors.RESET} ${Colors.RED}${
              result.error ?? 'Unknown error'
            }${Colors.RESET}\n`
          );
        }
        break;
      }

      case 'error':
        console.error('Critical Error:', event.error);
        break;
    }

    result = await iterator.next();
  }

  console.log();

  return result.value;
}
