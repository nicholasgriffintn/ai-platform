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
  stripe_price_id: text(),
  created_at: text().default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updated_at: text()
    .default(sql`(CURRENT_TIMESTAMP)`)
    .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
});

export const anonymousUser = sqliteTable("anonymous_user", {
  id: text().primaryKey(),
  ip_address: text().notNull(),
  user_agent: text(),
  daily_message_count: integer("daily_message_count").default(0),
  daily_reset: text("daily_reset"),
  created_at: text().default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updated_at: text()
    .default(sql`(CURRENT_TIMESTAMP)`)
    .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
  last_active_at: text("last_active_at"),
  captcha_verified: integer({ mode: "boolean" }).default(false),
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
  role: text({
    enum: ["user", "admin", "moderator"],
  }).default("user"),
  created_at: text().default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updated_at: text()
    .default(sql`(CURRENT_TIMESTAMP)`)
    .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
  setup_at: text(),
  terms_accepted_at: text(),
  plan_id: text()
    .references(() => plans.id)
    .default("free"),
  message_count: integer("message_count").default(0),
  daily_message_count: integer("daily_message_count").default(0),
  daily_reset: text("daily_reset"),
  daily_pro_message_count: integer("daily_pro_message_count").default(0),
  daily_pro_reset: text("daily_pro_reset"),
  last_active_at: text("last_active_at"),
  stripe_customer_id: text(),
  stripe_subscription_id: text(),
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
  jwt_token: text(),
  jwt_expires_at: text(),
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
    parent_conversation_id: text().references(() => conversation.id),
    parent_message_id: text(),
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
    parentConversationIdIdx: index(
      "conversation_parent_conversation_id_idx",
    ).on(table.parent_conversation_id),
    parentMessageIdIdx: index("conversation_parent_message_id_idx").on(
      table.parent_message_id,
    ),
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
    parts: text({
      mode: "json",
    }),
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
    tool_call_id: text(),
    tool_call_arguments: text({
      mode: "json",
    }),
    app: text(),
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
      enum: ["bedrock", "vectorize", "s3vectors"],
    }).default("vectorize"),
    bedrock_knowledge_base_id: text(),
    bedrock_knowledge_base_custom_data_source_id: text(),
    s3vectors_bucket_name: text(),
    s3vectors_index_name: text(),
    s3vectors_region: text(),
    memories_save_enabled: integer({ mode: "boolean" }).default(false),
    memories_chat_history_enabled: integer({ mode: "boolean" }).default(false),
    transcription_provider: text({
      enum: ["workers", "mistral", "replicate"],
    }).default("workers"),
    transcription_model: text().default("whisper"),
    search_provider: text({
      enum: ["duckduckgo", "tavily", "serper", "parallel", "perplexity"],
    }),
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

export const appData = sqliteTable(
  "app_data",
  {
    id: text().primaryKey(),
    user_id: integer()
      .notNull()
      .references(() => user.id),
    app_id: text().notNull(),
    item_id: text(),
    item_type: text(),
    data: text({
      mode: "json",
    }),
    share_id: text().unique(),
    created_at: text().default(sql`(CURRENT_TIMESTAMP)`).notNull(),
    updated_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    userIdIdx: index("app_data_user_id_idx").on(table.user_id),
    appIdIdx: index("app_data_app_id_idx").on(table.app_id),
    itemIdIdx: index("app_data_item_id_idx").on(table.item_id),
    itemTypeIdx: index("app_data_item_type_idx").on(table.item_type),
    shareIdIdx: index("app_data_share_id_idx").on(table.share_id),
    lookupIdx: index("app_data_lookup_idx").on(
      table.user_id,
      table.app_id,
      table.item_id,
      table.item_type,
    ),
  }),
);

export type AppData = typeof appData.$inferSelect;

export const agents = sqliteTable(
  "agents",
  {
    id: text().primaryKey(),
    user_id: integer()
      .notNull()
      .references(() => user.id),
    name: text().notNull(),
    description: text().default("").notNull(),
    avatar_url: text(),
    servers: text({ mode: "json" }).notNull(),
    model: text(),
    temperature: text(),
    max_steps: integer(),
    system_prompt: text(),
    few_shot_examples: text({ mode: "json" }),
    team_id: text(),
    team_role: text(),
    is_team_agent: integer({ mode: "boolean" }).default(false),
    created_at: text().default(sql`(CURRENT_TIMESTAMP)`).notNull(),
    updated_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    userIdIdx: index("agents_user_id_idx").on(table.user_id),
    teamIdIdx: index("agents_team_id_idx").on(table.team_id),
  }),
);

export type Agent = typeof agents.$inferSelect;

