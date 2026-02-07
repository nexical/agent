# @app-core/agent

This package implements a lightweight, polling-based agent that executes jobs from the Nexical Orchestrator. It is designed to run in any environment (Docker, Bare Metal, Serverless) and execute simplified "Workers" defined in your modules.

## 📚 Table of Contents

1. [Architecture](#architecture)
2. [Integration with Web App](#integration-with-web-app)
3. [Authentication](#authentication)
4. [Developing Processors (Workers)](#developing-processors-workers)
5. [Testing](#testing)
6. [Deployment](#deployment)

---

## Architecture

The agent follows a **Pull Model** (Long Polling). It connects _outbound_ to the Orchestrator, meaning you do not need to open inbound ports or configure complicated firewalls.

### The Loop

1.  **Poll**: The agent sends a `POST /api/orchestrator/poll` request with its `capabilities` (list of registered job types).
2.  **Execute**: If a job is returned, the matching worker is found and executed.
3.  **Report**: The agent reports Success or Failure back to the Orchestrator.

---

## Integration with Web App

The Agent System interacts with the main web application via the **Orchestrator Module**.

### Triggering a Job

To trigger work for an agent, simply create a `Job` record in the database via the `OrchestratorService`.

```typescript
import { OrchestratorService } from '@modules/orchestrator/src/lib/orchestrator-service';

// In an API Handler or Service
await OrchestratorService.createJob({
  type: 'project.sync', // Must match a registered worker
  payload: {
    // Must match the worker's Zod schema
    projectId: '123',
  },
  // Optional: Attribute to a user or team
  userId: context.locals.user.id,
});
```

The Orchestrator will queue this job. The next available Agent with the `project.sync` capability will pick it up.

---

## Authentication

### Agent Identity

Access to the Orchestrator API is secured via a shared secret.

- **Header**: `x-agent-secret`
- **Environment Variable**: `AGENT_SECRET`

### Worker Context (`AgentContext`)

When a worker runs, it receives an `AgentContext` object. This context contains an authenticated `NexicalClient` (SDK) that is pre-configured to communicate with the API.

```typescript
// Worker Handler
async handler(job, context) {
    // ✅ Full Access to the API
    await context.api.orchestrator.createJobLog({
        jobId: job.id,
        message: "Doing work...",
        level: "INFO"
    });
}
```

---

## Developing Processors (Workers)

Workers are the logic units of the agent. They are defined **within your modules** to keep business logic collocated.

### 1. Create a Worker File

Create a file in `modules/{your-module}/src/agent/{worker-name}.ts`.

```typescript
// modules/email/src/agent/send-welcome.ts
import type { AgentWorker } from '@modules/orchestrator/src/types';
import { z } from 'zod';

// 1. Define Payload Schema
const PayloadSchema = z.object({
  email: z.string().email(),
  name: z.string(),
});

// 2. Export Worker Definition
export const worker: AgentWorker<z.infer<typeof PayloadSchema>> = {
  jobType: 'email.send-welcome', // Unique Job Type
  schema: PayloadSchema,

  // 3. Implement Handler
  handler: async (job, context) => {
    const { email, name } = job.payload;
    context.logger.info(`Sending email to ${email}`);

    // ... perform work ...

    return { sent: true }; // Result stored in Job.result
  },
};
```

### 2. Generate Registry

Run the generator to register your new worker.

```bash
npm run gen:agent
```

This updates `packages/agent/src/registry.ts`.

---

## Testing

We support both **Unit Tests** (fast, mocked) and **Integration Tests** (comprehensive, real DB).

### 1. Unit Testing Workers

Use `AgentRunner.invoke` to test logic in isolation.

```typescript
// modules/email/tests/unit/agent.test.ts
import { describe, it, expect } from 'vitest';
import { AgentRunner } from '@modules/orchestrator/tests/integration/lib/agent-runner';
import { worker } from '../../src/agent/send-welcome';

it('should send email', async () => {
  const result = await AgentRunner.invoke(worker, {
    email: 'test@example.com',
    name: 'Test',
  });
  expect(result.sent).toBe(true);
});
```

### 2. Integration Testing

Use `AgentRunner.run` to test the full flow with a database.

```typescript
// modules/email/tests/integration/agent/send-welcome.test.ts
import { describe, it, expect } from 'vitest';
import { AgentRunner } from '@modules/orchestrator/tests/integration/lib/agent-runner';
import { worker } from '@modules/email/src/agent/send-welcome';
import { db } from '@/lib/db';

it('should process queued job', async () => {
  // 1. Create Job in DB
  const job = await db.job.create({
    data: {
      type: 'email.send-welcome',
      payload: { email: 'real@db.com', name: 'Real' },
    },
  });

  // 2. Run Agent Harness
  const result = await AgentRunner.run(worker, job.id);

  // 3. Verify Side Effects
  expect(result.sent).toBe(true);
  const updatedJob = await db.job.findUnique({ where: { id: job.id } });
  // Note: Harness doesn't update Job Status (Agent Main loop does),
  // but you can verify other DB side effects here.
});
```

### 3. Framework Tests

Tests for the Agent Runtime itself (auth, polling loop) are located in `packages/agent/tests/unit`.

---

## Deployment

### Environment Variables

| Variable              | Required | Default         | Description                |
| --------------------- | -------- | --------------- | -------------------------- |
| `AGENT_API_URL`       | Yes      | -               | ArcNexus server API URL    |
| `AGENT_API_TOKEN`     | Yes      | -               | Agent authentication token |
| `AGENT_CAPABILITIES`  | No       | `*`             | Comma-separated job types  |
| `AGENT_HOSTNAME`      | No       | System hostname | Agent identifier           |
| `AGENT_POLL_INTERVAL` | No       | `5000`          | Poll interval (ms)         |

### Docker

The agent is stateless. You can run multiple instances for horizontal scaling.

```bash
docker build -f packages/agent/Dockerfile -t arcnexus-agent .

docker run -d \
  --name arcnexus-agent \
  -e AGENT_API_URL=https://your-instance.com/api \
  -e AGENT_API_TOKEN=sk_agent_xxxxx \
  -e AGENT_CAPABILITIES=CHAT_COMPLETION,COMMAND_EXECUTION \
  -v /path/to/repos:/agent/workspace \
  arcnexus-agent
```

### Docker Compose

```yaml
# docker-compose.agent.yml
version: '3.8'
services:
  agent:
    build:
      context: .
      dockerfile: packages/agent/Dockerfile
    environment:
      - AGENT_API_URL=${AGENT_API_URL}
      - AGENT_API_TOKEN=${AGENT_API_TOKEN}
    volumes:
      - ./workspace:/agent/workspace
    restart: unless-stopped
```

### Binary (Self-Contained)

Compile to a single executable for bare-metal deployment.

```bash
npm run gen:agent
cd packages/agent
npm run package
./bin/agent-linux
```
