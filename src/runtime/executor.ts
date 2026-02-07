import type { AgentJob, AgentResult, AgentContext } from '../core/types.js';
import type { JobProcessor } from '../core/processor.js';
import { NexicalClient } from '@nexical/sdk';
import { AgentAuthStrategy } from '../networking/auth.js';
import { JobRemoteLogger } from './logger.js';

export interface ExecutorConfig {
  apiUrl: string;
  apiToken: string;
}

export class JobExecutor {
  private client: NexicalClient;

  constructor(config: ExecutorConfig) {
    this.client = new NexicalClient({
      baseUrl: config.apiUrl,
      authStrategy: new AgentAuthStrategy(config.apiToken),
    });
  }

  public async execute(processor: JobProcessor<unknown>, job: AgentJob): Promise<AgentResult> {
    // Validate payload
    const payload = processor.schema.parse(job.payload);

    const logger = new JobRemoteLogger(this.client, job.id);
    const context: AgentContext = {
      logger,
      api: this.client,
    };

    const result = await processor.process({ ...job, payload }, context);
    return result || { success: true };
  }
}
