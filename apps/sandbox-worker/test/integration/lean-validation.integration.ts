import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { SandboxExecInstance } from "../../src/lib/commands";
import { validateLeanProof } from "../../src/lib/lean-proof/validation";

const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE_ROOT = resolve(APP_ROOT, "test/fixtures/lean4");
const DEFAULT_IMAGE =
  "docker.io/lixuanji/lean4@sha256:1446f060ef6b3a97ec1ec6ef9e12ad7c1e7072025cbbae43d1b0b7e944ffb99d";

function runDocker(args: string[], input?: string) {
  return spawnSync("docker", args, {
    cwd: APP_ROOT,
    encoding: "utf8",
    input,
  });
}

describe("Lean 4 container validation", () => {
  const containerName = `polychat-lean-proof-${process.pid}-${Date.now()}`;
  const temporaryRoot = mkdtempSync(resolve(tmpdir(), "polychat-lean-fixture-"));
  const fixtureCopy = resolve(temporaryRoot, "repo");
  const image = process.env.POLYCHAT_LEAN_TEST_IMAGE || DEFAULT_IMAGE;
  let sandbox: SandboxExecInstance & {
    readFile(path: string): Promise<{ success: boolean; content: string }>;
    writeFile(path: string, content: string): Promise<void>;
  };

  beforeAll(() => {
    cpSync(FIXTURE_ROOT, fixtureCopy, { recursive: true });

    const started = runDocker([
      "run",
      "-d",
      "--platform",
      "linux/amd64",
      "--name",
      containerName,
      "--entrypoint",
      "/bin/sh",
      "--user",
      "root",
      "-v",
      `${fixtureCopy}:/workspace/repo`,
      "-w",
      "/workspace/repo",
      image,
      "-c",
      "sleep infinity",
    ]);

    if (started.status !== 0) {
      throw new Error(started.stderr || "Failed to start Lean integration container");
    }

    sandbox = {
      exec: async (command: string) => {
        const result = runDocker(["exec", containerName, "/bin/sh", "-lc", command]);

        return {
          success: result.status === 0,
          exitCode: result.status ?? 1,
          stdout: result.stdout,
          stderr: result.stderr,
          command,
          duration: 0,
          timestamp: new Date().toISOString(),
        };
      },
      readFile: async (path: string) => {
        const result = runDocker(["exec", containerName, "cat", "--", path]);

        return { success: result.status === 0, content: result.stdout };
      },
      writeFile: async (path: string, content: string) => {
        const result = runDocker(["exec", "-i", containerName, "tee", "--", path], content);

        if (result.status !== 0) {
          throw new Error(result.stderr || `Failed to write ${path}`);
        }
      },
    };

    const buildDirectory = runDocker([
      "exec",
      containerName,
      "mkdir",
      "-p",
      "/workspace/repo/.lake/build/lib/lean",
    ]);
    const buildValidModule = runDocker([
      "exec",
      containerName,
      "/bin/sh",
      "-lc",
      "lake env lean -o .lake/build/lib/lean/Valid.olean Valid.lean",
    ]);

    if (buildDirectory.status !== 0 || buildValidModule.status !== 0) {
      throw new Error(
        buildDirectory.stderr || buildValidModule.stderr || "Failed to build Lean fixture module",
      );
    }
  });

  afterAll(() => {
    runDocker(["rm", "-f", containerName]);
    rmSync(temporaryRoot, { recursive: true, force: true });
  });

  it("kernel-checks a valid theorem without unexpected axioms", async () => {
    const result = await validateLeanProof({
      sandbox: sandbox as any,
      repositoryRoot: "/workspace/repo",
      targetPaths: ["Valid.lean"],
      declarations: ["valid_identity"],
    });

    expect(result.outcome, JSON.stringify(result)).toBe("kernel_checked");
    expect(result.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "compiler", status: "passed" }),
        expect.objectContaining({ kind: "kernel", status: "passed" }),
      ]),
    );
  });

  it("rejects a theorem with an unsolved goal", async () => {
    const result = await validateLeanProof({
      sandbox: sandbox as any,
      repositoryRoot: "/workspace/repo",
      targetPaths: ["Invalid.lean"],
      declarations: [],
    });

    expect(result.outcome).toBe("incomplete");
    expect(result.evidence).toContainEqual(
      expect.objectContaining({ kind: "compiler", status: "failed" }),
    );
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ severity: "error", message: expect.stringContaining("unsolved") }),
    );
  });

  it("detects sorry and downgrades an otherwise compiling theorem", async () => {
    const result = await validateLeanProof({
      sandbox: sandbox as any,
      repositoryRoot: "/workspace/repo",
      targetPaths: ["Sorry.lean"],
      declarations: ["sorry_escape"],
    });

    expect(result.outcome).toBe("compiled");
    expect(result.sourceRisks).toContainEqual(
      expect.objectContaining({ summary: expect.stringContaining("`sorry`") }),
    );
    expect(result.evidence).toContainEqual(
      expect.objectContaining({ kind: "source_policy", status: "warning" }),
    );
  });
});
