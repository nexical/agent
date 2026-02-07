import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PersistentAgent } from '../../src/core/persistent';
import { TestServer } from '@tests/integration/lib/server';
import { ApiClient } from '@tests/integration/lib/client';

class TestPersistentAgent extends PersistentAgent {
  name = 'TestPersistentAgent';
  tickCount = 0;

  constructor() {
    super();
    this.intervalMs = 100; // Fast ticks for testing
  }

  async tick() {
    this.tickCount++;
    // Use the inherited this.api (NexicalClient) to call the heartbeat
    await this.api.orchestrator.agent.heartbeat('test-agent-id', { id: 'test-agent-id' });
  }
}

describe('Persistent Agent Integration', () => {
  let savedEnv: typeof process.env;

  beforeEach(async () => {
    savedEnv = { ...process.env };

    const adminClient = new ApiClient(TestServer.getUrl());
    const actor = await adminClient.as('user', { role: 'ADMIN' });

    process.env.AGENT_API_TOKEN = actor.token.rawKey;
    process.env.AGENT_API_URL = TestServer.getUrl() + '/api';
  });

  afterEach(() => {
    process.env = savedEnv;
  });

  it('should run the tick loop and interact with the API', async () => {
    const agent = new TestPersistentAgent();

    // Start in background
    const startPromise = agent.start();

    // Wait for a few ticks
    await new Promise((resolve) => setTimeout(resolve, 500));

    const ticks = agent.tickCount;
    expect(ticks).toBeGreaterThanOrEqual(1);

    agent.stop();
    await startPromise; // Await the loop to exit

    // Verify it stopped
    const finalTicks = agent.tickCount;
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(agent.tickCount).toBe(finalTicks);
  });

  it('should handle API errors gracefully in the loop', async () => {
    // Force an invalid token AFTER startup
    const agent = new TestPersistentAgent();
    const startPromise = agent.start();

    await new Promise((resolve) => setTimeout(resolve, 200));
    const ticksBefore = agent.tickCount;

    // Break the token
    process.env.AGENT_API_TOKEN = 'invalid-token';

    // Wait some more - it should keep ticking but log errors
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(agent.tickCount).toBeGreaterThan(ticksBefore);

    agent.stop();
    await startPromise; // Await the loop to exit
  });
});
