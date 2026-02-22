# Skill: Implement Persistent Agent

Guide for implementing continuous, tick-based background workers within the Nexus Agent ecosystem.

## Overview

Persistent Agents are long-running processes that execute a `tick()` method at a fixed interval. They are designed for ongoing monitoring, periodic cleanup, or real-time synchronization tasks.

## Mandatory Implementation Rules

- **Extend `PersistentAgent`**: Use the provided base class from `@nexical/agent/core`.
- **Tick Implementation**: Core logic MUST reside in the `tick()` method.
- **Lifecycle Management**: Implement a `while (this.running)` loop to handle execution and graceful shutdown.
- **Error Isolation**: Each `tick()` execution MUST be wrapped in a `try/catch` block to prevent individual failures from crashing the entire process.
- **Named Exports Only**: Export your agent class using a named export.
- **ESM Extensions**: All relative imports MUST use the `.js` extension (e.g., `import { Service } from '../services/index.js';`).
- **Environment-First Configuration**: Source API URLs, tokens, and intervals from `AGENT_*` environment variables.
- **Standardized SDK Client**: Use `NexicalClient` with `AgentAuthStrategy` for all API calls.

## Example Configuration

```bash
# Environment variables used by the agent
AGENT_WATCHER_INTERVAL=60000
AGENT_API_URL=https://api.nexical.com
AGENT_API_TOKEN=your-secret-token
```

## Implementation Checklist

1. [ ] Extend `PersistentAgent` base class.
2. [ ] Define the agent `name` and `intervalMs`.
3. [ ] Implement the `tick()` method.
4. [ ] Configure `NexicalClient` with `AgentAuthStrategy`.
5. [ ] Register the agent in `src/registry.ts`.
6. [ ] Verify ESM extension compliance in all imports.
