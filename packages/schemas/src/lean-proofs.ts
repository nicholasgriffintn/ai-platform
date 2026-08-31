import z from "zod/v4";

import { hasUniqueValues } from "./collection-validation";
import { hasControlCharacter } from "./string-validation";

export const LEAN_PROOF_MAX_TARGET_PATHS = 20;
export const LEAN_PROOF_MAX_DECLARATIONS = 50;
export const LEAN_PROOF_MAX_ACCEPTANCE_CRITERIA = 20;
export const LEAN_PROOF_MAX_TOKEN_BUDGET = 10_000_000;

export const leanProofIdempotencyKeySchema = z
  .string()
  .trim()
  .min(8)
  .max(128)
  .regex(
    /^[A-Za-z0-9._:-]+$/,
    "Idempotency key may only contain letters, numbers, dots, underscores, colons and hyphens",
  );

export const repositoryRelativePathSchema = z
  .string()
  .trim()
  .min(1)
  .max(512)
  .superRefine((path, context) => {
    const segments = path.split("/");
    const isDriveRooted = /^[a-zA-Z]:/.test(path);
    const hasInvalidSegment = segments.some(
      (segment) => segment.length === 0 || segment === "." || segment === "..",
    );

    if (
      path.startsWith("/") ||
      path.startsWith("\\") ||
      path.includes("\\") ||
      path.includes(":") ||
      isDriveRooted ||
      hasInvalidSegment ||
      hasControlCharacter(path)
    ) {
      context.addIssue({
        code: "custom",
        message: "Path must be a normalised repository-relative path without traversal",
      });
    }
  });

export const leanRepositoryRelativePathSchema = repositoryRelativePathSchema.refine(
  (path) => path.endsWith(".lean"),
  { error: "Target path must name a .lean file" },
);

export const leanDeclarationSchema = z
  .string()
  .trim()
  .min(1)
  .max(240)
  .regex(
    /^[\p{L}_][\p{L}\p{N}_']*(?:\.[\p{L}_][\p{L}\p{N}_']*)*$/u,
    "Declaration must be a qualified Lean name",
  )
  .refine((declaration) => !hasControlCharacter(declaration), {
    error: "Declaration cannot contain control characters",
  });

export const leanProofRequestSchema = z
  .object({
    targetPaths: z.array(leanRepositoryRelativePathSchema).min(1).max(LEAN_PROOF_MAX_TARGET_PATHS),
    declarations: z.array(leanDeclarationSchema).max(LEAN_PROOF_MAX_DECLARATIONS).default([]),
    objective: z.string().trim().min(1).max(4000),
    acceptanceCriteria: z
      .array(z.string().trim().min(1).max(500))
      .max(LEAN_PROOF_MAX_ACCEPTANCE_CRITERIA)
      .default([]),
  })
  .strict()
  .superRefine((request, context) => {
    if (!hasUniqueValues(request.targetPaths)) {
      context.addIssue({
        code: "custom",
        message: "Target paths must be unique",
        path: ["targetPaths"],
      });
    }

    if (!hasUniqueValues(request.declarations)) {
      context.addIssue({
        code: "custom",
        message: "Declarations must be unique",
        path: ["declarations"],
      });
    }
  });

export const createLeanProofProjectTaskSchema = leanProofRequestSchema.extend({
  tokenBudget: z.number().int().positive().max(LEAN_PROOF_MAX_TOKEN_BUDGET).optional(),
});

export const leanProofOutcomeSchema = z.enum([
  "kernel_checked",
  "compiled",
  "incomplete",
  "failed",
]);

export const leanProofDiagnosticSchema = z
  .object({
    severity: z.enum(["error", "warning", "information"]),
    message: z.string().trim().min(1).max(4000),
    path: leanRepositoryRelativePathSchema.nullable().default(null),
    line: z.number().int().positive().nullable().default(null),
    column: z.number().int().positive().nullable().default(null),
    endLine: z.number().int().positive().nullable().default(null),
    endColumn: z.number().int().positive().nullable().default(null),
    code: z.string().trim().min(1).max(120).nullable().default(null),
  })
  .strict();

