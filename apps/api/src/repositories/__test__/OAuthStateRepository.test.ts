import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import * as schema from "~/lib/database/schema";

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
    CREATE TABLE oauth_state (
      state_hash text PRIMARY KEY NOT NULL,
      provider text NOT NULL,
      code_verifier text,
      nonce text,
      redirect_uri text,
      context text,
      created_at text NOT NULL,
      expires_at text NOT NULL
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
  });

  it("returns null for a state hash that was never created", async () => {
    const repository = createRepository();

    await expect(repository.consumeByStateHash("never-created")).resolves.toBeNull();
  });
});
