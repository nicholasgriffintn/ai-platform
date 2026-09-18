import { bufferToBase64 } from "@ngriffin_uk/polychat-utility-server/base64";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

import { createServiceContext } from "~/lib/context/serviceContext";
import type { IEnv, IUser } from "~/types";

import { updateUserSettings } from "../userOperations";

const CREATE_USER_SETTINGS_TABLE = `CREATE TABLE user_settings (
  id text PRIMARY KEY NOT NULL,
  user_id integer NOT NULL,
  nickname text,
  job_role text,
  traits text,
  preferences text,
  guardrails_enabled integer DEFAULT false,
  guardrails_provider text DEFAULT 'llamaguard',
  bedrock_guardrail_id text,
  bedrock_guardrail_version text,
  embedding_provider text DEFAULT 'vectorize',
  bedrock_knowledge_base_id text,
  bedrock_knowledge_base_custom_data_source_id text,
  s3vectors_bucket_name text,
  s3vectors_index_name text,
  s3vectors_region text,
  memories_save_enabled integer DEFAULT false,
  memories_chat_history_enabled integer DEFAULT false,
  temporary_chats_default integer DEFAULT false,
  memory_provider text DEFAULT 'built-in',
  transcription_provider text DEFAULT 'workers',
  transcription_model text DEFAULT 'whisper',
  speech_provider text DEFAULT 'melotts',
  speech_model text DEFAULT '@cf/myshell-ai/melotts',
  search_provider text,
  sandbox_model text,
  tracking_enabled integer DEFAULT true,
  advertise_machines integer DEFAULT true,
  public_key text,
  private_key text,
  created_at text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
  updated_at text DEFAULT (CURRENT_TIMESTAMP),
  pet_source text DEFAULT 'preset',
  pet_id text DEFAULT 'pip',
  pet_travel_enabled integer DEFAULT false,
  pet_animation_enabled integer DEFAULT false,
  pet_model_overrides text DEFAULT '{"families":{},"providers":{}}' NOT NULL,
  default_model_tier text,
  default_model_id text,
  default_compute_site text,
  onboarding_seen text DEFAULT '[]' NOT NULL,
  last_model_selection text
)`;

const CREATE_PROVIDER_SETTINGS_TABLE = `CREATE TABLE provider_settings (
  id text PRIMARY KEY NOT NULL,
  provider_id text NOT NULL,
  user_id integer NOT NULL,
  api_key text,
  enabled integer DEFAULT false,
  created_at text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
  updated_at text DEFAULT (CURRENT_TIMESTAMP)
)`;

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
      sqlite.exec(CREATE_USER_SETTINGS_TABLE);
      sqlite.exec(CREATE_PROVIDER_SETTINGS_TABLE);

      const context = createTestContext(sqlite);

      await expect(
        updateUserSettings(context, { nickname: "New nickname", memories_save_enabled: true }, 42),
      ).resolves.toEqual({
        success: true,
        message: "User settings updated successfully",
      });

      const saved = await context.repositories.userSettings.getUserSettings(42);
      const rows = sqlite.prepare("SELECT COUNT(*) AS count FROM user_settings").get() as {
        count: number;
      };
      const provisioned = sqlite
        .prepare("SELECT public_key, private_key FROM user_settings WHERE user_id = 42")
        .get() as { public_key: string | null; private_key: string | null };

      expect(saved?.nickname).toBe("New nickname");
      expect(saved?.memories_save_enabled).toBe(true);
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
      sqlite.exec(CREATE_USER_SETTINGS_TABLE);
      sqlite.exec(CREATE_PROVIDER_SETTINGS_TABLE);

      const context = createTestContext(sqlite);

      await updateUserSettings(context, { nickname: "First" }, 42);
      await updateUserSettings(context, { nickname: "Second" }, 42);

      const rows = sqlite.prepare("SELECT COUNT(*) AS count FROM user_settings").get() as {
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
      sqlite.exec(CREATE_USER_SETTINGS_TABLE);
      sqlite.exec(CREATE_PROVIDER_SETTINGS_TABLE);

      const context = createTestContext(sqlite);

      await updateUserSettings(context, { last_model_selection: { modelId: "test-model" } }, 42);

      const providers = sqlite.prepare("SELECT COUNT(*) AS count FROM provider_settings").get() as {
        count: number;
      };

      expect(providers.count).toBe(0);
    } finally {
      sqlite.close();
    }
  });
});
