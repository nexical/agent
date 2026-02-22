# Nexical Agent (`@nexical/agent`) Architecture

This document provides comprehensive architectural guidance for the `@nexical/agent` package. It outlines the system's core design, runtime behavior, and patterns for development. This serves as the authoritative guide for contributing to and understanding the Nexus Agent.

## 1. System Overview

The Nexus Agent is an **Orchestrator Worker**. It acts as the execution arm of the Nexus Ecosystem. It is designed to connect to the centralized Orchestrator API, receive tasks, and process them locally or act as a supervisor for long-running processes.

The agent operates in two primary modalities via a single entrypoint (`src/main.ts`):

1. **Supervisor Mode (Default)**: Runs the `JobPoller` (which fetches and executes discrete jobs) and acts as a process manager (Supervisor) spawning child processes for long-running persistent agents.
2. **Processor Mode (`--processor [name]`)**: Runs as a dedicated spawned child process executing a single `PersistentAgent` continuously.

## 2. Core Concepts & Entities

The core abstractions are located in `src/core/`.

### `JobProcessor<T>`

Defines a worker that handles discrete, queue-based jobs.

- **Trigger**: Activated by the `JobPoller` when the Orchestrator API assigns a job.
- **Validation**: Enforces strongly-typed payloads using `z.ZodSchema`. The `JobExecutor` automatically validates the payload before handing it to the `process()` method.
- **Contract**: Must implement `jobType` (string), `schema` (Zod), and `process(job, context)` logic.

### `PersistentAgent`

Defines a worker that runs continuously in a loop (tick-based).

- **Trigger**: Started by the `AgentSupervisor` and runs in its own isolated OS process.
- **Loop**: Executes the `tick()` method on a defined `intervalMs`.
- **Contract**: Must implement `name` (string) and the `tick()` method. State is maintained within the class instance.

## 3. Runtime Architecture

The runtime details are orchestrated inside `src/runtime/`.

### 3.1 The Supervisor Pattern (`AgentSupervisor`)

When the main process boots, the `AgentSupervisor` reads all registered `PersistentAgent` classes from the registry and spawns them.

- **Isolation**: Each persistent agent runs in a child process (via `fork` in production or `spawn` with `tsx` in development).
- **Resilience**: The supervisor listens for exit signals from children and automatically restarts them after a 5-second backoff.
- **Graceful Shutdown**: Intercepts `SIGINT`/`SIGTERM` to safely terminate all child processes before exiting the main process.
- **Environment Awareness**: The supervisor MUST detect the entrypoint type and use the appropriate engine (`tsx` for development, `node` fork for production).

### 3.2 The Poller & Executor

While persistent agents run as children, the main process runs the `JobPoller`.

- **JobPoller**: Continuously long-polls the Orchestrator API (via `AgentClient.poll`) advertising its "capabilities" (the list of registered `JobProcessor` types).
- **JobExecutor**: When a job is received, the Executor validates the payload against the processor's Zod schema. It injects an `AgentContext` (providing API access and remote logging) into the processor.
- **Completion/Failure**: The Poller guarantees that the outcome (`complete` or `fail`) is reported back to the Orchestrator.

## 4. Networking & Authentication

Network interactions are managed in `src/networking/`.

### `AgentClient`

A specialized wrapper around the `@nexical/sdk` `NexicalClient`. It is responsible for orchestrator-specific operations:

- **Registration**: Calls `registerAgent` providing its hostname and capabilities.
- **Polling & Updates**: Handles `pollJobs`, `completeJob`, `failJob`, and `updateProgress`.
- **Job Creation**: Allows agents to spawn child jobs via `createJob`.

### Authentication

Security relies on a shared secret token mechanism.

- The `AgentAuthStrategy` applies the token (from `AGENT_API_TOKEN`) as a Bearer token.
- Both the main Poller and the Persistent Agent child processes utilize this token.

## 5. Module Development Guide

When adding new capabilities to the agent, adhere strictly to these patterns:

### Adding a Job Processor

