import { z } from 'zod';

export type JobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface AgentJob<T = unknown> {
  id: string;
  type: string;
  payload: T;
  status?: JobStatus;
  progress?: number;
  result?: unknown;
  error?: unknown;
  retryCount?: number;
  maxRetries?: number;
}

export interface AgentContext {
  // We can add a constrained SDK client here later if needed
  // or just the raw capabilities
  logger: {
    info(msg: string, ...args: unknown[]): void;
    error(msg: string, ...args: unknown[]): void;
    warn(msg: string, ...args: unknown[]): void;
  };
  api: unknown; // NexicalClient (Used as any to prevent circular dependency in SDK Types)
}

export interface AgentResult {
  success: boolean;
  data?: unknown;
  error?: unknown;
}

export interface AgentWorker<T = unknown> {
  jobType: string;
  schema: z.ZodSchema<T>;
  handler(job: AgentJob<T>, context: AgentContext): Promise<AgentResult | void>;
}
