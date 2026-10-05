import type { EvalCase, ScoreSummary } from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { and, desc, eq, inArray, isNull, ne, or } from "drizzle-orm";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import {
  modelRoute,
  type ModelEvalSuiteRecord,
  modelEvalSuite,
  type ModelEvalRunRecord,
  modelEvalRun,
  modelEvalRunChanges,
  modelEvalRunValues,
  modelEvalSuiteValues,
} from "~/infrastructure/database/model-storage";
import { modelConfiguration, modelOperation } from "~/infrastructure/database/schema";
import type { IEnv } from "~/types";

export type { ModelEvalSuiteRecord } from "~/infrastructure/database/model-storage";
export type { ModelEvalRunRecord } from "~/infrastructure/database/model-storage";

export class ModelEvalRepository extends BaseRepository<Pick<IEnv, "DB">> {
  async createSuite(input: {
    workspaceId: string;
    projectId: string | null;
    name: string;
    description: string | null;
    systemPrompt: string | null;
    cases: EvalCase[];
    graderIds: string[];
    replaySampleSize: number;
    createdBy: number;
  }): Promise<ModelEvalSuiteRecord> {
    const [record] = await this.database
      .insert(modelConfiguration)
      .values(
        modelEvalSuiteValues({
          id: generateId(),
          workspace_id: input.workspaceId,
          project_id: input.projectId,
          name: input.name,
          description: input.description,
          system_prompt: input.systemPrompt,
          cases: input.cases,
          grader_ids: input.graderIds,
          replay_sample_size: input.replaySampleSize,
          created_by: input.createdBy,
        }),
      )
      .returning(modelEvalSuite);

    return record;
  }

  async getSuite(workspaceId: string, suiteId: string): Promise<ModelEvalSuiteRecord | null> {
    const [record] = await this.database
      .select(modelEvalSuite)
      .from(modelConfiguration)
      .where(
        and(
          eq(modelConfiguration.kind, "suite"),
          and(eq(modelEvalSuite.workspace_id, workspaceId), eq(modelEvalSuite.id, suiteId)),
        ),
      )
      .limit(1);

    return record ?? null;
  }

  async getSuiteById(suiteId: string): Promise<ModelEvalSuiteRecord | null> {
    const [record] = await this.database
      .select(modelEvalSuite)
      .from(modelConfiguration)
      .where(and(eq(modelConfiguration.kind, "suite"), eq(modelEvalSuite.id, suiteId)))
      .limit(1);

    return record ?? null;
  }

  async listSuites(workspaceId: string, projectId?: string): Promise<ModelEvalSuiteRecord[]> {
    return this.database
      .select(modelEvalSuite)
      .from(modelConfiguration)
      .where(
        and(
          eq(modelConfiguration.kind, "suite"),
          and(
            eq(modelEvalSuite.workspace_id, workspaceId),
            projectId
              ? or(eq(modelEvalSuite.project_id, projectId), isNull(modelEvalSuite.project_id))
              : undefined,
          ),
        ),
      )
      .orderBy(desc(modelEvalSuite.updated_at));
  }

  async deleteSuite(workspaceId: string, suiteId: string): Promise<void> {
    await this.database
      .delete(modelConfiguration)
      .where(
        and(
          eq(modelConfiguration.kind, "suite"),
          and(eq(modelEvalSuite.workspace_id, workspaceId), eq(modelEvalSuite.id, suiteId)),
        ),
      );
  }

  async createRun(input: {
    suiteId: string;
    routeId: string;
    versionId: string;
    trigger: ModelEvalRunRecord["trigger"];
    casesTotal: number;
    createdBy: number | null;
  }): Promise<ModelEvalRunRecord> {
    const [record] = await this.database
      .insert(modelOperation)
      .values(
        modelEvalRunValues({
          id: generateId(),
          suite_id: input.suiteId,
          route_id: input.routeId,
          version_id: input.versionId,
          trigger: input.trigger,
          cases_total: input.casesTotal,
          created_by: input.createdBy,
        }),
      )
      .returning(modelEvalRun);

    return record;
  }

