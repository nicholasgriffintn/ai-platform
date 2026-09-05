import { describe, expect, it, vi } from "vitest";

import type { IEnv } from "~/types";
import { decryptJsonPayload, isEncryptedJsonPayload } from "~/utils/crypto";

import { TaskNotificationRepository } from "../TaskNotificationRepository";

describe("TaskNotificationRepository registrations", () => {
  it("replaces one installation endpoint without storing raw destination credentials", async () => {
    const statements: Array<{ query: string; values: unknown[] }> = [];
    const registration = {
      id: "registration-existing",
      user_id: 7,
      installation_id: "installation-1",
      platform: "web",
      endpoint_hash: "stored-hash",
      destination_json: "{}",
      state: "registered",
      failure_code: null,
      updated_at: "2026-09-05T12:00:00.000Z",
    };
    const database = Object.assign(Object.create(null), {
      batch: vi.fn().mockResolvedValue([]),
      prepare: vi.fn((query: string) => ({
        bind: (...values: unknown[]) => {
          statements.push({ query, values });

          return Object.assign(Object.create(null), {
            first: vi
              .fn()
              .mockResolvedValue(
                query.includes("SELECT * FROM task_notification_registration")
                  ? registration
                  : null,
              ),
          });
        },
      })),
    });
    const env: IEnv = Object.assign(Object.create(null), {
      DB: database,
      PRIVATE_KEY: "notification-encryption-key",
    });
    const repository = new TaskNotificationRepository(env);

    await repository.upsertRegistration(7, {
      platform: "web",
      installationId: "installation-1",
      subscription: {
        endpoint: "https://push.example.test/a",
        expirationTime: null,
        keys: { p256dh: "public-key-a", auth: "auth-a" },
      },
    });
    await repository.upsertRegistration(7, {
      platform: "web",
      installationId: "installation-1",
      subscription: {
        endpoint: "https://push.example.test/b",
        expirationTime: null,
        keys: { p256dh: "public-key-b", auth: "auth-b" },
      },
    });

    const inserts = statements.filter(({ query }) =>
      query.includes("INSERT INTO task_notification_registration"),
    );
    const endpointHashes = inserts.map(({ values }) => values[4]);
    const latestEncrypted: unknown = JSON.parse(String(inserts[1].values[5]));

    expect(isEncryptedJsonPayload(latestEncrypted)).toBe(true);

    if (!isEncryptedJsonPayload(latestEncrypted)) {
      throw new Error("Expected an encrypted notification destination");
    }

    const latestDestination = await decryptJsonPayload({
      keyMaterial: env.PRIVATE_KEY ?? "",
      encrypted: latestEncrypted,
      additionalData: "7:web:installation-1",
    });

    expect(database.batch).toHaveBeenCalledTimes(2);
    expect(endpointHashes).toHaveLength(2);
    expect(endpointHashes[0]).not.toBe(endpointHashes[1]);
    expect(String(inserts[0].values[5])).not.toContain("https://push.example.test/a");
    expect(String(inserts[1].values[5])).not.toContain("https://push.example.test/b");
    expect(latestDestination).toEqual({
      endpoint: "https://push.example.test/b",
      p256dh: "public-key-b",
      authSecret: "auth-b",
    });
    expect(statements.filter(({ query }) => query.startsWith("DELETE FROM"))).toHaveLength(2);
  });
});
