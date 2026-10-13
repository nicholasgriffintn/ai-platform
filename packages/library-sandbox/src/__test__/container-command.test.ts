import { describe, expect, it, vi } from "vitest";

import { COMMAND_TIMEOUT_EXIT_CODE, runContainerCommand } from "../container-command";
import { parseInotifyLine } from "../container-watch";

function streamOf(...chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }

      controller.close();
    },
  });
}

function fakeContainer(params: {
  exitCode: Promise<number>;
  stdout?: string[];
  stderr?: string[];
}) {
  const kill = vi.fn();
  const exec = vi.fn(async () => ({
    stdout: streamOf(...(params.stdout ?? [])),
    stderr: streamOf(...(params.stderr ?? [])),
    exitCode: params.exitCode,
    kill,
  }));

  return { container: { exec } as unknown as Pick<Container, "exec">, exec, kill };
}

describe("runContainerCommand", () => {
  it("runs the command under timeout in bash and reports streamed output", async () => {
    const { container, exec } = fakeContainer({
      exitCode: Promise.resolve(0),
      stdout: ["build", "ing\n"],
      stderr: ["warn\n"],
    });
    const output: string[] = [];

    const result = await runContainerCommand(container, "pnpm build", {
      timeoutMs: 2_500,
      onOutput: ({ stream, data }) => {
        output.push(`${stream}:${data}`);
      },
    });

    expect(exec).toHaveBeenCalledWith(
      ["timeout", "--kill-after=5", "3", "bash", "-lc", "pnpm build"],
      expect.objectContaining({ cwd: "/workspace" }),
    );
    expect(result).toEqual({
      success: true,
      exitCode: 0,
      stdout: "building\n",
      stderr: "warn\n",
      timedOut: false,
    });
    expect(output).toContain("stderr:warn\n");
  });

  it("marks commands stopped by the timeout", async () => {
    const { container } = fakeContainer({ exitCode: Promise.resolve(COMMAND_TIMEOUT_EXIT_CODE) });

    await expect(runContainerCommand(container, "sleep 10")).resolves.toMatchObject({
      success: false,
      timedOut: true,
    });
  });

  it("terminates the process when the caller aborts", async () => {
    let finish: (code: number) => void = () => undefined;
    const { container, kill } = fakeContainer({
      exitCode: new Promise<number>((resolve) => {
        finish = resolve;
      }),
    });
    const controller = new AbortController();
    const running = runContainerCommand(container, "sleep 100", { signal: controller.signal });

    await vi.waitFor(() => expect(container.exec).toHaveBeenCalled());
    controller.abort();
    finish(143);

    await expect(running).rejects.toThrow();
    expect(kill).toHaveBeenCalledWith(15);
  });
});

describe("parseInotifyLine", () => {
  it("maps inotify events to file changes and ignores noise", () => {
    expect(parseInotifyLine("CREATE,ISDIR|/workspace/src")).toEqual({
      path: "/workspace/src",
      changeType: "create",
      isDirectory: true,
    });
    expect(parseInotifyLine("CLOSE_WRITE,CLOSE|/workspace/a.ts")).toMatchObject({
      changeType: "modify",
    });
    expect(parseInotifyLine("OPEN|/workspace/a.ts")).toBeNull();
    expect(parseInotifyLine("garbage")).toBeNull();
  });
});
