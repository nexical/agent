import { describe, it, expect } from 'vitest';
import { AgentAuthStrategy } from '../../src/networking/auth';

describe('AgentAuthStrategy', () => {
  it('should inject correct headers', async () => {
    const secret = 'test-secret';
    const strategy = new AgentAuthStrategy(secret);
    const headers = await strategy.getHeaders();

    expect(headers).toHaveProperty('Authorization', `Bearer ${secret}`);
  });
});
