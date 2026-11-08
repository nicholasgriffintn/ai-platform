import { and, eq, gt, lte } from "drizzle-orm";
import z from "zod/v4";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import { authenticationToken } from "~/infrastructure/database/schema";

const PURPOSE = "secret_reference";

const payloadSchema = z.object({
  salt: z.string().min(1),
  project_id: z.string().min(1).nullable(),
  conversation_id: z.string().min(1),
  interaction_id: z.string().min(1),
  label: z.string().min(1),
  destination: z.string().min(1),
  sealed_value: z.string().min(1),
});

export type SecretReferenceRecord = z.infer<typeof payloadSchema> & {
  token_hash: string;
  user_id: number;
  created_at: string;
  expires_at: string;
};

type TokenRow = typeof authenticationToken.$inferSelect;

function toRecord(row: TokenRow | undefined): SecretReferenceRecord | null {
  const payload = payloadSchema.safeParse(row?.payload);

  if (!row || row.user_id === null || !payload.success) {
    return null;
  }

  return {
    ...payload.data,
    token_hash: row.token_hash,
    user_id: row.user_id,
    created_at: row.created_at,
    expires_at: row.expires_at,
  };
}

export class SecretReferenceRepository extends BaseRepository {
  async save(record: SecretReferenceRecord): Promise<void> {
    const { token_hash, user_id, created_at, expires_at, ...payload } = record;

    await this.database
      .insert(authenticationToken)
      .values({ purpose: PURPOSE, token_hash, user_id, payload, created_at, expires_at })
      .onConflictDoNothing();
  }

  async findByHash(tokenHash: string): Promise<SecretReferenceRecord | null> {
    const [row] = await this.database
      .select()
      .from(authenticationToken)
      .where(
        and(
          eq(authenticationToken.purpose, PURPOSE),
          eq(authenticationToken.token_hash, tokenHash),
        ),
      )
      .limit(1);

    return toRecord(row);
  }

  async consume(params: {
    tokenHash: string;
    userId: number;
    now: string;
  }): Promise<SecretReferenceRecord | null> {
    const [row] = await this.database
      .delete(authenticationToken)
      .where(
        and(
          eq(authenticationToken.purpose, PURPOSE),
          eq(authenticationToken.token_hash, params.tokenHash),
          eq(authenticationToken.user_id, params.userId),
          gt(authenticationToken.expires_at, params.now),
        ),
      )
      .returning();

    return toRecord(row);
  }

  async deleteExpiredForUser(userId: number, now: string): Promise<void> {
    await this.database
      .delete(authenticationToken)
      .where(
        and(
          eq(authenticationToken.purpose, PURPOSE),
          eq(authenticationToken.user_id, userId),
          lte(authenticationToken.expires_at, now),
        ),
      );
  }
}
