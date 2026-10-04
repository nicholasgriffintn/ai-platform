import {
  importProjectIssue,
  listProjectReviews,
  getProjectTaskReview,
  prepareReviewPublication,
  previewProjectIssue,
  publishPullRequestReview,
  reconcileReviewPublication,
  setGithubReviewPolicy,
  startPullRequestReview,
} from "@ngriffin_uk/polychat-library-client";
import type {
  GithubReviewPolicyInput,
  ImportProjectIssueInput,
  IssueLocator,
  PullRequestLocator,
  PublishPullRequestReviewInput,
} from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useProjectTaskReview(projectId: string, taskId: string) {
  return useQuery({
    queryKey: ["project-task-pr-review", projectId, taskId],
    queryFn: () => getProjectTaskReview(projectId, taskId),
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });
}

export function useProjectReviews(projectId: string) {
  return useQuery({
    queryKey: ["project-pr-reviews", projectId],
    queryFn: () => listProjectReviews(projectId),
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });
}

export function useProjectTaskIntegrations(projectId: string) {
  const cache = useQueryClient();
  const refresh = async () => {
    await Promise.all([
      cache.invalidateQueries({ queryKey: ["project-pr-reviews", projectId] }),
      cache.invalidateQueries({ queryKey: ["project-task-pr-review", projectId] }),
      cache.invalidateQueries({ queryKey: ["project-tasks", projectId] }),
      cache.invalidateQueries({ queryKey: ["sources"] }),
      cache.invalidateQueries({ queryKey: ["outputs"] }),
    ]);
  };

  const preview = useMutation({
    mutationFn: (locator: IssueLocator) => previewProjectIssue(projectId, locator),
  });
  const importIssue = useMutation({
    mutationFn: (input: ImportProjectIssueInput) => importProjectIssue(projectId, input),
    onSettled: refresh,
  });
  const savePolicy = useMutation({
    mutationFn: (input: GithubReviewPolicyInput) => setGithubReviewPolicy(projectId, input),
    onSettled: refresh,
  });
  const startReview = useMutation({
    mutationFn: (locator: PullRequestLocator) => startPullRequestReview(projectId, locator),
    onSettled: refresh,
  });
  const prepare = useMutation({
    mutationFn: (reviewId: string) => prepareReviewPublication(projectId, reviewId),
    onSettled: () => cache.invalidateQueries({ queryKey: ["outputs"] }),
  });
  const publish = useMutation({
    mutationFn: ({ reviewId, input }: { reviewId: string; input: PublishPullRequestReviewInput }) =>
      publishPullRequestReview(projectId, reviewId, input),
    onSettled: refresh,
  });
  const checkPublication = useMutation({
    mutationFn: (reviewId: string) => reconcileReviewPublication(projectId, reviewId),
    onSettled: refresh,
  });

  return {
    preview,
    importIssue,
    savePolicy,
    startReview,
    prepare,
    publish,
    checkPublication,
  };
}
