import { AgentSupervisor } from '../templates/supervisor.ts.js';
import { type NexicalClient } from '@/lib/api.js';

/**
 * Example demonstrating production-ready AgentSupervisor setup.
 * All relative imports MUST include the '.js' extension.
 */
export async function runSupervisorExample(client: NexicalClient): Promise<void> {
  const supervisor = new AgentSupervisor(client, {
    entryPoint: './dist/runtime/executor.js',
    maxRestarts: 10,
    restartDelay: 5000,
  });

  console.info('Starting AgentSupervisor...');
  await supervisor.spawnProcessor();
}
