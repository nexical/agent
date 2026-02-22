import { z } from 'zod';
import { JobProcessor, type AgentJob, type AgentContext } from '@nexical/agent/core/index.js';

/**
 * Payload for the EmailWelcomeProcessor.
 */
export const EmailWelcomePayloadSchema = z.object({
  /**
   * Recipient email address.
   */
  email: z.string().email(),

  /**
   * Recipient full name.
   */
  name: z.string(),

  /**
   * Optional template identifier.
   */
  templateId: z.string().optional(),
});

export type EmailWelcomePayload = z.infer<typeof EmailWelcomePayloadSchema>;

/**
 * EmailWelcomeProcessor handles sending onboarding welcome emails.
 */
export class EmailWelcomeProcessor extends JobProcessor<EmailWelcomePayload> {
  /**
   * Unique identifier for the 'email.send-welcome' job type.
   */
  public static jobType = 'email.send-welcome';

  /**
   * Zod Schema for runtime payload validation.
   */
  public schema = EmailWelcomePayloadSchema;

  /**
   * Execution logic for sending welcome emails.
   *
   * @param job - Job instance with EmailWelcomePayload.
   * @param context - Execution context for logging and API calls.
   */
  public async process(
    job: AgentJob<EmailWelcomePayload>,
    context: AgentContext,
  ): Promise<{ sent: boolean; provider: string }> {
    const { email, name, templateId } = job.payload;

    context.logger.info(
      `Sending welcome email to ${email} (${name}) using template ${templateId ?? 'default'}...`,
    );

    try {
      // 1. Log progress to the Orchestrator via context.api
      await context.api.orchestrator.updateProgress({
        jobId: job.id,
        progress: 0.5,
        message: 'Formatting email content...',
      });

      // 2. Perform business logic (simulated)
      // Note: Real implementations would delegate to an EmailService or similar.
      const sent = true;
      const provider = 'AWS_SES';

      // 3. Final log entry
      context.logger.info(`Successfully sent email via ${provider}`);

      // 4. Return result to be stored in Job.result
      return { sent, provider };
    } catch (error: unknown) {
      context.logger.error(
        `Email delivery failure: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }
}
