import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const plans = sqliteTable("plans", {
  id: text().primaryKey(),
  name: text(),
  description: text(),
  price: integer(),
  created_at: text().default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updated_at: text()
    .default(sql`(CURRENT_TIMESTAMP)`)
    .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
});

export const user = sqliteTable("user", {
  id: integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
  name: text(),
  avatar_url: text(),
  email: text().unique().notNull(),
  github_username: text(),
  company: text(),
  site: text(),
  location: text(),
  bio: text(),
  twitter_username: text(),
  created_at: text().default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updated_at: text()
    .default(sql`(CURRENT_TIMESTAMP)`)
    .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
  setup_at: text(),
  terms_accepted_at: text(),
  plan_id: text()
    .references(() => plans.id)
    .default("free"),
});

export type User = typeof user.$inferSelect;

export const oauthAccount = sqliteTable(
  "oauth_account",
  {
    provider_id: text(),
    provider_user_id: text(),
    user_id: integer()
      .notNull()
      .references(() => user.id),
  },
  (table: any) => [
    primaryKey({ columns: [table.provider_id, table.provider_user_id] }),
  ],
);

export const session = sqliteTable("session", {
  id: text().primaryKey(),
  user_id: integer()
    .notNull()
    .references(() => user.id),
  expires_at: text().notNull(),
});

export type Session = typeof session.$inferSelect;

export const embedding = sqliteTable("embedding", {
  id: text().primaryKey(),
  metadata: text(),
  title: text(),
  content: text(),
  type: text(),
  namespace: text(),
  created_at: text().default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updated_at: text()
    .default(sql`(CURRENT_TIMESTAMP)`)
    .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
});

export type Embedding = typeof embedding.$inferSelect;

export const conversation = sqliteTable(
  "conversation",
  {
    id: text().primaryKey(),
    user_id: integer()
      .notNull()
      .references(() => user.id),
    title: text().default("New Conversation"),
    is_archived: integer({ mode: "boolean" }).default(false),
    is_public: integer({ mode: "boolean" }).default(false),
    share_id: text().unique(),
    last_message_id: text(),
    last_message_at: text(),
    message_count: integer().default(0),
    created_at: text().default(sql`(CURRENT_TIMESTAMP)`).notNull(),
    updated_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    titleIdx: index("conversation_title_idx").on(table.title),
    archivedIdx: index("conversation_archived_idx").on(table.is_archived),
    publicIdx: index("conversation_public_idx").on(table.is_public),
    shareIdIdx: index("conversation_share_id_idx").on(table.share_id),
    userIdIdx: index("conversation_user_id_idx").on(table.user_id),
  }),
);

export type Conversation = typeof conversation.$inferSelect;

export const message = sqliteTable(
  "message",
  {
    id: text().primaryKey(),
    conversation_id: text()
      .notNull()
      .references(() => conversation.id),
    parent_message_id: text(),
    role: text({
      enum: ["user", "assistant", "system", "tool", "developer"],
    }).notNull(),
    content: text().notNull(),
    name: text(),
    tool_calls: text({
      mode: "json",
    }),
    citations: text({
      mode: "json",
    }),
    model: text(),
    status: text(),
    timestamp: integer(),
    platform: text({
      enum: ["web", "mobile", "api", "dynamic-apps"],
    }),
    mode: text({
      enum: ["normal", "local", "remote", "prompt_coach", "no_system"],
    }),
    log_id: text(),
    data: text({
      mode: "json",
    }),
    usage: text({
      mode: "json",
    }),
    created_at: text().default(sql`(CURRENT_TIMESTAMP)`).notNull(),
    updated_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    conversationIdx: index("message_conversation_id_idx").on(
      table.conversation_id,
    ),
    parentMessageIdx: index("message_parent_message_id_idx").on(
      table.parent_message_id,
    ),
    roleIdx: index("message_role_idx").on(table.role),
  }),
);

export type Message = typeof message.$inferSelect;

