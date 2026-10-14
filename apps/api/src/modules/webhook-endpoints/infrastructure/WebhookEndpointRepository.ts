import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { and, desc, eq, lt, or } from "drizzle-orm";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import { webhookEndpoint, type WebhookEndpointRecord } from "~/infrastructure/database/schema";

export interface CreateWebhookEndpointRecord {
  userId: number;
  url: string;
  description: string;
  events: string[];
  encryptedSecret: string;
}

export type WebhookEndpointChanges = Partial<
  Pick<WebhookEndpointRecord, "url" | "description" | "events" | "enabled" | "encrypted_secret">
>;

export class WebhookEndpointRepository extends BaseRepository {
  async create(input: CreateWebhookEndpointRecord): Promise<WebhookEndpointRecord> {
    const [record] = await this.database
      .insert(webhookEndpoint)
      .values({
        id: generateId(),
        user_id: input.userId,
        url: input.url,
        description: input.description,
        events: input.events,
        encrypted_secret: input.encryptedSecret,
      })
      .returning();

    return record;
  }

  async get(userId: number, id: string): Promise<WebhookEndpointRecord | null> {
    const [record] = await this.database
      .select()
      .from(webhookEndpoint)
      .where(and(eq(webhookEndpoint.id, id), eq(webhookEndpoint.user_id, userId)))
      .limit(1);

    return record ?? null;
  }

  async list(userId: number, limit: number, after?: string): Promise<WebhookEndpointRecord[]> {
    const anchor = after ? await this.get(userId, after) : null;
    const scope = eq(webhookEndpoint.user_id, userId);

    return this.database
      .select()
      .from(webhookEndpoint)
      .where(
        anchor
          ? and(
              scope,
              or(
                lt(webhookEndpoint.created_at, anchor.created_at),
                and(
                  eq(webhookEndpoint.created_at, anchor.created_at),
                  lt(webhookEndpoint.id, anchor.id),
                ),
              ),
            )
          : scope,
      )
      .orderBy(desc(webhookEndpoint.created_at), desc(webhookEndpoint.id))
      .limit(limit);
  }

  async listEnabled(userId: number): Promise<WebhookEndpointRecord[]> {
    return this.database
      .select()
      .from(webhookEndpoint)
      .where(and(eq(webhookEndpoint.user_id, userId), eq(webhookEndpoint.enabled, true)));
  }

  async update(
    userId: number,
    id: string,
    changes: WebhookEndpointChanges,
  ): Promise<WebhookEndpointRecord | null> {
    const [record] = await this.database
      .update(webhookEndpoint)
      .set(changes)
      .where(and(eq(webhookEndpoint.id, id), eq(webhookEndpoint.user_id, userId)))
      .returning();

    return record ?? null;
  }

  async delete(userId: number, id: string): Promise<boolean> {
    const deleted = await this.database
      .delete(webhookEndpoint)
      .where(and(eq(webhookEndpoint.id, id), eq(webhookEndpoint.user_id, userId)))
      .returning({ id: webhookEndpoint.id });

    return deleted.length > 0;
  }
}
