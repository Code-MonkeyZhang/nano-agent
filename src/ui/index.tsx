import { render } from 'ink';
import { AppContainer } from './AppContainer.js';
import type { AgentCore } from '../agent.js';

export async function runInteractiveUI(agent: AgentCore): Promise<void> {
  const { waitUntilExit } = render(<AppContainer agent={agent} />);
  await waitUntilExit();
}
