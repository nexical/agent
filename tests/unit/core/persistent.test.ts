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
  public tickError: Error | null = null;
  public stopAfterTicks: number | null = null;

  protected async tick() {
    this.tickCount++;
    if (this.tickError) throw this.tickError;
    if (this.stopAfterTicks !== null && this.tickCount >= this.stopAfterTicks) {
      this.stop();
    }
  }
}

describe('PersistentAgent', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    process.env.AGENT_API_TOKEN = 'test-token';
    vi.useFakeTimers();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should throw error if AGENT_API_TOKEN is missing', () => {
    delete process.env.AGENT_API_TOKEN;
    expect(() => new TestAgent()).toThrow('AGENT_API_TOKEN is required');
  });

  it('should initialize with default interval', () => {
    const agent = new TestAgent();
    // @ts-expect-error accessing protected
    expect(agent.intervalMs).toBe(60000);
  });

  it('should override interval via env', () => {
    process.env.AGENT_WATCHER_INTERVAL = '5000';
    const agent = new TestAgent();
    // @ts-expect-error accessing protected
    expect(agent.intervalMs).toBe(5000);
  });

  it('should run tick loop', async () => {
    const agent = new TestAgent();
    // @ts-expect-error accessing protected
    agent.intervalMs = 100;
    agent.stopAfterTicks = 2;

    const startPromise = agent.start();

    // First tick is immediate
    await vi.advanceTimersByTimeAsync(0);
    expect(agent.tickCount).toBe(1);

    // Second tick after interval
    await vi.advanceTimersByTimeAsync(100);
    expect(agent.tickCount).toBe(2);

    await startPromise;
    expect(agent.tickCount).toBe(2);
  });

  it('should not start if already running', async () => {
    const agent = new TestAgent();
    // @ts-expect-error accessing protected
    agent.intervalMs = 100;
    agent.stopAfterTicks = 1;

    const promise1 = agent.start();
    const promise2 = agent.start();

    expect(promise2).toBeInstanceOf(Promise); // Returns early but still a promise
    await promise2;

    await promise1;
  });

  it('should handle errors in tick', async () => {
    const agent = new TestAgent();
    // @ts-expect-error accessing protected
    agent.intervalMs = 100;
    agent.tickError = new Error('Tick Failed');

    // We need to stop it somehow since it will loop forever on error
    // Let's stop it after 1 tick
    let ticks = 0;
    // @ts-expect-error accessing protected method for testing
    vi.spyOn(agent, 'tick').mockImplementation(async () => {
      ticks++;
      if (ticks >= 1) agent.stop();
      throw new Error('Tick Failed');
    });

    const loggerSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await agent.start();
    expect(loggerSpy).toHaveBeenCalledWith(
      expect.stringContaining('Tick failed:'),
      expect.any(Error),
    );
  });

  it('should refresh api client if token is present in env during start', async () => {
    const agent = new TestAgent();
    agent.stopAfterTicks = 1;

    process.env.AGENT_API_TOKEN = 'new-token';
    const loggerSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    await agent.start();

    expect(loggerSpy).toHaveBeenCalledWith(
      expect.stringContaining('Refreshing API client with token: new-token'),
    );
  });
});
