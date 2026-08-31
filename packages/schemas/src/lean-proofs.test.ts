import { describe, expect, it } from "vitest";

import {
  leanProofIdempotencyKeySchema,
  leanProofRequestSchema,
  leanProofResultSchema,
  leanRepositoryRelativePathSchema,
} from "./lean-proofs";
import {
  isProjectTaskRetryable,
  projectTaskCompletionSchema,
  projectTaskRunnerSchema,
} from "./project-tasks";
import { executeSandboxRunSchema, sandboxProjectTaskDispatchContextSchema } from "./sandbox";

const request = {
  targetPaths: ["Mathlib/Algebra/Proof.lean"],
  declarations: ["Mathlib.Algebra.example_theorem"],
  objective: "Replace the proof placeholder with a kernel-checked proof.",
  acceptanceCriteria: ["The target declaration has no remaining proof placeholders."],
};

describe("Lean proof contracts", () => {
  it("accepts bounded opaque idempotency keys and rejects header injection", () => {
    expect(leanProofIdempotencyKeySchema.safeParse("proof-request:1234").success).toBe(true);
    expect(leanProofIdempotencyKeySchema.safeParse("short").success).toBe(false);
    expect(leanProofIdempotencyKeySchema.safeParse("proof-request\r\ninjected").success).toBe(
      false,
    );
  });

  it.each([
    "/Mathlib/Proof.lean",
    "../Proof.lean",
    "Mathlib/../Proof.lean",
    "Mathlib\\Proof.lean",
    "C:/Mathlib/Proof.lean",
    "./Proof.lean",
    "Mathlib//Proof.lean",
    "Mathlib/Proof.txt",
  ])("rejects unsafe or non-Lean target path %s", (path) => {
    expect(leanRepositoryRelativePathSchema.safeParse(path).success).toBe(false);
  });

  it("rejects duplicate targets and declarations before dispatch", () => {
    expect(
      leanProofRequestSchema.safeParse({
        ...request,
        targetPaths: [request.targetPaths[0], request.targetPaths[0]],
        declarations: [request.declarations[0], request.declarations[0]],
      }).success,
    ).toBe(false);
  });

  it.each([
    "Mathlib.Algebra.target;#eval",
    "Mathlib.Algebra.target)--",
    "Mathlib.Algebra.target `escape`",
    "Mathlib/Algebra.target",
  ])("rejects declaration text that could inject Lean source: %s", (declaration) => {
    expect(
      leanProofRequestSchema.safeParse({ ...request, declarations: [declaration] }).success,
    ).toBe(false);
  });

  it("accepts qualified Unicode Lean declaration names", () => {
    expect(
      leanProofRequestSchema.safeParse({
        ...request,
        declarations: ["Mathlib.Algebra.μέτρο_1'"],
      }).success,
    ).toBe(true);
  });

  it("only reports kernel_checked with passing kernel evidence and consistent usage", () => {
    const result = {
      outcome: "kernel_checked",
      summary: "The declaration passed the Lean kernel checks.",
      targetPaths: request.targetPaths,
      declarations: request.declarations,
      changedPaths: request.targetPaths,
      diagnostics: [],
      evidence: [
        {
          kind: "kernel",
          status: "passed",
          summary: "Lean accepted the declaration without additional axioms.",
          path: request.targetPaths[0],
          declaration: request.declarations[0],
        },
      ],
      usage: {
        inputTokens: 120,
        outputTokens: 30,
        totalTokens: 150,
        cachedInputTokens: 20,
        iterations: 2,
      },
    };

    expect(leanProofResultSchema.safeParse(result).success).toBe(true);
    expect(leanProofResultSchema.safeParse({ ...result, evidence: [] }).success).toBe(false);
    expect(
      leanProofResultSchema.safeParse({
        ...result,
        evidence: [
          ...result.evidence,
          {
            ...result.evidence[0],
            kind: "source_policy",
            status: "failed",
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      leanProofResultSchema.safeParse({
        ...result,
        usage: { ...result.usage, totalTokens: 151 },
      }).success,
    ).toBe(false);
  });
});

describe("Lean proof runner contracts", () => {
  it("keeps repository credentials out of the durable project task runner", () => {
    expect(
      projectTaskRunnerSchema.safeParse({ kind: "sandbox", profile: "lean-proof", request })
        .success,
    ).toBe(true);
    expect(
      projectTaskRunnerSchema.safeParse({
        kind: "sandbox",
        profile: "lean-proof",
        request,
        repo: "owner/repository",
        installationId: 123,
      }).success,
    ).toBe(false);
  });

  it("requires runtime-specific completion anchors", () => {
    const completion = {
      id: "completion-1",
      stageId: null,
      runtime: "sandbox",
      conversationId: null,
      goalId: "goal-1",
      sandboxRunId: "run-1",
      outputId: "output-1",
      output: "Proof checks passed.",
      evidence: [],
      approval: {
        mode: "human",
        status: "pending",
        reviewedByUserId: null,
        reviewedAt: null,
      },
      createdAt: "2026-08-31T12:00:00.000Z",
    };

    expect(projectTaskCompletionSchema.safeParse(completion).success).toBe(true);
    expect(projectTaskCompletionSchema.safeParse({ ...completion, outputId: null }).success).toBe(
      false,
    );
    expect(
      projectTaskCompletionSchema.safeParse({ ...completion, conversationId: "conversation-1" })
        .success,
    ).toBe(false);
  });

  it("treats failed proof verification as retryable", () => {
    expect(
      isProjectTaskRetryable({
        status: "blocked",
        blockedReason: "verification_failed",
        dispatchTaskId: "dispatch-1",
      }),
    ).toBe(true);
  });

  it("requires an exact project task context for project-owned sandbox runs", () => {
    const projectTaskContext = {
      dispatchTaskId: "dispatch-1",
      taskId: "task-1",
      projectId: "project-1",
      workspaceId: "workspace-1",
      runnerIdentityUserId: 42,
    };

    expect(sandboxProjectTaskDispatchContextSchema.safeParse(projectTaskContext).success).toBe(
      true,
    );
    expect(
      sandboxProjectTaskDispatchContextSchema.safeParse({
        ...projectTaskContext,
        installationId: 123,
      }).success,
    ).toBe(false);

    expect(
      executeSandboxRunSchema.safeParse({
        installationId: 123,
        repo: "owner/repository",
        task: request.objective,
        taskType: "lean-proof",
        leanProof: request,
        tokenBudget: 100_000,
        projectTaskContext,
      }).success,
    ).toBe(true);
    expect(
      executeSandboxRunSchema.safeParse({
        installationId: 123,
        repo: "owner/repository",
        task: request.objective,
        taskType: "lean-proof",
      }).success,
    ).toBe(false);
  });
});
