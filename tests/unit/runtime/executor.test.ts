import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JobExecutor } from '../../../src/runtime/executor.js';
import { z } from 'zod';
import { JobProcessor } from '../../../src/core/processor.js';

// Mock NexicalClient and AgentAuthStrategy
vi.mock('@nexical/sdk', () => ({
  NexicalClient: vi.fn(),
}));

vi.mock('../networking/auth.js', () => ({
  AgentAuthStrategy: vi.fn(),
}));

vi.mock('./logger.js', () => ({
  JobRemoteLogger: vi.fn(),
}));

type TestPayload = { foo: string };
type Job = { id: string; type: string; payload: Record<string, unknown> };

class TestProcessor extends JobProcessor<TestPayload> {
  jobType = 'test.job';
  schema = z.object({ foo: z.string() });
  async process(job: Job, context: { logger: { info: (msg: string) => void } }) {
    return { success: true, processed: (job.payload as TestPayload).foo };
  }
}

describe('JobExecutor', () => {
  let executor: JobExecutor;

  beforeEach(() => {
    vi.clearAllMocks();
    executor = new JobExecutor({
      apiUrl: 'http://test-api',
      apiToken: 'test-token',
    });
  });

  it('should execute processor with validated payload', async () => {
    const processor = new TestProcessor({ apiUrl: 'http://test-api', apiToken: 'test-token' });
    const job: Job = { id: 'job-1', type: 'test.job', payload: { foo: 'bar' } };

    const result = await executor.execute(processor, job);

    expect(result).toEqual({ success: true, processed: 'bar' });
  });

  it('should throw error if payload validation fails', async () => {
    const processor = new TestProcessor({ apiUrl: 'http://test-api', apiToken: 'test-token' });
    const job: Job = { id: 'job-1', type: 'test.job', payload: { foo: 123 } };

    await expect(executor.execute(processor, job)).rejects.toThrow();
  });

  it('should return default success if processor returns nothing', async () => {
    class NoResultProcessor extends TestProcessor {
      async process(_job: Job, _context: { logger: { info: (msg: string) => void } }) {
        return undefined as unknown as { success: boolean; processed: string };
      }
    }
    const processor = new NoResultProcessor({ apiUrl: 'http://test-api', apiToken: 'test-token' });
    const job: Job = { id: 'job-1', type: 'test.job', payload: { foo: 'bar' } };

    const result = await executor.execute(processor, job);
    expect(result).toEqual({ success: true });
  });
});
