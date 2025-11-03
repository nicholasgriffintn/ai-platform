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
				const deleteExisting = this.buildDeleteQuery("webauthn_challenge", {
					user_id: userId,
				});
				if (deleteExisting.query) {
					await this.executeRun(deleteExisting.query, deleteExisting.values);
				}

				const insert = this.buildInsertQuery("webauthn_challenge", {
					user_id: userId,
					challenge,
					expires_at: expiresAt.toISOString(),
				});

				if (insert) {
					await this.executeRun(insert.query, insert.values);
				}
			} else {
				const insert = this.buildInsertQuery("webauthn_challenge", {
					challenge,
					expires_at: expiresAt.toISOString(),
				});

				if (insert) {
					await this.executeRun(insert.query, insert.values);
				}
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
		const conditions: Record<string, unknown> = { challenge };
		if (userId) {
			conditions.user_id = userId;
		}

		const { query, values } = this.buildDeleteQuery(
			"webauthn_challenge",
			conditions,
		);
		await this.executeRun(query, values);
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

			const insert = this.buildInsertQuery(
				"passkey",
				{
					user_id: userId,
					credential_id: credentialId,
					public_key: publicKeyBase64,
					counter,
					device_type: deviceType,
					backed_up: backedUp ? 1 : 0,
					transports: transports ?? null,
				},
				{ jsonFields: ["transports"] },
			);

			if (!insert) {
				return;
			}

			await this.executeRun(insert.query, insert.values);
		} catch (error) {
			logger.error("Error creating passkey:", { error });
			throw error;
		}
	}

	public async getPasskeysByUserId(
		userId: number,
	): Promise<Record<string, unknown>[]> {
		const { query, values } = this.buildSelectQuery("passkey", {
			user_id: userId,
		});
		return this.runQuery<Record<string, unknown>>(query, values);
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
		const update = this.buildUpdateQuery(
			"passkey",
			{ counter },
			["counter"],
			"credential_id = ?",
			[credentialId],
		);

		if (!update) {
			return;
		}

		const queryWithTimestamp = update.query.replace(
			"updated_at = datetime('now')",
			"updated_at = CURRENT_TIMESTAMP",
		);

		await this.executeRun(queryWithTimestamp, update.values);
	}

	public async deletePasskey(
		passkeyId: number,
		userId: number,
	): Promise<boolean> {
		try {
			const { query, values } = this.buildDeleteQuery("passkey", {
				id: passkeyId,
				user_id: userId,
			});
			const result = await this.executeRun(query, values);

			return result?.success && result?.meta?.changes > 0;
		} catch (error) {
			logger.error("Error deleting passkey:", { error });
			return false;
		}
	}
}
