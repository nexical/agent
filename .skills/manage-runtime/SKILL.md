---
name: manage-runtime
description: 'This skill provides guidance on managing the lifecycle and execution environment of Nexical Agents. It focuses on the **Supervisor Pattern**, ensuring process stability, automatic recovery, and enviro...'
---

# Skill: Manage Runtime

**ID**: `manage-runtime`
**Version**: 1.0.0
**Context**: `packages/agent`

## Overview

This skill provides guidance on managing the lifecycle and execution environment of Nexical Agents. It focuses on the **Supervisor Pattern**, ensuring process stability, automatic recovery, and environment-aware execution.

## Core Patterns

### 1. The Supervisor Pattern (`AgentSupervisor`)

The `AgentSupervisor` is responsible for managing the child process lifecycles.

- **Named Class Exports**: All supervisor and executor logic MUST be exported as named classes.
- **Constructor-Based DI**: Dependencies (clients, config) MUST be passed via the constructor.
- **ESM Extensions**: All relative imports MUST include the `.js` extension (e.g., `import { Foo } from './foo.js'`).

### 2. Environment-Aware Supervision

The supervisor MUST detect the entrypoint type and use the appropriate execution engine:

- **Development**: Use `tsx` for `.ts` files.
- **Production**: Use `node` (via `fork`) for `.js` files.

### 3. Graceful Signal Handling & Auto-Restart

- **Signals**: Listen for `SIGINT` and `SIGTERM` for graceful shutdown.
- **Auto-Restart**: Automatically restart crashed child processes after a 5-second delay.

### 4. Zero-Tolerance for `any`

- Strictly forbid the `any` type. Use specific interfaces or `unknown`.

### 5. PersistentAgent Lifecycle (Tick-based)

- **DI Enforcement**: `PersistentAgent` implementations MUST receive their configuration and `NexicalClient` via the constructor.
- **Environment Isolation**: NEVER pull directly from `process.env` inside the agent logic.
- **Controlled Loop**: Use a controlled `while(this.running)` loop with error isolation.

## Execution Protocol

1. **Initialize Supervisor**: Use the `AgentSupervisor` class to wrap your agent processors.
2. **Inject Dependencies**: Ensure the `NexicalClient` and any configuration objects are passed into the supervisor's constructor.
3. **Handle Process Lifecycle**: The supervisor manages the spawning and monitoring of child processes.
4. **Validation**: Use Zod schemas to validate all configuration and runtime payloads.

## Drift Note

- **Observed Drift**: Current `PersistentAgent` implementation pulls directly from `process.env`.
- **Target Pattern**: All future implementations and refactorings MUST follow the Constructor-Based DI rule.

## Related Resources

- **Template**: `templates/supervisor.ts.template`
- **Template**: `templates/persistent-agent.ts.template`
- **Example**: `examples/supervisor.ts`
- **Example**: `examples/worker-agent.ts`
