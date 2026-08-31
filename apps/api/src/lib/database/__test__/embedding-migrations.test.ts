import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

const migrationPath = (name: string) =>
  fileURLToPath(new URL(`../../../../migrations/${name}`, import.meta.url));

const applyMigration = (db: Database.Database, name: string) => {
  const sql = readFileSync(migrationPath(name), "utf8").replaceAll("--> statement-breakpoint", "");

  db.exec(sql);
};

const insertLegacyEmbedding = (
  db: Database.Database,
  input: {
    id: string;
    userId?: number | null;
    namespace?: string | null;
    metadata?: Record<string, unknown>;
    content?: string;
  },
) => {
  db.prepare(
    `INSERT INTO embedding (id, metadata, title, content, type, namespace, user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    input.id,
    JSON.stringify(input.metadata ?? {}),
    `Title for ${input.id}`,
    input.content ?? `Content for ${input.id}`,
    "note",
    input.namespace ?? null,
    input.userId ?? null,
  );
};

describe("embedding lifecycle migrations", () => {
  let db: Database.Database;

  afterEach(() => {
    db?.close();
  });

  it("quarantines only provably scoped legacy records without trusting provider or metadata", () => {
    db = new Database(":memory:");
    db.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE user (id INTEGER PRIMARY KEY NOT NULL);
      CREATE TABLE user_settings (user_id INTEGER PRIMARY KEY, embedding_provider TEXT);
      CREATE TABLE embedding (
        id TEXT PRIMARY KEY NOT NULL,
        metadata TEXT,
        title TEXT,
        content TEXT,
        type TEXT,
        namespace TEXT,
        user_id INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES user(id)
      );
      INSERT INTO user (id) VALUES (42), (99);
      INSERT INTO user_settings (user_id, embedding_provider) VALUES (42, 'mistral');
    `);

    insertLegacyEmbedding(db, {
      id: "proven-parent",
      userId: 42,
      namespace: "user_kb_42",
      metadata: {
        keep: "public-value",
        chunkId: "attacker-chunk",
        content: "private-copy",
        documentId: "attacker-document",
        fileData: "data:private",
        namespace: "user_kb_99",
        provider: "mistral",
        providerTarget: "attacker-target",
        scopeTag: "attacker-scope",
        title: "attacker-title",
        type: "attacker-type",
        userId: "99",
        vectorSpace: "attacker-space",
        vectorSpaceVersion: "attacker-version",
      },
    });
    insertLegacyEmbedding(db, {
      id: "proven-parent-0",
      userId: 42,
      namespace: "user_kb_42",
      metadata: { chunkIndex: 0 },
      content: "Proven child content",
    });
    insertLegacyEmbedding(db, {
      id: "suffix-collision",
      userId: 42,
      namespace: "user_kb_42",
    });
    insertLegacyEmbedding(db, {
      id: "suffix-collision-0",
      userId: 42,
      namespace: "user_kb_42",
      metadata: { chunkIndex: 1 },
      content: "Spoofed child content",
    });
    insertLegacyEmbedding(db, {
      id: "orphan-0",
      userId: 42,
      namespace: "user_kb_42",
      metadata: { chunkIndex: 0 },
      content: "Orphan content",
    });
    insertLegacyEmbedding(db, {
      id: "wrong-namespace",
      userId: 42,
      namespace: "user_kb_99",
    });
    insertLegacyEmbedding(db, {
      id: "missing-user",
      namespace: "user_kb_42",
    });

    applyMigration(db, "0008_organic_spacker_dave.sql");
    applyMigration(db, "0009_backfill_scoped_embeddings.sql");

    const documents = db
      .prepare(
        `SELECT logical_id, metadata, lifecycle_status, provider, provider_target,
                embedding_model, vector_space, vector_space_version
         FROM embedding_document
         ORDER BY logical_id`,
      )
      .all() as Array<Record<string, unknown>>;
    const chunks = db
      .prepare(
        `SELECT d.logical_id, c.vector_id, c.chunk_index, c.content, c.lifecycle_status,
                c.provider, c.provider_target, c.embedding_model, c.vector_space_version
         FROM embedding_chunk c
         JOIN embedding_document d ON d.id = c.document_id
         ORDER BY c.vector_id`,
      )
      .all() as Array<Record<string, unknown>>;

    expect(documents.map(({ logical_id }) => logical_id)).toEqual([
      "orphan-0",
      "proven-parent",
      "suffix-collision",
      "suffix-collision-0",
    ]);
    expect(documents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          logical_id: "proven-parent",
          metadata: JSON.stringify({ keep: "public-value" }),
        }),
      ]),
    );
    expect(documents.every(({ lifecycle_status }) => lifecycle_status === "pending")).toBe(true);
    expect(documents.every(({ provider }) => provider === "quarantined")).toBe(true);
    expect(documents.every(({ provider_target }) => provider_target === "quarantined-legacy")).toBe(
      true,
    );
    expect(documents.every(({ embedding_model }) => embedding_model === "unknown-legacy")).toBe(
      true,
    );
    expect(documents.every(({ vector_space }) => vector_space === "legacy-unresolved")).toBe(true);
    expect(documents.every(({ vector_space_version }) => vector_space_version === "legacy")).toBe(
      true,
    );

    expect(chunks).toEqual([
      expect.objectContaining({
        logical_id: "orphan-0",
        vector_id: "orphan-0",
        chunk_index: 0,
      }),
      expect.objectContaining({
        logical_id: "proven-parent",
        vector_id: "proven-parent-0",
        chunk_index: 0,
        content: "Proven child content",
      }),
      expect.objectContaining({
        logical_id: "suffix-collision",
        vector_id: "suffix-collision",
        chunk_index: 0,
      }),
      expect.objectContaining({
        logical_id: "suffix-collision-0",
        vector_id: "suffix-collision-0",
        chunk_index: 0,
        content: "Spoofed child content",
      }),
    ]);
    expect(chunks.every(({ lifecycle_status }) => lifecycle_status === "pending")).toBe(true);
    expect(chunks.every(({ provider }) => provider === "quarantined")).toBe(true);
    expect(chunks.every(({ provider_target }) => provider_target === "quarantined-legacy")).toBe(
      true,
    );
    expect(chunks.every(({ embedding_model }) => embedding_model === "unknown-legacy")).toBe(true);
    expect(chunks.every(({ vector_space_version }) => vector_space_version === "legacy")).toBe(
      true,
    );
  });
});
