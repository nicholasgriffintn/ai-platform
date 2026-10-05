import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import * as schema from "~/infrastructure/database/schema";

import { OAuthStateRepository } from "../OAuthStateRepository";

let sqlite: Database.Database;

function createRepository(): OAuthStateRepository {
  const repository = new OAuthStateRepository({ DB: {} } as any);

  (repository as unknown as { database: unknown }).database = drizzle(sqlite, {
    schema,
  });

  return repository;
}

beforeEach(() => {
  sqlite = new Database(":memory:");
  sqlite.exec(`
    CREATE TABLE authentication_token (
      purpose text NOT NULL,
      token_hash text NOT NULL,
      provider text NOT NULL,
      kind text,
      session_id text,
      binding_id text,
      user_id integer,
      consumed_at text,
      payload text,
      oauth_data text,
      created_at text NOT NULL,
      expires_at text NOT NULL,
      attempts integer DEFAULT 0 NOT NULL,
      PRIMARY KEY (purpose, token_hash)
    );
  `);
});

afterEach(() => {
  sqlite.close();
});

describe("OAuthStateRepository.consumeByStateHash", () => {
  it("returns the record on first consumption and prevents replay on the second", async () => {
    const repository = createRepository();
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    const expiresAt = new Date("2026-01-01T00:10:00.000Z");

    await repository.create({
      stateHash: "state-hash-1",
      provider: "github",
      codeVerifier: "verifier",
      createdAt,
      expiresAt,
    });

    sqlite
      .prepare(`INSERT INTO authentication_token
      (purpose, token_hash, provider, kind, payload, created_at, expires_at)
      VALUES ('challenge', 'state-hash-1', 'github', 'otp', '{}', ?, ?)`)
      .run(createdAt.toISOString(), expiresAt.toISOString());

    const first = await repository.consumeByStateHash("state-hash-1");

    expect(first).toMatchObject({
      stateHash: "state-hash-1",
      provider: "github",
      codeVerifier: "verifier",
    });
    expect(first?.createdAt).toEqual(createdAt);
    expect(first?.expiresAt).toEqual(expiresAt);

    const second = await repository.consumeByStateHash("state-hash-1");

    expect(second).toBeNull();
    expect(
      sqlite
        .prepare("SELECT purpose FROM authentication_token WHERE token_hash = ?")
        .get("state-hash-1"),
    ).toEqual({ purpose: "challenge" });
  });

  it("returns null for a state hash that was never created", async () => {
    const repository = createRepository();

    await expect(repository.consumeByStateHash("never-created")).resolves.toBeNull();
  });
});
