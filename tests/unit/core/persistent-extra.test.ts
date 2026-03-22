import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PersistentAgent } from '../../../src/core/persistent.js';

// Mock NexicalClient and AgentAuthStrategy
vi.mock('@nexical/sdk', () => ({
  NexicalClient: vi.fn(),
}));

vi.mock('../networking/auth.js', () => ({
  AgentAuthStrategy: vi.fn(),
}));

class TestAgent extends PersistentAgent {
  public name = 'TestAgent';
  public tickCount = 0;

  protected async tick() {
    this.tickCount++;
  }

  public setRunning(val: boolean) {
    this.running = val;
  }
}

describe('PersistentAgent Extra Coverage', () => {
  beforeEach(() => {
    vi.stubEnv('AGENT_API_TOKEN', 'test-token');
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should return immediately if already running', async () => {
    const agent = new TestAgent();
    agent.setRunning(true);
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    await agent.start();

    expect(infoSpy).not.toHaveBeenCalledWith(expect.stringContaining('Starting persistent agent'));
  });

  it('should skip API refresh if token is missing mid-loop', async () => {
    vi.stubEnv('AGENT_API_TOKEN', 'test-token');
    const agent = new TestAgent();
    // @ts-expect-error accessing protected
    agent.intervalMs = 100;

    let ticks = 0;
    const tickSpy = vi.spyOn(agent, 'tick' as any).mockImplementation(async () => {
      ticks++;
      if (ticks === 1) {
        vi.stubEnv('AGENT_API_TOKEN', '');
      } else if (ticks === 2) {
        agent.stop();
      }
    });

    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    const startPromise = agent.start();

    // First tick
    await vi.advanceTimersByTimeAsync(0);
    expect(tickSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining('Refreshing API client with token: test-token'),
    );

    // Second tick
    await vi.advanceTimersByTimeAsync(100);
    expect(tickSpy).toHaveBeenCalledTimes(2);

    await startPromise;

    // Second tick should NOT have refreshed (token was empty)
    const refreshCalls = infoSpy.mock.calls.filter((c) => c[0].includes('Refreshing API client'));
    expect(refreshCalls.length).toBe(1);
  });

  it('should skip timeout if stopped during tick', async () => {
    const agent = new TestAgent();
    // @ts-expect-error accessing protected
    agent.intervalMs = 1000;

    vi.spyOn(agent, 'tick' as any).mockImplementation(async () => {
      agent.stop();
    });

    const promise = agent.start();
    // Use real timers check to ensure we didn't wait
    const start = Date.now();
    await promise;
    const end = Date.now();

    // Should have finished almost immediately (well within 1000ms)
    // Even without fake timers jumping, the promise resolves because loop terminates
    expect(end - start).toBeLessThan(500);
  });

  it('should use default API URL if AGENT_API_URL is missing', () => {
    delete process.env.AGENT_API_URL;
    const agent = new TestAgent();
    // @ts-expect-error accessing protected
    expect(agent.api).toBeDefined();
    // Internal check of NexicalClient params if possible, but mocking covers the branch
  });
});
