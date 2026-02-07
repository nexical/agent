import { fork, spawn, type ChildProcess } from 'child_process';
import path from 'path';

export class AgentSupervisor {
  private children: Map<string, ChildProcess> = new Map();
  private shuttingDown: boolean = false;
  private entryPoint: string;

  constructor(
    private processors: Record<string, new () => unknown>, // Weak type for mixins
    entryPoint?: string,
  ) {
    // Default to executing the same file that started this process
    this.entryPoint = entryPoint || process.argv[1];
  }

  public start() {
    console.info('[Supervisor] Starting Nexus Agent Supervisor...');
    console.info('Registered Processors:', Object.keys(this.processors));

    for (const name of Object.keys(this.processors)) {
      this.spawnProcessor(name);
    }

    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }

  private spawnProcessor(name: string) {
    if (this.shuttingDown) return;

    console.info(`[Supervisor] Spawning processor: ${name}`);

    const childArgs = ['--processor', name];
    let child: ChildProcess;
    if (this.entryPoint.endsWith('.ts')) {
      // TypeScript/Dev Mode: Use spawn with node and tsx binary
      const tsxPath = path.resolve(process.cwd(), 'node_modules/tsx/dist/cli.mjs');
      // Sanitize env: Remove NODE_OPTIONS to avoid conflicts with vitest/tsx recursion
      const { NODE_OPTIONS: _, ...childEnv } = process.env;

      child = spawn(process.execPath, [tsxPath, this.entryPoint, ...childArgs], {
        env: childEnv,
        stdio: 'inherit',
      });

      child.on('error', (err) => console.error(`[Child ${name} SPAWN ERROR]`, err));
    } else {
      // Production/JS Mode: Use fork (node)
      child = fork(this.entryPoint, childArgs, {
        env: process.env,
        stdio: 'inherit',
      });
    }

    this.children.set(name, child);

    child.on('exit', (code, signal) => {
      if (this.shuttingDown) return;

      console.error(`[Supervisor] Processor ${name} exited with code ${code} / signal ${signal}`);
      this.children.delete(name);

      // Restart logic
      console.info(`[Supervisor] Restarting ${name} in 5 seconds...`);
      setTimeout(() => this.spawnProcessor(name), 5000);
    });
  }

  public async shutdown() {
    if (this.shuttingDown) return;
    this.shuttingDown = true;
    console.info('\n[Supervisor] Shutting down...');

    const killPromises: Promise<void>[] = [];

    this.children.forEach((child, name) => {
      console.info(`[Supervisor] Killing ${name}...`);
      if (child.exitCode === null && !child.killed) {
        const p = new Promise<void>((resolve) => {
          child.on('exit', () => resolve());
          child.kill('SIGTERM');
        });
        killPromises.push(p);
      }
    });

    await Promise.all(killPromises);
    console.info('[Supervisor] All children terminated.');
  }
}
