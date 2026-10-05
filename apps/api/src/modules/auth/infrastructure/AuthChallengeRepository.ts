import type { AuthChallengeRecord, ChallengeStore } from "@ngriffin_uk/auth-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { and, eq, sql } from "drizzle-orm";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import { authenticationToken } from "~/infrastructure/database/schema";
import {
  decryptAuthChallengePayload,
  encryptAuthChallengePayload,
} from "~/modules/auth/application/challengeEncryption";

export class AuthChallengeRepository extends BaseRepository implements ChallengeStore {
  public async create(record: AuthChallengeRecord): Promise<void> {
    if (!this.env.JWT_SECRET) {
      throw new AssistantError(
        "JWT_SECRET is required for challenge encryption",
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    await this.database.insert(authenticationToken).values({
      purpose: "challenge",
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
      .from(authenticationToken)
      .where(
        and(
          eq(authenticationToken.purpose, "challenge"),
          eq(authenticationToken.token_hash, tokenHash),
        ),
      )
      .limit(1);

    return record ? this.mapAuthChallenge(record) : null;
  }

  public async consumeByTokenHash(tokenHash: string): Promise<AuthChallengeRecord | null> {
    const [record] = await this.database
      .delete(authenticationToken)
      .where(
        and(
          eq(authenticationToken.purpose, "challenge"),
          eq(authenticationToken.token_hash, tokenHash),
        ),
      )
      .returning();

    return record ? this.mapAuthChallenge(record) : null;
  }

  public async incrementAttempts(tokenHash: string, expectedAttempts: number): Promise<boolean> {
    const updated = await this.database
      .update(authenticationToken)
      .set({ attempts: sql`${authenticationToken.attempts} + 1` })
      .where(
        and(
          eq(authenticationToken.purpose, "challenge"),
          eq(authenticationToken.token_hash, tokenHash),
          eq(authenticationToken.attempts, expectedAttempts),
        ),
      )
      .returning({ tokenHash: authenticationToken.token_hash });

    return updated.length === 1;
  }

  private async mapAuthChallenge(
    record: typeof authenticationToken.$inferSelect,
  ): Promise<AuthChallengeRecord> {
    if (!this.env.JWT_SECRET) {
      throw new AssistantError(
        "JWT_SECRET is required for challenge encryption",
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    if (!record.provider || !record.kind || !record.payload) {
      throw new AssistantError(
        "Stored authentication challenge is invalid",
        ErrorType.INTERNAL_ERROR,
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
