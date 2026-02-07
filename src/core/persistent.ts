import { NexicalClient } from '@nexical/sdk';
import { AgentAuthStrategy } from '../networking/auth.js';

export interface PersistentAgentConfig {
  intervalMs?: number;
}

export abstract class PersistentAgent {
  public abstract name: string;
  protected intervalMs: number = 60000; // Default 1 minute
  protected running: boolean = false;
  protected api: NexicalClient;
  protected logger: Console = console;

  constructor() {
    if (!process.env.AGENT_API_TOKEN) {
      throw new Error('AGENT_API_TOKEN is required');
    }

    // Allow overriding interval via env
    if (process.env.AGENT_WATCHER_INTERVAL) {
      this.intervalMs = parseInt(process.env.AGENT_WATCHER_INTERVAL);
    }

    this.api = new NexicalClient({
      baseUrl: process.env.AGENT_API_URL || 'http://localhost:4321/api',
      authStrategy: new AgentAuthStrategy(process.env.AGENT_API_TOKEN),
    });
  }

  public async start() {
    if (this.running) return;
    this.running = true;
    this.logger.info(`[${this.name}] Starting persistent agent...`);

    while (this.running) {
      try {
        // Ensure client is current with latest env vars (especially for testing)
        if (process.env.AGENT_API_TOKEN) {
          this.logger.info(
            `[${this.name}] Refreshing API client with token: ${process.env.AGENT_API_TOKEN.substring(0, 10)}...`,
          );
          this.api = new NexicalClient({
            baseUrl: process.env.AGENT_API_URL || 'http://localhost:4321/api',
            authStrategy: new AgentAuthStrategy(process.env.AGENT_API_TOKEN),
          });
        }
        this.logger.info(`[${this.name}] Tick beginning...`);
        await this.tick();
      } catch (error) {
        this.logger.error(`[${this.name}] Tick failed:`, error);
      }

      if (this.running) {
        await new Promise((resolve) => setTimeout(resolve, this.intervalMs));
      }
    }
  }

  public stop() {
    this.running = false;
    this.logger.info(`[${this.name}] Stopping...`);
  }

  protected abstract tick(): Promise<void>;
}
