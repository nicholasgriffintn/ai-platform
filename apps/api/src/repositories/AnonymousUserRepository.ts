import type { ActorCreditDeltas } from "~/lib/usage/creditActor";
import type { AnonymousUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";

import { BaseRepository } from "./BaseRepository";

const logger = getLogger({ prefix: "repositories/AnonymousUserRepository" });

export class AnonymousUserRepository extends BaseRepository {
  /**
   * Hashes an IP address using SHA-256 for privacy using Web Crypto API
   * @param ipAddress The IP address to hash
   * @returns Hashed IP address as a hex string
   */
  private async hashIpAddress(ipAddress: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(ipAddress);

    const hashBuffer = await crypto.subtle.digest("SHA-256", data);

    const hashArray = Array.from(new Uint8Array(hashBuffer));

    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  public async getAnonymousUserById(id: string): Promise<AnonymousUser | null> {
    const { query, values } = this.buildSelectQuery("anonymous_user", { id });

    return this.runQuery<AnonymousUser>(query, values, true);
  }

  public async getAnonymousUserByIp(ipAddress: string): Promise<AnonymousUser | null> {
    const hashedIp = await this.hashIpAddress(ipAddress);
    const { query, values } = this.buildSelectQuery("anonymous_user", {
      ip_address: hashedIp,
    });

    return this.runQuery<AnonymousUser>(query, values, true);
  }

  public async createOrUpdateAnonymousUser(
    ipAddress: string,
    userAgent?: string,
    id?: string,
  ): Promise<AnonymousUser | null> {
    const userId = id || generateId();
    const now = new Date().toISOString();
    const hashedIp = await this.hashIpAddress(ipAddress);

    const existingUser = await this.getAnonymousUserById(userId);

    if (existingUser) {
      return this.updateAnonymousUser(userId, {
        ip_address: hashedIp,
        user_agent: userAgent,
        last_active_at: now,
      });
    }

    const insert = this.buildInsertQuery(
      "anonymous_user",
      {
        id: userId,
        ip_address: hashedIp,
        user_agent: userAgent || null,
        created_at: now,
        updated_at: now,
        last_active_at: now,
      },
      { returning: "*" },
    );

    if (!insert) {
      return null;
    }

    return this.runQuery<AnonymousUser>(insert.query, insert.values, true);
  }

  public async updateAnonymousUser(
    id: string,
    userData: Partial<AnonymousUser>,
  ): Promise<AnonymousUser | null> {
    if (!id) {
      return null;
    }

    const filteredUserData = Object.fromEntries(
      Object.entries(userData).filter(([, value]) => value !== undefined && value !== null),
    ) as Partial<AnonymousUser>;

    const fieldsToUpdate = Object.keys(filteredUserData).filter((key) => key !== "id");

    const result = this.buildUpdateQuery(
      "anonymous_user",
      filteredUserData,
      fieldsToUpdate,
      "id = ?",
      [id],
    );

    if (!result) {
      return null;
    }

    await this.executeRun(result.query, result.values);

    return this.getAnonymousUserById(id);
  }

  public async getOrCreateAnonymousUser(
    ipAddress: string,
    userAgent?: string,
  ): Promise<AnonymousUser | null> {
    try {
      const hashedIp = await this.hashIpAddress(ipAddress);
      const deterministicId = hashedIp.substring(0, 36);
      const now = new Date().toISOString();

      return this.runQuery<AnonymousUser>(
        `INSERT INTO anonymous_user (
					id, ip_address, user_agent,
					created_at, updated_at, last_active_at
				) VALUES (?, ?, ?, ?, ?, ?)
				ON CONFLICT(id) DO UPDATE SET
					ip_address = excluded.ip_address,
					user_agent = COALESCE(excluded.user_agent, anonymous_user.user_agent),
					updated_at = excluded.updated_at,
					last_active_at = excluded.last_active_at
				RETURNING *`,
        [deterministicId, hashedIp, userAgent || null, now, now, now],
        true,
      );
    } catch (error) {
      logger.error("Error in getOrCreateAnonymousUser:", {
        error_message: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  public async getCreditSpend(
    id: string,
    period: string,
  ): Promise<{ spentCreditMicros: number; reservedCreditMicros: number } | null> {
    const row = await this.runQuery<{
      credit_period: string | null;
      spent_credit_micros: number | null;
      reserved_credit_micros: number | null;
    }>(
      "SELECT credit_period, spent_credit_micros, reserved_credit_micros FROM anonymous_user WHERE id = ?",
      [id],
      true,
    );

    if (!row) {
      return null;
    }

    if (row.credit_period !== period) {
      return { spentCreditMicros: 0, reservedCreditMicros: 0 };
    }

    return {
      spentCreditMicros: row.spent_credit_micros ?? 0,
      reservedCreditMicros: row.reserved_credit_micros ?? 0,
    };
  }

  public async applyCreditDeltas(
    id: string,
    period: string,
    deltas: ActorCreditDeltas,
  ): Promise<void> {
    const spent = Math.round(deltas.spent_credit_micros ?? 0);
    const reserved = Math.round(deltas.reserved_credit_micros ?? 0);

    if (!Number.isFinite(spent) || !Number.isFinite(reserved)) {
      throw new AssistantError("Non-finite anonymous credit delta", ErrorType.PARAMS_ERROR);
    }

    if (spent === 0 && reserved === 0) {
      return;
    }

    await this.executeRun(
      `UPDATE anonymous_user
             SET spent_credit_micros = MAX(
                   0,
                   CASE WHEN credit_period = ? THEN COALESCE(spent_credit_micros, 0) ELSE 0 END + ?
                 ),
                 reserved_credit_micros = MAX(
                   0,
                   CASE WHEN credit_period = ? THEN COALESCE(reserved_credit_micros, 0) ELSE 0 END + ?
                 ),
                 credit_period = ?,
                 last_active_at = datetime('now'),
                 updated_at = datetime('now')
             WHERE id = ?`,
      [period, spent, period, reserved, period, id],
    );
  }
}
