import type { WebAuthnCredential, WebAuthnStore } from "@ngriffin_uk/auth-webauthn";
import { and, asc, eq } from "drizzle-orm";

import { passkey, type Passkey } from "~/lib/database/schema";
import { getLogger } from "~/utils/logger";

import { BaseRepository } from "./BaseRepository";

const logger = getLogger({ prefix: "repositories/WebAuthnRepository" });

export class WebAuthnRepository extends BaseRepository implements WebAuthnStore {
  public async saveCredential(credential: WebAuthnCredential): Promise<void> {
    await this.database.insert(passkey).values({
      user_id: Number(credential.userId),
      credential_id: credential.id,
      public_key: credential.publicKeyJwk,
      counter: credential.signCount,
      device_type: credential.backupEligible ? "multiDevice" : "singleDevice",
      backed_up: credential.backedUp,
      transports: credential.transports ?? null,
      created_at: credential.createdAt.toISOString(),
      updated_at: credential.updatedAt.toISOString(),
    });
  }

  public async findCredential(credentialId: string): Promise<WebAuthnCredential | null> {
    const [record] = await this.database
      .select()
      .from(passkey)
      .where(eq(passkey.credential_id, credentialId))
      .limit(1);

    return record ? mapCredential(record) : null;
  }

  public async listCredentials(userId: string): Promise<readonly WebAuthnCredential[]> {
    const records = await this.database
      .select()
      .from(passkey)
      .where(eq(passkey.user_id, Number(userId)))
      .orderBy(asc(passkey.created_at));

    return records.map(mapCredential);
  }

  public async updateSignCount(input: {
    readonly credentialId: string;
    readonly previousSignCount: number;
    readonly signCount: number;
    readonly backedUp: boolean;
  }): Promise<boolean> {
    const updated = await this.database
      .update(passkey)
      .set({
        counter: input.signCount,
        backed_up: input.backedUp,
        updated_at: new Date().toISOString(),
      })
      .where(
        and(
          eq(passkey.credential_id, input.credentialId),
          eq(passkey.counter, input.previousSignCount),
        ),
      )
      .returning({ id: passkey.id });

    return updated.length === 1;
  }

  public async getPasskeysByUserId(userId: number): Promise<Passkey[]> {
    return this.database.select().from(passkey).where(eq(passkey.user_id, userId));
  }

  public async deletePasskey(passkeyId: number, userId: number): Promise<boolean> {
    try {
      const deleted = await this.database
        .delete(passkey)
        .where(and(eq(passkey.id, passkeyId), eq(passkey.user_id, userId)))
        .returning({ id: passkey.id });

      return deleted.length === 1;
    } catch (error) {
      logger.error("Error deleting passkey:", { error });

      return false;
    }
  }
}

function mapCredential(record: Passkey): WebAuthnCredential {
  return {
    id: record.credential_id,
    userId: String(record.user_id),
    publicKeyJwk: record.public_key,
    algorithm: record.public_key.kty === "RSA" ? "RS256" : "ES256",
    signCount: record.counter,
    ...(record.transports ? { transports: record.transports } : {}),
    backupEligible: record.device_type === "multiDevice",
    backedUp: record.backed_up,
    createdAt: new Date(record.created_at),
    updatedAt: new Date(record.updated_at),
  };
}
