import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JobPoller } from '../../../src/runtime/poller.js';

const mockPoll = vi.fn();
const mockFail = vi.fn();
const mockComplete = vi.fn();
const mockExecute = vi.fn();

const MockAgentClient = class {
  poll = mockPoll;
  fail = mockFail;
  complete = mockComplete;
};

const MockJobExecutor = class {
  execute = mockExecute;
};

vi.mock('../networking/client.js', () => ({
  AgentClient: MockAgentClient,
}));

vi.mock('./executor.js', () => ({
  JobExecutor: MockJobExecutor,
}));

type MockAgentClientType = InstanceType<typeof MockAgentClient>;
type MockJobExecutorType = InstanceType<typeof MockJobExecutor>;
type MockProcessor = { jobType: string };

describe('JobPoller', () => {
  let poller: JobPoller;
  let mockClient: MockAgentClientType;
  let mockExecutor: MockJobExecutorType;
  const mockProcessors: Record<string, MockProcessor> = {
    'test.job': { jobType: 'test.job' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = new MockAgentClient();
    mockExecutor = new MockJobExecutor();
    poller = new JobPoller(
      mockClient as unknown as InstanceType<
        typeof import('../../../src/networking/client.js').AgentClient
      >,
      mockExecutor as unknown as InstanceType<
        typeof import('../../../src/runtime/executor.js').JobExecutor
      >,
      mockProcessors as Record<
        string,
        InstanceType<typeof import('../../../src/core/processor.js').JobProcessor<unknown>>
      >,
      'agent-1',
    );
    // Don't use fake timers by default to avoid hanging promises in loops
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should start and poll for jobs', async () => {
    mockPoll
      .mockResolvedValueOnce({ id: 'job-1', type: 'test.job' })
      .mockImplementationOnce(async () => {
        poller.stop();
        return null;
      });
    mockExecute.mockResolvedValue({ success: true });
    mockComplete.mockResolvedValue({});

    await poller.start();

    expect(mockPoll).toHaveBeenCalledWith(['test.job'], 'agent-1');
    expect(mockExecute).toHaveBeenCalledWith(mockProcessors['test.job'], {
      id: 'job-1',
      type: 'test.job',
    });
    expect(mockComplete).toHaveBeenCalledWith('job-1', { success: true });
  });

  it('should handle processor not found', async () => {
    mockPoll
      .mockResolvedValueOnce({ id: 'job-1', type: 'unknown.job' })
      .mockImplementationOnce(async () => {
        poller.stop();
        return null;
      });

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await poller.start();

    expect(errorSpy).toHaveBeenCalledWith('No processor found for type unknown.job');
    expect(mockFail).toHaveBeenCalledWith('job-1', 'Processor not found on this agent');
  });

  it('should handle execution failure', async () => {
    mockPoll
      .mockResolvedValueOnce({ id: 'job-1', type: 'test.job' })
      .mockImplementationOnce(async () => {
        poller.stop();
        return null;
      });
    mockExecute.mockRejectedValue(new Error('Execution failed'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await poller.start();

    expect(errorSpy).toHaveBeenCalledWith('Job job-1 failed:', expect.any(Error));
    expect(mockFail).toHaveBeenCalledWith('job-1', 'Execution failed');
  });

  it('should handle non-Error catch during execution', async () => {
    mockPoll
      .mockResolvedValueOnce({ id: 'job-1', type: 'test.job' })
      .mockImplementationOnce(async () => {
        poller.stop();
        return null;
      });
    mockExecute.mockRejectedValue('String error');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await poller.start();

    expect(errorSpy).toHaveBeenCalledWith('Job job-1 failed:', 'String error');
    expect(mockFail).toHaveBeenCalledWith('job-1', 'Unknown error');
  });

  it('should handle polling error and continue', async () => {
    mockPoll.mockRejectedValueOnce(new Error('Poll failed')).mockImplementationOnce(async () => {
      poller.stop();
      return null;
    });

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await poller.start();

    expect(errorSpy).toHaveBeenCalledWith('Polling cycle Error:', expect.any(Error));
  });
});
