import { AgentClient } from '../networking/client.js';
import { JobExecutor } from './executor.js';
import type { JobProcessor } from '../core/processor.js';

export class JobPoller {
  private running: boolean = false;

  constructor(
    private client: AgentClient,
    private executor: JobExecutor,
    private processors: Record<string, JobProcessor<unknown>>,
    private agentId?: string,
  ) {}

  public async start() {
    console.info('[JobPoller] Agent starting... polling for jobs.');
    this.running = true;

    while (this.running) {
      await this.pollOnce();

      if (this.running) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }

  /**
   * Performs a single poll and execution cycle.
   * Useful for testing and manual triggers.
   */
  public async pollOnce() {
    try {
      const capabilities = Object.keys(this.processors);
      // 1. Poll
      const job = await this.client.poll(capabilities, this.agentId);

      if (job) {
        console.info(`Received job: ${job.type} (${job.id})`);

        const processor = this.processors[job.type];
        if (!processor) {
          console.error(`No processor found for type ${job.type}`);
          await this.client.fail(job.id, 'Processor not found on this agent');
          return;
        }

        // 2. Execute
        try {
          const result = await this.executor.execute(processor, job);

          // 3. Complete
          await this.client.complete(job.id, result);
          console.info(`Job ${job.id} completed.`);
        } catch (err: unknown) {
          console.error(`Job ${job.id} failed:`, err);
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          await this.client.fail(job.id, errorMessage);
        }
      }
    } catch (err) {
      console.error('Polling cycle Error:', err);
    }
  }

  public stop() {
    this.running = false;
  }
}
