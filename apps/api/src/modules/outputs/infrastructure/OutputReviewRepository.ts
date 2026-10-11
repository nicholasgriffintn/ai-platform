import {
  councilReviewSeatSchema,
  type CouncilReview,
  type CouncilReviewSeat,
  type CouncilReviewVerdict,
} from "@ngriffin_uk/polychat-schemas";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";
import z from "zod/v4";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import type { OutputReviewRow } from "~/infrastructure/database/schema";

const seatsSchema = z.array(councilReviewSeatSchema).catch([]);
const dissentSchema = z.array(z.string()).catch([]);

function readJson(value: unknown): unknown {
  return typeof value === "string" ? safeParseJson(value) : value;
}

function formatReview(row: OutputReviewRow): CouncilReview {
  return {
    id: row.id,
    outputId: row.output_id,
    outputRevision: row.output_revision,
    verdict: row.verdict,
    brief: row.brief,
    dissent: dissentSchema.parse(readJson(row.dissent)),
    seats: seatsSchema.parse(readJson(row.seats)),
    createdAt: row.created_at,
  };
}

export class OutputReviewRepository extends BaseRepository {
  public async create(input: {
    id: string;
    outputId: string;
    outputRevision: number;
    outputKind: string;
    reviewedByUserId: number;
    projectId: string | null;
    verdict: CouncilReviewVerdict;
    brief: string;
    dissent: readonly string[];
    seats: readonly CouncilReviewSeat[];
  }): Promise<void> {
    await this.executeRun(
      `INSERT INTO output_review (
         id, output_id, output_revision, output_kind, reviewed_by_user_id, project_id,
         verdict, brief, dissent, seats
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.outputId,
        input.outputRevision,
        input.outputKind,
        input.reviewedByUserId,
        input.projectId,
        input.verdict,
        input.brief,
        JSON.stringify(input.dissent),
        JSON.stringify(input.seats),
      ],
    );
  }

  public async getById(id: string): Promise<CouncilReview | null> {
    const row = await this.runQuery<OutputReviewRow>(
      "SELECT * FROM output_review WHERE id = ?",
      [id],
      true,
    );

    return row ? formatReview(row) : null;
  }

  public async listForOutput(outputId: string, limit: number): Promise<CouncilReview[]> {
    const rows = await this.runQuery<OutputReviewRow>(
      `SELECT * FROM output_review WHERE output_id = ?
       ORDER BY created_at DESC, id DESC LIMIT ?`,
      [outputId, limit],
    );

    return rows.map(formatReview);
  }

  public async listRecentBriefsForKind(params: {
    userId: number;
    projectId: string | null;
    outputKind: string;
    excludeOutputId: string;
    limit: number;
  }): Promise<string[]> {
    const rows = await this.runQuery<{ brief: string }>(
      `SELECT brief FROM output_review
       WHERE reviewed_by_user_id = ? AND output_kind = ? AND output_id != ?
         AND project_id IS ?
       ORDER BY created_at DESC, id DESC LIMIT ?`,
      [params.userId, params.outputKind, params.excludeOutputId, params.projectId, params.limit],
    );

    return rows.map((row) => row.brief);
  }
}
