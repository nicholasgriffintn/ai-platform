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
      last_active_at text,
      updated_at text
    );
    CREATE TABLE anonymous_user (
      id text PRIMARY KEY,
      credit_period text,
      spent_credit_micros integer DEFAULT 0,
      reserved_credit_micros integer DEFAULT 0,
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
    sqlite.prepare("INSERT INTO user (id, message_count) VALUES (?, ?)").run(1, 0);

    const repository = new UserRepository(createEnv());

    await Promise.all(
      Array.from({ length: 25 }, () => repository.incrementUsageCounters(1, { message_count: 1 })),
    );

    expect(readUser().message_count).toBe(25);
  });

  it("returns the persisted row so callers see authoritative counters", async () => {
    sqlite.prepare("INSERT INTO user (id, message_count) VALUES (?, ?)").run(1, 3);

    const repository = new UserRepository(createEnv());
    const updated = await repository.incrementUsageCounters(1, { message_count: 1 });

    expect(updated?.message_count).toBe(4);
  });
});

describe("AnonymousUserRepository.applyCreditDeltas", () => {
  it("keeps every concurrent credit delta instead of losing all but one", async () => {
    sqlite
      .prepare(
        "INSERT INTO anonymous_user (id, credit_period, spent_credit_micros) VALUES (?, ?, ?)",
      )
      .run("anon-1", "2026-08", 0);

    const repository = new AnonymousUserRepository(createEnv());

    await Promise.all(
      Array.from({ length: 15 }, () =>
        repository.applyCreditDeltas("anon-1", "2026-08", { spent_credit_micros: 1_000 }),
      ),
    );

    expect(readAnonymousUser().spent_credit_micros).toBe(15_000);
  });

  it("restarts the balance when the period rolls over", async () => {
    sqlite
      .prepare(
        "INSERT INTO anonymous_user (id, credit_period, spent_credit_micros, reserved_credit_micros) VALUES (?, ?, ?, ?)",
      )
      .run("anon-1", "2026-08", 9_000, 500);

    const repository = new AnonymousUserRepository(createEnv());

    await repository.applyCreditDeltas("anon-1", "2026-09", { spent_credit_micros: 1_000 });

    const anonymousUser = readAnonymousUser();

    expect(anonymousUser.spent_credit_micros).toBe(1_000);
    expect(anonymousUser.reserved_credit_micros).toBe(0);
    expect(anonymousUser.credit_period).toBe("2026-09");
  });

  it("never drives a released reservation below zero", async () => {
    sqlite
      .prepare(
        "INSERT INTO anonymous_user (id, credit_period, reserved_credit_micros) VALUES (?, ?, ?)",
      )
      .run("anon-1", "2026-08", 500);

    const repository = new AnonymousUserRepository(createEnv());

    await repository.applyCreditDeltas("anon-1", "2026-08", { reserved_credit_micros: -2_000 });

    expect(readAnonymousUser().reserved_credit_micros).toBe(0);
  });

  it("reports a fresh balance once the period has moved on", async () => {
    sqlite
      .prepare(
        "INSERT INTO anonymous_user (id, credit_period, spent_credit_micros) VALUES (?, ?, ?)",
      )
      .run("anon-1", "2026-08", 9_000);

    const repository = new AnonymousUserRepository(createEnv());

    await expect(repository.getCreditSpend("anon-1", "2026-09")).resolves.toEqual({
      spentCreditMicros: 0,
      reservedCreditMicros: 0,
    });
    await expect(repository.getCreditSpend("anon-1", "2026-08")).resolves.toEqual({
      spentCreditMicros: 9_000,
      reservedCreditMicros: 0,
    });
  });
});
