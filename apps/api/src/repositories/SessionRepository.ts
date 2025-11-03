import { BaseRepository } from "./BaseRepository";

export class SessionRepository extends BaseRepository {
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
}
