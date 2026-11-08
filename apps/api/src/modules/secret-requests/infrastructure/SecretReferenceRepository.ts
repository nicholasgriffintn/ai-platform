import { and, eq, gt, isNull, lte } from "drizzle-orm";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import { secretReference } from "~/infrastructure/database/schema";

export type SecretReferenceRecord = typeof secretReference.$inferSelect;

export interface SecretReferenceRedemption {
  id: string;
  userId: number;
  projectId: string | null;
  conversationId: string;
  now: string;
}

export class SecretReferenceRepository extends BaseRepository {
  async replaceForInteraction(record: SecretReferenceRecord): Promise<void> {
    const {
      conversation_id: _conversationId,
      interaction_id: _interactionId,
      ...replacement
    } = record;

    await this.database
      .insert(secretReference)
      .values(record)
      .onConflictDoUpdate({
        target: [secretReference.conversation_id, secretReference.interaction_id],
        set: replacement,
      });
  }

  async findByHash(referenceHash: string): Promise<SecretReferenceRecord | null> {
    const [record] = await this.database
      .select()
      .from(secretReference)
      .where(eq(secretReference.reference_hash, referenceHash))
      .limit(1);

    return record ?? null;
  }

  async consume(params: SecretReferenceRedemption): Promise<SecretReferenceRecord | null> {
    const [record] = await this.database
      .delete(secretReference)
      .where(
        and(
          eq(secretReference.id, params.id),
          eq(secretReference.user_id, params.userId),
          params.projectId === null
            ? isNull(secretReference.project_id)
            : eq(secretReference.project_id, params.projectId),
          eq(secretReference.conversation_id, params.conversationId),
          gt(secretReference.expires_at, params.now),
        ),
      )
      .returning();

    return record ?? null;
  }

  async deleteExpiredForUser(userId: number, now: string): Promise<void> {
    await this.database
      .delete(secretReference)
      .where(and(eq(secretReference.user_id, userId), lte(secretReference.expires_at, now)));
  }
}
