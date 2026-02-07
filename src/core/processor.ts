import { z } from 'zod';
import { NexicalClient } from '@nexical/sdk';
import { AgentAuthStrategy } from '../networking/auth.js';
import type { AgentJob, AgentResult, AgentContext } from './types.js';

export interface ProcessorConfig {
  apiUrl: string;
  apiToken: string;
}

export abstract class JobProcessor<T = unknown> {
  public abstract jobType: string;
  public abstract schema: z.ZodSchema<T>;
  protected api: NexicalClient;
  protected logger: Console = console;

  constructor(config: ProcessorConfig) {
    this.api = new NexicalClient({
      baseUrl: config.apiUrl,
      authStrategy: new AgentAuthStrategy(config.apiToken),
    });
  }

  public abstract process(job: AgentJob<T>, context: AgentContext): Promise<AgentResult | void>;
}
