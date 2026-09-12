import type { OutboundDeliveryRow } from "~/lib/database/schema";
import { AssistantError, ErrorType } from "~/utils/errors";
import { parseJsonRecord } from "~/utils/json";

import { BaseRepository } from "./BaseRepository";

export interface OutboundDeliveryRecord {
  id: string;
  userId: number;
  kind: string;
  scopeId: string;
  operationId: string;
  payloadDigest: string;
  payload: Record<string, unknown>;
  state: "prepared" | "sending" | "sent" | "indeterminate";
  executionToken: string | null;
  executionLeaseExpiresAt: string | null;
  sentAt: string | null;
}

function parseDelivery(row: OutboundDeliveryRow): OutboundDeliveryRecord {
  const payload = parseJsonRecord(row.payload_json);

  return {
    id: row.id,
    userId: row.user_id,
    kind: row.kind,
    scopeId: row.scope_id,
    operationId: row.operation_id,
    payloadDigest: row.payload_digest,
    payload,
    state: row.state,
    executionToken: row.execution_token,
    executionLeaseExpiresAt: row.execution_lease_expires_at,
    sentAt: row.sent_at,
  };
}

export class OutboundDeliveryRepository extends BaseRepository {
  async prepare(input: {
    id: string;
    userId: number;
    kind: string;
    scopeId: string;
    operationId: string;
    payloadDigest: string;
    payload: Record<string, unknown>;
  }): Promise<OutboundDeliveryRecord> {
    const now = new Date().toISOString();

    await this.executeRun(
      `INSERT OR IGNORE INTO outbound_delivery (
         id, user_id, kind, scope_id, operation_id, payload_digest,
         payload_json, state, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 'prepared', ?, ?)`,
      [
        input.id,
        input.userId,
        input.kind,
        input.scopeId,
        input.operationId,
        input.payloadDigest,
        JSON.stringify(input.payload),
        now,
        now,
      ],
    );
    const row = await this.runQuery<OutboundDeliveryRow>(
      "SELECT * FROM outbound_delivery WHERE id = ? AND user_id = ?",
      [input.id, input.userId],
      true,
    );

    if (
      !row ||
      row.kind !== input.kind ||
      row.scope_id !== input.scopeId ||
      row.operation_id !== input.operationId ||
      row.payload_digest !== input.payloadDigest
    ) {
      throw new AssistantError(
        "Outbound operation conflicts with an existing delivery",
        ErrorType.CONFLICT_ERROR,
        409,
      );
    }

    return parseDelivery(row);
  }

  async begin(input: {
    id: string;
    userId: number;
    executionToken: string;
    now: string;
    leaseExpiresAt: string;
  }): Promise<"execute" | "sent" | "in_progress" | "indeterminate"> {
    const claimed = await this.runQuery<OutboundDeliveryRow>(
      `UPDATE outbound_delivery
       SET state = 'sending', execution_token = ?, execution_lease_expires_at = ?, updated_at = ?
       WHERE id = ? AND user_id = ? AND state = 'prepared'
       RETURNING *`,
      [input.executionToken, input.leaseExpiresAt, input.now, input.id, input.userId],
      true,
    );

    if (claimed) {
      return "execute";
    }

    const current = await this.runQuery<OutboundDeliveryRow>(
      "SELECT * FROM outbound_delivery WHERE id = ? AND user_id = ?",
      [input.id, input.userId],
      true,
    );

    if (!current) {
      throw new AssistantError("Outbound delivery not found", ErrorType.NOT_FOUND, 404);
    }

    if (current.state === "sent") {
      return "sent";
    }

    if (current.state === "indeterminate") {
      return "indeterminate";
    }

    if (
      current.state === "sending" &&
      current.execution_lease_expires_at &&
      current.execution_lease_expires_at > input.now
    ) {
      return "in_progress";
    }

    await this.executeRun(
      `UPDATE outbound_delivery
       SET state = 'indeterminate', updated_at = ?
       WHERE id = ? AND user_id = ? AND state = 'sending'`,
      [input.now, input.id, input.userId],
    );

    return "indeterminate";
  }

  async complete(input: {
    id: string;
    userId: number;
    executionToken: string;
    sentAt: string;
  }): Promise<boolean> {
    const result = await this.executeRun(
      `UPDATE outbound_delivery
       SET state = 'sent', sent_at = ?, updated_at = ?
       WHERE id = ? AND user_id = ? AND state = 'sending' AND execution_token = ?`,
      [input.sentAt, input.sentAt, input.id, input.userId, input.executionToken],
    );

    return Boolean(result.meta?.changes);
  }

  async markIndeterminate(input: {
    id: string;
    userId: number;
    executionToken: string;
    recordedAt: string;
  }): Promise<void> {
    await this.executeRun(
      `UPDATE outbound_delivery
       SET state = 'indeterminate', updated_at = ?
       WHERE id = ? AND user_id = ? AND state = 'sending' AND execution_token = ?`,
      [input.recordedAt, input.id, input.userId, input.executionToken],
    );
  }
}
