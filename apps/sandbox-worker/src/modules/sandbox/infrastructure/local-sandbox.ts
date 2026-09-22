import {
  CodeInterpreter,
  SandboxClient,
  type Process,
  type ProcessStatus,
  type WaitForLogResult,
  type WaitForPortOptions,
} from "@cloudflare/sandbox";
import { delay } from "@ngriffin_uk/polychat-utility-core";
import z from "zod/v4";

import type { SandboxInstance } from "./feature-implementation/types";
import type { LocalSandboxRelay } from "./local-sandbox-relay";

const SESSION_ID = "polychat-local";

class LocalProcess implements Process {
  readonly startTime: Date;
  readonly sessionId = SESSION_ID;
  status: ProcessStatus;
  endTime?: Date;
  exitCode?: number;

  constructor(
    private readonly client: SandboxClient,
    readonly id: string,
    readonly command: string,
    readonly pid?: number,
    status: ProcessStatus = "running",
    startTime = new Date(),
  ) {
    this.status = status;
    this.startTime = startTime;
  }

  async kill(): Promise<void> {
    await this.client.processes.killProcess(this.id);
    this.status = "killed";
    this.endTime = new Date();
  }

  async getStatus(): Promise<ProcessStatus> {
    const result = await this.client.processes.getProcess(this.id);

    this.status = result.process?.status ?? "error";
    this.exitCode = result.process?.exitCode;
    this.endTime = result.process?.endTime ? new Date(result.process.endTime) : undefined;

    return this.status;
  }

  async getLogs(): Promise<{ stdout: string; stderr: string }> {
    const result = await this.client.processes.getProcessLogs(this.id);

    return { stdout: result.stdout, stderr: result.stderr };
  }

  async waitForLog(pattern: string | RegExp, timeout = 30_000): Promise<WaitForLogResult> {
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      const logs = await this.getLogs();

      for (const line of `${logs.stdout}\n${logs.stderr}`.split("\n")) {
        const match = typeof pattern === "string" ? line.includes(pattern) : line.match(pattern);

        if (match) {
          return { line, ...(Array.isArray(match) ? { match } : {}) };
        }
      }

      if ((await this.getStatus()) !== "running") {
        throw new Error("The process exited before its expected log appeared");
      }

      await delay(500);
    }

    throw new Error("The process did not produce its expected log in time");
  }

  async waitForPort(port: number, options: WaitForPortOptions = {}): Promise<void> {
    if (!Number.isInteger(port) || port < 1 || port > 65_535) {
      throw new Error("Invalid service port");
    }

    const deadline = Date.now() + (options.timeout ?? 30_000);
    const mode = options.mode ?? "http";
    const path = options.path ?? "/";

    if (!path.startsWith("/") || path.includes("'")) {
      throw new Error("Invalid service health path");
    }

    const command =
      mode === "tcp"
        ? `python3 -c 'import socket; socket.create_connection(("127.0.0.1", ${port}), 2).close()'`
        : `curl -s -o /dev/null -w '%{http_code}' --max-time 2 'http://127.0.0.1:${port}${path}'`;

    while (Date.now() < deadline) {
      const result = await this.client.commands.execute(command, SESSION_ID, { timeoutMs: 5000 });
      const status = Number(result.stdout.trim());
      const expected = options.status ?? { min: 200, max: 399 };
      const ready =
        mode === "tcp"
          ? result.exitCode === 0
          : result.exitCode === 0 &&
            (typeof expected === "number"
              ? status === expected
              : status >= expected.min && status <= expected.max);

      if (ready) {
        return;
      }

      if ((await this.getStatus()) !== "running") {
        throw new Error("The service exited before its port was ready");
      }

      await delay(options.interval ?? 500);
    }

    throw new Error("The service port did not become ready in time");
  }

  async waitForExit(timeout = 30_000): Promise<{ exitCode: number }> {
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      if ((await this.getStatus()) !== "running") {
        return { exitCode: this.exitCode ?? 1 };
      }

      await delay(500);
    }

    throw new Error("The process did not exit in time");
  }
}

export async function createLocalSandbox(relay: LocalSandboxRelay): Promise<SandboxInstance> {
  const containerId = await relay.start();
  const client = new SandboxClient({
    stub: {
      containerFetch: async (url, init) => {
        const target = new URL(url);

        if (init.body != null && typeof init.body !== "string") {
          throw new Error("The local sandbox only accepts text requests");
        }

        const method = z
          .enum(["GET", "POST", "PUT", "PATCH", "DELETE"])
          .parse(init.method ?? "GET");
        const response = await relay.request({
          containerId,
          path: target.pathname + target.search,
          method,
          body: init.body ?? undefined,
          contentType:
            new Headers(init.headers).get("Content-Type") === "application/json"
              ? "application/json"
              : undefined,
        });

        return new Response(response.body, {
          status: response.status,
          headers: response.contentType ? { "Content-Type": response.contentType } : undefined,
        });
      },
      fetch: async () => {
        throw new Error("Local sandbox WebSocket transport is unavailable");
      },
    },
  });
  const interpreter = new CodeInterpreter(client.interpreter);

  try {
    await client.utils.createSession({ id: SESSION_ID, cwd: "/workspace" });
  } catch (error) {
    await relay.stop(containerId).catch(() => undefined);
    throw error;
  }

  return {
    exec: async (command, options) => {
      const started = Date.now();
      const result = await client.commands.execute(command, SESSION_ID, {
        timeoutMs: options?.timeout,
        env: options?.env,
        cwd: options?.cwd,
      });

      return {
        success: result.exitCode === 0,
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        command,
        duration: Date.now() - started,
        timestamp: result.timestamp,
      };
    },
    gitCheckout: (repoUrl, options) =>
      client.git.checkout(repoUrl, SESSION_ID, {
        branch: options?.branch,
        targetDir: options?.targetDir,
        depth: options?.depth,
        timeoutMs: options?.cloneTimeoutMs,
      }),
    readFile: (path, options) => client.files.readFile(path, SESSION_ID, options),
    writeFile: (path, content, options) => {
      if (typeof content !== "string") {
        throw new Error("Streaming file writes are unavailable in a local sandbox");
      }

      return client.files.writeFile(path, content, SESSION_ID, options);
    },
    exists: (path) => client.files.exists(path, SESSION_ID),
    startProcess: async (command, options) => {
      const result = await client.processes.startProcess(command, SESSION_ID, {
        processId: options?.processId,
        timeoutMs: options?.timeout,
        env: options?.env,
        cwd: options?.cwd,
        autoCleanup: options?.autoCleanup,
      });

      return new LocalProcess(client, result.processId, result.command, result.pid);
    },
    getProcess: async (id) => {
      const result = await client.processes.getProcess(id);

      if (!result.process) {
        return null;
      }

      return new LocalProcess(
        client,
        result.process.id,
        result.process.command,
        result.process.pid,
        result.process.status,
        new Date(result.process.startTime),
      );
    },
    unexposePort: async () => undefined,
    createCodeContext: (options) => interpreter.createCodeContext(options),
    runCode: async (code, options) => (await interpreter.runCode(code, options)).toJSON(),
    deleteCodeContext: (id) => interpreter.deleteCodeContext(id),
    watch: async () => {
      throw new Error("File watching is unavailable in a local sandbox");
    },
    destroy: async () => relay.stop(containerId),
  };
}
