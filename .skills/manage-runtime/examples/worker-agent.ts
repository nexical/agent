import { PersistentAgent } from '../templates/persistent-agent.ts.js';
import { type NexicalClient } from '@/lib/api.js';

/**
 * Example demonstrating a concrete PersistentAgent implementation.
 * All relative imports MUST include the '.js' extension.
 */
export class WorkerAgent extends PersistentAgent {
  /**
   * Implement domain-specific tick logic.
   * Business logic uses the injected client (this.api).
   */
  protected override async tick(): Promise<void> {
    this.logger.info(`[${this.name}] Tick beginning...`);

    // Example: Poll for work via injected client
    // const work = await this.api.work.getPendingWork({ actor: this.agentActor });

    this.logger.info(`[${this.name}] Tick completed.`);
  }
}

/**
 * Usage example showing Constructor-Based Dependency Injection.
 */
export async function runWorkerExample(client: NexicalClient): Promise<void> {
  const agent = new WorkerAgent(client, {
    name: 'Log-Watcher-Agent',
    intervalMs: 10000,
  });

  console.info('Starting Worker Agent...');
  await agent.start();
}
