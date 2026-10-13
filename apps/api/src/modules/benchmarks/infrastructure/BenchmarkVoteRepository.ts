import type { BenchmarkVoteWinner } from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { and, eq, gt } from "drizzle-orm";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import { benchmarkVote, type BenchmarkVoteRecord } from "~/infrastructure/database/schema";
import type { IEnv } from "~/types";

const BOARD_VOTE_LIMIT = 20_000;

export interface CreateBenchmarkVoteInput {
  benchmarkId: string;
  version: number;
  pairKey: string;
  leftRunId: string;
  rightRunId: string;
  itemId: string;
  winner: BenchmarkVoteWinner;
  voterUserId: number;
}

export class BenchmarkVoteRepository extends BaseRepository<Pick<IEnv, "DB">> {
  async create(input: CreateBenchmarkVoteInput): Promise<boolean> {
    const inserted = await this.database
      .insert(benchmarkVote)
      .values({
        id: generateId(),
        benchmark_id: input.benchmarkId,
        version: input.version,
        pair_key: input.pairKey,
        left_run_id: input.leftRunId,
        right_run_id: input.rightRunId,
        item_id: input.itemId,
        winner: input.winner,
        voter_user_id: input.voterUserId,
      })
      .onConflictDoNothing()
      .returning({ id: benchmarkVote.id });

    return inserted.length > 0;
  }

  async listForBoard(benchmarkId: string, version: number): Promise<BenchmarkVoteRecord[]> {
    return this.database
      .select()
      .from(benchmarkVote)
      .where(and(eq(benchmarkVote.benchmark_id, benchmarkId), eq(benchmarkVote.version, version)))
      .limit(BOARD_VOTE_LIMIT);
  }

  async hasVotesSince(benchmarkId: string, version: number, since: string): Promise<boolean> {
    const [row] = await this.database
      .select({ id: benchmarkVote.id })
      .from(benchmarkVote)
      .where(
        and(
          eq(benchmarkVote.benchmark_id, benchmarkId),
          eq(benchmarkVote.version, version),
          gt(benchmarkVote.created_at, since),
        ),
      )
      .limit(1);

    return Boolean(row);
  }
}