1. Create a class extending `JobProcessor<T>` in `apps/backend/modules/{module}/src/agent/{ClassName}.ts`.
2. Define your payload schema using `zod`.
3. Implement the `process` method. Use `context.logger` for remote observability, avoiding standard `console.log` for job-specific execution flows.
4. **DO NOT** manually edit `src/registry.ts`. The discovery script handles registration automatically.
5. Trigger registration by running `npm run generate` in the `packages/agent` directory.

```typescript
// Example Implementation (apps/backend/modules/orchestrator-api/src/agent/EchoProcessor.ts)
import { z } from 'zod';
import { JobProcessor, type AgentJob, type AgentContext } from '@nexical/agent';

export const MyJobSchema = z.object({ targetPath: z.string() });
export type MyJobPayload = z.infer<typeof MyJobSchema>;

export class MyJobProcessor extends JobProcessor<MyJobPayload> {
  public jobType = 'my-job-type';
  public schema = MyJobSchema;

  public async process(job: AgentJob<MyJobPayload>, ctx: AgentContext) {
    ctx.logger.info(`Processing ${job.payload.targetPath}`);
    // implementation
    return { success: true };
  }
}
```

### Adding a Persistent Agent

1. Create a class extending `PersistentAgent` in `apps/backend/modules/{module}/src/agent/{ClassName}.ts`.
2. Define the `name` and (optionally) override `intervalMs`.
3. Implement the `tick()` method.
4. Trigger registration by running `npm run generate` in the `packages/agent` directory.

### Automated Discovery & Registration

The Nexus Agent utilizes a centralized registry for background agents and job processors discovered across backend modules.

- **Discovery Root**: The system scans `apps/backend/modules/*/src/agent/*.ts` for valid classes.
- **Registry Key Convention**: Keys MUST follow the format `{module-name}.{ClassName}` (e.g., `orchestrator-api.EchoProcessor`).
- **Trigger**: The file `packages/agent/src/registry.ts` is machine-generated and MUST NOT be edited manually. Run `npm run generate` to refresh the registry.

### Dependency Rules and Hygiene

- **Strict Naming**: Agent implementation classes MUST use PascalCase and include a functional suffix: `Processor` for queue-based jobs (`JobProcessor`) or `Agent` for continuous tasks (`PersistentAgent`).
- **Strict Typing**: The `any` type is strictly forbidden. Use Zod schemas to derive TypeScript types automatically.
- **Isolation**: Processors must not maintain shared memory state, as they may be executed concurrently or across different agent nodes.
- **API Access**: Always utilize the `this.api` (Nexical SDK client) or the `context.api` injected into job processors. Do not construct raw `fetch` calls to the orchestrator.
- **ESM Module Imports**: Local file imports in TypeScript MUST include the `.js` extension to ensure compatibility with the ESM runtime (e.g., `import { MyService } from './my-service.js'`).

## 6. Execution Flow Summary

1. **Boot**: `node dist/main.js` is executed.
2. **Env Validation**: Ensures `AGENT_API_TOKEN` exists.
3. **Supervisor Init**: `AgentSupervisor` spawns child processes for each `PersistentAgent`.
4. **Registration**: Main process calls the Orchestrator to register its capabilities (`jobProcessors`).
5. **Poller Loop**: Main process polls for jobs.
   - On Job -> `JobExecutor` -> Validate -> Execute -> Complete/Fail.
6. **Child Loops**: Child processes run `PersistentAgent.tick()` independently.

---

## 7. Rule Summary (MANDATORY)

- **ESM Import Compliance**: All relative imports MUST include the `.js` extension even when writing in TypeScript (e.g., `import { MyService } from './my-service.js'`).
- **Named Exports Only**: Core classes, interfaces, and constants MUST be exported using named exports. Default exports are strictly forbidden.
- **Constructor-Based Dependency Injection**: All classes MUST receive their dependencies (clients, loggers, config) via the constructor. Do NOT pull directly from `process.env` in the constructor.
- **Persistent Lifecycle Management**: Persistent agents MUST use a controlled `while(this.running)` loop with a `try/catch` wrapper for the `tick()` method to isolate individual failure events.
- **Environment-First Configuration**: Agent configuration (API URLs, Tokens, Intervals) MUST prioritize `AGENT_*` environment variables.
- **Standardized SDK Client**: Agents MUST use `NexicalClient` with the appropriate `AgentAuthStrategy` for all API interactions.
