import { describe, expect, it, vi } from "vitest";

import { assertSafeCommand, buildSummary, runSandboxCommand } from "../commands";
import type { WorkspaceCommandOptions } from "../workspace";

describe("assertSafeCommand", () => {
  it("allows non-mutating commands in read-only mode", () => {
    expect(() => assertSafeCommand("pnpm test --filter api", { readOnly: true })).not.toThrow();
  });

  it("blocks mutating commands in read-only mode", () => {
    expect(() => assertSafeCommand("git add -A", { readOnly: true })).toThrow(/read-only/);
  });

  it("retains the global sandbox policy outside read-only mode", () => {
    expect(() => assertSafeCommand("git add -A")).toThrow(/sandbox policy/);
  });

  it("blocks shell redirection in read-only mode", () => {
    expect(() => assertSafeCommand("echo hi > /tmp/test.txt", { readOnly: true })).toThrow(
      /read-only/,
    );
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

describe("buildSummary", () => {
  it("uses task-type specific summary text", () => {
    const summary = buildSummary(
      "Review authentication flow",
      "owner/repo",
      3,
      undefined,
      "code-review",
    );

    expect(summary).toContain("Completed code review");
  });

  it("includes refactoring summary variants", () => {
    const summary = buildSummary(
      "Cleanup duplicated parsing",
      "owner/repo",
      4,
      "sandbox/refactor-branch",
      "refactoring",
    );

    expect(summary).toContain("Completed refactoring");
    expect(summary).toContain("sandbox/refactor-branch");
  });
});
