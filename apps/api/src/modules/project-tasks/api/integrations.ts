import {
  createPullRequestReviewResponseSchema,
  importProjectIssueSchema,
  issueLocatorSchema,
  issuePreviewResponseSchema,
  listPageOf,
  preparedReviewPublicationSchema,
  projectIssueImportResponseSchema,
  projectReviewListResponseSchema,
  publishPullRequestReviewSchema,
  publishedReviewResponseSchema,
  pullRequestLocatorSchema,
  reviewPolicyInputSchema,
  reviewPolicyResponseSchema,
} from "@ngriffin_uk/polychat-schemas";
import z from "zod/v4";

import type { ResourceBuilder } from "~/infrastructure/http/resource";
import {
  importProjectIssue,
  previewProjectIssue,
} from "~/modules/project-tasks/application/issue-intake";
import {
  listProjectReviews,
  prepareReviewPublication,
  publishPullRequestReview,
  reconcileReviewPublication,
  startPullRequestReview,
} from "~/modules/project-tasks/application/pull-request-review";
import { setProjectReviewPolicy } from "~/modules/project-tasks/application/review-policy";

const projectParamsSchema = z.object({ project_id: z.string().min(1) });
const reviewParamsSchema = projectParamsSchema.extend({ review_id: z.string().min(1) });

export function defineProjectReviews(projects: ResourceBuilder): void {
  projects
    .sub("reviews", "review_id")
    .list({
      auth: true,
      tags: ["projects", "tasks"],
      summary: "List pull request reviews",
      description: "The project's reviews, with its automatic review policies alongside.",
      paramSchema: projectParamsSchema,
      responses: { 200: { description: "Reviews", schema: projectReviewListResponseSchema } },
      handler: async ({ serviceContext, params }) => {
        const { policies, reviews } = await listProjectReviews(serviceContext, params.project_id);

        return { ...listPageOf(reviews, (review) => review.id), policies };
      },
    })
    .create({
      auth: true,
      tags: ["projects", "tasks"],
      summary: "Review the current pull request revision",
      paramSchema: projectParamsSchema,
      bodySchema: pullRequestLocatorSchema,
      responses: {
        200: { description: "Admitted review", schema: createPullRequestReviewResponseSchema },
      },
      handler: ({ serviceContext, params, body }) =>
        startPullRequestReview(serviceContext, params.project_id, body),
    })
    .action("prepare_publication", {
      auth: true,
      tags: ["projects", "tasks"],
      summary: "Prepare a governed review for human publication",
      paramSchema: reviewParamsSchema,
      responses: {
        200: { description: "Publication preview", schema: preparedReviewPublicationSchema },
      },
      handler: ({ serviceContext, params }) =>
        prepareReviewPublication(serviceContext, params.project_id, params.review_id),
    })
    .action("publish", {
      auth: true,
      tags: ["projects", "tasks"],
      summary: "Publish the approved review to its exact commit",
      paramSchema: reviewParamsSchema,
      bodySchema: publishPullRequestReviewSchema,
      responses: {
        200: { description: "Published review", schema: publishedReviewResponseSchema },
      },
      handler: ({ serviceContext, params, body }) =>
        publishPullRequestReview(serviceContext, params.project_id, params.review_id, body),
    })
    .action("check_publication", {
      auth: true,
      tags: ["projects", "tasks"],
      summary: "Reconcile an uncertain publication without external writes",
      paramSchema: reviewParamsSchema,
      responses: {
        200: { description: "Publication state", schema: publishedReviewResponseSchema },
      },
      handler: ({ serviceContext, params }) =>
        reconcileReviewPublication(serviceContext, params.project_id, params.review_id),
    });

  projects.singleton("review_policy").update({
    auth: true,
    tags: ["projects", "tasks"],
    summary: "Set the automatic pull request review policy",
    paramSchema: projectParamsSchema,
    bodySchema: reviewPolicyInputSchema,
    responses: { 200: { description: "Saved policy", schema: reviewPolicyResponseSchema } },
    handler: ({ serviceContext, params, body }) =>
      setProjectReviewPolicy(serviceContext, params.project_id, body),
  });
}

export function defineProjectImports(projects: ResourceBuilder): void {
  projects
    .sub("imports", "import_id")
    .create({
      auth: true,
      tags: ["projects", "tasks"],
      summary: "Import an approved issue snapshot as a task",
      paramSchema: projectParamsSchema,
      bodySchema: importProjectIssueSchema,
      responses: {
        200: { description: "The imported task", schema: projectIssueImportResponseSchema },
      },
      handler: ({ serviceContext, params, body }) =>
        importProjectIssue(serviceContext, params.project_id, body),
    })
    .collectionAction("preview", {
      auth: true,
      tags: ["projects", "tasks"],
      summary: "Read an external issue before importing it",
      paramSchema: projectParamsSchema,
      bodySchema: issueLocatorSchema,
      responses: {
        200: { description: "Issue snapshot and any import", schema: issuePreviewResponseSchema },
      },
      handler: ({ serviceContext, params, body }) =>
        previewProjectIssue(serviceContext, params.project_id, body),
    });
}
