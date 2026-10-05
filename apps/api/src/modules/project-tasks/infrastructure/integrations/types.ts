import type {
  IssueLocator,
  IssueSnapshot,
  PullRequestLocator,
  PullRequestReviewTarget,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

export interface IssueCapture {
  readonly fields: Omit<IssueSnapshot, "revision" | "capturedAt">;
  readonly upstreamRevision: string;
}

export interface CapturedReview {
  readonly target: PullRequestReviewTarget;
  readonly title: string;
  readonly url: string;
  readonly content: string;
  readonly omitted: readonly string[];
  readonly unavailableCount: number;
}

export interface TaskReviewClient {
  readonly connectionId: string;
  readonly canAutomate: boolean;
  readonly repository: string;
  captureReview(
    locator: PullRequestLocator,
    expectedTarget?: PullRequestReviewTarget,
  ): Promise<CapturedReview>;
  assertCurrentTarget(target: PullRequestReviewTarget): Promise<void>;
  publishReview(target: PullRequestReviewTarget, body: string): Promise<string>;
  findPublication(target: PullRequestReviewTarget, body: string): Promise<string | null>;
}

export interface TaskIntegrationAdapter {
  readonly provider: string;
  readonly readIssue?: (
    context: ServiceContext,
    projectId: string,
    locator: IssueLocator,
  ) => Promise<IssueCapture>;
  readonly connectReview?: (
    context: ServiceContext,
    locator: Omit<PullRequestLocator, "pullRequestNumber">,
  ) => Promise<TaskReviewClient>;
}
