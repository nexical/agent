# @app-core/agent

This package implements a lightweight, polling-based agent that executes jobs from the Nexical Orchestrator. It is designed to run in any environment (Docker, Bare Metal, Serverless) and execute simplified "Processors" defined in your modules.

## 📚 Table of Contents

1. [Architecture](#architecture)
2. [Integration with Web App](#integration-with-web-app)
3. [Authentication](#authentication)
4. [Developing Processors](#developing-processors)
5. [Testing](#testing)
6. [Deployment](#deployment)

---

## Architecture

The agent follows a **Pull Model** (Long Polling). It connects _outbound_ to the Orchestrator, meaning you do not need to open inbound ports or configure complicated firewalls.

### The Loop

1.  **Poll**: The agent sends a `POST /api/orchestrator/poll` request with its `capabilities` (list of registered job types).
2.  **Execute**: If a job is returned, the matching processor is found and executed.
3.  **Report**: The agent reports Success or Failure back to the Orchestrator.

---

## Integration with Web App

The Agent System interacts with the main web application via the **Orchestrator Module**.

### Triggering a Job

To trigger work for an agent, simply create a `Job` record in the database via the `OrchestratorService`.

```typescript
import { OrchestratorService } from '@modules/orchestrator/src/lib/orchestrator-service.js';

// In an API Handler or Service
await OrchestratorService.createJob({
  type: 'project.sync', // Must match a registered processor
  payload: {
    // Must match the processor's Zod schema
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

Access to the Orchestrator API is secured via a Bearer token.

- **Header**: `Authorization: Bearer <TOKEN>`
- **Environment Variable**: `AGENT_API_TOKEN`

### Execution Context (`AgentContext`)

When a processor runs, it receives an `AgentContext` object. This context contains an authenticated `NexicalClient` (SDK) that is pre-configured to communicate with the API and a `logger` for remote job-specific logging.

```typescript
import type { AgentJob, AgentContext } from '@nexical/agent/core/index.js';

// Processor Execution
public async process(job: AgentJob<MyPayload>, context: AgentContext) {
    // ✅ Full Access to the API via context.api
    await context.api.orchestrator.createJobLog({
        jobId: job.id,
        message: "Doing work...",
        level: "INFO"
    });
}
```

---

## Developing Processors

The Agent uses a **Base Class Pattern** for defining logic units. These are defined **within your modules** to keep business logic collocated.

### 1. Create a Processor File

Create a file in `modules/{your-module}/src/agent/{processor-name}.ts`.

```typescript
// modules/email/src/agent/welcome-processor.ts
import { z } from 'zod';
import { JobProcessor, type AgentJob, type AgentContext } from '@nexical/agent/core/index.js';

// 1. Define Payload Schema
export const WelcomePayloadSchema = z.object({
  email: z.string().email(),
  name: z.string(),
});

export type WelcomePayload = z.infer<typeof WelcomePayloadSchema>;

// 2. Implement Processor Class
export class WelcomeProcessor extends JobProcessor<WelcomePayload> {
  public static jobType = 'email.send-welcome'; // Unique Job Type
  public schema = WelcomePayloadSchema;

  // 3. Implement Execution Logic
  public async process(job: AgentJob<WelcomePayload>, context: AgentContext): Promise<unknown> {
    const { email, name } = job.payload;
    context.logger.info(`Sending email to ${email}`);

    // ... perform work using context.api or other services ...

    return { sent: true }; // Result stored in Job.result
  }
}
```

### 2. Register Processor

Add your class to the agent's registry in `packages/agent/src/registry.js`.

```bash
npm run gen:agent
```

---

## Testing

We support both **Unit Tests** (fast, mocked) and **Integration Tests** (comprehensive, real DB).

### 1. Unit Testing Processors

Use `AgentRunner.invoke` to test logic in isolation.

```typescript
// modules/email/tests/unit/agent.test.ts
import { describe, it, expect } from 'vitest';
import { AgentRunner } from '@modules/orchestrator/tests/integration/lib/agent-runner.js';
import { WelcomeProcessor } from '../../src/agent/welcome-processor.js';

it('should send email', async () => {
  const processor = new WelcomeProcessor();
  const result = await AgentRunner.invoke(processor, {
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
import { AgentRunner } from '@modules/orchestrator/tests/integration/lib/agent-runner.js';
import { WelcomeProcessor } from '../../src/agent/welcome-processor.js';
import { db } from '@/lib/db.js';

it('should process queued job', async () => {
  // 1. Create Job in DB
  const job = await db.job.create({
    data: {
      type: WelcomeProcessor.jobType,
      payload: { email: 'real@db.com', name: 'Real' },
    },
  });

  // 2. Run Agent Harness
  const processor = new WelcomeProcessor();
  const result = await AgentRunner.run(processor, job.id);

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
| `AGENT_API_URL`       | Yes      | -               | Nexical server API URL     |
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
