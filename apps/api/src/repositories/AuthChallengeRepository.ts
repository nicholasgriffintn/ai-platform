import type { AuthChallengeRecord, ChallengeStore } from "@ngriffin_uk/auth-core";
import { and, eq, sql } from "drizzle-orm";

import { authChallenge } from "~/lib/database/schema";
import {
	decryptAuthChallengePayload,
	encryptAuthChallengePayload,
} from "~/services/auth/challengeEncryption";
import { AssistantError, ErrorType } from "~/utils/errors";
import { BaseRepository } from "./BaseRepository";

export class AuthChallengeRepository extends BaseRepository implements ChallengeStore {
	public async create(record: AuthChallengeRecord): Promise<void> {
		if (!this.env.JWT_SECRET) {
			throw new AssistantError(
				"JWT_SECRET is required for challenge encryption",
				ErrorType.CONFIGURATION_ERROR,
			);
		}
		await this.database.insert(authChallenge).values({
			token_hash: record.tokenHash,
			provider: record.provider,
			kind: record.kind,
			payload: await encryptAuthChallengePayload(record, this.env.JWT_SECRET),
			created_at: record.createdAt.toISOString(),
			expires_at: record.expiresAt.toISOString(),
			attempts: record.attempts,
		});
	}

	public async findByTokenHash(tokenHash: string): Promise<AuthChallengeRecord | null> {
		const [record] = await this.database
			.select()
			.from(authChallenge)
			.where(eq(authChallenge.token_hash, tokenHash))
			.limit(1);
		return record ? this.mapAuthChallenge(record) : null;
	}

	public async consumeByTokenHash(tokenHash: string): Promise<AuthChallengeRecord | null> {
		const [record] = await this.database
			.delete(authChallenge)
			.where(eq(authChallenge.token_hash, tokenHash))
			.returning();
		return record ? this.mapAuthChallenge(record) : null;
	}

	public async incrementAttempts(tokenHash: string, expectedAttempts: number): Promise<boolean> {
		const updated = await this.database
			.update(authChallenge)
			.set({ attempts: sql`${authChallenge.attempts} + 1` })
			.where(
				and(eq(authChallenge.token_hash, tokenHash), eq(authChallenge.attempts, expectedAttempts)),
			)
			.returning({ tokenHash: authChallenge.token_hash });
		return updated.length === 1;
	}

	private async mapAuthChallenge(
		record: typeof authChallenge.$inferSelect,
	): Promise<AuthChallengeRecord> {
		if (!this.env.JWT_SECRET) {
			throw new AssistantError(
				"JWT_SECRET is required for challenge encryption",
				ErrorType.CONFIGURATION_ERROR,
			);
		}
		const metadata = {
			tokenHash: record.token_hash,
			provider: record.provider,
			kind: record.kind,
			createdAt: new Date(record.created_at),
			expiresAt: new Date(record.expires_at),
			attempts: record.attempts,
		};
		return {
			...metadata,
			payload: await decryptAuthChallengePayload(metadata, record.payload, this.env.JWT_SECRET),
		};
	}
}
