import { describe, it, expect } from 'vitest';
import { jobProcessors } from '../../src/registry';

describe('Agent Core Integration', () => {
  it('should load the registry correctly', () => {
    expect(jobProcessors).toBeDefined();
    // Verify our sample EchoProcessor is registered
    expect(Object.keys(jobProcessors)).toContain('orchestrator-api.EchoProcessor');
  });

  it('should have a clean environment for testing', () => {
    expect(process.env.NODE_ENV).toBeDefined();
  });
});