  async getRun(runId: string): Promise<ModelEvalRunRecord | null> {
    const [record] = await this.database
      .select(modelEvalRun)
      .from(modelOperation)
      .where(and(eq(modelOperation.kind, "evaluation"), eq(modelEvalRun.id, runId)))
      .limit(1);

    return record ?? null;
  }

  async listRuns(filters: {
    suiteIds?: string[];
    routeIds?: string[];
    versionIds?: string[];
    limit?: number;
  }): Promise<ModelEvalRunRecord[]> {
    const conditions = [];

    if (filters.suiteIds) {
      conditions.push(inArray(modelEvalRun.suite_id, filters.suiteIds));
    }

    if (filters.routeIds) {
      conditions.push(inArray(modelEvalRun.route_id, filters.routeIds));
    }

    if (filters.versionIds) {
      conditions.push(inArray(modelEvalRun.version_id, filters.versionIds));
    }

    if (
      [filters.suiteIds, filters.routeIds, filters.versionIds].some(
        (list) => list !== undefined && list.length === 0,
      )
    ) {
      return [];
    }

    return this.database
      .select(modelEvalRun)
      .from(modelOperation)
      .where(and(eq(modelOperation.kind, "evaluation"), and(...conditions)))
      .orderBy(desc(modelEvalRun.created_at))
      .limit(filters.limit ?? 200);
  }

  async listReplayCandidates(): Promise<Array<{ suiteId: string; routeId: string }>> {
    return this.database
      .selectDistinct({ suiteId: modelEvalRun.suite_id, routeId: modelEvalRun.route_id })
      .from(modelOperation)
      .innerJoin(
        modelConfiguration,
        and(eq(modelConfiguration.kind, "route"), eq(modelRoute.id, modelEvalRun.route_id)),
      )
      .where(
        and(
          eq(modelOperation.kind, "evaluation"),
          and(
            eq(modelEvalRun.status, "completed"),
            ne(modelEvalRun.trigger, "replay"),
            eq(modelRoute.status, "active"),
          ),
        ),
      );
  }

  async latestRunAt(suiteId: string, routeId: string, trigger: "replay"): Promise<string | null> {
    const [record] = await this.database
      .select({ createdAt: modelEvalRun.created_at })
      .from(modelOperation)
      .where(
        and(
          eq(modelOperation.kind, "evaluation"),
          and(
            eq(modelEvalRun.suite_id, suiteId),
            eq(modelEvalRun.route_id, routeId),
            eq(modelEvalRun.trigger, trigger),
          ),
        ),
      )
      .orderBy(desc(modelEvalRun.created_at))
      .limit(1);

    return record?.createdAt ?? null;
  }

  async updateRun(
    runId: string,
    updates: Partial<
      Pick<
        ModelEvalRunRecord,
        | "status"
        | "scores"
        | "latency_p95_ms"
        | "cases_completed"
        | "failure_reason"
        | "completed_at"
      >
    >,
  ): Promise<void> {
    await this.database
      .update(modelOperation)
      .set(modelEvalRunChanges(updates))
      .where(and(eq(modelOperation.kind, "evaluation"), eq(modelEvalRun.id, runId)));
  }

  async updateRunScores(
    runId: string,
    scores: Record<string, ScoreSummary>,
    latencyP95Ms: number | null,
  ): Promise<void> {
    await this.updateRun(runId, {
      status: "completed",
      scores,
      latency_p95_ms: latencyP95Ms,
      completed_at: new Date().toISOString(),
    });
  }

  async latestCompletedRun(suiteId: string, routeId: string): Promise<ModelEvalRunRecord | null> {
    const [record] = await this.database
      .select(modelEvalRun)
      .from(modelOperation)
      .where(
        and(
          eq(modelOperation.kind, "evaluation"),
          and(
            eq(modelEvalRun.suite_id, suiteId),
            eq(modelEvalRun.route_id, routeId),
            eq(modelEvalRun.status, "completed"),
          ),
        ),
      )
      .orderBy(desc(modelEvalRun.completed_at))
      .limit(1);

    return record ?? null;
  }
}
