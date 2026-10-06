import type { PolyHandoffDecision, PolyHandoffUrgency } from "@ngriffin_uk/polychat-schemas";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import type { PolyHandoffRow } from "~/infrastructure/database/schema";
import type { IEnv } from "~/types";

export interface CreatePolyHandoffParams {
  id: string;
  contextId: string;
  sourceKind: PolyHandoffRow["source_kind"];
  sourceId: string;
  fingerprint: string;
  title: string;
  summary: string;
  resultConversationId: string | null;
  urgency: PolyHandoffUrgency;
  decision: PolyHandoffDecision;
  reason: string;
  admissionReceipt: Record<string, unknown> | null;
  createdAt: string;
}

export class PolyHandoffRepository extends BaseRepository<Pick<IEnv, "DB">> {
  async insertOnce(params: CreatePolyHandoffParams): Promise<PolyHandoffRow> {
    await this.executeRun(
      `INSERT INTO poly_handoff (
         id, context_id, source_kind, source_id, fingerprint, title, summary,
         result_conversation_id, urgency, decision, reason, admission_receipt_json, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(context_id, fingerprint) DO NOTHING`,
      [
        params.id,
        params.contextId,
        params.sourceKind,
        params.sourceId,
        params.fingerprint,
        params.title,
        params.summary,
        params.resultConversationId,
        params.urgency,
        params.decision,
        params.reason,
        params.admissionReceipt ? JSON.stringify(params.admissionReceipt) : null,
        params.createdAt,
      ],
    );

    const row = await this.getByFingerprint(params.contextId, params.fingerprint);

    if (!row) {
      throw new Error("Poly handoff was not recorded");
    }

    return row;
  }

  async getByFingerprint(contextId: string, fingerprint: string): Promise<PolyHandoffRow | null> {
    return this.runQuery<PolyHandoffRow>(
      "SELECT * FROM poly_handoff WHERE context_id = ? AND fingerprint = ?",
      [contextId, fingerprint],
      true,
    );
  }

  async listNotifiedSince(contextId: string, since: string): Promise<string[]> {
    const rows = await this.runQuery<Pick<PolyHandoffRow, "created_at">>(
      `SELECT created_at FROM poly_handoff
       WHERE context_id = ? AND decision = 'notified' AND created_at >= ?
       ORDER BY created_at DESC`,
      [contextId, since],
    );

    return rows.map((row) => row.created_at);
  }

  async listNotedSince(contextId: string, since: string, limit: number): Promise<PolyHandoffRow[]> {
    return this.runQuery<PolyHandoffRow>(
      `SELECT * FROM poly_handoff
       WHERE context_id = ? AND decision = 'noted' AND created_at >= ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [contextId, since, limit],
    );
  }
}
