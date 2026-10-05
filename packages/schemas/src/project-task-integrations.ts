import { isHttpUrl } from "@ngriffin_uk/polychat-utility-core";
import z from "zod/v4";

import { createProjectTaskSchema, projectTaskSchema } from "./project-tasks.js";

const externalUrl = z.url().refine(isHttpUrl, "Use an HTTP or HTTPS URL");

export const gitCommitShaSchema = z
  .string()
  .regex(/^[a-fA-F0-9]{40}$/)
  .transform((value) => value.toLowerCase());

export const taskIntegrationProviderSchema = z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/);
export const issueLocatorSchema = z
  .object({
    provider: taskIntegrationProviderSchema,
    accountId: z.string().trim().min(1).max(200),
    repository: z.string().trim().min(1).max(300).optional(),
    issueId: z.string().trim().min(1).max(100),
  })
  .strict();

export const issueSnapshotSchema = z
  .object({
    provider: taskIntegrationProviderSchema,
    accountId: z.string().min(1).max(200),
    connectionId: z.string().nullable(),
    externalId: z.string().min(1).max(200),
    identifier: z.string().min(1).max(300),
    title: z.string().min(1).max(1000),
    description: z.string().max(100000),
    url: externalUrl,
    revision: z.string().regex(/^[a-f0-9]{64}$/),
    capturedAt: z.iso.datetime(),
  })
  .strict();

export const issuePreviewResponseSchema = z
  .object({
    issue: issueSnapshotSchema,
    existingTaskId: z.string().nullable(),
  })
  .strict();

export const importProjectIssueSchema = z
  .object({
    locator: issueLocatorSchema,
    expectedRevision: z.string().regex(/^[a-f0-9]{64}$/),
    task: createProjectTaskSchema.omit({ originConversationId: true }),
  })
  .strict();

export const projectIssueImportResponseSchema = z
  .object({
    task: projectTaskSchema,
    sourceId: z.string(),
    reused: z.boolean(),
  })
  .strict();

export const pullRequestLocatorSchema = z
  .object({
    provider: taskIntegrationProviderSchema,
    accountId: z.string().trim().min(1).max(200),
    repository: z.string().trim().min(1).max(300),
    pullRequestNumber: z.number().int().positive(),
  })
  .strict();

export const pullRequestReviewTargetSchema = pullRequestLocatorSchema
  .extend({
    connectionId: z.string().min(1),
    repositoryId: z.string().min(1).max(300),
    baseSha: gitCommitShaSchema,
    headSha: gitCommitShaSchema,
  })
  .strict();

export const reviewPolicyInputSchema = z.discriminatedUnion("enabled", [
  z.object({ enabled: z.literal(false), id: z.string().min(1) }).strict(),
  z
    .object({
      enabled: z.literal(true),
      provider: taskIntegrationProviderSchema,
      accountId: z.string().trim().min(1).max(200),
      repository: z.string().trim().min(1).max(300),
      tokenBudget: z.number().int().min(1000).max(100000).default(20000),
    })
    .strict(),
]);

export const reviewPolicySchema = z
  .object({
    id: z.string().min(1),
    workspaceId: z.string().min(1),
    enabled: z.boolean(),
    provider: taskIntegrationProviderSchema,
    accountId: z.string().trim().min(1).max(200),
    repository: z.string().min(1).max(300),
    tokenBudget: z.number().int().min(1000).max(100000),
    projectId: z.string(),
    ownerUserId: z.number().int().positive(),
    connectionId: z.string(),
    revision: z.string(),
  })
  .strict();

export const pullRequestReviewSchema = z
  .object({
    id: z.string(),
    workspaceId: z.string(),
    ownerUserId: z.number().int().positive(),
    projectId: z.string(),
    taskId: z.string(),
    sourceId: z.string(),
    target: pullRequestReviewTargetSchema,
    policyId: z.string().nullable(),
    policyRevision: z.string().nullable(),
    publicationStatus: z.enum(["unpublished", "publishing", "published", "unknown"]),
    publishedUrl: externalUrl.nullable(),
    createdAt: z.string(),
  })
  .strict();

export const projectReviewListResponseSchema = z
  .object({
    policies: z.array(reviewPolicySchema),
    reviews: z.array(pullRequestReviewSchema),
  })
  .strict();

export const publishPullRequestReviewSchema = z
  .object({
    completionId: z.string().min(1),
    body: z.string().trim().min(1).max(60000),
  })
  .strict();

export const projectReviewIntakeSchema = z
  .object({
    workspaceId: z.string(),
    policyId: z.string(),
    projectId: z.string(),
    policyRevision: z.string(),
    target: pullRequestReviewTargetSchema,
  })
  .strict();

export type IssueLocator = z.infer<typeof issueLocatorSchema>;
export type IssueSnapshot = z.infer<typeof issueSnapshotSchema>;
export type ImportProjectIssueInput = z.infer<typeof importProjectIssueSchema>;
export type PullRequestLocator = z.infer<typeof pullRequestLocatorSchema>;
export type PullRequestReviewTarget = z.infer<typeof pullRequestReviewTargetSchema>;
export type PullRequestReview = z.infer<typeof pullRequestReviewSchema>;
export type ReviewPolicy = z.infer<typeof reviewPolicySchema>;
export type ReviewPolicyInput = z.input<typeof reviewPolicyInputSchema>;
export type PublishPullRequestReviewInput = z.infer<typeof publishPullRequestReviewSchema>;

export const createPullRequestReviewResponseSchema = z
  .object({ review: pullRequestReviewSchema, reused: z.boolean() })
  .strict();
export const preparedReviewPublicationSchema = z
  .object({
    completionId: z.string(),
    body: z.string(),
    outputId: z.string(),
    review: pullRequestReviewSchema,
  })
  .strict();
export const publishedReviewResponseSchema = z.object({ review: pullRequestReviewSchema }).strict();
export const projectTaskReviewResponseSchema = z
  .object({ review: pullRequestReviewSchema.nullable() })
  .strict();
export const reviewPolicyResponseSchema = z.object({ policy: reviewPolicySchema }).strict();

export type IssuePreview = z.infer<typeof issuePreviewResponseSchema>;
export type ProjectIssueImportResult = z.infer<typeof projectIssueImportResponseSchema>;
export type ProjectReviewList = z.infer<typeof projectReviewListResponseSchema>;
export type PreparedReviewPublication = z.infer<typeof preparedReviewPublicationSchema>;
