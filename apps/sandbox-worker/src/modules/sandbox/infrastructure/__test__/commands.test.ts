import { describe, expect, it, vi } from "vitest";

import { assertSafeCommand, runSandboxCommand } from "../commands";
import type { WorkspaceCommandOptions } from "../workspace";

describe("assertSafeCommand", () => {
  it("blocks mutating commands in read-only mode", () => {
    expect(() => assertSafeCommand("git add -A", { readOnly: true })).toThrow(/read-only/);
  });

  it("blocks interpreter commands in read-only mode", () => {
    expect(() =>
      assertSafeCommand("python -c \"open('tmp.txt','w').write('x')\"", {
        readOnly: true,
      }),
    ).toThrow(/not allowed|read-only/);
  });
});

describe("runSandboxCommand", () => {
  it("redacts credentials split across output chunks before emitting or returning output", async () => {
    const output: string[] = [];
    const exec = vi.fn(async (_command: string, options?: WorkspaceCommandOptions) => {
      await options?.onOutput?.({ stream: "stdout", data: "ready\nprivate-" });
      await options?.onOutput?.({ stream: "stdout", data: "credential\nfinished\n" });

      return {
        success: true,
        exitCode: 0,
        stdout: "ready\nprivate-credential\nfinished\n",
        stderr: "",
        timedOut: false,
      };
    });
    const result = await runSandboxCommand({ exec }, "pnpm test", {
      redactionSecrets: ["private-credential"],
      onOutput: ({ data }) => {
        output.push(data);
      },
    });

    expect(output.join("")).toBe("ready\n[redacted credential]\nfinished\n");
    expect(result.stdout).toBe(output.join(""));
  });
});
