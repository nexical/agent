---
name: implement-processor
description: 'This skill defines the workflow for implementing `JobProcessor` and `PersistentAgent` classes within the Nexical Agent system.'
---

# Skill: Agent Implement Processor

This skill defines the workflow for implementing `JobProcessor` and `PersistentAgent` classes within the Nexical Agent system.

## Overview

The Agent system follows a **Base Class Pattern**. Instead of using raw object definitions, all agent workers are implemented as classes extending specialized base classes. This ensures every worker has standardized access to the infrastructure (API, Logger) and enforces type safety via Zod schemas.

## Workflow

1.  **Define Domain**: Identify if the task is a discrete job (Pull-based via `JobPoller`) or a continuous process (Loop-based via `PersistentAgent`).
2.  **Select Base Class**:
    - Use `JobProcessor<T>` for discrete tasks (e.g., "Send Email", "Resize Image").
    - Use `PersistentAgent` for continuous tasks (e.g., "Sync Files", "Monitor Health").
3.  **Define Schema**: Create a Zod schema for the generic type parameter `T` (for `JobProcessor`) to ensure runtime validation.
4.  **Implement Execution Logic**:
    - For `JobProcessor`, implement the `process(job, context)` method.
    - For `PersistentAgent`, implement the `tick()` method.
5.  **Adhere to Hygiene**:
    - Use **Named Exports**.
    - Include **.js extensions** on all relative imports.
    - Use **Type-Only Imports** (`import type`) where appropriate.
    - Avoid `any` strictly. Use `unknown` with comments for circular dependency mitigation.
    - Use **Configuration-Driven Initialization**: Prefer explicit configuration objects or environment variables for initialization.
6.  **Registration & Discovery**:
    The Agent system utilizes an **Automated Registry**. You do NOT need to manually register your processor.
    1.  Ensure your file is located within the `src/modules/` or `src/processors/` directory (depending on project structure).
    2.  Ensure your class is **Named Exported**.
    3.  Run the generation script (usually part of the build process):
        ```bash
        npm run generate
        # or
        npx tsx scripts/generate.ts
        ```
    4.  This will update `src/registry.ts` automatically. **NEVER manually edit `src/registry.ts`.**

## Critical Patterns

### 1. Base Class Pattern

Components MUST provide common infrastructure (api, logger) to sub-classes.

```typescript
import { JobProcessor, type AgentJob, type AgentContext } from '@nexical/agent/core/index.js';
import { z } from 'zod';

export class MyProcessor extends JobProcessor<MyPayload> {
  // Common infra like this.api and this.logger are available via inheritance
}
```

### 2. Type-Safe Payload Schema

Every worker MUST define a Zod schema for its generic type parameter `T`.

```typescript
public schema = MyPayloadSchema;
```

### 3. ESM Import Extension

All relative imports MUST include the `.js` extension, even when pointing to `.ts` files.

```typescript
import { Helper } from './utils.js';
```

### 4. Circular Dependency Mitigation

When a direct import causes a circular reference, use `unknown` and a clarifying comment.

```typescript
api: unknown; // NexicalClient (Used as unknown to prevent circular dependency)
```

### 5. Configuration-Driven Initialization

Use explicit configuration objects or environment variables for infrastructure setup.

- **Standard Environment Variables**: Ensure `AGENT_API_TOKEN` and `AGENT_API_URL` are set in your environment, as the base classes rely on these for Orchestrator communication.

```typescript
constructor(config: ProcessorConfig) {
  super();
  this.config = config;
}
```

## Available Resources

- `templates/processor.ts.template`: Scaffold for a `JobProcessor`.
- `templates/persistent.ts.template`: Scaffold for a `PersistentAgent`.
- `examples/email-processor.ts`: Example implementation of a `JobProcessor`.
- `examples/file-sync-agent.ts`: Example implementation of a `PersistentAgent`.
