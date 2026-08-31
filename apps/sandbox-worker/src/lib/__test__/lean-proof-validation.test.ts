import { leanProofResultSchema, sandboxRunEventSchema } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it, vi } from "vitest";

import { canCommitLeanProof } from "../../tasks/runners/lean-proof";
import type { SandboxExecInstance } from "../commands";
import { buildLeanProofBranchName } from "../lean-proof/branch";
import {
  assertLeanReplacementFileLimits,
  assertLeanTargetFileLimits,
  LEAN_PROOF_MAX_TARGET_BYTES,
  LEAN_PROOF_MAX_TARGET_FILE_BYTES,
} from "../lean-proof/file-limits";
import { resolveContainedRepositoryFile } from "../lean-proof/repository-path";
import { LEAN_PROOF_SUMMARY_MAX_CHARS, normaliseLeanProofSummary } from "../lean-proof/summary";
import {
  assertLeanProofNotCancelled,
  parseAxiomAudit,
  parseLeanDiagnostics,
  scanRiskyLeanSource,
  validateLeanProof,
} from "../lean-proof/validation";

describe("Lean proof repository boundaries", () => {
  it("derives an isolated branch from the server run identity", () => {
    expect(buildLeanProofBranchName("run:project/proof-123")).toBe(
      "polychat/lean-proof-run-project-proof-123",
    );
  });

  it("rejects a symlink that resolves outside the repository", async () => {
    const sandbox: SandboxExecInstance = {
      exec: vi
        .fn()
        .mockResolvedValueOnce({
          success: true,
          exitCode: 0,
          stdout: "/private/secret.lean\n",
          stderr: "",
        })
        .mockResolvedValueOnce({
          success: true,
          exitCode: 0,
          stdout: "/workspace/repo\n",
          stderr: "",
        }),
    };

    await expect(
      resolveContainedRepositoryFile(sandbox, "/workspace/repo", "Proof.lean"),
    ).rejects.toThrow("resolves outside the checkout");
  });

  it("checks a safely quoted fixed stat command before accepting a target", async () => {
    const exec = vi
      .fn()
      .mockResolvedValueOnce({
        success: true,
        exitCode: 0,
        stdout: "/workspace/repo/Proof.lean\n",
        stderr: "",
      })
      .mockResolvedValueOnce({
        success: true,
        exitCode: 0,
        stdout: "/workspace/repo\n",
        stderr: "",
      })
      .mockResolvedValueOnce({ success: true, exitCode: 0, stdout: "1200\n", stderr: "" });

    await expect(
      assertLeanTargetFileLimits({
        sandbox: { exec } as SandboxExecInstance,
        repositoryRoot: "/workspace/repo",
        targetPaths: ["Proof.lean"],
      }),
    ).resolves.toEqual([
      {
        path: "Proof.lean",
        resolvedPath: "/workspace/repo/Proof.lean",
        sizeBytes: 1200,
      },
    ]);
    expect(exec).toHaveBeenLastCalledWith("stat -Lc %s -- '/workspace/repo/Proof.lean'");
  });

  it("rejects oversized targets before validation reads them", async () => {
    const exec = vi
      .fn()
      .mockResolvedValueOnce({
        success: true,
        exitCode: 0,
        stdout: "/workspace/repo/Proof.lean\n",
        stderr: "",
      })
      .mockResolvedValueOnce({
        success: true,
        exitCode: 0,
        stdout: "/workspace/repo\n",
        stderr: "",
      })
      .mockResolvedValueOnce({
        success: true,
        exitCode: 0,
        stdout: `${LEAN_PROOF_MAX_TARGET_FILE_BYTES + 1}\n`,
        stderr: "",
      });
    const readFile = vi.fn();

    await expect(
      validateLeanProof({
        sandbox: { exec, readFile } as any,
        repositoryRoot: "/workspace/repo",
        targetPaths: ["Proof.lean"],
        declarations: [],
      }),
    ).rejects.toThrow("per-file limit");
    expect(readFile).not.toHaveBeenCalled();
  });

  it("enforces the aggregate target limit and prospective replacement size", async () => {
    const targetPaths = Array.from({ length: 5 }, (_, index) => `Proof${index}.lean`);
    const targetSize = Math.floor(LEAN_PROOF_MAX_TARGET_BYTES / 5) + 1;
    const exec = vi.fn(async (command: string) => {
      if (command === "realpath -e -- '/workspace/repo'") {
        return {
          success: true,
          exitCode: 0,
          stdout: "/workspace/repo\n",
          stderr: "",
          command,
          duration: 0,
          timestamp: new Date().toISOString(),
        };
      }

      if (command.startsWith("realpath -e -- '/workspace/repo/")) {
        const path = command.slice("realpath -e -- '".length, -1);

        return {
          success: true,
          exitCode: 0,
          stdout: `${path}\n`,
          stderr: "",
          command,
          duration: 0,
          timestamp: new Date().toISOString(),
        };
      }

      return {
        success: true,
        exitCode: 0,
        stdout: `${targetSize}\n`,
        stderr: "",
        command,
        duration: 0,
        timestamp: new Date().toISOString(),
      };
    });

    await expect(
      assertLeanTargetFileLimits({
        sandbox: { exec },
        repositoryRoot: "/workspace/repo",
        targetPaths,
      }),
    ).rejects.toThrow("aggregate limit");

    expect(() =>
      assertLeanReplacementFileLimits(
        [
          { path: "Proof.lean", resolvedPath: "/workspace/repo/Proof.lean", sizeBytes: 10 },
          {
            path: "Other.lean",
            resolvedPath: "/workspace/repo/Other.lean",
            sizeBytes: LEAN_PROOF_MAX_TARGET_BYTES - 10,
          },
        ],
        "Proof.lean",
        "x".repeat(11),
      ),
    ).toThrow("aggregate limit");
  });

  it("accepts a real path contained by the repository root", async () => {
    const sandbox: SandboxExecInstance = {
      exec: vi
        .fn()
        .mockResolvedValueOnce({
          success: true,
          exitCode: 0,
          stdout: "/workspace/repo/Proof.lean\n",
          stderr: "",
        })
        .mockResolvedValueOnce({
          success: true,
          exitCode: 0,
          stdout: "/workspace/repo\n",
          stderr: "",
        }),
    };

    await expect(
      resolveContainedRepositoryFile(sandbox, "/workspace/repo", "Proof.lean"),
    ).resolves.toBe("/workspace/repo/Proof.lean");
  });
});

