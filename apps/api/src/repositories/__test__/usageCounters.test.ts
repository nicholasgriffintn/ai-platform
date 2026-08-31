import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { IEnv } from "~/types";

import { AnonymousUserRepository } from "../AnonymousUserRepository";
import { UserRepository } from "../UserRepository";

let sqlite: Database.Database;

function createEnv(): IEnv {
  const prepare = (query: string) => {
    const statement = sqlite.prepare(query);

    return {
      bind: (...params: unknown[]) => ({
        first: async () => (statement.reader ? (statement.get(...params) ?? null) : null),
        all: async () => ({ results: statement.all(...params) }),
        run: async () => {
          if (statement.reader) {
            const results = statement.all(...params);

            return { success: true, meta: { changes: results.length } };
          }

          const info = statement.run(...params);

          return { success: true, meta: { changes: info.changes } };
        },
      }),
    };
  };

  return { DB: { prepare } } as unknown as IEnv;
}

function readUser() {
  return sqlite.prepare("SELECT * FROM user WHERE id = 1").get() as Record<string, unknown>;
}

function readAnonymousUser() {
  return sqlite.prepare("SELECT * FROM anonymous_user WHERE id = 'anon-1'").get() as Record<
    string,
    unknown
  >;
}

beforeEach(() => {
  sqlite = new Database(":memory:");
  sqlite.exec(`
    CREATE TABLE user (
      id integer PRIMARY KEY,
      message_count integer DEFAULT 0,
      daily_message_count integer DEFAULT 0,
      daily_reset text,
      last_active_at text,
      updated_at text
    );
    CREATE TABLE anonymous_user (
      id text PRIMARY KEY,
      daily_message_count integer DEFAULT 0,
      daily_reset text,
      last_active_at text,
      updated_at text
    );
  `);
});

afterEach(() => {
  sqlite.close();
});

describe("UserRepository.incrementUsageCounters", () => {
  it("keeps every concurrent increment instead of losing all but one", async () => {
    const occurredAt = new Date("2026-08-31T12:00:00.000Z");

    sqlite
      .prepare(
        "INSERT INTO user (id, message_count, daily_message_count, daily_reset) VALUES (?, ?, ?, ?)",
      )
      .run(1, 0, 0, "2026-08-31T00:05:00.000Z");

    const repository = new UserRepository(createEnv());

    await Promise.all(
      Array.from({ length: 25 }, () =>
        repository.incrementUsageCounters(
          1,
          { message_count: 1, daily_message_count: 1 },
          occurredAt,
        ),
      ),
    );

    const user = readUser();

    expect(user.daily_message_count).toBe(25);
    expect(user.message_count).toBe(25);
    expect(user.daily_reset).toBe("2026-08-31T00:05:00.000Z");
  });

  it("rolls the free-account counter over once on a new UTC day and accumulates the rest", async () => {
    const occurredAt = new Date("2026-09-01T00:30:00.000Z");

    sqlite
      .prepare(
        "INSERT INTO user (id, message_count, daily_message_count, daily_reset) VALUES (?, ?, ?, ?)",
      )
      .run(1, 40, 40, "2026-08-31T23:59:00.000Z");

    const repository = new UserRepository(createEnv());

    await Promise.all(
      Array.from({ length: 5 }, () =>
        repository.incrementUsageCounters(
          1,
          { message_count: 1, daily_message_count: 1 },
          occurredAt,
        ),
      ),
    );

    const user = readUser();

    expect(user.daily_message_count).toBe(5);
    expect(user.message_count).toBe(45);
    expect(user.daily_reset).toBe("2026-09-01T00:30:00.000Z");
  });

  it("returns the persisted row so callers see authoritative counters", async () => {
    sqlite
      .prepare(
        "INSERT INTO user (id, message_count, daily_message_count, daily_reset) VALUES (?, ?, ?, ?)",
      )
      .run(1, 3, 3, "2026-08-31T00:00:00.000Z");

    const repository = new UserRepository(createEnv());
    const updated = await repository.incrementUsageCounters(
      1,
      { message_count: 1, daily_message_count: 1 },
      new Date("2026-08-31T12:00:00.000Z"),
    );

    expect(updated?.daily_message_count).toBe(4);
    expect(updated?.message_count).toBe(4);
  });
});

describe("AnonymousUserRepository.incrementDailyCount", () => {
  it("keeps every concurrent increment instead of losing all but one", async () => {
    const occurredAt = new Date("2026-08-31T12:00:00.000Z");

    sqlite
      .prepare("INSERT INTO anonymous_user (id, daily_message_count, daily_reset) VALUES (?, ?, ?)")
      .run("anon-1", 0, "2026-08-31T00:05:00.000Z");

    const repository = new AnonymousUserRepository(createEnv());

    await Promise.all(
      Array.from({ length: 15 }, () => repository.incrementDailyCount("anon-1", occurredAt)),
    );

    expect(readAnonymousUser().daily_message_count).toBe(15);
  });

  it("restarts the counter on a new UTC day", async () => {
    sqlite
      .prepare("INSERT INTO anonymous_user (id, daily_message_count, daily_reset) VALUES (?, ?, ?)")
      .run("anon-1", 9, "2026-08-30T22:00:00.000Z");

    const repository = new AnonymousUserRepository(createEnv());

    await repository.incrementDailyCount("anon-1", new Date("2026-08-31T01:00:00.000Z"));

    const anonymousUser = readAnonymousUser();

    expect(anonymousUser.daily_message_count).toBe(1);
    expect(anonymousUser.daily_reset).toBe("2026-08-31T01:00:00.000Z");
  });

  it("rejects an increment for an unknown anonymous user", async () => {
    const repository = new AnonymousUserRepository(createEnv());

    await expect(repository.incrementDailyCount("missing")).rejects.toThrow("User not found");
  });
});
