import { z } from 'zod';
import { JobProcessor, type AgentJob, type AgentContext } from '@nexical/agent';

export const EchoSchema = z.object({
  message: z.string(),
});

export type EchoPayload = z.infer<typeof EchoSchema>;

/**
 * EchoProcessor simply echoes back the input message.
 *
 * Location: apps/backend/modules/orchestrator-api/src/agent/EchoProcessor.ts
 * Registry Key: orchestrator-api.EchoProcessor
 */
export class EchoProcessor extends JobProcessor<EchoPayload> {
  public jobType = 'echo-test';
  public schema = EchoSchema;

  public async process(job: AgentJob<EchoPayload>, ctx: AgentContext) {
    const { message } = job.payload;

    ctx.logger.info(`Received echo message: ${message}`);

    // Simulate some work
    await new Promise((resolve) => setTimeout(resolve, 100));

    return {
      success: true,
      echoed: message,
      processedAt: new Date().toISOString(),
    };
  }
}
