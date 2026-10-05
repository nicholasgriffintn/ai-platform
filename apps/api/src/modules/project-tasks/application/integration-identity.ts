import type { IssueSnapshot, PullRequestReviewTarget } from "@ngriffin_uk/polychat-schemas";
import { sha256Hex } from "@ngriffin_uk/polychat-utility-core";

export function issueImportIdentity(
  projectId: string,
  ownerUserId: number,
  issue: Pick<IssueSnapshot, "provider" | "accountId" | "externalId">,
): Promise<string> {
  return sha256Hex(
    JSON.stringify([
      "issue-import",
      projectId,
      ownerUserId,
      issue.provider,
      issue.accountId,
      issue.externalId,
    ]),
  );
}

export function reviewIdentity(
  projectId: string,
  target: PullRequestReviewTarget,
  policyRevision: string | null,
): Promise<string> {
  return sha256Hex(
    JSON.stringify([
      "pull-request-review",
      projectId,
      target.provider,
      target.accountId,
      target.connectionId,
      target.repositoryId,
      target.pullRequestNumber,
      target.baseSha.toLowerCase(),
      target.headSha.toLowerCase(),
      policyRevision,
    ]),
  );
}

export function reviewPolicyIdentity(
  projectId: string,
  provider: string,
  connectionId: string,
  repository: string,
): Promise<string> {
  return sha256Hex(
    JSON.stringify(["review-policy", projectId, provider, connectionId, repository]),
  );
}
