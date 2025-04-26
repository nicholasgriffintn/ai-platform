import { BaseRepository } from "./BaseRepository";

export interface MagicLinkNonce {
  nonce: string;
  user_id: number;
  expires_at: number;
}

export class MagicLinkNonceRepository extends BaseRepository {
  /**
   * Creates a new magic link nonce in the database.
   * @param nonce - The nonce value
   * @param userId - The user ID
   * @param expiresAt - The expiration date
   */
  public async createNonce(
    nonce: string,
    userId: number,
    expiresAt: Date,
  ): Promise<void> {
    const expiresTimestamp = Math.floor(expiresAt.getTime() / 1000);
    await this.executeRun(
      "INSERT INTO magic_link_nonce (nonce, user_id, expires_at) VALUES (?, ?, ?)",
      [nonce, userId, expiresTimestamp],
    );
  }

  /**
   * Finds a nonce by its value, ensuring it belongs to the correct user and hasn't expired.
   * @param nonce - The nonce value
   * @param userId - The user ID
   * @returns The magic link nonce or null if it doesn't exist or has expired
   */
  public async findNonce(
    nonce: string,
    userId: number,
  ): Promise<MagicLinkNonce | null> {
    const nowTimestamp = Math.floor(Date.now() / 1000);
    const result = await this.runQuery<MagicLinkNonce>(
      "SELECT * FROM magic_link_nonce WHERE nonce = ? AND user_id = ? AND expires_at > ?",
      [nonce, userId, nowTimestamp],
      true,
    );
    return result;
  }

  /**
   * Deletes a nonce from the database by its value.
   * This is used to "consume" the nonce after successful verification.
   * @param nonce - The nonce value
   */
  public async deleteNonce(nonce: string): Promise<void> {
    await this.executeRun("DELETE FROM magic_link_nonce WHERE nonce = ?", [
      nonce,
    ]);
  }

  /**
   * Deletes expired nonces (optional cleanup task).
   * @returns The number of nonces deleted
   */
  public async deleteExpiredNonces(): Promise<void> {
    const nowTimestamp = Math.floor(Date.now() / 1000);
    await this.executeRun(
      "DELETE FROM magic_link_nonce WHERE expires_at <= ?",
      [nowTimestamp],
    );
  }
}
