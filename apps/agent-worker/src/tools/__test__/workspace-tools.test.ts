import { describe, expect, it, vi } from "vitest";

import type { WorkspaceTarget } from "../../types";
import { WORKSPACE_TOOLS } from "../workspace-tools";

function writeTool() {
  const tool = WORKSPACE_TOOLS.find((candidate) => candidate.name === "write_file");

  if (!tool) {
    throw new Error("write_file is not registered");
  }

  return tool;
}

function workspace(writeFile: WorkspaceTarget["writeFile"]) {
  return {
    exec: vi.fn<WorkspaceTarget["exec"]>().mockResolvedValue({
      success: true,
      exitCode: 0,
      stdout: "",
      stderr: "",
      timedOut: false,
    }),
    readFile: vi.fn<WorkspaceTarget["readFile"]>(),
    writeFile: vi.fn(writeFile),
  };
}

describe("write_file", () => {
  it("writes straight into an existing directory", async () => {
    const target = workspace(async () => undefined);

    await writeTool().prepare({ path: "src/a.ts", content: "a" }).run(target);

    expect(target.writeFile).toHaveBeenCalledTimes(1);
    expect(target.exec).not.toHaveBeenCalled();
  });

  it("creates a missing parent directory and writes again", async () => {
    const created = new Set<string>();
    const target = workspace(async () => {
      if (!created.has("parent")) {
        throw new Error("ENOENT");
      }
    });

    target.exec.mockImplementation(async () => {
      created.add("parent");

      return { success: true, exitCode: 0, stdout: "", stderr: "", timedOut: false };
    });

    await expect(
      writeTool().prepare({ path: "new/dir/a.ts", content: "a" }).run(target),
    ).resolves.toContain("/workspace/new/dir/a.ts");

    expect(target.exec).toHaveBeenCalledWith(`mkdir -p "$(dirname '/workspace/new/dir/a.ts')"`, {
      timeoutMs: 60_000,
    });
    expect(target.writeFile).toHaveBeenCalledTimes(2);
  });

  it("reports a write that still fails after creating the directory", async () => {
    const target = workspace(async () => {
      throw new Error("EACCES");
    });

    await expect(
      writeTool().prepare({ path: "locked/a.ts", content: "a" }).run(target),
    ).rejects.toThrow("EACCES");
  });
});
