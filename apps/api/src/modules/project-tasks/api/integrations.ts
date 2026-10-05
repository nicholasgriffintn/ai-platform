import {
  reviewPolicyInputSchema,
  reviewPolicyResponseSchema,
  createPullRequestReviewResponseSchema,
  preparedReviewPublicationSchema,
  publishedReviewResponseSchema,
  projectTaskReviewResponseSchema,
  importProjectIssueSchema,
  issueLocatorSchema,
  issuePreviewResponseSchema,
  projectIssueImportResponseSchema,
  projectReviewListResponseSchema,
  publishPullRequestReviewSchema,
  pullRequestLocatorSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { addRoute } from "~/infrastructure/http/routeBuilder";
import {
  importProjectIssue,
  previewProjectIssue,
} from "~/modules/project-tasks/application/issue-intake";
import {
  listProjectReviews,
  getProjectTaskReview,
  prepareReviewPublication,
  publishPullRequestReview,
  reconcileReviewPublication,
  startPullRequestReview,
} from "~/modules/project-tasks/application/pull-request-review";
import { setProjectReviewPolicy } from "~/modules/project-tasks/application/review-policy";
import type { IEnv } from "~/types";

const app = new Hono<{ Bindings: IEnv }>();
const projectParams = z.object({ projectId: z.string().min(1) });
const reviewParams = projectParams.extend({ reviewId: z.string().min(1) });

addRoute(app, "get", "/:projectId/tasks/:taskId/pr-review", {
  auth: true,
  tags: ["projects", "tasks"],
  summary: "Read the review associated with a project task",
  paramSchema: projectParams.extend({ taskId: z.string().min(1) }),
  responses: { 200: { description: "Task review", schema: projectTaskReviewResponseSchema } },
  handler: ({ serviceContext, params }) =>
    getProjectTaskReview(serviceContext, params.projectId, params.taskId),
});

addRoute(app, "post", "/:projectId/issue-imports/preview", {
  auth: true,
  tags: ["projects", "tasks"],
  summary: "Read an external issue for task import",
  paramSchema: projectParams,
  bodySchema: issueLocatorSchema,
  responses: {
    200: { description: "Issue snapshot and existing import", schema: issuePreviewResponseSchema },
  },
  handler: ({ serviceContext, params, body }) =>
    previewProjectIssue(serviceContext, params.projectId, body),
});
addRoute(app, "post", "/:projectId/issue-imports", {
  auth: true,
  tags: ["projects", "tasks"],
  summary: "Import an approved issue snapshot into Work",
  paramSchema: projectParams,
  bodySchema: importProjectIssueSchema,
  responses: {
    200: { description: "The imported task", schema: projectIssueImportResponseSchema },
  },
  handler: ({ serviceContext, params, body }) =>
    importProjectIssue(serviceContext, params.projectId, body),
});
addRoute(app, "get", "/:projectId/pr-reviews", {
  auth: true,
  tags: ["projects", "tasks"],
  summary: "List project PR reviews and automatic review policies",
  paramSchema: projectParams,
  responses: { 200: { description: "Project reviews", schema: projectReviewListResponseSchema } },
  handler: ({ serviceContext, params }) => listProjectReviews(serviceContext, params.projectId),
});
addRoute(app, "put", "/:projectId/pr-reviews/policy", {
  auth: true,
  tags: ["projects", "tasks"],
  summary: "Set automatic pull request review policy",
  paramSchema: projectParams,
  bodySchema: reviewPolicyInputSchema,
  responses: {
    200: { description: "Saved automatic review policy", schema: reviewPolicyResponseSchema },
  },
  handler: ({ serviceContext, params, body }) =>
    setProjectReviewPolicy(serviceContext, params.projectId, body),
});
addRoute(app, "post", "/:projectId/pr-reviews", {
  auth: true,
  tags: ["projects", "tasks"],
  summary: "Start a review of the current pull request revision",
  paramSchema: projectParams,
  bodySchema: pullRequestLocatorSchema,
  responses: {
    200: { description: "Admitted PR review", schema: createPullRequestReviewResponseSchema },
  },
  handler: ({ serviceContext, params, body }) =>
    startPullRequestReview(serviceContext, params.projectId, body),
});
addRoute(app, "post", "/:projectId/pr-reviews/:reviewId/prepare-publication", {
  auth: true,
  tags: ["projects", "tasks"],
  summary: "Prepare a governed review output for human publication",
  paramSchema: reviewParams,
  responses: {
    200: { description: "Review publication preview", schema: preparedReviewPublicationSchema },
  },
  handler: ({ serviceContext, params }) =>
    prepareReviewPublication(serviceContext, params.projectId, params.reviewId),
});
addRoute(app, "post", "/:projectId/pr-reviews/:reviewId/publish", {
  auth: true,
  tags: ["projects", "tasks"],
  summary: "Publish the explicitly approved review to its exact commit",
  paramSchema: reviewParams,
  bodySchema: publishPullRequestReviewSchema,
  responses: { 200: { description: "Published review", schema: publishedReviewResponseSchema } },
  handler: ({ serviceContext, params, body }) =>
    publishPullRequestReview(serviceContext, params.projectId, params.reviewId, body),
});

addRoute(app, "post", "/:projectId/pr-reviews/:reviewId/check-publication", {
  auth: true,
  tags: ["projects", "tasks"],
  summary: "Reconcile an uncertain publication without external writes",
  paramSchema: reviewParams,
  responses: {
    200: { description: "Current publication state", schema: publishedReviewResponseSchema },
  },
  handler: ({ serviceContext, params }) =>
    reconcileReviewPublication(serviceContext, params.projectId, params.reviewId),
});
export default app;
