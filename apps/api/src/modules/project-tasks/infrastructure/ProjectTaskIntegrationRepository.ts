import {
  reviewPolicySchema,
  pullRequestReviewSchema,
  type ReviewPolicy,
  type PullRequestReview,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";

import { REVIEW_POLICY_COLUMNS } from "~/infrastructure/database/accessStorage";
import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import { sourceResourceSql } from "~/infrastructure/database/resource-storage";
import { publishResourceEvent } from "~/modules/sync/application/resource-events";

export interface ExternalTaskImport {
  id: string;
  workspace_id: string;
  project_id: string;
  owner_user_id: number;
  task_id: string;
  source_id: string;
  provider: string;
  account_id: string;
  external_id: string;
}

interface ReviewRow {
  id: string;
  workspace_id: string;
  project_id: string;
  owner_user_id: number;
  task_id: string;
  source_id: string;
  target: string;
  policy_id: string | null;
  policy_revision: string | null;
  publication_status: PullRequestReview["publicationStatus"];
  publication_body: string | null;
  published_url: string | null;
  created_at: string;
}

interface PolicyRow {
  id: string;
  workspace_id: string;
  project_id: string;
  owner_user_id: number;
  provider: string;
  connection_id: string;
  account_id: string;
  repository: string;
  enabled: number;
  token_budget: number;
  revision: string;
}

export class ProjectTaskIntegrationRepository extends BaseRepository {
  async getImport(id: string, projectId: string): Promise<ExternalTaskImport | null> {
    return this.runQuery<ExternalTaskImport>(
      "SELECT i.* FROM project_task_integration i JOIN project p ON p.id = i.project_id AND p.workspace_id = i.workspace_id WHERE i.kind = 'import' AND i.id = ? AND i.project_id = ?",
      [id, projectId],
      true,
    );
  }

  async recordImport(input: ExternalTaskImport): Promise<boolean> {
    const result = await this.executeRun(
      `INSERT INTO project_task_integration (kind, id, workspace_id, project_id, owner_user_id, task_id, source_id, provider, account_id, external_id)
       SELECT 'import', ?, p.workspace_id, p.id, ?, t.id, s.id, ?, ?, ?
       FROM project p JOIN project_task t ON t.project_id = p.id AND t.workspace_id = p.workspace_id
       JOIN ${sourceResourceSql} s ON s.project_id = p.id
       WHERE p.id = ? AND p.workspace_id = ? AND t.id = ? AND t.created_by_user_id = ? AND s.id = ?
       ON CONFLICT(kind, id) DO NOTHING`,
      [
        input.id,
        input.owner_user_id,
        input.provider,
        input.account_id,
        input.external_id,
        input.project_id,
        input.workspace_id,
        input.task_id,
        input.owner_user_id,
        input.source_id,
      ],
    );

    return result.meta.changes === 1;
  }

  async getPolicy(id: string, projectId: string): Promise<ReviewPolicy | null> {
    const row = await this.runQuery<PolicyRow>(
      `SELECT ${REVIEW_POLICY_COLUMNS} FROM scoped_configuration r JOIN project p ON p.id = r.project_id AND p.workspace_id = r.workspace_id WHERE r.kind = 'review_policy' AND r.id = ? AND r.project_id = ?`,
      [id, projectId],
      true,
    );

    return row ? this.formatPolicy(row) : null;
  }

  async listProjectPolicies(projectId: string): Promise<ReviewPolicy[]> {
    const rows = await this.runQuery<PolicyRow>(
      `SELECT ${REVIEW_POLICY_COLUMNS} FROM scoped_configuration r JOIN project p ON p.id = r.project_id AND p.workspace_id = r.workspace_id WHERE r.kind = 'review_policy' AND r.project_id = ? ORDER BY r.target_kind, r.target_id, r.owner_user_id`,
      [projectId],
    );

    return rows.map((row) => this.formatPolicy(row));
  }

  async setPolicy(policy: ReviewPolicy): Promise<void> {
    const result = await this.executeRun(
      `INSERT INTO scoped_configuration (kind, id, workspace_id, project_id, owner_user_id, target_kind, connection_id, account_id, target_id, enabled, payload, revision)
       SELECT 'review_policy', ?, p.workspace_id, p.id, c.user_id, c.provider, c.id, ?, ?, ?, json_object('token_budget', ?), ?
       FROM project p JOIN provider_connection c ON c.id = ? AND c.user_id = ? AND c.provider = ?
       WHERE p.id = ? AND p.workspace_id = ? AND (c.status = 'connected' OR ? = 0)
       ON CONFLICT(kind, id) DO UPDATE SET enabled = excluded.enabled, payload = excluded.payload, revision = excluded.revision
       WHERE scoped_configuration.workspace_id = excluded.workspace_id
         AND scoped_configuration.project_id = excluded.project_id
         AND scoped_configuration.owner_user_id = excluded.owner_user_id
         AND scoped_configuration.target_kind = excluded.target_kind
         AND scoped_configuration.connection_id = excluded.connection_id
         AND scoped_configuration.account_id = excluded.account_id
         AND scoped_configuration.target_id = excluded.target_id`,
      [
        policy.id,
        policy.accountId,
        policy.repository,
        Number(policy.enabled),
        policy.tokenBudget,
        policy.revision,
        policy.connectionId,
        policy.ownerUserId,
        policy.provider,
        policy.projectId,
        policy.workspaceId,
        Number(policy.enabled),
      ],
    );

    if (result.meta.changes !== 1) {
      throw new AssistantError(
        "Review policy scope or connection changed",
        ErrorType.CONFLICT_ERROR,
        409,
      );
    }

    await publishResourceEvent(
      { env: this.env },
      { kind: "project", projectId: policy.projectId },
      "project_review.changed",
    );
  }

  async listPolicies(
    provider: string,
    accountId: string,
    repository: string,
  ): Promise<ReviewPolicy[]> {
    const rows = await this.runQuery<PolicyRow>(
      `SELECT ${REVIEW_POLICY_COLUMNS} FROM scoped_configuration r
       JOIN project p ON p.id = r.project_id AND p.workspace_id = r.workspace_id
       JOIN provider_connection c ON c.id = r.connection_id AND c.user_id = r.owner_user_id AND c.provider = r.target_kind
       WHERE r.kind = 'review_policy' AND r.target_kind = ? AND r.account_id = ? AND r.target_id = ? AND r.enabled = 1 AND c.status = 'connected'`,
      [provider, accountId, repository],
    );

    return rows.map((row) => this.formatPolicy(row));
  }

  private formatPolicy(row: PolicyRow): ReviewPolicy {
    return reviewPolicySchema.parse({
      id: row.id,
      workspaceId: row.workspace_id,
      projectId: row.project_id,
      ownerUserId: row.owner_user_id,
      provider: row.provider,
      connectionId: row.connection_id,
      accountId: row.account_id,
      repository: row.repository,
      enabled: row.enabled === 1,
      tokenBudget: row.token_budget,
      revision: row.revision,
    });
  }

  async getReview(id: string, projectId: string): Promise<PullRequestReview | null> {
    const row = await this.runQuery<ReviewRow>(
      "SELECT r.* FROM project_task_integration r JOIN project p ON p.id = r.project_id AND p.workspace_id = r.workspace_id WHERE r.kind = 'review' AND r.id = ? AND r.project_id = ?",
      [id, projectId],
      true,
    );

    return row ? this.formatReview(row) : null;
  }

  async getReviewForTask(taskId: string, projectId: string): Promise<PullRequestReview | null> {
    const row = await this.runQuery<ReviewRow>(
      "SELECT r.* FROM project_task_integration r JOIN project p ON p.id = r.project_id AND p.workspace_id = r.workspace_id WHERE r.kind = 'review' AND r.task_id = ? AND r.project_id = ?",
      [taskId, projectId],
      true,
    );

    return row ? this.formatReview(row) : null;
  }

  async listReviews(projectId: string): Promise<PullRequestReview[]> {
    const rows = await this.runQuery<ReviewRow>(
      "SELECT r.* FROM project_task_integration r JOIN project p ON p.id = r.project_id AND p.workspace_id = r.workspace_id WHERE r.kind = 'review' AND r.project_id = ? ORDER BY r.created_at DESC LIMIT 100",
      [projectId],
    );

    return rows.map((row) => this.formatReview(row));
  }

  private formatReview(row: ReviewRow): PullRequestReview {
    return pullRequestReviewSchema.parse({
      id: row.id,
      workspaceId: row.workspace_id,
      projectId: row.project_id,
      ownerUserId: row.owner_user_id,
      taskId: row.task_id,
      sourceId: row.source_id,
      target: safeParseJson(row.target),
      policyId: row.policy_id,
      policyRevision: row.policy_revision,
      publicationStatus: row.publication_status,
      publishedUrl: row.published_url,
      createdAt: row.created_at,
    });
  }

  async recordReview(
    review: Omit<PullRequestReview, "publicationStatus" | "publishedUrl" | "createdAt">,
  ): Promise<boolean> {
    const result = await this.executeRun(
      `INSERT INTO project_task_integration (kind, id, workspace_id, project_id, owner_user_id, task_id, source_id, target, policy_id, policy_revision)
       SELECT 'review', ?, p.workspace_id, p.id, ?, t.id, s.id, ?, ?, ?
       FROM project p JOIN project_task t ON t.project_id = p.id AND t.workspace_id = p.workspace_id
       JOIN ${sourceResourceSql} s ON s.project_id = p.id
       WHERE p.id = ? AND p.workspace_id = ? AND t.id = ? AND t.created_by_user_id = ? AND s.id = ?
       ON CONFLICT(kind, id) DO NOTHING`,
      [
        review.id,
        review.ownerUserId,
        JSON.stringify(review.target),
        review.policyId,
        review.policyRevision,
        review.projectId,
        review.workspaceId,
        review.taskId,
        review.ownerUserId,
        review.sourceId,
      ],
    );

    if (result.meta.changes === 1) {
      await publishResourceEvent(
        { env: this.env },
        { kind: "project", projectId: review.projectId },
        "project_review.changed",
      );
    }

    return result.meta.changes === 1;
  }

  async claimPublication(
    id: string,
    projectId: string,
    completionId: string,
    body: string,
  ): Promise<boolean> {
    const result = await this.executeRun(
      `UPDATE project_task_integration
       SET publication_status = 'publishing', publication_body = ?
       WHERE kind = 'review' AND id = ? AND project_id = ? AND publication_status = 'unpublished'
         AND EXISTS (
           SELECT 1 FROM project_task
           WHERE project_task.id = project_task_integration.task_id AND project_task.project_id = project_task_integration.project_id
             AND project_task.workspace_id = project_task_integration.workspace_id
             AND project_task.status IN ('review', 'done')
             AND json_extract(project_task.completions, '$[#-1].id') = ?
         )`,
      [body, id, projectId, completionId],
    );

    if (result.meta.changes === 1) {
      await publishResourceEvent(
        { env: this.env },
        { kind: "project", projectId: projectId },
        "project_review.changed",
      );
    }

    return result.meta.changes === 1;
  }

  async settlePublication(id: string, projectId: string, url: string | null): Promise<void> {
    await this.executeRun(
      "UPDATE project_task_integration SET publication_status = ?, published_url = ? WHERE kind = 'review' AND id = ? AND project_id = ? AND publication_status IN ('publishing', 'unknown')",
      [url ? "published" : "unknown", url, id, projectId],
    );
    await publishResourceEvent(
      { env: this.env },
      { kind: "project", projectId: projectId },
      "project_review.changed",
    );
  }

  async releasePublication(id: string, projectId: string, body: string): Promise<void> {
    await this.executeRun(
      "UPDATE project_task_integration SET publication_status = 'unpublished', publication_body = NULL WHERE kind = 'review' AND id = ? AND project_id = ? AND publication_status = 'publishing' AND publication_body = ?",
      [id, projectId, body],
    );
    await publishResourceEvent(
      { env: this.env },
      { kind: "project", projectId: projectId },
      "project_review.changed",
    );
  }

  async getPublicationBody(id: string, projectId: string): Promise<string | null> {
    const row = await this.runQuery<{ publication_body: string | null }>(
      "SELECT publication_body FROM project_task_integration WHERE kind = 'review' AND id = ? AND project_id = ?",
      [id, projectId],
      true,
    );

    return row?.publication_body ?? null;
  }
}
