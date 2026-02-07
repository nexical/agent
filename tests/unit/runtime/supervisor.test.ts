import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AgentSupervisor } from '../../../src/runtime/supervisor.js';
import { fork, spawn } from 'child_process';

vi.mock('child_process', () => {
  const forkMock = vi.fn();
  const spawnMock = vi.fn();
  return {
    __esModule: true,
    fork: forkMock,
    spawn: spawnMock,
    default: {
      fork: forkMock,
      spawn: spawnMock,
    },
  };
});

describe('AgentSupervisor', () => {
  let supervisor: AgentSupervisor;
  const mockProcessors = {
    'test-processor': class {},
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  type MockChildProcess = {
    on: ReturnType<typeof vi.fn>;
    exitCode: number | null;
    killed: boolean;
    kill: ReturnType<typeof vi.fn>;
    exitCb?: (code: number | null, signal: string | null) => void;
  };

  const createMockChild = (): MockChildProcess => {
    const child: MockChildProcess = {
      on: vi.fn(),
      exitCode: null,
      killed: false,
      kill: vi.fn(),
    };
    child.on.mockImplementation(
      (event: string, cb: (code: number | null, signal: string | null) => void) => {
        if (event === 'exit') child.exitCb = cb;
        return child;
      },
    );
    child.kill.mockImplementation(() => {
      if (child.exitCb) child.exitCb(0, 'SIGTERM');
      child.killed = true;
      child.exitCode = 0;
      return true;
    });
    return child;
  };

  it('should use default entryPoint if not provided', () => {
    const originalArgv = process.argv;
    process.argv = ['node', 'default-entry.js'];

    supervisor = new AgentSupervisor(mockProcessors);
    // @ts-expect-error accessing private
    expect(supervisor.entryPoint).toBe('default-entry.js');

    process.argv = originalArgv;
  });

  it('should spawn processors in TS mode and log errors', () => {
    const mockChild = createMockChild();
    (spawn as ReturnType<typeof vi.fn>).mockReturnValue(mockChild);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    supervisor = new AgentSupervisor(mockProcessors, 'test.ts');
    supervisor.start();

    expect(spawn).toHaveBeenCalled();

    // Trigger error event
    const errorCb = (
      (mockChild.on as ReturnType<typeof vi.fn>).mock.calls as Array<[string, (err: Error) => void]>
    ).find((c) => c[0] === 'error')![1];
    errorCb(new Error('Spawn error'));
    expect(errorSpy).toHaveBeenCalledWith('[Child test-processor SPAWN ERROR]', expect.any(Error));
  });

  it('should spawn processors in JS mode', () => {
    const mockChild = createMockChild();
    (fork as ReturnType<typeof vi.fn>).mockReturnValue(mockChild);

    supervisor = new AgentSupervisor(mockProcessors, 'test.js');
    supervisor.start();

    expect(fork).toHaveBeenCalled();
  });

  it('should restart child on exit and handle shuttingDown check', async () => {
    const mockChild = createMockChild();
    (fork as ReturnType<typeof vi.fn>).mockReturnValue(mockChild);

    supervisor = new AgentSupervisor(mockProcessors, 'test.js');
    supervisor.start();

    // Simulate exit
    mockChild.exitCb?.(1, null);

    expect(fork).toHaveBeenCalledTimes(1);

    // Advance time for restart
    vi.runAllTimers();
    expect(fork).toHaveBeenCalledTimes(2);

    // Test shuttingDown check in exit handler
    // @ts-expect-error accessing private
    supervisor.shuttingDown = true;
    mockChild.exitCb?.(0, null);
    // Should not call spawnProcessor again
    vi.runAllTimers();
    expect(fork).toHaveBeenCalledTimes(2);
  });

  it('should shutdown children and skip already dead ones', async () => {
    const mockChild1 = createMockChild();
    const mockChild2 = createMockChild();
    mockChild2.exitCode = 0;
    mockChild2.killed = true;

    const mockProcessors2 = {
      p1: class {},
      p2: class {},
    };

    (fork as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(mockChild1)
      .mockReturnValueOnce(mockChild2);

    supervisor = new AgentSupervisor(mockProcessors2, 'test.js');
    supervisor.start();

    await supervisor.shutdown();

    expect(mockChild1.kill).toHaveBeenCalled();
    expect(mockChild2.kill).not.toHaveBeenCalled();
  });

  it('should handle SIGINT and SIGTERM and not double shutdown', async () => {
    const mockChild = createMockChild();
    (fork as ReturnType<typeof vi.fn>).mockReturnValue(mockChild);

    const processSpy = vi.spyOn(process, 'on').mockImplementation((event, cb) => {
      return process;
    });

    supervisor = new AgentSupervisor(mockProcessors, 'test.js');
    supervisor.start();

    const sigintHandler = (
      (processSpy as ReturnType<typeof vi.fn>).mock.calls as Array<[string, () => Promise<void>]>
    ).find((c) => c[0] === 'SIGINT')![1];

    // First shutdown
    const shutdownPromise = sigintHandler();
    expect(shutdownPromise).toBeInstanceOf(Promise);

    // Second shutdown should return early
    const shutdownPromise2 = supervisor.shutdown();
    expect(shutdownPromise2).toBeInstanceOf(Promise);

    await shutdownPromise;
  });
});
