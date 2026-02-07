import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import { AgentClient } from '../../src/networking/client';
import { JobExecutor } from '../../src/runtime/executor';
import { JobPoller } from '../../src/runtime/poller';
import { TestServer } from '@tests/integration/lib/server';
import { ApiClient } from '@tests/integration/lib/client';
import type { JobProcessor } from '../../src/core/processor';
import type { AgentJob } from '../../src/core/types';

describe('Agent Lifecycle Integration', () => {
  let apiToken: string;
  let apiUrl: string;

  beforeEach(async () => {
    apiUrl = TestServer.getUrl() + '/api';

    // Get a valid ADMIN token for the agent
    const adminClient = new ApiClient(TestServer.getUrl());
    const actor = await adminClient.as('user', { role: 'ADMIN' });

    // Find the rawKey from the actor registry or directly from the actor object returned by client.as
    // In our integration tests, client.as('user') returns { ...user, token: { rawKey } }
    // if we use the right actor provider.
    apiToken = actor.token.rawKey;
  });

  it('should complete a full job lifecycle using JobPoller and JobExecutor', async () => {
    // 1. Setup Agent Components
    const client = new AgentClient({ apiUrl, apiToken });
    const executor = new JobExecutor({ apiUrl, apiToken });

    // Mock a simple Echo processor
    const processors: Record<string, JobProcessor<unknown>> = {
      'test.echo': {
        config: {},
        schema: z.any(),
        process: async (job: AgentJob<{ input: string }>) => ({
          success: true,
          data: { output: job.payload.input },
        }),
      } as unknown as JobProcessor<unknown>,
    };

    const agentId = 'test-lifecycle-agent';
    const poller = new JobPoller(client, executor, processors, agentId);

    // 2. Register Agent
    await client.register({
      id: agentId,
      hostname: 'test-host',
      capabilities: ['test.echo'],
    });

    // 3. Create a Job via API
    const userClient = new ApiClient(TestServer.getUrl());
    await userClient.as('user', { role: 'ADMIN' });
    const jobRes = await userClient.post('/api/job', {
      type: 'test.echo',
      payload: { input: 'hello world' },
    });
    expect(jobRes.status).toBe(201);
    const jobId = jobRes.body.data.id;

    // 4. Run Poller once
    await poller.pollOnce();

    // 5. Verify Job is completed in DB
    const finalJobRes = await userClient.get(`/api/job/${jobId}`);
    expect(finalJobRes.body.data.status).toBe('COMPLETED');
    expect(finalJobRes.body.data.result.data).toEqual({ output: 'hello world' });
    expect(finalJobRes.body.data.lockedBy).toBeTruthy();
  });

  it('should handle job failure in the executor', async () => {
    const client = new AgentClient({ apiUrl, apiToken });
    const executor = new JobExecutor({ apiUrl, apiToken });

    const processors: Record<string, JobProcessor<unknown>> = {
      'test.fail': {
        config: {},
        schema: z.any(),
        process: async () => {
          throw new Error('Simulated failure');
        },
      } as unknown as JobProcessor<unknown>,
    };

    const agentId = 'test-fail-agent';
    const poller = new JobPoller(client, executor, processors, agentId);

    // Register
    await client.register({
      id: agentId,
      hostname: 'test-host',
      capabilities: ['test.fail'],
    });

    // Create Job
    const userClient = new ApiClient(TestServer.getUrl());
    await userClient.as('user', { role: 'ADMIN' });
    const jobRes = await userClient.post('/api/job', {
      type: 'test.fail',
      payload: { input: 'wont work' },
      maxRetries: 0, // Fail immediately
    });
    const jobId = jobRes.body.data.id;

    // Poll
    await poller.pollOnce();

    // Verify failure
    const finalJobRes = await userClient.get(`/api/job/${jobId}`);
    expect(finalJobRes.body.data.status).toBe('FAILED');
    expect(finalJobRes.body.data.error).toBe('Simulated failure');
  });
});
