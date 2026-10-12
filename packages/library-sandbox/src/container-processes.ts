import { quoteShellArgument } from "@ngriffin_uk/polychat-utility-core";

import {
  runContainerCommand,
  WORKSPACE_ROOT,
  type ContainerExecutor,
} from "./container-command.js";

const PROCESS_ROOT = "/run/polychat/processes";
const PROCESS_ID_PATTERN = /^[A-Za-z0-9_.-]{1,80}$/;

export type ContainerProcessStatus = "running" | "completed" | "failed" | "missing";

export interface ContainerProcessState {
  id: string;
  status: ContainerProcessStatus;
  exitCode: number | null;
}

function processDirectory(id: string): string {
  if (!PROCESS_ID_PATTERN.test(id)) {
    throw new Error(`Invalid process id: ${id}`);
  }

  return `${PROCESS_ROOT}/${id}`;
}

export async function startContainerProcess(
  container: ContainerExecutor,
  params: { id: string; command: string; cwd?: string; env?: Record<string, string> },
): Promise<void> {
  const directory = quoteShellArgument(processDirectory(params.id));
  const runner = `bash -lc "$1"; echo $? > "$2/exit"`;
  const script = [
    "set -e",
    `rm -rf ${directory}`,
    `mkdir -p ${directory}`,
    `setsid bash -c ${quoteShellArgument(runner)} _ ${quoteShellArgument(params.command)} ${directory} > ${directory}/log 2>&1 < /dev/null &`,
    `echo $! > ${directory}/pid`,
  ].join("\n");
  const result = await runContainerCommand(container, script, {
    cwd: params.cwd ?? WORKSPACE_ROOT,
    ...(params.env ? { env: params.env } : {}),
    timeoutMs: 30_000,
  });

  if (!result.success) {
    throw new Error(result.stderr.trim() || `Could not start process ${params.id}`);
  }
}

export async function readContainerProcess(
  container: ContainerExecutor,
  id: string,
): Promise<ContainerProcessState> {
  const directory = quoteShellArgument(processDirectory(id));
  const result = await runContainerCommand(
    container,
    `if [ ! -f ${directory}/pid ]; then echo missing; elif [ -f ${directory}/exit ]; then echo "exited $(cat ${directory}/exit)"; elif kill -0 "$(cat ${directory}/pid)" 2>/dev/null; then echo running; else echo "exited 1"; fi`,
    { timeoutMs: 15_000 },
  );
  const [state, code] = result.stdout.trim().split(/\s+/);

  if (state === "running") {
    return { id, status: "running", exitCode: null };
  }

  if (state === "exited") {
    const exitCode = Number.parseInt(code ?? "1", 10);

    return { id, status: exitCode === 0 ? "completed" : "failed", exitCode };
  }

  return { id, status: "missing", exitCode: null };
}

export async function stopContainerProcess(
  container: ContainerExecutor,
  id: string,
): Promise<void> {
  const directory = quoteShellArgument(processDirectory(id));

  await runContainerCommand(
    container,
    `if [ -f ${directory}/pid ]; then kill -TERM -- "-$(cat ${directory}/pid)" 2>/dev/null || true; fi`,
    { timeoutMs: 15_000 },
  );
}

export async function readContainerProcessLogs(
  container: ContainerExecutor,
  id: string,
  options: { offset?: number; maxBytes?: number } = {},
): Promise<{ output: string; offset: number }> {
  const directory = quoteShellArgument(processDirectory(id));
  const offset = Math.max(0, Math.floor(options.offset ?? 0));
  const maxBytes = Math.max(1, Math.floor(options.maxBytes ?? 64 * 1024));
  const result = await runContainerCommand(
    container,
    `tail -c +${offset + 1} ${directory}/log 2>/dev/null | head -c ${maxBytes} || true`,
    { timeoutMs: 15_000 },
  );

  return {
    output: result.stdout,
    offset: offset + new TextEncoder().encode(result.stdout).byteLength,
  };
}
