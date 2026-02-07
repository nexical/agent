import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { main } from '../../src/main';

const mockSupervisorStart = vi.fn();
const mockSupervisorShutdown = vi.fn();
const mockPollerStart = vi.fn();
const mockPollerStop = vi.fn();
const mockRegister = vi.fn().mockResolvedValue({});

vi.mock('../../src/runtime/supervisor.js', () => ({
  AgentSupervisor: class {
    start = mockSupervisorStart;
    shutdown = mockSupervisorShutdown;
  },
}));

vi.mock('../../src/runtime/poller.js', () => ({
  JobPoller: class {
    start = mockPollerStart;
    stop = mockPollerStop;
  },
}));

vi.mock('../../src/networking/client.js', () => ({
  AgentClient: class {
    register = mockRegister;
  },
}));

vi.mock('../../src/runtime/executor.js', () => ({
  JobExecutor: class {},
}));

vi.mock('../../src/registry.js', () => ({
  jobProcessors: {
    'test-job': class MockProcessor {
      constructor() {}
    },
  },
  processors: {
    'test-persistent': class MockPersistent {
      static mockStart = vi.fn().mockResolvedValue({});
      static mockStop = vi.fn();
      start = MockPersistent.mockStart;
      stop = MockPersistent.mockStop;
    },
  },
}));

describe('Main Entry Point', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
      throw new Error(`Process.exit called with ${code}`);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should show help and exit', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    await expect(main(['node', 'agent.js', '--help'], {})).rejects.toThrow(
      'Process.exit called with 0',
    );
    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('Usage:'));
  });

  it('should exit if AGENT_API_TOKEN is missing', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(main(['node', 'agent.js'], {})).rejects.toThrow('Process.exit called with 1');
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('AGENT_API_TOKEN is not defined'),
    );
  });

  it('should start supervisor mode by default and handle signals', async () => {
    const env = { AGENT_API_TOKEN: 'test-token' };
    const processOnSpy = vi
      .spyOn(process, 'on')
      .mockImplementation((event: string | symbol, cb: (...args: unknown[]) => void) => {
        if (event === 'SIGINT' || event === 'SIGTERM') {
          // Capture but don't call immediately to test registration
        }
        return process;
      });

    await main(['node', 'agent.js'], env);

    expect(mockSupervisorStart).toHaveBeenCalled();
    expect(mockRegister).toHaveBeenCalled();
    expect(mockPollerStart).toHaveBeenCalled();
    expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    expect(processOnSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));

    // Test signal handler
    const sigintHandler = processOnSpy.mock.calls.find((c) => c[0] === 'SIGINT')![1];
    await expect(sigintHandler()).rejects.toThrow('Process.exit called with 0');
    expect(mockPollerStop).toHaveBeenCalled();
    expect(mockSupervisorShutdown).toHaveBeenCalled();
  });

  it('should start specific processor mode and handle SIGTERM', async () => {
    const env = { AGENT_API_TOKEN: 'test-token' };
    const processOnSpy = vi
      .spyOn(process, 'on')
      .mockImplementation((event: string | symbol, cb: (...args: unknown[]) => void) => {
        return process;
      });

    await main(['node', 'agent.js', '--processor', 'test-persistent'], env);

    expect(mockSupervisorStart).not.toHaveBeenCalled();
    expect(processOnSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));

    const sigtermHandler = processOnSpy.mock.calls.find((c) => c[0] === 'SIGTERM')![1];
    const registry = await import('../../src/registry.js');
    const mockStop = (
      registry.processors['test-persistent'] as unknown as { mockStop: ReturnType<typeof vi.fn> }
    ).mockStop;

    expect(() => sigtermHandler()).toThrow('Process.exit called with 0');
    expect(mockStop).toHaveBeenCalled();
  });

  it('should handle processor crash', async () => {
    const env = { AGENT_API_TOKEN: 'test-token' };
    const registry = await import('../../src/registry.js');
    (
      registry.processors['test-persistent'] as unknown as { mockStart: ReturnType<typeof vi.fn> }
    ).mockStart.mockRejectedValueOnce(new Error('Crash'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(main(['node', 'agent.js', '--processor', 'test-persistent'], env)).rejects.toThrow(
      'Process.exit called with 1',
    );
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('crashed:'), expect.any(Error));
  });

  it('should exit if processor not found', async () => {
    const env = { AGENT_API_TOKEN: 'test-token' };
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(main(['node', 'agent.js', '--processor', 'non-existent'], env)).rejects.toThrow(
      'Process.exit called with 1',
    );
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('not found in registry'));
  });
});
