import { BaseRepository } from "./BaseRepository";

export class SessionRepository extends BaseRepository {
  public async createSession(
    sessionId: string,
    userId: number,
    expiresAt: Date,
    jwtToken?: string,
    jwtExpiresAt?: Date,
  ): Promise<void> {
    await this.executeRun(
      `INSERT INTO session (id, user_id, expires_at, jwt_token, jwt_expires_at)
       VALUES (?, ?, ?, ?, ?)`,
      [
        sessionId,
        userId,
        expiresAt.toISOString(),
        jwtToken || null,
        jwtExpiresAt?.toISOString() || null,
      ],
    );
  }

  public async deleteSession(sessionId: string): Promise<void> {
    await this.executeRun(
      `DELETE FROM session
       WHERE id = ?`,
      [sessionId],
    );
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
}
