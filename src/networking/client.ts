import { NexicalClient } from '@nexical/sdk';
import type { RegisterAgentDTO } from '@modules/orchestrator-api/src/sdk/index.js';
import { AgentAuthStrategy } from './auth.js';
import type { AgentJob, AgentResult } from '../core/types.js';

export interface AgentClientConfig {
  apiUrl: string;
  apiToken: string;
}

export class AgentClient {
  private client: NexicalClient;
  private apiUrl: string;

  constructor(config: AgentClientConfig) {
    this.apiUrl = config.apiUrl;
    this.client = new NexicalClient({
      baseUrl: config.apiUrl,
      authStrategy: new AgentAuthStrategy(config.apiToken),
    });
  }

  public async poll(capabilities: string[], agentId?: string): Promise<AgentJob | null> {
    const response = await this.client.orchestrator.orchestrator.pollJobs({
      capabilities,
      agentId: agentId || '',
    });
    return response.data.length > 0 ? (response.data[0] as unknown as AgentJob) : null;
  }

  public async register(dto: {
    id?: string;
    hostname: string;
    capabilities: string[];
  }): Promise<void> {
    console.info('[AgentClient] Registering agent:', dto);
    await this.client.orchestrator.agent.registerAgent(dto as RegisterAgentDTO);
  }

  public async complete(jobId: string, result: AgentResult): Promise<void> {
    await this.client.orchestrator.job.completeJob(jobId, { id: jobId, result });
  }

  public async fail(jobId: string, error: string): Promise<void> {
    await this.client.orchestrator.job.failJob(jobId, { id: jobId, error });
  }

  public async updateProgress(jobId: string, progress: number): Promise<void> {
    await this.client.orchestrator.job.updateProgress(jobId, { progress });
  }

  /**
   * Create a new job to be processed by agents.
   */
  public async createJob(data: {
    type: string;
    payload: Record<string, unknown>;
    actorId?: string;
    actorType?: string;
    maxRetries?: number;
  }): Promise<AgentJob> {
    const response = await this.client.orchestrator.job.create({
      type: data.type,
      payload: data.payload as never,
      actorId: data.actorId,
      actorType: data.actorType,
      maxRetries: data.maxRetries,
    });

    if (response.error) {
      throw new Error(`Failed to create job: ${response.error}`);
    }

    return response.data as unknown as AgentJob;
  }

  /**
   * Wait for a job to complete with polling.
   */
  public async waitForJob(
    jobId: string,
    timeoutMs = 30000,
    pollIntervalMs = 1000,
  ): Promise<AgentJob> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const response = await this.client.orchestrator.job.get(jobId);

      if (response.error) {
        throw new Error(`Failed to get job: ${response.error}`);
      }

      const job = response.data as unknown as AgentJob;

      if (job.status === 'COMPLETED' || job.status === 'FAILED') {
        return job;
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
    throw new Error(`Timeout waiting for job ${jobId}`);
  }
}
