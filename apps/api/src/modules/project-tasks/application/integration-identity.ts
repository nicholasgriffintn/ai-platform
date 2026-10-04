import type { IssueSnapshot, PullRequestReviewTarget } from "@ngriffin_uk/polychat-schemas";
import { sha256Hex } from "@ngriffin_uk/polychat-utility-core";

export function issueImportIdentity(
  projectId: string,
  issue: Pick<IssueSnapshot, "provider" | "accountId" | "externalId">,
): Promise<string> {
  return sha256Hex(
    JSON.stringify(["issue-import", projectId, issue.provider, issue.accountId, issue.externalId]),
  );
}

export function reviewIdentity(
  projectId: string,
  target: PullRequestReviewTarget,
  policyRevision: string,
): Promise<string> {
  return sha256Hex(
    JSON.stringify([
      "pull-request-review",
      projectId,
      target.connectionId,
      target.repositoryId,
      target.pullRequestNumber,
      target.baseSha.toLowerCase(),
      target.headSha.toLowerCase(),
      policyRevision,
    ]),
  );
}
