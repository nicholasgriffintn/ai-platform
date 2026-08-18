import type { OAuthStateRecord, OAuthStateStore } from "@ngriffin_uk/auth-oauth2";
import { eq } from "drizzle-orm";

import { oauthState } from "~/lib/database/schema";

import { BaseRepository } from "./BaseRepository";

export class OAuthStateRepository extends BaseRepository implements OAuthStateStore {
  public async create(record: OAuthStateRecord): Promise<void> {
    await this.database.insert(oauthState).values({
      state_hash: record.stateHash,
      provider: record.provider,
      code_verifier: record.codeVerifier ?? null,
      nonce: record.nonce ?? null,
      redirect_uri: record.redirectUri ?? null,
      context: record.context ?? null,
      created_at: record.createdAt.toISOString(),
      expires_at: record.expiresAt.toISOString(),
    });
  }

  public async consumeByStateHash(stateHash: string): Promise<OAuthStateRecord | null> {
    const [record] = await this.database
      .delete(oauthState)
      .where(eq(oauthState.state_hash, stateHash))
      .returning();

    if (!record) {
      return null;
    }

    return {
      stateHash: record.state_hash,
      provider: record.provider,
      ...(record.code_verifier ? { codeVerifier: record.code_verifier } : {}),
      ...(record.nonce ? { nonce: record.nonce } : {}),
      ...(record.redirect_uri ? { redirectUri: record.redirect_uri } : {}),
      ...(record.context ? { context: record.context } : {}),
      createdAt: new Date(record.created_at),
      expiresAt: new Date(record.expires_at),
    };
  }
}