export const userSettings = sqliteTable(
  "user_settings",
  {
    id: text().primaryKey(),
    user_id: integer()
      .notNull()
      .references(() => user.id),
    nickname: text(),
    job_role: text(),
    traits: text(),
    preferences: text(),
    guardrails_enabled: integer({ mode: "boolean" }).default(false),
    guardrails_provider: text({
      enum: ["bedrock", "llamaguard"],
    }).default("llamaguard"),
    bedrock_guardrail_id: text(),
    bedrock_guardrail_version: text(),
    embedding_provider: text({
      enum: ["bedrock", "vectorize"],
    }).default("vectorize"),
    bedrock_knowledge_base_id: text(),
    bedrock_knowledge_base_custom_data_source_id: text(),
    memories_save_enabled: integer({ mode: "boolean" }).default(false),
    memories_chat_history_enabled: integer({ mode: "boolean" }).default(false),
    tracking_enabled: integer({ mode: "boolean" }).default(true),
    public_key: text(),
    private_key: text(),
    created_at: text().default(sql`(CURRENT_TIMESTAMP)`).notNull(),
    updated_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    userIdIdx: index("user_settings_user_id_idx").on(table.user_id),
  }),
);

export type UserSettings = typeof userSettings.$inferSelect;

export const userApiKeys = sqliteTable(
  "user_api_keys",
  {
    id: text().primaryKey(),
    user_id: integer()
      .notNull()
      .references(() => user.id),
    api_key: text().notNull(),
    hashed_key: text().notNull().unique(),
    name: text().default("API Key"),
    created_at: text().default(sql`(CURRENT_TIMESTAMP)`).notNull(),
    updated_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    userIdIdx: index("user_api_keys_user_id_idx").on(table.user_id),
    hashedKeyIdx: index("user_api_keys_hashed_key_idx").on(table.hashed_key),
  }),
);

export type UserApiKeys = typeof userApiKeys.$inferSelect;

export const providerSettings = sqliteTable(
  "provider_settings",
  {
    id: text().primaryKey(),
    provider_id: text().notNull(),
    user_id: integer()
      .notNull()
      .references(() => user.id),
    api_key: text(),
    enabled: integer({ mode: "boolean" }).default(false),
    created_at: text().default(sql`(CURRENT_TIMESTAMP)`).notNull(),
    updated_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    userIdIdx: index("provider_settings_user_id_idx").on(table.user_id),
    providerIdIdx: index("provider_settings_provider_id_idx").on(
      table.provider_id,
    ),
  }),
);

export type ProviderSettings = typeof providerSettings.$inferSelect;

export const modelSettings = sqliteTable(
  "model_settings",
  {
    id: text().primaryKey(),
    user_id: integer()
      .notNull()
      .references(() => user.id),
    model_id: text().default("default"),
    enabled: integer({ mode: "boolean" }).default(true),
    api_key: text(),
    created_at: text().default(sql`(CURRENT_TIMESTAMP)`).notNull(),
    updated_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    userIdIdx: index("model_settings_user_id_idx").on(table.user_id),
    modelIdIdx: index("model_settings_model_id_idx").on(table.model_id),
    enabledIdx: index("model_settings_enabled_idx").on(table.enabled),
  }),
);

export type ModelSettings = typeof modelSettings.$inferSelect;

export const passkey = sqliteTable(
  "passkey",
  {
    id: integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
    user_id: integer()
      .notNull()
      .references(() => user.id),
    credential_id: text().notNull().unique(),
    public_key: text().notNull(),
    counter: integer().notNull(),
    device_type: text().notNull(),
    backed_up: integer({ mode: "boolean" }).notNull(),
    transports: text({
      mode: "json",
    }),
    created_at: text().default(sql`(CURRENT_TIMESTAMP)`).notNull(),
    updated_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    userIdIdx: index("passkey_user_id_idx").on(table.user_id),
    credentialIdIdx: index("passkey_credential_id_idx").on(table.credential_id),
  }),
);

export type Passkey = typeof passkey.$inferSelect;

export const webauthnChallenge = sqliteTable(
  "webauthn_challenge",
  {
    id: integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
    user_id: integer().references(() => user.id),
    challenge: text().notNull(),
    expires_at: text().notNull(),
    created_at: text().default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  },
  (table) => ({
    userIdIdx: index("webauthn_challenge_user_id_idx").on(table.user_id),
    challengeIdx: index("webauthn_challenge_challenge_idx").on(table.challenge),
    expiresAtIdx: index("webauthn_challenge_expires_at_idx").on(
      table.expires_at,
    ),
  }),
);

export type WebAuthnChallenge = typeof webauthnChallenge.$inferSelect;

export const magicLinkNonces = sqliteTable(
  "magic_link_nonce",
  {
    nonce: text("nonce").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    userIdx: index("magic_link_nonce_user_idx").on(table.userId),
    expiresIdx: index("magic_link_nonce_expires_idx").on(table.expiresAt),
  }),
);

export type MagicLinkNonce = typeof magicLinkNonces.$inferSelect;
export type NewMagicLinkNonce = typeof magicLinkNonces.$inferInsert;
