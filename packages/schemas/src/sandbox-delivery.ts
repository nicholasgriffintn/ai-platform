import z from "zod/v4";

export const sandboxGitBranchNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(
    /^[A-Za-z0-9][A-Za-z0-9._/-]*$/,
    "Branch names may contain letters, numbers, dots, underscores, slashes and hyphens",
  )
  .refine(
    (value) =>
      !value.includes("..") &&
      !value.includes("//") &&
      !value.includes("@{") &&
      !value.endsWith("/") &&
      !value.endsWith(".") &&
      !value.endsWith(".lock"),
    "Branch name is not a safe Git reference",
  );

export const sandboxDeliveryPolicySchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("leave_uncommitted") }).strict(),
  z
    .object({
      mode: z.literal("review_branch"),
      destination: z.enum(["branch", "pull_request"]).default("pull_request"),
    })
    .strict(),
  z
    .object({
      mode: z.literal("commit_to_branch"),
      targetBranch: sandboxGitBranchNameSchema.refine(
        (value) => value.toLowerCase() !== "main",
        "Direct delivery cannot target main",
      ),
    })
    .strict(),
  z
    .object({
      mode: z.literal("custom"),
      instructions: z.string().trim().min(1).max(2000),
    })
    .strict(),
]);

export type SandboxDeliveryPolicy = z.infer<typeof sandboxDeliveryPolicySchema>;

export const DEFAULT_SANDBOX_DELIVERY_POLICY = {
  mode: "review_branch",
  destination: "pull_request",
} as const satisfies SandboxDeliveryPolicy;

export function resolveSandboxDeliveryPolicy(
  value: unknown,
  legacyShouldCommit?: boolean,
): SandboxDeliveryPolicy {
  const parsed = sandboxDeliveryPolicySchema.safeParse(value);

  if (parsed.success) {
    return parsed.data;
  }

  if (legacyShouldCommit === false) {
    return { mode: "leave_uncommitted" };
  }

  if (legacyShouldCommit === true) {
    return { mode: "review_branch", destination: "branch" };
  }

  return DEFAULT_SANDBOX_DELIVERY_POLICY;
}

export function sandboxDeliveryPolicyCreatesCommit(policy: SandboxDeliveryPolicy): boolean {
  return policy.mode === "review_branch" || policy.mode === "commit_to_branch";
}
