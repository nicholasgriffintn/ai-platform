import type { AuthSessionRecord, SessionStore } from "@ngriffin_uk/auth-core";
import { eq } from "drizzle-orm";

import { AUTH_SESSION_TTL_MS } from "~/constants/app";
import { session } from "~/lib/database/schema";
import { BaseRepository } from "./BaseRepository";

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
		if (!record) return null;

		const expiresAt = new Date(record.expiresAt);
		return {
			tokenHash: record.id,
			userId: String(record.userId),
			createdAt: new Date(expiresAt.getTime() - AUTH_SESSION_TTL_MS),
			expiresAt,
		};
	}

	public async deleteByTokenHash(tokenHash: string): Promise<void> {
		await this.database.delete(session).where(eq(session.id, tokenHash));
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
