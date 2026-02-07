import { describe, it, expect } from 'vitest';
import { jobProcessors, processors } from '../../src/registry.js';

describe('Registry', () => {
  it('should export jobProcessors', () => {
    expect(jobProcessors).toBeDefined();
    expect(typeof jobProcessors).toBe('object');
  });

  it('should export processors', () => {
    expect(processors).toBeDefined();
    expect(typeof processors).toBe('object');
  });
});
