import {
  issuePreviewResponseSchema,
  projectIssueImportResponseSchema,
  projectReviewListResponseSchema,
  projectTaskReviewResponseSchema,
  reviewPolicyResponseSchema,
  createPullRequestReviewResponseSchema,
  preparedReviewPublicationSchema,
  publishedReviewResponseSchema,
  type IssueLocator,
  type ImportProjectIssueInput,
  type PullRequestLocator,
  type ReviewPolicyInput,
  type PublishPullRequestReviewInput,
} from "@ngriffin_uk/polychat-schemas";

import { apiService } from "./api-service.js";
import { fetchApiOrThrow } from "./fetch-wrapper.js";
import { returnFetchedData } from "./http.js";

export async function previewProjectIssue(projectId: string, locator: IssueLocator) {
  const response = await fetchApiOrThrow(`/projects/${projectId}/issue-imports/preview`, {
    method: "POST",
    headers: await apiService.getHeaders(),
    body: locator,
  });

  return issuePreviewResponseSchema.parse(await returnFetchedData(response));
}

export async function importProjectIssue(projectId: string, input: ImportProjectIssueInput) {
  const response = await fetchApiOrThrow(`/projects/${projectId}/issue-imports`, {
    method: "POST",
    headers: await apiService.getHeaders(),
    body: input,
  });

  return projectIssueImportResponseSchema.parse(await returnFetchedData(response));
}

export async function listProjectReviews(projectId: string) {
  const response = await fetchApiOrThrow(`/projects/${projectId}/pr-reviews`, {
    method: "GET",
    headers: await apiService.getHeaders(),
  });

  return projectReviewListResponseSchema.parse(await returnFetchedData(response));
}

export async function getProjectTaskReview(projectId: string, taskId: string) {
  const response = await fetchApiOrThrow(`/projects/${projectId}/tasks/${taskId}/pr-review`, {
    method: "GET",
    headers: await apiService.getHeaders(),
  });

  return projectTaskReviewResponseSchema.parse(await returnFetchedData(response));
}

export async function setProjectReviewPolicy(projectId: string, input: ReviewPolicyInput) {
  const response = await fetchApiOrThrow(`/projects/${projectId}/pr-reviews/policy`, {
    method: "PUT",
    headers: await apiService.getHeaders(),
    body: input,
  });

  return reviewPolicyResponseSchema.parse(await returnFetchedData(response));
}

export async function startPullRequestReview(projectId: string, locator: PullRequestLocator) {
  const response = await fetchApiOrThrow(`/projects/${projectId}/pr-reviews`, {
    method: "POST",
    headers: await apiService.getHeaders(),
    body: locator,
  });

  return createPullRequestReviewResponseSchema.parse(await returnFetchedData(response));
}

export async function prepareReviewPublication(projectId: string, reviewId: string) {
  const response = await fetchApiOrThrow(
    `/projects/${projectId}/pr-reviews/${reviewId}/prepare-publication`,
    { method: "POST", headers: await apiService.getHeaders() },
  );

  return preparedReviewPublicationSchema.parse(await returnFetchedData(response));
}

export async function publishPullRequestReview(
  projectId: string,
  reviewId: string,
  input: PublishPullRequestReviewInput,
) {
  const response = await fetchApiOrThrow(`/projects/${projectId}/pr-reviews/${reviewId}/publish`, {
    method: "POST",
    headers: await apiService.getHeaders(),
    body: input,
  });

  return publishedReviewResponseSchema.parse(await returnFetchedData(response));
}

export async function reconcileReviewPublication(projectId: string, reviewId: string) {
  const response = await fetchApiOrThrow(
    `/projects/${projectId}/pr-reviews/${reviewId}/check-publication`,
    { method: "POST", headers: await apiService.getHeaders() },
  );

  return publishedReviewResponseSchema.parse(await returnFetchedData(response));
}
