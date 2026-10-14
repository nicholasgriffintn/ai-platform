import type {
  BenchmarkEntrant,
  BenchmarkRunStatus,
  BenchmarkScope,
  BenchmarkVisibility,
} from "@ngriffin_uk/polychat-schemas";
import { benchmarkEntrantKey } from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { and, desc, eq, gte, inArray, isNotNull, notInArray, sql } from "drizzle-orm";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import { benchmarkRun, type BenchmarkRunRecord } from "~/infrastructure/database/schema";
import type { IEnv } from "~/types";

export type { BenchmarkRunRecord } from "~/infrastructure/database/schema";

const ACTIVE_STATUSES: BenchmarkRunStatus[] = ["queued", "running"];
const HUMAN_BOARD_LIMIT = 500;
const OWNER_LIST_LIMIT = 100;
const OFFICIAL_LIST_LIMIT = 3000;

export interface CreateBenchmarkRunInput {
  id?: string;
  benchmarkId: string;
  version: number;
  scope: BenchmarkScope;
  entrant: BenchmarkEntrant;
  ownerUserId: number | null;
  workspaceId: string | null;
  status: BenchmarkRunStatus;
  visibility: BenchmarkVisibility;
  itemsTotal: number;
}

export type BenchmarkRunChanges = Partial<
  Pick<
    BenchmarkRunRecord,
    | "status"
    | "visibility"
    | "share_token"
    | "items_completed"
    | "score"
    | "metrics"
    | "rating"
    | "input_tokens"
    | "output_tokens"
    | "cost_usd"
    | "latency_p50_ms"
    | "failure_reason"
    | "completed_at"
  >
>;

export class BenchmarkRunRepository extends BaseRepository<Pick<IEnv, "DB">> {
  async create(input: CreateBenchmarkRunInput): Promise<BenchmarkRunRecord> {
    const [record] = await this.insertRun(input).returning();

    return record;
  }

  async createOnce(input: CreateBenchmarkRunInput): Promise<BenchmarkRunRecord | null> {
    const [record] = await this.insertRun(input).onConflictDoNothing().returning();

    return record ?? null;
  }

  private insertRun(input: CreateBenchmarkRunInput) {
    return this.database.insert(benchmarkRun).values({
      id: input.id ?? generateId(),
      benchmark_id: input.benchmarkId,
      version: input.version,
      scope: input.scope,
      entrant_key: benchmarkEntrantKey(input.entrant),
      entrant: input.entrant,
      owner_user_id: input.ownerUserId,
      workspace_id: input.workspaceId,
      status: input.status,
      visibility: input.visibility,
      items_total: input.itemsTotal,
      metrics: {},
    });
  }

  async get(id: string): Promise<BenchmarkRunRecord | null> {
    const [record] = await this.database
      .select()
      .from(benchmarkRun)
      .where(eq(benchmarkRun.id, id))
      .limit(1);

    return record ?? null;
  }

  async getStatus(id: string): Promise<BenchmarkRunStatus | null> {
    const [row] = await this.database
      .select({ status: benchmarkRun.status })
      .from(benchmarkRun)
      .where(eq(benchmarkRun.id, id))
      .limit(1);

    return row?.status ?? null;
  }

  async getByShareToken(token: string): Promise<BenchmarkRunRecord | null> {
    const [record] = await this.database
      .select()
      .from(benchmarkRun)
      .where(eq(benchmarkRun.share_token, token))
      .limit(1);

    return record ?? null;
  }

  async listByIds(ids: readonly string[]): Promise<BenchmarkRunRecord[]> {
    return ids.length === 0
      ? []
      : this.database
          .select()
          .from(benchmarkRun)
          .where(inArray(benchmarkRun.id, [...ids]));
  }

  async update(id: string, changes: BenchmarkRunChanges): Promise<void> {
    await this.database.update(benchmarkRun).set(changes).where(eq(benchmarkRun.id, id));
  }

  async claim(id: string): Promise<boolean> {
    const claimed = await this.database
      .update(benchmarkRun)
      .set({ status: "running" })
      .where(and(eq(benchmarkRun.id, id), inArray(benchmarkRun.status, ACTIVE_STATUSES)))
      .returning({ id: benchmarkRun.id });

    return claimed.length > 0;
  }

  async cancel(id: string, reason: string): Promise<boolean> {
    const cancelled = await this.database
      .update(benchmarkRun)
      .set({ status: "cancelled", failure_reason: reason })
      .where(and(eq(benchmarkRun.id, id), inArray(benchmarkRun.status, ACTIVE_STATUSES)))
      .returning({ id: benchmarkRun.id });

    return cancelled.length > 0;
  }