export const leanProofEvidenceSchema = z
  .object({
    kind: z.enum(["compiler", "language_server", "kernel", "source_policy", "test"]),
    status: z.enum(["passed", "failed", "warning"]),
    summary: z.string().trim().min(1).max(4000),
    path: leanRepositoryRelativePathSchema.nullable().default(null),
    declaration: leanDeclarationSchema.nullable().default(null),
  })
  .strict();

export const leanProofUsageSchema = z
  .object({
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    totalTokens: z.number().int().nonnegative(),
    cachedInputTokens: z.number().int().nonnegative().default(0),
    iterations: z.number().int().nonnegative(),
  })
  .strict()
  .superRefine((usage, context) => {
    if (usage.totalTokens !== usage.inputTokens + usage.outputTokens) {
      context.addIssue({
        code: "custom",
        message: "Total tokens must equal input plus output tokens",
        path: ["totalTokens"],
      });
    }

    if (usage.cachedInputTokens > usage.inputTokens) {
      context.addIssue({
        code: "custom",
        message: "Cached input tokens cannot exceed input tokens",
        path: ["cachedInputTokens"],
      });
    }
  });

export const leanProofResultSchema = z
  .object({
    outcome: leanProofOutcomeSchema,
    summary: z.string().trim().min(1).max(10_000),
    targetPaths: z.array(leanRepositoryRelativePathSchema).min(1).max(LEAN_PROOF_MAX_TARGET_PATHS),
    declarations: z.array(leanDeclarationSchema).max(LEAN_PROOF_MAX_DECLARATIONS).default([]),
    changedPaths: z.array(repositoryRelativePathSchema).max(100).default([]),
    diagnostics: z.array(leanProofDiagnosticSchema).max(500).default([]),
    evidence: z.array(leanProofEvidenceSchema).max(200).default([]),
    usage: leanProofUsageSchema,
  })
  .strict()
  .superRefine((result, context) => {
    if (!hasUniqueValues(result.targetPaths)) {
      context.addIssue({
        code: "custom",
        message: "Target paths must be unique",
        path: ["targetPaths"],
      });
    }

    if (!hasUniqueValues(result.declarations)) {
      context.addIssue({
        code: "custom",
        message: "Declarations must be unique",
        path: ["declarations"],
      });
    }

    if (!hasUniqueValues(result.changedPaths)) {
      context.addIssue({
        code: "custom",
        message: "Changed paths must be unique",
        path: ["changedPaths"],
      });
    }

    if (
      (result.outcome === "kernel_checked" || result.outcome === "compiled") &&
      result.diagnostics.some((diagnostic) => diagnostic.severity === "error")
    ) {
      context.addIssue({
        code: "custom",
        message: "Successful proof outcomes cannot include error diagnostics",
        path: ["diagnostics"],
      });
    }

    if (
      (result.outcome === "kernel_checked" || result.outcome === "compiled") &&
      result.evidence.some((evidence) => evidence.status === "failed")
    ) {
      context.addIssue({
        code: "custom",
        message: "Successful proof outcomes cannot include failed evidence",
        path: ["evidence"],
      });
    }

    if (
      result.outcome === "kernel_checked" &&
      !result.evidence.some(
        (evidence) => evidence.kind === "kernel" && evidence.status === "passed",
      )
    ) {
      context.addIssue({
        code: "custom",
        message: "Kernel-checked results require passing kernel evidence",
        path: ["evidence"],
      });
    }

    if (
      result.outcome === "compiled" &&
      !result.evidence.some(
        (evidence) => evidence.kind === "compiler" && evidence.status === "passed",
      )
    ) {
      context.addIssue({
        code: "custom",
        message: "Compiled results require passing compiler evidence",
        path: ["evidence"],
      });
    }
  });

export type LeanProofRequest = z.infer<typeof leanProofRequestSchema>;
export type CreateLeanProofProjectTaskInput = z.infer<typeof createLeanProofProjectTaskSchema>;
export type LeanProofOutcome = z.infer<typeof leanProofOutcomeSchema>;
export type LeanProofDiagnostic = z.infer<typeof leanProofDiagnosticSchema>;
export type LeanProofEvidence = z.infer<typeof leanProofEvidenceSchema>;
export type LeanProofUsage = z.infer<typeof leanProofUsageSchema>;
export type LeanProofResult = z.infer<typeof leanProofResultSchema>;
