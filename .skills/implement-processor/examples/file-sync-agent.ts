import { PersistentAgent } from '@nexical/agent/core/index.js';

/**
 * Configuration for the FileSyncAgent.
 */
export interface FileSyncConfig {
  /**
   * Local directory to monitor.
   */
  sourceDir: string;

  /**
   * Remote storage bucket name.
   */
  bucketName: string;

  /**
   * Sync interval in milliseconds.
   */
  intervalMs?: number;
}

/**
 * FileSyncAgent continuously synchronizes local files to remote storage.
 * Demonstrates tick-based logic and configuration-driven initialization.
 */
export class FileSyncAgent extends PersistentAgent {
  /**
   * Unique name for the agent process.
   */
  public name = 'file-sync-agent';

  /**
   * Explicit configuration object.
   */
  private config: FileSyncConfig;

  /**
   * Constructor following the Configuration-Driven Initialization pattern.
   *
   * @param config - Configuration object for the agent.
   */
  constructor(config: FileSyncConfig) {
    super();
    this.config = config;

    // Override the default tick interval if provided
    if (config.intervalMs) {
      this.intervalMs = config.intervalMs;
    }
  }

  /**
   * Continuous execution logic called on every tick.
   */
  public async tick(): Promise<void> {
    this.logger.info(
      `Starting sync tick for ${this.config.sourceDir} -> ${this.config.bucketName}`,
    );

    try {
      // 1. Scan for local changes (simulated)
      const changes = await this.scanForChanges(this.config.sourceDir);

      if (changes.length === 0) {
        this.logger.info('No changes detected. Skipping sync.');
        return;
      }

      // 2. Upload changes using the SDK (this.api)
      for (const file of changes) {
        this.logger.info(`Syncing file: ${file}`);
        // Simulated SDK call: await this.api.storage.upload(this.config.bucketName, file);
      }

      this.logger.info(`Successfully synced ${changes.length} files.`);
    } catch (error: unknown) {
      this.logger.error(
        `Sync tick failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Note: The Supervisor will catch unhandled errors and restart the agent if it crashes.
    }
  }

  /**
   * Internal helper to scan for changes.
   */
  private async scanForChanges(dir: string): Promise<string[]> {
    // Simulated file system scan
    return [];
  }
}
