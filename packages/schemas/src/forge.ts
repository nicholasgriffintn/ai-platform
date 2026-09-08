import z from "zod/v4";

export const forgeKindSchema = z.literal("github");
export const forgePullRequestRefSchema = z
  .object({
    forge: forgeKindSchema,
    repository: z.string().regex(/^[^/]+\/[^/]+$/),
    number: z.number().int().positive(),
  })
  .strict();

export const createPullRequestInputSchema = z
  .object({
    repository: z.string().regex(/^[^/]+\/[^/]+$/),
    head: z.string().min(1).max(256),
    base: z.string().min(1).max(256),
    title: z.string().min(1).max(256),
    body: z.string().max(100_000),
  })
  .strict();

export const forgePullRequestSchema = z
  .object({
    ref: forgePullRequestRefSchema,
    url: z.url(),
    title: z.string().min(1),
    head: z.string().min(1),
    base: z.string().min(1),
  })
  .strict();

export type CreatePullRequestInput = z.infer<typeof createPullRequestInputSchema>;
export type ForgePullRequest = z.infer<typeof forgePullRequestSchema>;
export type ForgePullRequestRef = z.infer<typeof forgePullRequestRefSchema>;
