import type { getSandbox } from "@cloudflare/sandbox";

import { parseCheckpointReference } from "../checkpoints";
import {
  AGENT_HOST_CHECKPOINT_EXCLUDES,
  AGENT_HOST_CHECKPOINT_TTL_SECONDS,
  HERMES_API_PORT,
  HERMES_HOME,
  HERMES_REQUEST_TIMEOUT_MS,
  HERMES_START_COMMAND,
  HERMES_STARTUP_TIMEOUT_MS,
} from "../config/agent-host";
import type { AgentHost, AgentHostState } from "./agent-host-container";

export type AgentHostSandbox = ReturnType<typeof getSandbox<AgentHost>>;

async function findRunningGateway(sandbox: AgentHostSandbox) {
  const processes = await sandbox.listProcesses().catch(() => []);

  return (
    processes.find(
      (process) =>
        process.command === HERMES_START_COMMAND &&
        (process.status === "running" || process.status === "starting"),
    ) ?? null
  );
}

async function hermesHomeExists(sandbox: AgentHostSandbox): Promise<boolean> {
  const result = await sandbox.exec(`test -f ${HERMES_HOME}/config.yaml`).catch(() => null);

  return result?.success === true;
}

export async function ensureHermesGateway(
  sandbox: AgentHostSandbox,
  state: AgentHostState,
): Promise<void> {
  const running = await findRunningGateway(sandbox);

  if (running) {
    await running.waitForPort(HERMES_API_PORT, {
      mode: "http",
      path: "/health",
      timeout: HERMES_STARTUP_TIMEOUT_MS,
    });

    return;
  }

  if (state.checkpointReference && !(await hermesHomeExists(sandbox))) {
    await sandbox.restoreBackup(parseCheckpointReference(state.checkpointReference));
  }

  const process = await sandbox.startProcess(HERMES_START_COMMAND, {
    env: { API_SERVER_KEY: state.apiServerKey },
  });

  await process.waitForPort(HERMES_API_PORT, {
    mode: "http",
    path: "/health",
    timeout: HERMES_STARTUP_TIMEOUT_MS,
  });
}

export async function hermesRequest(
  sandbox: AgentHostSandbox,
  state: AgentHostState,
  path: string,
  init: { method: "GET" | "POST"; body?: unknown },
): Promise<Response> {
  return sandbox.containerFetch(
    new Request(`http://localhost:${HERMES_API_PORT}${path}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${state.apiServerKey}`,
        "Content-Type": "application/json",
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(HERMES_REQUEST_TIMEOUT_MS),
    }),
    HERMES_API_PORT,
  );
}

export async function checkpointHermesHome(
  sandbox: AgentHostSandbox,
  hostId: string,
): Promise<string> {
  const backup = await sandbox.createBackup({
    dir: HERMES_HOME,
    name: `agent-host-${hostId}`,
    ttl: AGENT_HOST_CHECKPOINT_TTL_SECONDS,
    excludes: AGENT_HOST_CHECKPOINT_EXCLUDES,
  });

  return JSON.stringify(backup);
}
