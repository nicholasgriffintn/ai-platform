import { bufferToBase64 } from "@ngriffin_uk/polychat-utility-server/base64";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

import { createServiceContext } from "~/infrastructure/context/serviceContext";
import type { IEnv, IUser } from "~/types";

import { updateUserSettings } from "../userOperations";

const CREATE_SCOPED_CONFIGURATION_TABLE = `CREATE TABLE scoped_configuration (
  kind TEXT NOT NULL,
  id TEXT NOT NULL,
  user_id INTEGER,
  project_id TEXT,
  scope_type TEXT GENERATED ALWAYS AS (CASE WHEN project_id IS NOT NULL THEN 'project' ELSE 'user' END),
  scope_id TEXT GENERATED ALWAYS AS (COALESCE(project_id, CAST(user_id AS TEXT))),
  target_kind TEXT NOT NULL DEFAULT '',
  target_id TEXT,
  payload TEXT NOT NULL DEFAULT '{}',
  encrypted_value TEXT,
  public_key TEXT,
  enabled INTEGER,
  attached INTEGER NOT NULL DEFAULT 0,
  excluded INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER,
  configuration_id TEXT,
  configuration_created_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (kind, id),
  CONSTRAINT scoped_configuration_scope_check CHECK ((user_id IS NOT NULL) != (project_id IS NOT NULL)),
  CONSTRAINT scoped_configuration_kind_check CHECK (
    (kind IN ('preferences', 'provider', 'model') AND user_id IS NOT NULL)
    OR (kind = 'capability' AND target_id IS NOT NULL)
    OR (kind = 'environment' AND project_id IS NOT NULL AND target_id IS NOT NULL AND encrypted_value IS NOT NULL)
  ),
  CONSTRAINT scoped_configuration_attachment_check CHECK (attached = 0 OR (kind = 'capability' AND project_id IS NOT NULL AND created_by IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX scoped_configuration_user_target_idx ON scoped_configuration(user_id, kind, target_id);
--> statement-breakpoint
CREATE INDEX scoped_configuration_project_target_idx ON scoped_configuration(project_id, kind, target_kind, target_id);
--> statement-breakpoint
CREATE INDEX scoped_configuration_target_idx ON scoped_configuration(kind, target_kind, target_id);
--> statement-breakpoint
CREATE UNIQUE INDEX scoped_configuration_capability_idx ON scoped_configuration(scope_type, scope_id, target_kind, target_id) WHERE kind = 'capability';
--> statement-breakpoint
CREATE UNIQUE INDEX scoped_configuration_environment_idx ON scoped_configuration(project_id, target_id) WHERE kind = 'environment';
--> statement-breakpoint
`;

function createFakeD1(sqlite: Database.Database) {
  function makeStatement(query: string, params: unknown[] = []) {
    return {
      bind(...nextParams: unknown[]) {
        return makeStatement(query, nextParams);
      },
      async run() {
        const info = sqlite.prepare(query).run(...(params as never[]));

        return { success: true, meta: { changes: info.changes }, results: [] } as never;
      },
      async all() {
        return sqlite.prepare(query).all(...(params as never[])) as never;
      },
      async first() {
        return (sqlite.prepare(query).get(...(params as never[])) ?? null) as never;
      },
    };
  }

  return {
    prepare(query: string) {
      return makeStatement(query);
    },
    async batch(statements: Array<{ run: () => Promise<unknown> }>) {
      const results = [];

      for (const statement of statements) {
        results.push(await statement.run());
      }

      return results;
    },
  };
}

function createTestContext(sqlite: Database.Database) {
  const env = {
    DB: createFakeD1(sqlite),
    PRIVATE_KEY: bufferToBase64(new Uint8Array(32).fill(7)),
  } as unknown as IEnv;
  const user = { id: 42 } as IUser;

  return createServiceContext({ env, user });
}

describe("user settings provisioning", () => {
  it("persists settings for an account that was never provisioned a settings row", async () => {
    const sqlite = new Database(":memory:");

    try {
      sqlite.exec(CREATE_SCOPED_CONFIGURATION_TABLE);

      const context = createTestContext(sqlite);

      await expect(
        updateUserSettings(context, { nickname: "New nickname", memories_save_enabled: true }, 42),
      ).resolves.toEqual({
        success: true,
        message: "User settings updated successfully",
      });

      const saved = await context.repositories.userSettings.getUserSettings(42);
      const rows = sqlite
        .prepare("SELECT COUNT(*) AS count FROM scoped_configuration WHERE kind = 'preferences'")
        .get() as {
        count: number;
      };
      const provisioned = sqlite
        .prepare(
          "SELECT public_key, encrypted_value AS private_key FROM scoped_configuration WHERE kind = 'preferences' AND user_id = 42",
        )
        .get() as { public_key: string | null; private_key: string | null };

      expect(saved?.nickname).toBe("New nickname");
      expect(saved?.memories_save_enabled).toBe(true);
      expect(saved?.guardrails_provider).toBe("typesafe");
      expect(saved?.guardrails_enabled).toBe(true);
      expect(provisioned.public_key).toBeTruthy();
      expect(provisioned.private_key).toBeTruthy();
      expect(rows.count).toBe(1);
    } finally {
      sqlite.close();
    }
  });

  it("keeps a single settings row across repeated saves", async () => {
    const sqlite = new Database(":memory:");

    try {
      sqlite.exec(CREATE_SCOPED_CONFIGURATION_TABLE);

      const context = createTestContext(sqlite);

      await updateUserSettings(context, { nickname: "First" }, 42);
      await updateUserSettings(context, { nickname: "Second" }, 42);

      const rows = sqlite
        .prepare("SELECT COUNT(*) AS count FROM scoped_configuration WHERE kind = 'preferences'")
        .get() as {
        count: number;
      };
      const saved = await context.repositories.userSettings.getUserSettings(42);

      expect(rows.count).toBe(1);
      expect(saved?.nickname).toBe("Second");
    } finally {
      sqlite.close();
    }
  });

  it("leaves the provider catalogue untouched when saving settings", async () => {
    const sqlite = new Database(":memory:");

    try {
      sqlite.exec(CREATE_SCOPED_CONFIGURATION_TABLE);

      const context = createTestContext(sqlite);

      await updateUserSettings(context, { last_model_selection: { modelId: "test-model" } }, 42);

      const providers = sqlite
        .prepare("SELECT COUNT(*) AS count FROM scoped_configuration WHERE kind = 'provider'")
        .get() as {
        count: number;
      };

      expect(providers.count).toBe(0);
    } finally {
      sqlite.close();
    }
  });
  it("persists and returns DynamoDB settings without overwriting them on an unrelated update", async () => {
    const sqlite = new Database(":memory:");

    try {
      sqlite.exec(CREATE_SCOPED_CONFIGURATION_TABLE);
      const context = createTestContext(sqlite);

      await updateUserSettings(
        context,
        {
          embedding_provider: "dynamodb-vectors",
          dynamodb_vectors_table_name: "polychat-vectors",
          dynamodb_vectors_index_name: "embeddings",
          dynamodb_vectors_region: "eu-west-2",
        },
        42,
      );
      await updateUserSettings(context, { nickname: "Alex" }, 42);
      expect(await context.repositories.userSettings.getUserSettings(42)).toMatchObject({
        embedding_provider: "dynamodb-vectors",
        dynamodb_vectors_table_name: "polychat-vectors",
        dynamodb_vectors_index_name: "embeddings",
        dynamodb_vectors_region: "eu-west-2",
        nickname: "Alex",
      });
    } finally {
      sqlite.close();
    }
  });
});
