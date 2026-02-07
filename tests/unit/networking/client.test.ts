import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentClient } from '../../../src/networking/client.js';

const mockPollJobs = vi.fn();
const mockRegisterAgent = vi.fn();
const mockCompleteJob = vi.fn();
const mockFailJob = vi.fn();
const mockUpdateProgress = vi.fn();
const mockCreateJob = vi.fn();
const mockGetJob = vi.fn();

vi.mock('@nexical/sdk', () => ({
  NexicalClient: vi.fn().mockImplementation(function () {
    return {
      orchestrator: {
        orchestrator: {
          pollJobs: mockPollJobs,
        },
        agent: {
          registerAgent: mockRegisterAgent,
        },
        job: {
          completeJob: mockCompleteJob,
          failJob: mockFailJob,
          updateProgress: mockUpdateProgress,
          create: mockCreateJob,
          get: mockGetJob,
        },
      },
    };
  }),
}));

describe('AgentClient', () => {
  let client: AgentClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new AgentClient({
      apiUrl: 'http://test-api',
      apiToken: 'test-token',
    });
  });

  it('should poll for jobs', async () => {
    mockPollJobs.mockResolvedValue({ data: [{ id: 'job-1', type: 'test' }] });
    const job = await client.poll(['test'], 'agent-1');
    expect(job).toEqual({ id: 'job-1', type: 'test' });
    expect(mockPollJobs).toHaveBeenCalledWith({
      capabilities: ['test'],
      agentId: 'agent-1',
    });
  });

  it('should return null if no jobs found during poll', async () => {
    mockPollJobs.mockResolvedValue({ data: [] });
    const job = await client.poll(['test']);
    expect(job).toBeNull();
    expect(mockPollJobs).toHaveBeenCalledWith({
      capabilities: ['test'],
      agentId: '',
    });
  });

  it('should register agent', async () => {
    mockRegisterAgent.mockResolvedValue({});
    const dto = { hostname: 'test-host', capabilities: ['test'] };
    await client.register(dto);
    expect(mockRegisterAgent).toHaveBeenCalledWith(dto);
  });

  it('should complete job', async () => {
    mockCompleteJob.mockResolvedValue({});
    const result = { success: true };
    await client.complete('job-1', result);
    expect(mockCompleteJob).toHaveBeenCalledWith('job-1', { id: 'job-1', result });
  });

  it('should fail job', async () => {
    mockFailJob.mockResolvedValue({});
    await client.fail('job-1', 'error message');
    expect(mockFailJob).toHaveBeenCalledWith('job-1', { id: 'job-1', error: 'error message' });
  });

  it('should update progress', async () => {
    mockUpdateProgress.mockResolvedValue({});
    await client.updateProgress('job-1', 50);
    expect(mockUpdateProgress).toHaveBeenCalledWith('job-1', { progress: 50 });
  });

  it('should create job', async () => {
    mockCreateJob.mockResolvedValue({ data: { id: 'new-job' } });
    const job = await client.createJob({ type: 'test', payload: { foo: 'bar' } });
    expect(job).toEqual({ id: 'new-job' });
    expect(mockCreateJob).toHaveBeenCalledWith({
      type: 'test',
      payload: { foo: 'bar' },
      actorId: undefined,
      actorType: undefined,
      maxRetries: undefined,
    });
  });

  it('should throw error if create job fails', async () => {
    mockCreateJob.mockResolvedValue({ error: 'Creation failed' });
    await expect(client.createJob({ type: 'test', payload: {} })).rejects.toThrow(
      'Failed to create job: Creation failed',
    );
  });

  it('should wait for job success', async () => {
    mockGetJob
      .mockResolvedValueOnce({ data: { status: 'PENDING' } })
      .mockResolvedValueOnce({ data: { status: 'COMPLETED' } });

    vi.useFakeTimers();
    const waitPromise = client.waitForJob('job-1', 5000, 100);

    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(100);

    const job = await waitPromise;
    expect(job.status).toBe('COMPLETED');
    vi.useRealTimers();
  });

  it('should wait for job failure', async () => {
    mockGetJob.mockResolvedValue({ data: { status: 'FAILED' } });
    const job = await client.waitForJob('job-1');
    expect(job.status).toBe('FAILED');
  });

  it('should throw error if get job fails while waiting', async () => {
    mockGetJob.mockResolvedValue({ error: 'Get failed' });
    await expect(client.waitForJob('job-1')).rejects.toThrow('Failed to get job: Get failed');
  });

  it('should timeout waiting for job', async () => {
    mockGetJob.mockResolvedValue({ data: { status: 'PENDING' } });

    // Use a very short timeout and interval with real timers to avoid any loop issues
    const waitPromise = client.waitForJob('job-1', 50, 10);

    await expect(waitPromise).rejects.toThrow('Timeout waiting for job job-1');
  });
});
