import { BaseRepository } from "./BaseRepository";

export class SessionRepository extends BaseRepository {
  public async createSession(
    sessionId: string,
    userId: number,
    expiresAt: Date,
  ): Promise<void> {
    await this.executeRun(
      `INSERT INTO session (id, user_id, expires_at)
       VALUES (?, ?, ?)`,
      [sessionId, userId, expiresAt.toISOString()],
    );
  }

  public async deleteSession(sessionId: string): Promise<void> {
    await this.executeRun(
      `DELETE FROM session
       WHERE id = ?`,
      [sessionId],
    );
  }
}
