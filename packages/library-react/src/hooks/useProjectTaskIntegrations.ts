import {
  importProjectIssue,
  listProjectReviews,
  getProjectTaskReview,
  prepareReviewPublication,
  previewProjectIssue,
  publishPullRequestReview,
  reconcileReviewPublication,
  setProjectReviewPolicy,
  startPullRequestReview,
  useChatStore,
} from "@ngriffin_uk/polychat-library-client";
import type {
  ReviewPolicyInput,
  ImportProjectIssueInput,
  IssueLocator,
  PullRequestLocator,
  PublishPullRequestReviewInput,
} from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useLiveOrPoll } from "../sync/live-or-poll.js";
import { OUTPUT_QUERY_KEYS } from "./useOutputs.js";
import {
  projectTaskDetailQueryPrefix,
  projectTasksQueryKey,
  TASK_ATTENTION_QUERY_KEY,
} from "./useProjectTasks.js";
import { SOURCE_QUERY_KEYS } from "./useSources.js";

export function useProjectTaskReview(projectId: string, taskId: string) {
  const liveOrPoll = useLiveOrPoll();
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const isPro = useChatStore((state) => state.isPro);

  return useQuery({
    queryKey: ["project-task-pr-review", projectId, taskId],
    queryFn: () => getProjectTaskReview(projectId, taskId),
    enabled: Boolean(projectId && taskId) && isAuthenticated && isPro,
    refetchInterval: (query) => liveOrPoll(query, 30_000, "project_review.changed"),
    refetchIntervalInBackground: false,
  });
}

export function useProjectReviews(projectId: string) {
  const liveOrPoll = useLiveOrPoll();
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const isPro = useChatStore((state) => state.isPro);

  return useQuery({
    queryKey: ["project-pr-reviews", projectId],
    queryFn: () => listProjectReviews(projectId),
    enabled: Boolean(projectId) && isAuthenticated && isPro,
    refetchInterval: (query) => liveOrPoll(query, 30_000, "project_review.changed"),
    refetchIntervalInBackground: false,
  });
}

export function useProjectTaskIntegrations(projectId: string) {
  const cache = useQueryClient();
  const refreshReviews = async () => {
    await Promise.all([
      cache.invalidateQueries({ queryKey: ["project-pr-reviews", projectId] }),
      cache.invalidateQueries({ queryKey: ["project-task-pr-review", projectId] }),
    ]);
  };

  const refreshIntake = async () => {
    await Promise.all([
      cache.invalidateQueries({ queryKey: projectTasksQueryKey(projectId) }),
      cache.invalidateQueries({ queryKey: projectTaskDetailQueryPrefix(projectId) }),
      cache.invalidateQueries({ queryKey: TASK_ATTENTION_QUERY_KEY }),
      cache.invalidateQueries({ queryKey: SOURCE_QUERY_KEYS.all }),
    ]);
  };

  const preview = useMutation({
    mutationFn: (locator: IssueLocator) => previewProjectIssue(projectId, locator),
  });
  const importIssue = useMutation({
    mutationFn: (input: ImportProjectIssueInput) => importProjectIssue(projectId, input),
    onSettled: refreshIntake,
  });
  const savePolicy = useMutation({
    mutationFn: (input: ReviewPolicyInput) => setProjectReviewPolicy(projectId, input),
    onSettled: refreshReviews,
  });
  const startReview = useMutation({
    mutationFn: (locator: PullRequestLocator) => startPullRequestReview(projectId, locator),
    onSettled: () => Promise.all([refreshIntake(), refreshReviews()]),
  });
  const prepare = useMutation({
    mutationFn: (reviewId: string) => prepareReviewPublication(projectId, reviewId),
    onSettled: () =>
      cache.invalidateQueries({ queryKey: OUTPUT_QUERY_KEYS.listsByProject(projectId) }),
  });
  const publish = useMutation({
    mutationFn: ({ reviewId, input }: { reviewId: string; input: PublishPullRequestReviewInput }) =>
      publishPullRequestReview(projectId, reviewId, input),
    onSettled: () =>
      Promise.all([
        refreshReviews(),
        cache.invalidateQueries({ queryKey: OUTPUT_QUERY_KEYS.listsByProject(projectId) }),
      ]),
  });
  const checkPublication = useMutation({
    mutationFn: (reviewId: string) => reconcileReviewPublication(projectId, reviewId),
    onSettled: refreshReviews,
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
