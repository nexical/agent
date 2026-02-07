import 'dotenv/config';

import { jobProcessors, processors as persistentProcessors } from './registry.js';
import { AgentClient } from './networking/client.js';
import { JobExecutor } from './runtime/executor.js';
import { JobPoller } from './runtime/poller.js';
import { AgentSupervisor } from './runtime/supervisor.js';
import type { JobProcessor } from './core/processor.js';

export async function main(argv = process.argv, env = process.env) {
  // Configuration
  const AGENT_API_TOKEN = env.AGENT_API_TOKEN;
  const AGENT_API_URL = env.AGENT_API_URL || 'http://localhost:4321/api';

  // Parse Args
  const args = argv.slice(2);
  const processorArgIndex = args.indexOf('--processor');
  const processorName = processorArgIndex !== -1 ? args[processorArgIndex + 1] : null;

  // Help
  if (args.includes('-h') || args.includes('--help')) {
    console.info(`
Nexus Agent - Orchestrator Worker

Usage:
  agent [options]

Options:
  --processor [name]   Run a specific persistent processor (internal use)

Description:
  Runs a long-polling agent that executes jobs from the Nexus Orchestrator.
  Also manages persistent agent processors as subprocesses.

Configuration (Environment Variables):
  AGENT_API_TOKEN (Required)
  AGENT_API_URL (Optional)
`);
    process.exit(0);
  }

  // Validation
  if (!AGENT_API_TOKEN) {
    console.error('FATAL: AGENT_API_TOKEN is not defined. Use --help for more info.');
    process.exit(1);
  }

  // Mode Selection
  if (processorName) {
    // Mode 1: Processor Mode
    await startProcessor(processorName);
  } else {
    // Mode 2: Supervisor Mode
    await startSupervisor(AGENT_API_TOKEN, AGENT_API_URL, env);
  }
}

async function startProcessor(name: string) {
  const ProcessorClass = persistentProcessors[name];
  if (!ProcessorClass) {
    console.error(`FATAL: Processor ${name} not found in registry.`);
    process.exit(1);
  }

  try {
    const agent = new ProcessorClass();

    // Handle Shutdown
    process.on('SIGTERM', () => {
      agent.stop();
      process.exit(0);
    });

    await agent.start(); // Should loop forever
  } catch (err) {
    console.error(`FATAL: Processor ${name} crashed:`, err);
    process.exit(1);
  }
}

async function startSupervisor(apiToken: string, apiUrl: string, env: typeof process.env) {
  // 1. Start Supervisor (Persistent Processors)
  const supervisor = new AgentSupervisor(persistentProcessors);
  supervisor.start();

  // 2. Initialize Job Processors
  console.info('[DEBUG] Loading processors from registry:', jobProcessors);
  const initializedProcessors: Record<string, JobProcessor<unknown>> = {};
  for (const [key, ProcessorClass] of Object.entries(jobProcessors)) {
    const pClass = ProcessorClass as new (config: unknown) => JobProcessor<unknown>;
    initializedProcessors[key] = new pClass({
      apiUrl: apiUrl,
      apiToken: apiToken,
    });
  }

  // 3. Start Job Poller (in this process)
  const client = new AgentClient({
    apiUrl: apiUrl,
    apiToken: apiToken,
  });

  // Register Agent
  const capabilities = Object.keys(initializedProcessors);
  await client.register({
    id: env.AGENT_ID,
    hostname: env.AGENT_HOSTNAME || 'localhost',
    capabilities,
  });

  const executor = new JobExecutor({
    apiUrl: apiUrl,
    apiToken: apiToken,
  });

  const poller = new JobPoller(client, executor, initializedProcessors, env.AGENT_ID);
  poller.start();

  // Handle Shutdown
  process.on('SIGINT', async () => {
    poller.stop();
    await supervisor.shutdown();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    poller.stop();
    await supervisor.shutdown();
    process.exit(0);
  });
}

// Auto-run if not in test
if (process.env.NODE_ENV !== 'test') {
  main().catch((err) => {
    console.error('FATAL:', err);
    process.exit(1);
  });
}
