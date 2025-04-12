import type { AuthenticatorTransportFuture } from "@simplewebauthn/types";
import { BaseRepository } from "./BaseRepository";

export class WebAuthnRepository extends BaseRepository {
  public async createChallenge(
    challenge: string,
    userId?: number,
    expiresInMinutes = 5,
  ): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + expiresInMinutes);

    const query = userId
      ? `INSERT INTO webauthn_challenge (user_id, challenge, expires_at)
         VALUES (?, ?, ?)`
      : `INSERT INTO webauthn_challenge (challenge, expires_at)
         VALUES (?, ?)`;

    const params = userId
      ? [userId, challenge, expiresAt.toISOString()]
      : [challenge, expiresAt.toISOString()];

    await this.executeRun(query, params);
  }

  public async getChallenge(
    challenge: string,
    userId?: number,
  ): Promise<{ challenge: string } | null> {
    const query = userId
      ? `SELECT challenge FROM webauthn_challenge 
         WHERE user_id = ? AND challenge = ? AND expires_at > datetime('now')
         ORDER BY created_at DESC LIMIT 1`
      : `SELECT challenge FROM webauthn_challenge 
         WHERE challenge = ? AND expires_at > datetime('now')
         ORDER BY created_at DESC LIMIT 1`;

    const params = userId ? [userId, challenge] : [challenge];

    return this.runQuery<{ challenge: string }>(query, params, true);
  }

  public async getChallengeByUserId(
    userId: number,
  ): Promise<{ challenge: string } | null> {
    return this.runQuery<{ challenge: string }>(
      `SELECT challenge FROM webauthn_challenge 
       WHERE user_id = ? AND expires_at > datetime('now')
       ORDER BY created_at DESC LIMIT 1`,
      [userId],
      true,
    );
  }

  public async deleteChallenge(
    challenge: string,
    userId?: number,
  ): Promise<void> {
    const query = userId
      ? `DELETE FROM webauthn_challenge
         WHERE user_id = ? AND challenge = ?`
      : `DELETE FROM webauthn_challenge
         WHERE challenge = ?`;

    const params = userId ? [userId, challenge] : [challenge];

    await this.executeRun(query, params);
  }

  public async createPasskey(
    userId: number,
    credentialId: string,
    publicKey: Uint8Array,
    counter: number,
    deviceType: string,
    backedUp: boolean,
    transports?: AuthenticatorTransportFuture[],
  ): Promise<void> {
    await this.executeRun(
      `INSERT INTO passkey (
        user_id, 
        credential_id, 
        public_key, 
        counter, 
        device_type, 
        backed_up, 
        transports
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        credentialId,
        publicKey,
        counter,
        deviceType,
        backedUp ? 1 : 0,
        transports ? JSON.stringify(transports) : null,
      ],
    );
  }

  public async getPasskeysByUserId(
    userId: number,
  ): Promise<Record<string, unknown>[]> {
    return this.runQuery<Record<string, unknown>>(
      "SELECT * FROM passkey WHERE user_id = ?",
      [userId],
    );
  }

  public async getPasskeyByCredentialId(
    credentialId: string,
  ): Promise<Record<string, unknown> | null> {
    return this.runQuery<Record<string, unknown>>(
      `SELECT p.*, u.id as user_id, u.* 
       FROM passkey p 
       JOIN user u ON p.user_id = u.id 
       WHERE p.credential_id = ?`,
      [credentialId],
      true,
    );
  }

  public async updatePasskeyCounter(
    credentialId: string,
    counter: number,
  ): Promise<void> {
    await this.executeRun(
      "UPDATE passkey SET counter = ? WHERE credential_id = ?",
      [counter, credentialId],
    );
  }

  public async deletePasskey(
    passkeyId: number,
    userId: number,
  ): Promise<boolean> {
    const result = await this.executeRun(
      "DELETE FROM passkey WHERE id = ? AND user_id = ?",
      [passkeyId, userId],
    );

    return result !== null && typeof result === "object";
  }
}
