import type { AuthStrategy } from '@nexical/sdk-core';

export class AgentAuthStrategy implements AuthStrategy {
  constructor(private secret: string) {}
  async getHeaders() {
    return {
      Authorization: `Bearer ${this.secret}`,
    };
  }
}
