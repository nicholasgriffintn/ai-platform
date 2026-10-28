import z from "zod/v4";

export const AGENT_CHANGE_STATUSES = ["added", "modified", "deleted", "renamed", "copied"] as const;

export const agentChangedFileSchema = z.object({
  path: z.string().min(1),
  status: z.enum(AGENT_CHANGE_STATUSES),
  previousPath: z.string().nullable(),
  additions: z.number().int().nonnegative().nullable(),
  deletions: z.number().int().nonnegative().nullable(),
});
export type AgentChangedFile = z.infer<typeof agentChangedFileSchema>;

export const agentTurnChangesSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  files: z.array(agentChangedFileSchema).max(2000),
  patch: z.string().max(300_000),
  truncated: z.boolean(),
});
export type AgentTurnChanges = z.infer<typeof agentTurnChangesSchema>;

export const agentWorktreeSchema = z.object({
  path: z.string().min(1),
  branch: z.string().min(1),
  baseBranch: z.string().min(1).nullable(),
  baseCommit: z.string().min(1),
});
export type AgentWorktree = z.infer<typeof agentWorktreeSchema>;

export const agentBranchFileSchema = z
  .object({
    path: z
      .string()
      .min(1)
      .max(1000)
      .refine((path) => !path.startsWith("/") && !path.split("/").includes(".."), {
        error: "File paths must stay inside the repository.",
      }),
    deleted: z.boolean(),
    executable: z.boolean(),
    contentBase64: z.string().nullable(),
  })
  .refine((file) => file.deleted || file.contentBase64 !== null, {
    error: "A changed file needs its content.",
  });
export type AgentBranchFile = z.infer<typeof agentBranchFileSchema>;

export const AGENT_BRANCH_PATTERN = /^polychat\/[A-Za-z0-9-]{1,48}$/;
const MAX_PULL_REQUEST_CONTENT = 30 * 1024 * 1024;

export const agentBranchChangesSchema = z.object({
  repository: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
  branch: z.string().regex(AGENT_BRANCH_PATTERN),
  baseBranch: z.string().min(1).max(200),
  baseCommit: z.string().regex(/^[0-9a-f]{40}$/),
  headCommit: z.string().regex(/^[0-9a-f]{40}$/),
  files: z.array(agentBranchFileSchema).min(1).max(500),
});
export type AgentBranchChanges = z.infer<typeof agentBranchChangesSchema>;

export const agentPullRequestRequestSchema = z.object({
  changes: agentBranchChangesSchema.refine(
    (changes) =>
      changes.files.reduce((total, file) => total + (file.contentBase64?.length ?? 0), 0) <=
      MAX_PULL_REQUEST_CONTENT,
    { error: "These changes are too large to send in one pull request." },
  ),
  title: z.string().trim().min(1).max(200),
  body: z.string().max(20_000).default(""),
});
export type AgentPullRequestRequest = z.infer<typeof agentPullRequestRequestSchema>;

export const agentPullRequestSchema = z.object({
  repository: z.string().min(1),
  branch: z.string().min(1),
  number: z.number().int().positive(),
  url: z.string().url(),
  created: z.boolean(),
});
export type AgentPullRequest = z.infer<typeof agentPullRequestSchema>;
