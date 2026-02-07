import { describe, it, expect } from 'vitest';
import { JobProcessor } from '../../../src/core/processor';
import { z } from 'zod';
import { vi } from 'vitest';

vi.mock('@nexical/sdk', () => {
  return {
    NexicalClient: class MockClient {
      constructor(public config: { baseUrl: string }) {}
    },
  };
});

// Concrete implementation for testing
class TestProcessor extends JobProcessor<unknown> {
  jobType = 'test.job';
  schema = z.object({ foo: z.string() });

  async process() {
    // no-op
  }

  // Helper to expose api for assertions
  getApi() {
    return this.api;
  }
}

describe('JobProcessor', () => {
  it('should initialize with correct config', () => {
    const processor = new TestProcessor({
      apiUrl: 'http://test-api',
      apiToken: 'test-token',
    });

    const api = processor.getApi();
    expect(api).toBeDefined();
    expect((api as unknown as { config: { baseUrl: string } }).config.baseUrl).toBe(
      'http://test-api',
    );
  });

  it('should have correct jobType', () => {
    const processor = new TestProcessor({
      apiUrl: 'http://test-api',
      apiToken: 'test-token',
    });
    expect(processor.jobType).toBe('test.job');
  });

  it('should have a schema', () => {
    const processor = new TestProcessor({
      apiUrl: 'http://test-api',
      apiToken: 'test-token',
    });
    expect(processor.schema).toBeDefined();
    const result = processor.schema.safeParse({ foo: 'bar' });
    expect(result.success).toBe(true);
  });
});
