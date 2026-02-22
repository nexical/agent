import { PersistentAgent } from '../core/index.js';
import { NexicalClient, AgentAuthStrategy } from '../networking/index.js';

/**
 * Example WatcherAgent
 *
 * A continuous background worker that monitors a specific endpoint or resource.
 */
export class WatcherAgent extends PersistentAgent {
  public name = 'watcher-agent';
  private intervalMs = parseInt(process.env.AGENT_WATCHER_INTERVAL || '60000');
  private api: NexicalClient;

  constructor() {
    super();
    // Initialize the standardized SDK client with environment-sourced credentials
    this.api = new NexicalClient({
      baseUrl: process.env.AGENT_API_URL,
      authStrategy: new AgentAuthStrategy(process.env.AGENT_API_TOKEN),
    });
  }

  /**
   * The core logic executed by the agent on each tick.
   */
  protected async tick(): Promise<void> {
    try {
      this.logger.info(`[${this.name}] Starting watcher tick...`);

      // Perform monitoring or periodic tasks
      // Example: const status = await this.api.get('/health');
      // this.logger.info(`[${this.name}] Endpoint status:`, status);

      this.logger.info(`[${this.name}] Watcher tick completed successfully.`);
    } catch (error) {
      this.logger.error(`[${this.name}] Watcher tick failed:`, error);
    }
  }

  /**
   * Manages the continuous lifecycle of the persistent agent.
   */
  public async run(): Promise<void> {
    this.logger.info(`[${this.name}] Starting persistent watcher...`);
    this.running = true;

    while (this.running) {
      try {
        await this.tick();
      } catch (error) {
        this.logger.error(`[${this.name}] Unexpected error in persistent loop:`, error);
      }

      if (this.running) {
        // Wait for the defined interval before the next tick
        await new Promise((resolve) => setTimeout(resolve, this.intervalMs));
      }
    }

    this.logger.info(`[${this.name}] Persistent watcher stopped.`);
  }
}
