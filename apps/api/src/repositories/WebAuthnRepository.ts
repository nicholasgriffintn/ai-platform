import type { AuthenticatorTransportFuture } from "@simplewebauthn/types";

import { encodeBase64Url } from "~/utils/base64url";
import { getLogger } from "~/utils/logger";
import { AssistantError, ErrorType } from "~/utils/errors";
import { BaseRepository } from "./BaseRepository";

const logger = getLogger({ prefix: "repositories/WebAuthnRepository" });

export class WebAuthnRepository extends BaseRepository {
	public async createChallenge(
		challenge: string,
		userId?: number,
		expiresInMinutes = 5,
	): Promise<void> {
		const expiresAt = new Date();
		expiresAt.setMinutes(expiresAt.getMinutes() + expiresInMinutes);

		try {
			if (userId) {
				await this.executeRun(
					"DELETE FROM webauthn_challenge WHERE user_id = ?",
					[userId],
				);
				await this.executeRun(
					`INSERT INTO webauthn_challenge (user_id, challenge, expires_at)
           VALUES (?, ?, ?)`,
					[userId, challenge, expiresAt.toISOString()],
				);
			} else {
				await this.executeRun(
					`INSERT INTO webauthn_challenge (challenge, expires_at)
           VALUES (?, ?)`,
					[challenge, expiresAt.toISOString()],
				);
			}
		} catch (error) {
			logger.error("Error in createChallenge:", { error });
			throw new AssistantError(
				"Failed to create challenge",
				ErrorType.DATABASE_ERROR,
			);
		}
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
		try {
			const publicKeyBase64 = encodeBase64Url(publicKey);

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
					publicKeyBase64,
					counter,
					deviceType,
					backedUp ? 1 : 0,
					transports ? JSON.stringify(transports) : null,
				],
			);
		} catch (error) {
			logger.error("Error creating passkey:", { error });
			throw error;
		}
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
		try {
			const result = await this.executeRun(
				"DELETE FROM passkey WHERE id = ? AND user_id = ?",
				[passkeyId, userId],
			);

			return result?.success && result?.meta?.changes > 0;
		} catch (error) {
			logger.error("Error deleting passkey:", { error });
			return false;
		}
	}
}
