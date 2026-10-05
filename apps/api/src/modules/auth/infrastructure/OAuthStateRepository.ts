import type { OAuthStateRecord, OAuthStateStore } from "@ngriffin_uk/auth-oauth2";
import { and, eq } from "drizzle-orm";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import { authenticationToken } from "~/infrastructure/database/schema";

export class OAuthStateRepository extends BaseRepository implements OAuthStateStore {
  public async create(record: OAuthStateRecord): Promise<void> {
    await this.database.insert(authenticationToken).values({
      purpose: "oauth_state",
      token_hash: record.stateHash,
      provider: record.provider,
      oauth_data: {
        codeVerifier: record.codeVerifier,
        nonce: record.nonce,
        redirectUri: record.redirectUri,
        context: record.context,
      },
      created_at: record.createdAt.toISOString(),
      expires_at: record.expiresAt.toISOString(),
    });
  }

  public async consumeByStateHash(stateHash: string): Promise<OAuthStateRecord | null> {
    const [record] = await this.database
      .delete(authenticationToken)
      .where(
        and(
          eq(authenticationToken.purpose, "oauth_state"),
          eq(authenticationToken.token_hash, stateHash),
        ),
      )
      .returning();

    if (!record?.provider || !record.oauth_data) {
      return null;
    }

    return {
      stateHash: record.token_hash,
      provider: record.provider,
      ...record.oauth_data,
      createdAt: new Date(record.created_at),
      expiresAt: new Date(record.expires_at),
    };
  }
}
