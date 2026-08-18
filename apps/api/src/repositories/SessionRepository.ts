import type { AuthSessionRecord, SessionStore } from "@ngriffin_uk/auth-core";
import { eq } from "drizzle-orm";

import { AUTH_SESSION_TTL_MS } from "~/constants/app";
import { session } from "~/lib/database/schema";

import { BaseRepository } from "./BaseRepository";
import { toAuthSessionRecord, type StoredSessionRecord } from "./sessionRecord";

interface ConsumeMobileAuthCodeOptions {
  jti: string;
  sessionId: string;
  userId: number;
  expiresAt: Date;
}

export class SessionRepository extends BaseRepository implements SessionStore {
  public async create(record: AuthSessionRecord): Promise<void> {
    await this.database.insert(session).values({
      id: record.tokenHash,
      user_id: Number(record.userId),
      expires_at: record.expiresAt.toISOString(),
      jwt_token: null,
      jwt_expires_at: null,
    });
  }

  public async findByTokenHash(tokenHash: string): Promise<AuthSessionRecord | null> {
    const [record] = await this.database
      .select({
        id: session.id,
        userId: session.user_id,
        expiresAt: session.expires_at,
      })
      .from(session)
      .where(eq(session.id, tokenHash))
      .limit(1);

    if (!record) {
      return null;
    }

    return toAuthSessionRecord(record, AUTH_SESSION_TTL_MS);
  }

  public async deleteByTokenHash(tokenHash: string): Promise<void> {
    await this.database.delete(session).where(eq(session.id, tokenHash));
  }

  public async rotateByTokenHash(
    currentTokenHash: string,
    replacement: AuthSessionRecord,
  ): Promise<AuthSessionRecord | null> {
    const [, consumed] = await this.env.DB.batch<StoredSessionRecord>([
      this.env.DB.prepare(
        `INSERT INTO session (
				   id, user_id, expires_at, jwt_token, jwt_expires_at
				 )
				 SELECT ?, user_id, ?, NULL, NULL FROM session
				 WHERE id = ? AND user_id = ? AND datetime(expires_at) > datetime(?)`,
      ).bind(
        replacement.tokenHash,
        replacement.expiresAt.toISOString(),
        currentTokenHash,
        Number(replacement.userId),
        replacement.createdAt.toISOString(),
      ),
      this.env.DB.prepare(
        `DELETE FROM session
				 WHERE id = ? AND EXISTS (SELECT 1 FROM session WHERE id = ?)
				 RETURNING id, user_id AS userId, expires_at AS expiresAt`,
      ).bind(currentTokenHash, replacement.tokenHash),
    ]);
    const record = consumed?.results[0];

    return record ? toAuthSessionRecord(record, AUTH_SESSION_TTL_MS) : null;
  }

  public async touchByTokenHash(
    tokenHash: string,
    expiresAt: Date,
  ): Promise<AuthSessionRecord | null> {
    const record = await this.env.DB.prepare(
      `UPDATE session
			 SET expires_at = MAX(expires_at, ?)
			 WHERE id = ? AND datetime(expires_at) > datetime(?)
			 RETURNING id, user_id AS userId, expires_at AS expiresAt`,
    )
      .bind(
        expiresAt.toISOString(),
        tokenHash,
        new Date(expiresAt.getTime() - AUTH_SESSION_TTL_MS).toISOString(),
      )
      .first<StoredSessionRecord>();

    return record ? toAuthSessionRecord(record, AUTH_SESSION_TTL_MS) : null;
  }

  public async deleteByUserId(userId: string): Promise<void> {
    await this.database.delete(session).where(eq(session.user_id, Number(userId)));
  }

  public async deleteSession(sessionId: string): Promise<void> {
    const { query, values } = this.buildDeleteQuery("session", {
      id: sessionId,
    });

    await this.executeRun(query, values);
  }

  public async getSessionWithJwt(sessionId: string): Promise<{
    id: string;
    user_id: number;
    expires_at: string;
    jwt_token: string | null;
    jwt_expires_at: string | null;
  } | null> {
    return this.runQuery<{
      id: string;
      user_id: number;
      expires_at: string;
      jwt_token: string | null;
      jwt_expires_at: string | null;
    }>(
      `SELECT id, user_id, expires_at, jwt_token, jwt_expires_at
       FROM session
       WHERE id = ? AND expires_at > datetime('now')`,
      [sessionId],
      true,
    );
  }

  public async updateSessionJwt(
    sessionId: string,
    jwtToken: string,
    jwtExpiresAt: Date,
  ): Promise<void> {
    await this.executeRun(
      `UPDATE session
       SET jwt_token = ?, jwt_expires_at = ?
       WHERE id = ?`,
      [jwtToken, jwtExpiresAt.toISOString(), sessionId],
    );
  }

  public async createSession(
    sessionId: string,
    userId: number,
    expiresAt: Date,
    jwtToken?: string,
    jwtExpiresAt?: Date,
  ): Promise<void> {
    const insert = this.buildInsertQuery("session", {
      id: sessionId,
      user_id: userId,
      expires_at: expiresAt.toISOString(),
      jwt_token: jwtToken ?? null,
      jwt_expires_at: jwtExpiresAt?.toISOString() ?? null,
    });

    if (!insert) {
      return;
    }

    await this.executeRun(insert.query, insert.values);
  }

  public async consumeMobileAuthCode({
    jti,
    sessionId,
    userId,
    expiresAt,
  }: ConsumeMobileAuthCodeOptions): Promise<boolean> {
    await this.executeRun(
      `DELETE FROM mobile_auth_exchange_code
       WHERE datetime(expires_at) <= datetime('now')`,
    );

    const result = await this.executeRun(
      `INSERT OR IGNORE INTO mobile_auth_exchange_code (
         jti,
         session_id,
         user_id,
         expires_at
       )
       VALUES (?, ?, ?, ?)`,
      [jti, sessionId, userId, expiresAt.toISOString()],
    );

    return Number(result.meta.changes ?? 0) > 0;
  }
}
