---
name: registry-discovery
description: 'This skill governs the **Automated Discovery Protocol** for background agents and job processors within the Nexus Ecosystem.'
---

# Skill: Agent Registry Discovery

This skill governs the **Automated Discovery Protocol** for background agents and job processors within the Nexus Ecosystem.

## Core Mandates

### 1. Automated Registration (STRICT)

- **NO MANUAL EDITS**: The file `packages/agent/src/registry.ts` is machine-generated. NEVER modify it manually.
- **Trigger**: Run `npm run generate` within the `packages/agent` directory to refresh the registry.
- **Discovery Root**: The script scans `apps/backend/modules/*/src/agent/*.ts` for valid agent classes.

### 2. Implementation Rules

- **Base Classes**: Agents MUST extend either `JobProcessor` (from `@nexical/agent`) or `PersistentAgent` (from `@nexical/agent`).
- **Naming Convention**:
  - **Queue-based jobs**: MUST end with the suffix `Processor` (e.g., `EmailProcessor`).
  - **Continuous tasks**: MUST end with the suffix `Agent` (e.g., `SyncAgent`).
- **Registry Keys**: The generator produces keys in the format `{module-name}.{ClassName}` (e.g., `orchestrator-api.EchoProcessor`).

### 3. Structural Standards

- **ESM Extensions**: All relative imports MUST include the `.js` extension (e.g., `import { MyService } from './my-service.js';`).
- **Dependency Injection**: Agents MUST NOT use `process.env` directly in the constructor. They MUST receive configuration via the `ProcessorConfig` or `AgentConfig` objects provided by the runtime.
- **Payload Validation**: `JobProcessor` implementations MUST define a `public schema` using Zod to validate job payloads.

## Implementation Workflow

1. **Scaffold**: Create the agent file in `apps/backend/modules/{module}/src/agent/{ClassName}.ts`.
2. **Inherit**: Extend the appropriate base class and implement the required methods (`process` or `tick`).
3. **Validate**: If it's a `JobProcessor`, define the Zod schema for input validation.
4. **Register**: Run `npm run generate` in `packages/agent` to update the global registry.
5. **Verify**: Check `packages/agent/src/registry.ts` to ensure your agent was correctly picked up.

## Related Resources

- **Templates**: `templates/JobProcessor.ts.template`, `templates/PersistentAgent.ts.template`
- **Architecture**: `packages/agent/ARCHITECTURE.md`
