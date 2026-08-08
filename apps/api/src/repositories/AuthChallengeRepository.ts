import type { AuthChallengeRecord, ChallengeStore } from "@ngriffin_uk/auth-core";
import { and, eq, sql } from "drizzle-orm";

import { authChallenge } from "~/lib/database/schema";
import { BaseRepository } from "./BaseRepository";

export class AuthChallengeRepository extends BaseRepository implements ChallengeStore {
	public async create(record: AuthChallengeRecord): Promise<void> {
		await this.database.insert(authChallenge).values({
			token_hash: record.tokenHash,
			provider: record.provider,
			kind: record.kind,
			payload: record.payload,
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
		return record ? mapAuthChallenge(record) : null;
	}

	public async consumeByTokenHash(tokenHash: string): Promise<AuthChallengeRecord | null> {
		const [record] = await this.database
			.delete(authChallenge)
			.where(eq(authChallenge.token_hash, tokenHash))
			.returning();
		return record ? mapAuthChallenge(record) : null;
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
}

function mapAuthChallenge(record: typeof authChallenge.$inferSelect): AuthChallengeRecord {
	return {
		tokenHash: record.token_hash,
		provider: record.provider,
		kind: record.kind,
		payload: record.payload,
		createdAt: new Date(record.created_at),
		expiresAt: new Date(record.expires_at),
		attempts: record.attempts,
	};
}
