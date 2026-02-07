import { NexicalClient } from '@nexical/sdk';

export class JobRemoteLogger {
  constructor(
    private client: NexicalClient,
    private jobId: string,
  ) {}

  private async log(level: string, message: string, ...args: unknown[]) {
    const formattedMessage =
      args.length > 0 ? `${message} ${args.map((a) => JSON.stringify(a)).join(' ')}` : message;

    // Log to local console for immediate visibility
    if (level.toLowerCase() === 'error') {
      console.error(`[Job ${this.jobId}] [${level}] ${formattedMessage}`);
    } else if (level.toLowerCase() === 'warn') {
      console.warn(`[Job ${this.jobId}] [${level}] ${formattedMessage}`);
    } else {
      console.info(`[Job ${this.jobId}] [${level}] ${formattedMessage}`);
    }

    try {
      // Transmit to application
      await this.client.orchestrator.jobLog.create({
        jobId: this.jobId,
        level,
        message: formattedMessage,
      });
    } catch (err) {
      console.error(`[JobRemoteLogger] Failed to transmit log:`, err);
    }
  }

  info(msg: string, ...args: unknown[]) {
    this.log('INFO', msg, ...args);
  }

  error(msg: string, ...args: unknown[]) {
    this.log('ERROR', msg, ...args);
  }

  warn(msg: string, ...args: unknown[]) {
    this.log('WARN', msg, ...args);
  }
}
