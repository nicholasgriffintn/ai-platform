import { quoteShellArgument } from "@ngriffin_uk/polychat-utility-core";

export const WORKSPACE_ROOT = "/workspace";
export const COMMAND_TIMEOUT_EXIT_CODE = 124;
const DEFAULT_COMMAND_TIMEOUT_MS = 6 * 60 * 60 * 1000;
const KILL_GRACE_SECONDS = 5;

export type ContainerExecutor = Pick<Container, "exec">;

export interface ContainerCommandResult {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

export interface ContainerCommandOutput {
  stream: "stdout" | "stderr";
  data: string;
}

export interface ContainerCommandOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
  stdin?: string;
  signal?: AbortSignal;
  onOutput?: (output: ContainerCommandOutput) => Promise<void> | void;
}

export function containerCommandArgv(command: string, timeoutMs?: number): string[] {
  const seconds = Math.max(1, Math.ceil((timeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS) / 1000));

  return ["timeout", `--kill-after=${KILL_GRACE_SECONDS}`, String(seconds), "bash", "-lc", command];
}

async function readStream(
  stream: ReadableStream<Uint8Array> | undefined,
  source: ContainerCommandOutput["stream"],
  onOutput: ContainerCommandOptions["onOutput"],
): Promise<string> {
  if (!stream) {
    return "";
  }

  const decoder = new TextDecoder();
  const chunks: string[] = [];

  for await (const value of stream) {
    const data = decoder.decode(value, { stream: true });

    if (data) {
      chunks.push(data);
      await onOutput?.({ stream: source, data });
    }
  }

  const tail = decoder.decode();

  if (tail) {
    chunks.push(tail);
    await onOutput?.({ stream: source, data: tail });
  }

  return chunks.join("");
}

export async function runContainerCommand(
  container: ContainerExecutor,
  command: string,
  options: ContainerCommandOptions = {},
): Promise<ContainerCommandResult> {
  options.signal?.throwIfAborted();

  const process = await container.exec(containerCommandArgv(command, options.timeoutMs), {
    cwd: options.cwd ?? WORKSPACE_ROOT,
    ...(options.env ? { env: options.env } : {}),
    ...(options.stdin !== undefined ? { stdin: "pipe" as const } : {}),
  });
  let cancelled = false;
  const cancel = () => {
    if (!cancelled) {
      cancelled = true;
      process.kill(15);
    }
  };

  options.signal?.addEventListener("abort", cancel, { once: true });

  try {
    if (options.stdin !== undefined && process.stdin) {
      const writer = process.stdin.getWriter();

      await writer.write(new TextEncoder().encode(options.stdin));
      await writer.close();
    }

    const [stdout, stderr, exitCode] = await Promise.all([
      readStream(process.stdout ?? undefined, "stdout", options.onOutput),
      readStream(process.stderr ?? undefined, "stderr", options.onOutput),
      process.exitCode,
    ]);

    options.signal?.throwIfAborted();

    return {
      success: exitCode === 0,
      exitCode,
      stdout,
      stderr,
      timedOut: exitCode === COMMAND_TIMEOUT_EXIT_CODE,
    };
  } finally {
    options.signal?.removeEventListener("abort", cancel);
  }
}

export async function runContainerArgv(
  container: ContainerExecutor,
  argv: string[],
  options: Omit<ContainerCommandOptions, "timeoutMs"> = {},
): Promise<ContainerCommandResult> {
  return runContainerCommand(container, argv.map(quoteShellArgument).join(" "), options);
}

export type ContainerScriptLanguage = "python" | "javascript" | "typescript";

const SCRIPT_INTERPRETERS: Record<ContainerScriptLanguage, string> = {
  python: "python3 -",
  javascript: "node --input-type=module -",
  typescript: "node --input-type=module-typescript -",
};

export async function runContainerScript(
  container: ContainerExecutor,
  params: { language: ContainerScriptLanguage; code: string; cwd?: string; timeoutMs?: number },
): Promise<ContainerCommandResult> {
  return runContainerCommand(container, SCRIPT_INTERPRETERS[params.language], {
    stdin: params.code,
    ...(params.cwd ? { cwd: params.cwd } : {}),
    timeoutMs: params.timeoutMs ?? 5 * 60 * 1000,
  });
}
