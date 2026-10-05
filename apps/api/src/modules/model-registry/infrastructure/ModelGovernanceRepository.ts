import type {
  EvidenceKind,
  EvidenceSource,
  EvidenceStatus,
  ModelDecisionState,
  ModelGovernanceEnforcement,
  PolicyRule,
  PolicyVerdict,
} from "@ngriffin_uk/polychat-schemas";
import { chunkArray, generateId } from "@ngriffin_uk/polychat-utility-core";
import { and, desc, eq, getTableColumns, inArray, isNull, lte, or, sql } from "drizzle-orm";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import {
  type ModelPolicyRecord,
  modelPolicy,
  type ModelEvidenceRecord,
  modelEvidence,
  type ModelDecisionRecord,
  modelDecision,
  modelDecisionChanges,
  modelDecisionValues,
  modelPolicyRevisionValues,
  modelPolicyValues,
  modelPolicyChanges,
  modelEvidenceValues,
} from "~/infrastructure/database/model-storage";
import { modelConfiguration, modelRecord, approval } from "~/infrastructure/database/schema";
import type { IEnv } from "~/types";

export type { ModelEvidenceRecord } from "~/infrastructure/database/model-storage";
export type { ModelPolicyRecord } from "~/infrastructure/database/model-storage";
export type { ModelDecisionRecord } from "~/infrastructure/database/model-storage";

export const WORKSPACE_POLICY_SCOPE_KEY = "workspace";
const DECISION_LIST_LIMIT = 500;

export interface AddEvidenceInput {
  versionId: string;
  routeId?: string | null;
  kind: EvidenceKind;
  source: EvidenceSource;
  status: EvidenceStatus;
  summary: string;
  details?: Record<string, unknown>;
}

export class ModelGovernanceRepository extends BaseRepository<Pick<IEnv, "DB">> {
  async addEvidence(inputs: AddEvidenceInput[]): Promise<ModelEvidenceRecord[]> {
    if (inputs.length === 0) {
      return [];
    }

    const now = new Date().toISOString();
    const inserts = chunkArray(
      inputs,
      BaseRepository.rowsPerInsert(Object.keys(getTableColumns(modelRecord)).length + 4),
    ).map((page) =>
      this.database
        .insert(modelRecord)
        .values(
          page.map((input) =>
            modelEvidenceValues({
              id: generateId(),
              version_id: input.versionId,
              route_id: input.routeId ?? null,
              kind: input.kind,
              source: input.source,
              status: input.status,
              summary: input.summary,
              details: input.details ?? {},
              observed_at: now,
            }),
          ),
        )
        .returning(modelEvidence),
    );
    const [first, ...rest] = inserts;

    return (await this.database.batch([first, ...rest])).flat();
  }

  async listEvidence(versionIds: string[]): Promise<ModelEvidenceRecord[]> {
    const records = await this.selectInChunks(versionIds, (page) =>
      this.database
        .select(modelEvidence)
        .from(modelRecord)
        .where(and(eq(modelRecord.kind, "evidence"), inArray(modelEvidence.version_id, page))),
    );

    return records.sort((left, right) => right.observed_at.localeCompare(left.observed_at));
  }

  async getPolicy(workspaceId: string, scopeKey: string): Promise<ModelPolicyRecord | null> {
    const [record] = await this.database
      .select(modelPolicy)
      .from(modelConfiguration)
      .where(
        and(
          eq(modelConfiguration.kind, "policy"),
          and(eq(modelPolicy.workspace_id, workspaceId), eq(modelPolicy.scope_key, scopeKey)),
        ),
      )
      .limit(1);

    return record ?? null;
  }

  async listPolicies(workspaceId: string): Promise<ModelPolicyRecord[]> {
    return this.database
      .select(modelPolicy)
      .from(modelConfiguration)
      .where(and(eq(modelConfiguration.kind, "policy"), eq(modelPolicy.workspace_id, workspaceId)));
  }

  async savePolicy(input: {
    workspaceId: string;
    projectId: string | null;
    rules: PolicyRule[];
    hash: string;
    enforcement: ModelGovernanceEnforcement;
    updatedBy: number;
  }): Promise<ModelPolicyRecord> {
    const scopeKey = input.projectId ?? WORKSPACE_POLICY_SCOPE_KEY;
    const existing = await this.getPolicy(input.workspaceId, scopeKey);
    const now = new Date().toISOString();

    if (existing && existing.hash === input.hash && existing.enforcement === input.enforcement) {
      return existing;
    }

    const id = existing?.id ?? generateId();
    const revision = (existing?.revision ?? 0) + 1;
    const values = {
      rules: input.rules,
      revision,
      hash: input.hash,
      enforcement: input.enforcement,
      updated_by: input.updatedBy,
      updated_at: now,
    };
    const write = existing
      ? this.database
          .update(modelConfiguration)
          .set(modelPolicyChanges(values))
          .where(and(eq(modelConfiguration.kind, "policy"), eq(modelPolicy.id, id)))
          .returning(modelPolicy)
      : this.database
          .insert(modelConfiguration)
          .values(
            modelPolicyValues({
              id,
              workspace_id: input.workspaceId,
              project_id: input.projectId,
              scope_key: scopeKey,
              ...values,
            }),
          )
          .returning(modelPolicy);
    const [[record]] = await this.database.batch([
      write,
      this.database.insert(modelRecord).values(
        modelPolicyRevisionValues({
          policy_id: id,
          revision,
          hash: input.hash,
          rules: input.rules,
          enforcement: input.enforcement,
          created_by: input.updatedBy,
        }),
      ),
    ]);

    return record;
  }

