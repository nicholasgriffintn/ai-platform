import {
  githubReviewPolicySchema,
  pullRequestReviewSchema,
  type GithubReviewPolicy,
  type PullRequestReview,
} from "@ngriffin_uk/polychat-schemas";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";

export interface ExternalTaskImport {
  id: string;
  project_id: string;
  task_id: string;
  source_id: string;
  provider: "github" | "linear";
  account_id: string;
  external_id: string;
  revision: string;
}

interface ReviewRow {
  id: string;
  project_id: string;
  task_id: string;
  source_id: string;
  target: string;
  policy_revision: string;
  publication_status: PullRequestReview["publicationStatus"];
  publication_body: string | null;
  publication_completion_id: string | null;
  published_url: string | null;
  created_at: string;
}

interface PolicyRow {
  project_id: string;
  owner_user_id: number;
  connection_id: string;
  installation_id: number;
  repository: string;
  enabled: number;
  token_budget: number;
  revision: string;
}

export class ProjectTaskIntegrationRepository extends BaseRepository {
  async getImport(id: string): Promise<ExternalTaskImport | null> {
    return this.runQuery<ExternalTaskImport>(
      "SELECT * FROM project_task_external_import WHERE id = ?",
      [id],
      true,
    );
  }

  async recordImport(input: ExternalTaskImport): Promise<void> {
    await this.executeRun(
      "INSERT INTO project_task_external_import (id, project_id, task_id, source_id, provider, account_id, external_id, revision) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING",
      [
        input.id,
        input.project_id,
        input.task_id,
        input.source_id,
        input.provider,
        input.account_id,
        input.external_id,
        input.revision,
      ],
    );
  }

  async getPolicy(projectId: string): Promise<GithubReviewPolicy | null> {
    const row = await this.runQuery<PolicyRow>(
      "SELECT * FROM project_github_review_policy WHERE project_id = ?",
      [projectId],
      true,
    );

    return row ? this.formatPolicy(row) : null;
  }

  async setPolicy(policy: GithubReviewPolicy): Promise<void> {
    await this.executeRun(
      `INSERT INTO project_github_review_policy (project_id, owner_user_id, connection_id, installation_id, repository, enabled, token_budget, revision)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(project_id) DO UPDATE SET owner_user_id = excluded.owner_user_id, connection_id = excluded.connection_id,
       installation_id = excluded.installation_id, repository = excluded.repository, enabled = excluded.enabled,
       token_budget = excluded.token_budget, revision = excluded.revision`,
      [
        policy.projectId,
        policy.ownerUserId,
        policy.connectionId,
        policy.installationId,
        policy.repository,
        Number(policy.enabled),
        policy.tokenBudget,
        policy.revision,
      ],
    );
  }

  async listPolicies(installationId: number, repository: string): Promise<GithubReviewPolicy[]> {
    const rows = await this.runQuery<PolicyRow>(
      "SELECT * FROM project_github_review_policy WHERE installation_id = ? AND repository = ? AND enabled = 1",
      [installationId, repository.toLowerCase()],
    );

    return rows.map((row) => this.formatPolicy(row));
  }

  private formatPolicy(row: PolicyRow): GithubReviewPolicy {
    return githubReviewPolicySchema.parse({
      projectId: row.project_id,
      ownerUserId: row.owner_user_id,
      connectionId: row.connection_id,
      installationId: row.installation_id,
      repository: row.repository,
      enabled: row.enabled === 1,
      tokenBudget: row.token_budget,
      revision: row.revision,
    });
  }

  async getReview(id: string): Promise<PullRequestReview | null> {
    const row = await this.runQuery<ReviewRow>(
      "SELECT * FROM project_pull_request_review WHERE id = ?",
      [id],
      true,
    );

    return row ? this.formatReview(row) : null;
  }

  async getReviewForTask(taskId: string): Promise<PullRequestReview | null> {
    const row = await this.runQuery<ReviewRow>(
      "SELECT * FROM project_pull_request_review WHERE task_id = ?",
      [taskId],
      true,
    );

    return row ? this.formatReview(row) : null;
  }

  async listReviews(projectId: string): Promise<PullRequestReview[]> {
    const rows = await this.runQuery<ReviewRow>(
      "SELECT * FROM project_pull_request_review WHERE project_id = ? ORDER BY created_at DESC LIMIT 100",
      [projectId],
    );

    return rows.map((row) => this.formatReview(row));
  }

  private formatReview(row: ReviewRow): PullRequestReview {
    return pullRequestReviewSchema.parse({
      id: row.id,
      projectId: row.project_id,
      taskId: row.task_id,
      sourceId: row.source_id,
      target: safeParseJson(row.target),
      policyRevision: row.policy_revision,
      publicationStatus: row.publication_status,
      publishedUrl: row.published_url,
      createdAt: row.created_at,
    });
  }

  async recordReview(
    review: Omit<PullRequestReview, "publicationStatus" | "publishedUrl" | "createdAt">,
  ): Promise<void> {
    await this.executeRun(
      "INSERT INTO project_pull_request_review (id, project_id, task_id, source_id, target, policy_revision) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING",
      [
        review.id,
        review.projectId,
        review.taskId,
        review.sourceId,
        JSON.stringify(review.target),
        review.policyRevision,
      ],
    );
  }

  async claimPublication(id: string, completionId: string, body: string): Promise<boolean> {
    const result = await this.executeRun(
      "UPDATE project_pull_request_review SET publication_status = 'publishing', publication_completion_id = ?, publication_body = ? WHERE id = ? AND publication_status = 'unpublished'",
      [completionId, body, id],
    );

    return result.meta.changes === 1;
  }

  async settlePublication(id: string, url: string | null): Promise<void> {
    await this.executeRun(
      "UPDATE project_pull_request_review SET publication_status = ?, published_url = ? WHERE id = ? AND publication_status IN ('publishing', 'unknown')",
      [url ? "published" : "unknown", url, id],
    );
  }

  async getPublicationBody(id: string): Promise<string | null> {
    const row = await this.runQuery<{ publication_body: string | null }>(
      "SELECT publication_body FROM project_pull_request_review WHERE id = ?",
      [id],
      true,
    );

    return row?.publication_body ?? null;
  }
}