  async requeue(
    id: string,
    options: { ownerUserId?: number; fromCompleted?: boolean } = {},
  ): Promise<boolean> {
    const statuses: BenchmarkRunStatus[] = options.fromCompleted
      ? ["failed", "cancelled", "completed"]
      : ["failed", "cancelled"];
    const requeued = await this.database
      .update(benchmarkRun)
      .set({
        status: "queued",
        failure_reason: null,
        completed_at: null,
        score: null,
        ...(options.ownerUserId === undefined ? {} : { owner_user_id: options.ownerUserId }),
      })
      .where(and(eq(benchmarkRun.id, id), inArray(benchmarkRun.status, statuses)))
      .returning({ id: benchmarkRun.id });

    return requeued.length > 0;
  }

  async delete(id: string): Promise<void> {
    await this.database.delete(benchmarkRun).where(eq(benchmarkRun.id, id));
  }

  async listCompletedBoardRuns(scope: "official" | "human"): Promise<BenchmarkRunRecord[]> {
    return this.database
      .select()
      .from(benchmarkRun)
      .where(
        and(
          eq(benchmarkRun.scope, scope),
          eq(benchmarkRun.status, "completed"),
          eq(benchmarkRun.visibility, "public"),
        ),
      )
      .orderBy(desc(benchmarkRun.completed_at))
      .limit(scope === "human" ? HUMAN_BOARD_LIMIT * 6 : 2000);
  }

  async listOfficial(): Promise<BenchmarkRunRecord[]> {
    return this.database
      .select()
      .from(benchmarkRun)
      .where(eq(benchmarkRun.scope, "official"))
      .orderBy(desc(benchmarkRun.created_at))
      .limit(OFFICIAL_LIST_LIMIT);
  }

  async listOfficialEntrantKeys(
    benchmarkId: string,
    version: number,
    options: { retryFailed: boolean },
  ): Promise<Set<string>> {
    const rows = await this.database
      .select({ entrantKey: benchmarkRun.entrant_key })
      .from(benchmarkRun)
      .where(
        and(
          eq(benchmarkRun.benchmark_id, benchmarkId),
          eq(benchmarkRun.version, version),
          eq(benchmarkRun.scope, "official"),
          notInArray(
            benchmarkRun.status,
            options.retryFailed ? ["cancelled", "failed"] : ["cancelled"],
          ),
        ),
      );

    return new Set(rows.map((row) => row.entrantKey));
  }

  async officialSpendSince(since: string): Promise<number> {
    const [row] = await this.database
      .select({ total: sql<number>`coalesce(sum(${benchmarkRun.cost_usd}), 0)` })
      .from(benchmarkRun)
      .where(and(eq(benchmarkRun.scope, "official"), gte(benchmarkRun.created_at, since)));

    return row?.total ?? 0;
  }

  async listByOwner(userId: number): Promise<BenchmarkRunRecord[]> {
    return this.database
      .select()
      .from(benchmarkRun)
      .where(and(eq(benchmarkRun.owner_user_id, userId), eq(benchmarkRun.scope, "personal")))
      .orderBy(desc(benchmarkRun.created_at))
      .limit(OWNER_LIST_LIMIT);
  }

  async listByWorkspace(workspaceId: string): Promise<BenchmarkRunRecord[]> {
    return this.database
      .select()
      .from(benchmarkRun)
      .where(and(eq(benchmarkRun.workspace_id, workspaceId), eq(benchmarkRun.scope, "workspace")))
      .orderBy(desc(benchmarkRun.created_at))
      .limit(OWNER_LIST_LIMIT);
  }

  async listCompletedPersonal(userId: number): Promise<BenchmarkRunRecord[]> {
    return this.database
      .select()
      .from(benchmarkRun)
      .where(
        and(
          eq(benchmarkRun.owner_user_id, userId),
          eq(benchmarkRun.scope, "personal"),
          eq(benchmarkRun.status, "completed"),
          isNotNull(benchmarkRun.score),
        ),
      )
      .orderBy(desc(benchmarkRun.completed_at))
      .limit(OWNER_LIST_LIMIT);
  }

  async countOwnerRunsSince(
    userId: number,
    since: string,
  ): Promise<{ active: number; recent: number }> {
    const [row] = await this.database
      .select({
        active: sql<number>`sum(case when ${benchmarkRun.status} in ('queued', 'running') then 1 else 0 end)`,
        recent: sql<number>`count(*)`,
      })
      .from(benchmarkRun)
      .where(
        and(
          eq(benchmarkRun.owner_user_id, userId),
          inArray(benchmarkRun.scope, ["personal", "workspace"]),
          gte(benchmarkRun.created_at, since),
        ),
      );

    return { active: row?.active ?? 0, recent: row?.recent ?? 0 };
  }
}
