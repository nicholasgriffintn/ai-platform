import type { Mock } from "vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SandboxTaskRunnerRegistry } from "../runner";

const { runnerInstances } = vi.hoisted(() => ({
  runnerInstances: [] as Array<{ taskType: string; execute: Mock }>,
}));

vi.mock("../runners/feature-implementation-runner", () => ({
  AgentTaskRunner: class {
    readonly taskType: string;
    readonly execute: Mock;

    constructor(taskType: string) {
      this.taskType = taskType;
      this.execute = vi.fn();
      runnerInstances.push({
        taskType,
        execute: this.execute,
      });
    }
  },
}));

import { executeSandboxTask } from "../index";

describe("sandbox task runners", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const runner of runnerInstances) {
      runner.execute.mockReset();
    }
  });

  it("resolves the runner selected by the task profile", async () => {
    const documentationRunner = runnerInstances.find(
      (runner) => runner.taskType === "documentation",
    );

    expect(documentationRunner).toBeDefined();
    documentationRunner?.execute.mockResolvedValueOnce({
      success: true,
      summary: "done",
    });

    const result = await executeSandboxTask(
      {
        userId: 1,
        repo: "owner/repo",
        task: "Write docs for run cancellation",
        taskType: "documentation",
        shouldCommit: false,
        polychatApiUrl: "https://api.example.com",
      } as any,
      { userToken: "token" },
      {} as any,
    );

    expect(result).toEqual({
      success: true,
      summary: "done",
    });
    expect(documentationRunner?.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({
          taskType: "documentation",
          task: expect.stringContaining("Documentation request: Write docs for run cancellation"),
          shouldCommit: false,
        }),
      }),
    );
  });

  it("throws when resolving an unregistered runner", () => {
    const registry = new SandboxTaskRunnerRegistry();

    expect(() => registry.resolve("bug-fix")).toThrow(
      "No sandbox task runner registered for bug-fix",
    );
  });
});