describe("Lean proof evidence", () => {
  it("bounds oversized summaries while retaining their opening and terminal evidence", () => {
    const summary = `Opening proof context\n${"a".repeat(12_000)}\nTerminal compiler evidence`;
    const normalised = normaliseLeanProofSummary(summary);

    expect(normalised).toHaveLength(LEAN_PROOF_SUMMARY_MAX_CHARS);
    expect(normalised).toMatch(/^Opening proof context/);
    expect(normalised).toContain("middle omitted");
    expect(normalised).toMatch(/Terminal compiler evidence$/);
    const leanProof = {
      outcome: "incomplete" as const,
      summary: normalised,
      targetPaths: ["Proof.lean"],
      declarations: [],
      changedPaths: [],
      diagnostics: [],
      evidence: [],
      usage: {
        inputTokens: 1,
        outputTokens: 1,
        totalTokens: 2,
        cachedInputTokens: 0,
        iterations: 1,
      },
    };

    expect(leanProofResultSchema.safeParse(leanProof).success).toBe(true);
    expect(
      sandboxRunEventSchema.safeParse({
        type: "run_completed",
        result: { success: true, summary: normalised, leanProof },
      }).success,
    ).toBe(true);
  });

  it("parses compiler diagnostics without treating warnings as errors", () => {
    expect(
      parseLeanDiagnostics(
        [
          "Proof.lean:4:7: error: unsolved goals",
          "Proof.lean:8:2: warning: declaration uses 'sorry'",
        ].join("\n"),
      ),
    ).toMatchObject([
      { severity: "error", path: "Proof.lean", line: 4, column: 7 },
      { severity: "warning", path: "Proof.lean", line: 8, column: 2 },
    ]);
  });

  it("flags proof escape hatches conservatively", () => {
    const risks = scanRiskyLeanSource(
      "Proof.lean",
      "axiom oracle : False\ntheorem unsafeProof : False := by sorry",
    );

    expect(risks.map((risk) => risk.summary)).toEqual([
      "Detected unfinished proof (`sorry`).",
      "Detected new axiom declaration.",
    ]);
  });

  it("only accepts the standard Lean axioms", () => {
    expect(parseAxiomAudit("'identity' does not depend on any axioms")).toEqual({
      passed: true,
      summaries: [],
    });
    expect(parseAxiomAudit("'safe' depends on axioms: [propext, Classical.choice]")).toEqual({
      passed: true,
      summaries: [],
    });
    expect(parseAxiomAudit("'unsafe' depends on axioms: [sorryAx, Classical.choice]")).toEqual({
      passed: false,
      summaries: ["Unexpected axioms: sorryAx"],
    });
  });

  it("honours cancellation before starting compiler work", () => {
    const controller = new AbortController();

    controller.abort();

    expect(() => assertLeanProofNotCancelled(controller.signal)).toThrow(
      expect.objectContaining({ name: "AbortError" }),
    );
  });

  it("does not permit a commit for incomplete or warning-bearing evidence", () => {
    expect(
      canCommitLeanProof({
        outcome: "incomplete",
        diagnostics: [],
        sourceRisks: [],
        evidence: [
          {
            kind: "compiler",
            status: "failed",
            summary: "unsolved goals",
            path: "Proof.lean",
            declaration: null,
          },
        ],
      }),
    ).toBe(false);
    expect(
      canCommitLeanProof({
        outcome: "compiled",
        diagnostics: [],
        sourceRisks: [{ path: "Proof.lean", summary: "Detected sorry." }],
        evidence: [
          {
            kind: "source_policy",
            status: "warning",
            summary: "Detected sorry.",
            path: "Proof.lean",
            declaration: null,
          },
        ],
      }),
    ).toBe(false);
  });
});