  async createDecision(input: {
    workspaceId: string;
    projectId: string | null;
    versionId: string;
    routeId: string | null;
    state: ModelDecisionState;
    verdict: PolicyVerdict;
    evidenceIds: string[];
    isException: boolean;
    note: string | null;
    requestedBy: number | null;
    decidedBy?: number | null;
  }): Promise<ModelDecisionRecord> {
    const [record] = await this.database
      .insert(approval)
      .values(
        modelDecisionValues({
          id: generateId(),
          workspace_id: input.workspaceId,
          project_id: input.projectId,
          version_id: input.versionId,
          route_id: input.routeId,
          state: input.state,
          verdict: input.verdict,
          evidence_ids: input.evidenceIds,
          is_exception: input.isException,
          note: input.note,
          requested_by: input.requestedBy,
          decided_by: input.decidedBy ?? null,
          decided_at: input.state === "pending" ? null : new Date().toISOString(),
        }),
      )
      .returning(modelDecision);

    return record;
  }

  async getDecision(workspaceId: string, decisionId: string): Promise<ModelDecisionRecord | null> {
    const [record] = await this.database
      .select(modelDecision)
      .from(approval)
      .where(
        and(
          eq(approval.kind, "decision"),
          and(eq(modelDecision.workspace_id, workspaceId), eq(modelDecision.id, decisionId)),
        ),
      )
      .limit(1);

    return record ?? null;
  }

  async listDecisions(
    workspaceId: string,
    filters: { state?: ModelDecisionState; projectId?: string; versionIds?: string[] } = {},
  ): Promise<ModelDecisionRecord[]> {
    const conditions = [eq(modelDecision.workspace_id, workspaceId)];

    if (filters.state) {
      conditions.push(eq(modelDecision.state, filters.state));
    }

    if (filters.projectId) {
      conditions.push(eq(modelDecision.project_id, filters.projectId));
    }

    const select = (versionIds?: string[]) =>
      this.database
        .select(modelDecision)
        .from(approval)
        .where(
          and(
            eq(approval.kind, "decision"),
            and(
              ...conditions,
              ...(versionIds ? [inArray(modelDecision.version_id, versionIds)] : []),
            ),
          ),
        )
        .orderBy(
          desc(sql`coalesce(${modelDecision.decided_at}, ${modelDecision.created_at})`),
          desc(sql`rowid`),
        )
        .limit(DECISION_LIST_LIMIT);

    if (!filters.versionIds) {
      return select();
    }

    const records = await this.selectInChunks(filters.versionIds, select);

    return records
      .sort((left, right) =>
        (right.decided_at ?? right.created_at).localeCompare(left.decided_at ?? left.created_at),
      )
      .slice(0, DECISION_LIST_LIMIT);
  }

  async resolveDecision(input: {
    decisionId: string;
    state: ModelDecisionState;
    decidedBy: number;
    note: string | null;
    conditions: string | null;
    expiresAt: string | null;
    verdict?: PolicyVerdict;
    evidenceIds?: string[];
  }): Promise<ModelDecisionRecord | null> {
    const [record] = await this.database
      .update(approval)
      .set(
        modelDecisionChanges({
          state: input.state,
          decided_by: input.decidedBy,
          decided_at: new Date().toISOString(),
          note: input.note,
          conditions: input.conditions,
          expires_at: input.expiresAt,
          ...(input.verdict ? { verdict: input.verdict } : {}),
          ...(input.evidenceIds ? { evidence_ids: input.evidenceIds } : {}),
        }),
      )
      .where(and(eq(approval.kind, "decision"), eq(modelDecision.id, input.decisionId)))
      .returning(modelDecision);

    return record ?? null;
  }

  async expireDecisions(now: string): Promise<ModelDecisionRecord[]> {
    return this.database
      .update(approval)
      .set(modelDecisionChanges({ state: "expired" }))
      .where(
        and(
          eq(approval.kind, "decision"),
          and(eq(modelDecision.state, "approved"), lte(modelDecision.expires_at, now)),
        ),
      )
      .returning(modelDecision);
  }

  async findActiveApprovals(
    workspaceId: string,
    projectId: string | null,
  ): Promise<ModelDecisionRecord[]> {
    return this.database
      .select(modelDecision)
      .from(approval)
      .where(
        and(
          eq(approval.kind, "decision"),
          and(
            eq(modelDecision.workspace_id, workspaceId),
            eq(modelDecision.state, "approved"),
            projectId
              ? or(eq(modelDecision.project_id, projectId), isNull(modelDecision.project_id))
              : isNull(modelDecision.project_id),
          ),
        ),
      );
  }
}