export const sharedAgents = sqliteTable(
  "shared_agents",
  {
    id: text().primaryKey(),
    agent_id: text()
      .notNull()
      .references(() => agents.id),
    user_id: integer()
      .notNull()
      .references(() => user.id),
    name: text().notNull(),
    description: text().default("").notNull(),
    avatar_url: text(),
    category: text(),
    tags: text({ mode: "json" }),
    is_featured: integer({ mode: "boolean" }).default(false),
    is_public: integer({ mode: "boolean" }).default(true),
    usage_count: integer().default(0),
    rating_count: integer().default(0),
    rating_average: text().default("0"),
    template_data: text({ mode: "json" }).notNull(),
    created_at: text().default(sql`(CURRENT_TIMESTAMP)`).notNull(),
    updated_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    agentIdIdx: index("shared_agents_agent_id_idx").on(table.agent_id),
    userIdIdx: index("shared_agents_user_id_idx").on(table.user_id),
    categoryIdx: index("shared_agents_category_idx").on(table.category),
    featuredIdx: index("shared_agents_featured_idx").on(table.is_featured),
    publicIdx: index("shared_agents_public_idx").on(table.is_public),
    usageIdx: index("shared_agents_usage_idx").on(table.usage_count),
    ratingIdx: index("shared_agents_rating_idx").on(table.rating_average),
  }),
);

export type SharedAgent = typeof sharedAgents.$inferSelect;

export const agentInstalls = sqliteTable(
  "agent_installs",
  {
    id: text().primaryKey(),
    shared_agent_id: text()
      .notNull()
      .references(() => sharedAgents.id),
    user_id: integer()
      .notNull()
      .references(() => user.id),
    agent_id: text()
      .notNull()
      .references(() => agents.id),
    created_at: text().default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  },
  (table) => ({
    sharedAgentIdIdx: index("agent_installs_shared_agent_id_idx").on(
      table.shared_agent_id,
    ),
    userIdIdx: index("agent_installs_user_id_idx").on(table.user_id),
    agentIdIdx: index("agent_installs_agent_id_idx").on(table.agent_id),
    uniqueInstall: index("agent_installs_unique_idx").on(
      table.shared_agent_id,
      table.user_id,
    ),
  }),
);

export type AgentInstall = typeof agentInstalls.$inferSelect;

export const agentRatings = sqliteTable(
  "agent_ratings",
  {
    id: text().primaryKey(),
    shared_agent_id: text()
      .notNull()
      .references(() => sharedAgents.id),
    user_id: integer()
      .notNull()
      .references(() => user.id),
    rating: integer().notNull(),
    review: text(),
    created_at: text().default(sql`(CURRENT_TIMESTAMP)`).notNull(),
    updated_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    sharedAgentIdIdx: index("agent_ratings_shared_agent_id_idx").on(
      table.shared_agent_id,
    ),
    userIdIdx: index("agent_ratings_user_id_idx").on(table.user_id),
    ratingIdx: index("agent_ratings_rating_idx").on(table.rating),
    uniqueRating: index("agent_ratings_unique_idx").on(
      table.shared_agent_id,
      table.user_id,
    ),
  }),
);

export type AgentRating = typeof agentRatings.$inferSelect;

export const memories = sqliteTable(
  "memories",
  {
    id: text().primaryKey(),
    user_id: integer()
      .notNull()
      .references(() => user.id),
    text: text().notNull(),
    category: text({
      enum: ["fact", "preference", "schedule", "general", "snapshot"],
    }).notNull(),
    conversation_id: text(),
    metadata: text(),
    vector_id: text(),
    created_at: text().default(sql`(CURRENT_TIMESTAMP)`).notNull(),
    updated_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    userIdIdx: index("memories_user_id_idx").on(table.user_id),
    categoryIdx: index("memories_category_idx").on(table.category),
    conversationIdIdx: index("memories_conversation_id_idx").on(
      table.conversation_id,
    ),
    vectorIdIdx: index("memories_vector_id_idx").on(table.vector_id),
  }),
);

export type Memory = typeof memories.$inferSelect;

export const memoryGroups = sqliteTable(
  "memory_groups",
  {
    id: text().primaryKey(),
    user_id: integer()
      .notNull()
      .references(() => user.id),
    title: text().notNull(),
    description: text(),
    category: text({
      enum: ["fact", "preference", "schedule", "general", "snapshot"],
    }),
    created_at: text().default(sql`(CURRENT_TIMESTAMP)`).notNull(),
    updated_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    userIdIdx: index("memory_groups_user_id_idx").on(table.user_id),
    categoryIdx: index("memory_groups_category_idx").on(table.category),
  }),
);

export type MemoryGroup = typeof memoryGroups.$inferSelect;

export const memoryGroupMembers = sqliteTable(
  "memory_group_members",
  {
    id: text().primaryKey(),
    group_id: text()
      .notNull()
      .references(() => memoryGroups.id, { onDelete: "cascade" }),
    memory_id: text()
      .notNull()
      .references(() => memories.id, { onDelete: "cascade" }),
    similarity_score: text(),
    created_at: text().default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  },
  (table) => ({
    groupIdIdx: index("memory_group_members_group_id_idx").on(table.group_id),
    memoryIdIdx: index("memory_group_members_memory_id_idx").on(
      table.memory_id,
    ),
    uniqueMember: index("memory_group_members_unique_idx").on(
      table.group_id,
      table.memory_id,
    ),
  }),
);

export type MemoryGroupMember = typeof memoryGroupMembers.$inferSelect;
