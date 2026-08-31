import type { AuthChallengeKind } from "@ngriffin_uk/auth-protocol";
import type {
  ProjectTaskConstraints,
  ProjectTaskCompletion,
  ProjectTaskContext,
  ProjectTaskCriterion,
  ProjectTaskRunner,
  StoredPetModelOverrides,
  ToolPermission,
} from "@ngriffin_uk/polychat-schemas";
import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const plans = sqliteTable("plans", {
  id: text().primaryKey(),
  name: text(),
  description: text(),
  price: integer(),
  stripe_price_id: text(),
  created_at: text()
    .default(sql`(CURRENT_TIMESTAMP)`)
    .notNull(),
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
  created_at: text()
    .default(sql`(CURRENT_TIMESTAMP)`)
    .notNull(),
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
  created_at: text()
    .default(sql`(CURRENT_TIMESTAMP)`)
    .notNull(),
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
  byok_message_count: integer("byok_message_count").default(0),
  daily_byok_message_count: integer("daily_byok_message_count").default(0),
  daily_byok_reset: text("daily_byok_reset"),
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
  (table: any) => [primaryKey({ columns: [table.provider_id, table.provider_user_id] })],
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

export const oauthState = sqliteTable(
  "oauth_state",
  {
    state_hash: text().primaryKey(),
    provider: text().notNull(),
    code_verifier: text(),
    nonce: text(),
    redirect_uri: text(),
    context: text({ mode: "json" }).$type<Readonly<Record<string, string>>>(),
    created_at: text().notNull(),
    expires_at: text().notNull(),
  },
  (table) => ({
    expiresAtIdx: index("oauth_state_expires_at_idx").on(table.expires_at),
  }),
);

export const authChallenge = sqliteTable(
  "auth_challenge",
  {
    token_hash: text().primaryKey(),
    provider: text().notNull(),
    kind: text().$type<AuthChallengeKind>().notNull(),
    payload: text({ mode: "json" }).$type<Readonly<Record<string, unknown>>>().notNull(),
    created_at: text().notNull(),
    expires_at: text().notNull(),
    attempts: integer().default(0).notNull(),
  },
  (table) => ({
    expiresAtIdx: index("auth_challenge_expires_at_idx").on(table.expires_at),
  }),
);

export const mobileAuthExchangeCodes = sqliteTable(
  "mobile_auth_exchange_code",
  {
    jti: text().primaryKey(),
    session_id: text()
      .notNull()
      .references(() => session.id, { onDelete: "cascade" }),
    user_id: integer()
      .notNull()
      .references(() => user.id),
    expires_at: text().notNull(),
    consumed_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
  },
  (table) => ({
    expiresAtIdx: index("mobile_auth_exchange_code_expires_at_idx").on(table.expires_at),
    sessionIdx: index("mobile_auth_exchange_code_session_idx").on(table.session_id),
  }),
);

export const embedding = sqliteTable(
  "embedding",
  {
    id: text().primaryKey(),
    metadata: text(),
    title: text(),
    content: text(),
    type: text(),
    namespace: text(),
    user_id: integer().references(() => user.id),
    created_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
    updated_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    namespaceIdx: index("embedding_namespace_idx").on(table.namespace),
    userIdIdx: index("embedding_user_id_idx").on(table.user_id),
    scopeLookupIdx: index("embedding_scope_lookup_idx").on(
      table.id,
      table.type,
      table.namespace,
      table.user_id,
    ),
  }),
);

export type Embedding = typeof embedding.$inferSelect;

export const embeddingDocument = sqliteTable(
  "embedding_document",
  {
    id: text().primaryKey(),
    scope_type: text().default("personal").notNull(),
    user_id: integer()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    logical_id: text().notNull(),
    type: text().notNull(),
    title: text().default("").notNull(),
    metadata: text({ mode: "json" }).$type<Readonly<Record<string, unknown>>>().notNull(),
    lifecycle_status: text().default("pending").notNull(),
    provider: text().notNull(),
    provider_target: text().default("quarantined-legacy").notNull(),
    embedding_model: text().default("unknown-legacy").notNull(),
    vector_space: text().notNull(),
    vector_space_version: text().default("legacy").notNull(),
    created_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
    updated_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    lifecycleCheck: check(
      "embedding_document_lifecycle_check",
      sql`${table.lifecycle_status} IN ('pending', 'active', 'delete_pending')`,
    ),
    personalScopeCheck: check(
      "embedding_document_personal_scope_check",
      sql`${table.scope_type} = 'personal'`,
    ),
    userLogicalIdIdx: uniqueIndex("embedding_document_user_logical_id_idx").on(
      table.user_id,
      table.logical_id,
    ),
    userLifecycleIdx: index("embedding_document_user_lifecycle_idx").on(
      table.user_id,
      table.lifecycle_status,
    ),
  }),
);

export const embeddingChunk = sqliteTable(
  "embedding_chunk",
  {
    id: text().primaryKey(),
    document_id: text()
      .notNull()
      .references(() => embeddingDocument.id, { onDelete: "cascade" }),
    vector_id: text().notNull(),
    chunk_index: integer().notNull(),
    content: text().notNull(),
    metadata: text({ mode: "json" }).$type<Readonly<Record<string, unknown>>>().notNull(),
    lifecycle_status: text().default("pending").notNull(),
    provider: text().notNull(),
    provider_target: text().default("quarantined-legacy").notNull(),
    embedding_model: text().default("unknown-legacy").notNull(),
    vector_space: text().notNull(),
    vector_space_version: text().default("legacy").notNull(),
    created_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
    updated_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    lifecycleCheck: check(
      "embedding_chunk_lifecycle_check",
      sql`${table.lifecycle_status} IN ('pending', 'active', 'delete_pending')`,
    ),
    documentChunkIdx: uniqueIndex("embedding_chunk_document_index_idx").on(
      table.document_id,
      table.chunk_index,
    ),
    vectorIdIdx: uniqueIndex("embedding_chunk_vector_id_idx").on(table.vector_id),
    documentLifecycleIdx: index("embedding_chunk_document_lifecycle_idx").on(
      table.document_id,
      table.lifecycle_status,
    ),
  }),
);

export type EmbeddingDocument = typeof embeddingDocument.$inferSelect;
export type EmbeddingChunk = typeof embeddingChunk.$inferSelect;

export const workspace = sqliteTable(
  "workspace",
  {
    id: text().primaryKey(),
    name: text().notNull(),
    description: text().default("").notNull(),
    colour: text().default("#E8643C").notNull(),
    created_by: integer()
      .notNull()
      .references(() => user.id),
    created_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
    updated_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    createdByIdx: index("workspace_created_by_idx").on(table.created_by),
  }),
);

export type Workspace = typeof workspace.$inferSelect;

export const workspaceMember = sqliteTable(
  "workspace_member",
  {
    workspace_id: text()
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    user_id: integer()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text({ enum: ["owner", "admin", "member"] }).notNull(),
    joined_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.workspace_id, table.user_id] }),
    userIdIdx: index("workspace_member_user_id_idx").on(table.user_id),
  }),
);

export type WorkspaceMember = typeof workspaceMember.$inferSelect;

export const workspaceInvitation = sqliteTable(
  "workspace_invitation",
  {
    id: text().primaryKey(),
    workspace_id: text()
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    email: text().notNull(),
    role: text({ enum: ["admin", "member"] }).notNull(),
    token_hash: text().notNull().unique(),
    status: text({ enum: ["pending", "accepted", "revoked"] })
      .default("pending")
      .notNull(),
    invited_by: integer()
      .notNull()
      .references(() => user.id),
    accepted_by: integer().references(() => user.id),
    expires_at: text().notNull(),
    accepted_at: text(),
    created_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
    updated_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    workspaceEmailIdx: uniqueIndex("workspace_invitation_workspace_email_idx").on(
      table.workspace_id,
      table.email,
    ),
    workspaceStatusIdx: index("workspace_invitation_workspace_status_idx").on(
      table.workspace_id,
      table.status,
    ),
  }),
);

export type WorkspaceInvitation = typeof workspaceInvitation.$inferSelect;

export const project = sqliteTable(
  "project",
  {
    id: text().primaryKey(),
    workspace_id: text()
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    name: text().notNull(),
    description: text().default("").notNull(),
    instructions: text().default("").notNull(),
    colour: text().default("#2563EB").notNull(),
    coding_enabled: integer({ mode: "boolean" }).default(false).notNull(),
    coding_installation_id: integer(),
    coding_repository: text(),
    coding_prompt_strategy: text().default("auto").notNull(),
    coding_should_commit: integer({ mode: "boolean" }).default(true).notNull(),
    coding_timeout_seconds: integer().default(900).notNull(),
    flow: text({ mode: "json" }).$type<Record<string, unknown> | null>(),
    created_by: integer()
      .notNull()
      .references(() => user.id),
    archived_at: text(),
    created_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
    updated_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    workspaceIdx: index("project_workspace_id_idx").on(table.workspace_id),
    workspaceNameIdx: uniqueIndex("project_workspace_name_idx")
      .on(table.workspace_id, table.name)
      .where(sql`${table.archived_at} IS NULL`),
  }),
);

export type Project = typeof project.$inferSelect;

export const authoredSkill = sqliteTable(
  "authored_skill",
  {
    id: text().primaryKey(),
    scope_type: text({ enum: ["personal", "project"] }).notNull(),
    scope_id: text().notNull(),
    name: text().notNull(),
    created_by: integer()
      .notNull()
      .references(() => user.id),
    draft_revision_id: text().notNull(),
    stable_revision_id: text().notNull(),
    state_version: integer().default(1).notNull(),
    archived_at: text(),
    created_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
    updated_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
  },
  (table) => ({
    scopeNameIdx: uniqueIndex("authored_skill_scope_name_idx")
      .on(table.scope_type, table.scope_id, table.name)
      .where(sql`${table.archived_at} IS NULL`),
    scopeTypeCheck: check(
      "authored_skill_scope_type_check",
      sql`${table.scope_type} IN ('personal', 'project')`,
    ),
    stateVersionCheck: check(
      "authored_skill_state_version_check",
      sql`${table.state_version} >= 1`,
    ),
  }),
);

export type AuthoredSkill = typeof authoredSkill.$inferSelect;

export const authoredSkillRevision = sqliteTable(
  "authored_skill_revision",
  {
    id: text().primaryKey(),
    skill_id: text()
      .notNull()
      .references(() => authoredSkill.id, { onDelete: "cascade" }),
    revision: integer().notNull(),
    description: text().notNull(),
    change_note: text(),
    digest: text().notNull(),
    storage_key: text().notNull().unique(),
    size: integer().notNull(),
    // Keep lineage readable even when the originating personal skill is later purged.
    source_skill_id: text(),
    source_revision_id: text(),
    created_by: integer()
      .notNull()
      .references(() => user.id),
    created_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
  },
  (table) => ({
    skillRevisionIdx: uniqueIndex("authored_skill_revision_skill_revision_idx").on(
      table.skill_id,
      table.revision,
    ),
    revisionCheck: check("authored_skill_revision_number_check", sql`${table.revision} >= 1`),
    sizeCheck: check("authored_skill_revision_size_check", sql`${table.size} >= 0`),
    sourceCheck: check(
      "authored_skill_revision_source_check",
      sql`(${table.source_skill_id} IS NULL AND ${table.source_revision_id} IS NULL) OR (${table.source_skill_id} IS NOT NULL AND ${table.source_revision_id} IS NOT NULL)`,
    ),
  }),
);

export type AuthoredSkillRevision = typeof authoredSkillRevision.$inferSelect;

export const projectCapability = sqliteTable(
  "project_capability",
  {
    id: text().primaryKey(),
    project_id: text()
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    kind: text({ enum: ["app", "recipe", "skill", "tool", "agent"] }).notNull(),
    capability_id: text().notNull(),
    configuration: text({ mode: "json" }).$type<Record<string, unknown>>().default({}).notNull(),
    created_by: integer()
      .notNull()
      .references(() => user.id),
    created_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
  },
  (table) => ({
    projectCapabilityIdx: uniqueIndex("project_capability_project_kind_id_idx").on(
      table.project_id,
      table.kind,
      table.capability_id,
    ),
  }),
);

export type ProjectCapability = typeof projectCapability.$inferSelect;

export const conversation = sqliteTable(
  "conversation",
  {
    id: text().primaryKey(),
    user_id: integer()
      .notNull()
      .references(() => user.id),
    type: text({ enum: ["chat", "task"] })
      .notNull()
      .default("chat"),
    title: text().default("New Conversation"),
    is_archived: integer({ mode: "boolean" }).default(false),
    is_public: integer({ mode: "boolean" }).default(false),
    share_id: text().unique(),
    last_message_id: text(),
    last_message_at: text(),
    message_count: integer().default(0),
    parent_conversation_id: text().references(() => conversation.id),
    parent_message_id: text(),
    project_id: text().references(() => project.id, { onDelete: "cascade" }),
    created_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
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
    typeIdx: index("conversation_type_idx").on(table.type),
    parentConversationIdIdx: index("conversation_parent_conversation_id_idx").on(
      table.parent_conversation_id,
    ),
    parentMessageIdIdx: index("conversation_parent_message_id_idx").on(table.parent_message_id),
    projectIdIdx: index("conversation_project_id_idx").on(table.project_id),
    userProjectArchivedUpdatedIdx: index("conversation_user_project_archived_updated_idx").on(
      table.user_id,
      table.project_id,
      table.is_archived,
      table.updated_at,
    ),
  }),
);

export type Conversation = typeof conversation.$inferSelect;

export const goal = sqliteTable(
  "goal",
  {
    id: text().primaryKey(),
    conversation_id: text().references(() => conversation.id, {
      onDelete: "cascade",
    }),
    sandbox_run_id: text(),
    user_id: integer()
      .notNull()
      .references(() => user.id),
    objective: text().notNull(),
    status: text({
      enum: ["active", "paused", "completed", "cleared", "blocked", "stalled", "limit_reached"],
    })
      .notNull()
      .default("active"),
    source: text({ enum: ["user", "model"] })
      .notNull()
      .default("user"),
    iteration_count: integer().notNull().default(0),
    stall_streak: integer().notNull().default(0),
    tokens_spent: integer().notNull().default(0),
    progress: text({ mode: "json" }),
    evidence: text({ mode: "json" }),
    stopped_reason: text(),
    created_from_message_id: text(),
    created_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
    updated_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
    completed_at: text(),
    last_continued_at: text(),
  },
  (table) => ({
    conversationIdx: index("goal_conversation_id_idx").on(table.conversation_id),
    sandboxRunIdx: index("goal_sandbox_run_id_idx").on(table.sandbox_run_id),
    userIdx: index("goal_user_id_idx").on(table.user_id),
    statusIdx: index("goal_status_idx").on(table.status),
    ownerCheck: check(
      "goal_owner_check",
      sql`(${table.conversation_id} IS NULL) <> (${table.sandbox_run_id} IS NULL)`,
    ),
    activeConversationIdx: uniqueIndex("goal_active_conversation_idx")
      .on(table.conversation_id)
      .where(sql`${table.status} IN ('active','paused') AND ${table.conversation_id} IS NOT NULL`),
    activeSandboxRunIdx: uniqueIndex("goal_active_sandbox_run_idx")
      .on(table.sandbox_run_id)
      .where(sql`${table.status} IN ('active','paused') AND ${table.sandbox_run_id} IS NOT NULL`),
  }),
);

export type Goal = typeof goal.$inferSelect;

export const message = sqliteTable(
  "message",
  {
    id: text().primaryKey(),
    conversation_id: text()
      .notNull()
      .references(() => conversation.id),
    parent_message_id: text(),
    is_archived: integer({ mode: "boolean" }).default(false),
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
      enum: ["web", "mobile", "api", "tool-run"],
    }),
    mode: text({
      enum: ["normal", "local", "remote", "no_system", "agent", "plan", "build", "explore"],
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
    created_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
    updated_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    conversationIdx: index("message_conversation_id_idx").on(table.conversation_id),
    archivedIdx: index("message_archived_idx").on(table.is_archived),
    parentMessageIdx: index("message_parent_message_id_idx").on(table.parent_message_id),
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
      enum: ["bedrock", "llamaguard", "mistral", "shieldstral"],
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
    temporary_chats_default: integer({ mode: "boolean" }).default(false),
    memory_provider: text({
      enum: ["built-in", "hindsight", "honcho"],
    }).default("built-in"),
    transcription_provider: text({
      enum: ["workers", "mistral", "replicate"],
    }).default("workers"),
    transcription_model: text().default("whisper"),
    speech_provider: text({
      enum: ["polly", "cartesia", "elevenlabs", "melotts", "mistral"],
    }).default("melotts"),
    speech_model: text().default("@cf/myshell-ai/melotts"),
    search_provider: text({
      enum: ["duckduckgo", "tavily", "serper", "parallel", "perplexity", "exa"],
    }),
    sandbox_model: text(),
    pet_source: text({
      enum: ["preset", "custom"],
    }).default("preset"),
    pet_id: text().default("pip"),
    pet_travel_enabled: integer({ mode: "boolean" }).default(false),
    pet_animation_enabled: integer({ mode: "boolean" }).default(false),
    pet_model_overrides: text({ mode: "json" })
      .$type<StoredPetModelOverrides>()
      .default({ families: {}, providers: {} })
      .notNull(),
    tracking_enabled: integer({ mode: "boolean" }).default(true),
    public_key: text(),
    private_key: text(),
    created_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
    updated_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    userIdIdx: index("user_settings_user_id_idx").on(table.user_id),
  }),
);

export type UserSettings = typeof userSettings.$inferSelect;

export const userPet = sqliteTable(
  "user_pet",
  {
    id: text().primaryKey(),
    user_id: integer()
      .notNull()
      .references(() => user.id),
    name: text().notNull(),
    description: text(),
    origin: text({
      enum: ["upload", "generated"],
    }).notNull(),
    sheet_key: text().notNull(),
    layout_id: text().notNull().default("polychat-v1"),
    prompt: text(),
    created_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
  },
  (table) => ({
    userIdIdx: index("user_pet_user_id_idx").on(table.user_id),
  }),
);

export type UserPet = typeof userPet.$inferSelect;

export const capabilityConfiguration = sqliteTable(
  "capability_configuration",
  {
    id: text().primaryKey(),
    scope_type: text({ enum: ["user", "project"] })
      .default("user")
      .notNull(),
    scope_id: text().notNull(),
    capability_kind: text().default("tool").notNull(),
    capability_id: text().notNull(),
    configuration: text().notNull(),
    created_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
    updated_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    scopeCapabilityIdx: uniqueIndex("capability_configuration_scope_capability_idx").on(
      table.scope_type,
      table.scope_id,
      table.capability_kind,
      table.capability_id,
    ),
  }),
);

export type CapabilityConfiguration = typeof capabilityConfiguration.$inferSelect;

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
    created_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
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
    created_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
    updated_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    userIdIdx: index("provider_settings_user_id_idx").on(table.user_id),
    providerIdIdx: index("provider_settings_provider_id_idx").on(table.provider_id),
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
    created_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
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
    public_key: text({ mode: "json" }).$type<JsonWebKey>().notNull(),
    counter: integer().notNull(),
    device_type: text().notNull(),
    backed_up: integer({ mode: "boolean" }).notNull(),
    transports: text({ mode: "json" }).$type<readonly AuthenticatorTransport[]>(),
    created_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
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

export const providerConnection = sqliteTable(
  "provider_connection",
  {
    id: text().primaryKey(),
    user_id: integer()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    provider: text().notNull(),
    kind: text().notNull(),
    external_id: text().default("").notNull(),
    status: text({ enum: ["connected", "invalid", "revoked"] })
      .default("connected")
      .notNull(),
    encrypted_data: text({ mode: "json" }).$type<Record<string, unknown>>().notNull(),
    metadata: text({ mode: "json" }).$type<Record<string, unknown>>().default({}).notNull(),
    created_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
    updated_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    userProviderIdx: index("provider_connection_user_provider_idx").on(
      table.user_id,
      table.provider,
    ),
    uniqueConnection: uniqueIndex("provider_connection_unique_idx").on(
      table.user_id,
      table.provider,
      table.kind,
      table.external_id,
    ),
  }),
);

export type ProviderConnection = typeof providerConnection.$inferSelect;

export const source = sqliteTable(
  "source",
  {
    id: text().primaryKey(),
    created_by_user_id: integer()
      .notNull()
      .references(() => user.id),
    project_id: text().references(() => project.id, { onDelete: "cascade" }),
    conversation_id: text().references(() => conversation.id, {
      onDelete: "set null",
    }),
    connection_id: text().references(() => providerConnection.id, {
      onDelete: "set null",
    }),
    kind: text({
      enum: ["file", "memory", "text", "url", "connector", "repository"],
    }).notNull(),
    title: text().notNull(),
    status: text({ enum: ["processing", "available", "failed", "archived"] })
      .default("available")
      .notNull(),
    content: text(),
    provider: text(),
    external_uri: text(),
    vector_id: text(),
    metadata: text({ mode: "json" }).$type<Record<string, unknown>>().default({}).notNull(),
    storage_key: text().unique(),
    mime_type: text(),
    filename: text(),
    byte_size: integer(),
    created_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
    updated_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    creatorIdx: index("source_created_by_user_id_idx").on(table.created_by_user_id),
    projectIdx: index("source_project_id_idx").on(table.project_id),
    conversationIdx: index("source_conversation_id_idx").on(table.conversation_id),
    connectionIdx: index("source_connection_id_idx").on(table.connection_id),
    kindIdx: index("source_kind_idx").on(table.kind),
    vectorIdx: index("source_vector_id_idx").on(table.vector_id),
  }),
);

export type Source = typeof source.$inferSelect;

export const sourceCollection = sqliteTable(
  "source_collection",
  {
    id: text().primaryKey(),
    created_by_user_id: integer()
      .notNull()
      .references(() => user.id),
    project_id: text().references(() => project.id, { onDelete: "cascade" }),
    title: text().notNull(),
    description: text(),
    kind: text({ enum: ["general", "memory", "context"] })
      .default("general")
      .notNull(),
    created_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
    updated_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    creatorIdx: index("source_collection_created_by_user_id_idx").on(table.created_by_user_id),
    projectIdx: index("source_collection_project_id_idx").on(table.project_id),
  }),
);

export type SourceCollection = typeof sourceCollection.$inferSelect;

export const sourceCollectionMember = sqliteTable(
  "source_collection_member",
  {
    collection_id: text()
      .notNull()
      .references(() => sourceCollection.id, { onDelete: "cascade" }),
    source_id: text()
      .notNull()
      .references(() => source.id, { onDelete: "cascade" }),
    created_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.collection_id, table.source_id] }),
    sourceIdx: index("source_collection_member_source_id_idx").on(table.source_id),
  }),
);

export const output = sqliteTable(
  "output",
  {
    id: text().primaryKey(),
    created_by_user_id: integer()
      .notNull()
      .references(() => user.id),
    project_id: text().references(() => project.id, { onDelete: "cascade" }),
    conversation_id: text().references(() => conversation.id, {
      onDelete: "set null",
    }),
    parent_output_id: text(),
    capability_id: text().notNull(),
    group_id: text(),
    kind: text().notNull(),
    title: text().notNull(),
    status: text({ enum: ["pending", "ready", "failed", "archived"] })
      .default("ready")
      .notNull(),
    sensitivity: text({
      enum: ["personal", "internal", "confidential"],
    }).notNull(),
    content: text({ mode: "json" }).$type<Record<string, unknown>>().default({}).notNull(),
    storage_key: text().unique(),
    mime_type: text(),
    filename: text(),
    byte_size: integer(),
    revision: integer().default(1).notNull(),
    created_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
    updated_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    creatorIdx: index("output_created_by_user_id_idx").on(table.created_by_user_id),
    projectIdx: index("output_project_id_idx").on(table.project_id),
    conversationIdx: index("output_conversation_id_idx").on(table.conversation_id),
    parentIdx: index("output_parent_output_id_idx").on(table.parent_output_id),
    capabilityIdx: index("output_capability_id_idx").on(table.capability_id),
    groupIdx: index("output_group_id_idx").on(table.group_id),
    lookupIdx: index("output_lookup_idx").on(
      table.created_by_user_id,
      table.capability_id,
      table.group_id,
      table.kind,
    ),
  }),
);

export type Output = typeof output.$inferSelect;

export const outputRevision = sqliteTable(
  "output_revision",
  {
    output_id: text()
      .notNull()
      .references(() => output.id, { onDelete: "cascade" }),
    revision: integer().notNull(),
    title: text().notNull(),
    status: text({
      enum: ["pending", "ready", "failed", "archived"],
    }).notNull(),
    sensitivity: text({
      enum: ["personal", "internal", "confidential"],
    }).notNull(),
    content: text({ mode: "json" }).$type<Record<string, unknown>>().notNull(),
    created_by_user_id: integer()
      .notNull()
      .references(() => user.id),
    created_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.output_id, table.revision] }),
  }),
);

export type OutputRevision = typeof outputRevision.$inferSelect;

export const outputSource = sqliteTable(
  "output_source",
  {
    output_id: text()
      .notNull()
      .references(() => output.id, { onDelete: "cascade" }),
    source_id: text()
      .notNull()
      .references(() => source.id, { onDelete: "cascade" }),
    created_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.output_id, table.source_id] }),
    sourceIdx: index("output_source_source_id_idx").on(table.source_id),
  }),
);

export const outputShare = sqliteTable(
  "output_share",
  {
    id: text().primaryKey(),
    output_id: text()
      .notNull()
      .references(() => output.id, { onDelete: "cascade" }),
    token_hash: text().notNull().unique(),
    permission: text({ enum: ["view"] })
      .default("view")
      .notNull(),
    created_by_user_id: integer()
      .notNull()
      .references(() => user.id),
    expires_at: text(),
    revoked_at: text(),
    created_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
  },
  (table) => ({
    outputIdx: index("output_share_output_id_idx").on(table.output_id),
  }),
);

export type OutputShare = typeof outputShare.$inferSelect;

export const template = sqliteTable(
  "template",
  {
    id: text().primaryKey(),
    created_by_user_id: integer()
      .notNull()
      .references(() => user.id),
    workspace_id: text().references(() => workspace.id, {
      onDelete: "cascade",
    }),
    project_id: text().references(() => project.id, { onDelete: "cascade" }),
    kind: text({ enum: ["project", "recipe", "capability"] }).notNull(),
    capability_id: text(),
    name: text().notNull(),
    description: text().default("").notNull(),
    configuration: text({ mode: "json" }).$type<Record<string, unknown>>().default({}).notNull(),
    status: text({ enum: ["active", "paused", "archived"] })
      .default("active")
      .notNull(),
    created_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
    updated_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    creatorIdx: index("template_created_by_user_id_idx").on(table.created_by_user_id),
    workspaceIdx: index("template_workspace_id_idx").on(table.workspace_id),
    projectIdx: index("template_project_id_idx").on(table.project_id),
    capabilityIdx: index("template_capability_id_idx").on(table.capability_id),
  }),
);

export type Template = typeof template.$inferSelect;

export const recipeComposioTrigger = sqliteTable(
  "recipe_composio_trigger",
  {
    id: text().primaryKey(),
    installation_id: text()
      .notNull()
      .references(() => template.id, { onDelete: "cascade" }),
    created_by_user_id: integer()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    project_id: text().references(() => project.id, { onDelete: "cascade" }),
    provider_id: text().notNull(),
    trigger_slug: text().notNull(),
    external_trigger_id: text().notNull().unique(),
    connected_account_id: text().notNull(),
    external_user_id: text().notNull(),
    configuration: text({ mode: "json" }).$type<Record<string, unknown>>().default({}).notNull(),
    status: text({ enum: ["active", "paused", "error"] })
      .default("active")
      .notNull(),
    last_error: text(),
    created_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
    updated_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    installationIdx: index("recipe_composio_trigger_installation_idx").on(table.installation_id),
    ownerIdx: index("recipe_composio_trigger_owner_idx").on(table.created_by_user_id),
    accountIdx: index("recipe_composio_trigger_account_idx").on(table.connected_account_id),
  }),
);

export type RecipeComposioTrigger = typeof recipeComposioTrigger.$inferSelect;

export const composioConnectorSession = sqliteTable(
  "composio_connector_session",
  {
    id: text().primaryKey(),
    remote_session_id: text().notNull().unique(),
    kind: text({ enum: ["tool", "connection"] }).notNull(),
    user_id: integer()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    provider: text().notNull(),
    toolkit_slug: text().notNull(),
    auth_config_id: text(),
    connected_account_id: text(),
    allowed_operation_ids: text({ mode: "json" }).$type<readonly string[]>().notNull(),
    run_id: text().notNull(),
    completion_id: text(),
    recipe_id: text(),
    installation_id: text().references(() => template.id, {
      onDelete: "cascade",
    }),
    state: text({ enum: ["active", "claimed", "cleanup_pending"] }).notNull(),
    created_at: text().notNull(),
    expires_at: text().notNull(),
    claimed_at: text(),
    cleanup_attempts: integer().default(0).notNull(),
    cleanup_after: text(),
  },
  (table) => ({
    stateExpiryIdx: index("composio_connector_session_state_expiry_idx").on(
      table.state,
      table.expires_at,
    ),
    stateCleanupIdx: index("composio_connector_session_state_cleanup_idx").on(
      table.state,
      table.cleanup_after,
    ),
    ownerProviderIdx: index("composio_connector_session_owner_provider_idx").on(
      table.user_id,
      table.provider,
    ),
    runIdx: index("composio_connector_session_run_idx").on(table.run_id),
  }),
);

export type ComposioConnectorSession = typeof composioConnectorSession.$inferSelect;

export const connectorOperationApproval = sqliteTable(
  "connector_operation_approval",
  {
    id: text().primaryKey(),
    user_id: integer()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    run_id: text().notNull(),
    completion_id: text().notNull(),
    provider: text().notNull(),
    operation: text().notNull(),
    connected_account_id: text().notNull(),
    channel: text().notNull(),
    argument_digest: text().notNull(),
    state: text({
      enum: ["pending", "approved", "rejected", "consumed"],
    }).notNull(),
    created_at: text().notNull(),
    expires_at: text().notNull(),
    resolved_at: text(),
    consumed_at: text(),
  },
  (table) => ({
    ownerStateIdx: index("connector_operation_approval_owner_state_idx").on(
      table.user_id,
      table.state,
    ),
    stateExpiryIdx: index("connector_operation_approval_state_expiry_idx").on(
      table.state,
      table.expires_at,
    ),
    runIdx: index("connector_operation_approval_run_idx").on(table.run_id),
  }),
);

export type ConnectorOperationApproval = typeof connectorOperationApproval.$inferSelect;

export const activityRecord = sqliteTable(
  "activity_record",
  {
    id: text().primaryKey(),
    created_by_user_id: integer()
      .notNull()
      .references(() => user.id),
    project_id: text().references(() => project.id, { onDelete: "cascade" }),
    conversation_id: text().references(() => conversation.id, {
      onDelete: "set null",
    }),
    capability_id: text().notNull(),
    group_id: text(),
    kind: text().notNull(),
    status: text({
      enum: ["queued", "running", "waiting", "succeeded", "failed", "cancelled"],
    }).notNull(),
    summary: text().notNull(),
    data: text({ mode: "json" }).$type<Record<string, unknown>>().default({}).notNull(),
    created_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
    updated_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    creatorIdx: index("activity_record_created_by_user_id_idx").on(table.created_by_user_id),
    projectIdx: index("activity_record_project_id_idx").on(table.project_id),
    conversationIdx: index("activity_record_conversation_id_idx").on(table.conversation_id),
    groupIdx: index("activity_record_group_id_idx").on(table.group_id),
  }),
);

export type ActivityRecord = typeof activityRecord.$inferSelect;

export const workspaceAuditRecord = sqliteTable(
  "workspace_audit_record",
  {
    id: text().primaryKey(),
    workspace_id: text().notNull(),
    actor_user_id: integer().references(() => user.id),
    action: text().notNull(),
    target_type: text().notNull(),
    target_id: text(),
    metadata: text({ mode: "json" }).$type<Record<string, unknown>>().default({}).notNull(),
    created_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
  },
  (table) => ({
    workspaceIdx: index("workspace_audit_record_workspace_id_idx").on(table.workspace_id),
    actorIdx: index("workspace_audit_record_actor_user_id_idx").on(table.actor_user_id),
    createdIdx: index("workspace_audit_record_created_at_idx").on(table.created_at),
  }),
);

export type WorkspaceAuditRecord = typeof workspaceAuditRecord.$inferSelect;

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
    enabled_tools: text({ mode: "json" }),
    team_id: text(),
    team_role: text(),
    is_team_agent: integer({ mode: "boolean" }).default(false),
    created_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
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
    created_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
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
    created_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
  },
  (table) => ({
    sharedAgentIdIdx: index("agent_installs_shared_agent_id_idx").on(table.shared_agent_id),
    userIdIdx: index("agent_installs_user_id_idx").on(table.user_id),
    agentIdIdx: index("agent_installs_agent_id_idx").on(table.agent_id),
    uniqueInstall: index("agent_installs_unique_idx").on(table.shared_agent_id, table.user_id),
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
    created_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
    updated_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    sharedAgentIdIdx: index("agent_ratings_shared_agent_id_idx").on(table.shared_agent_id),
    userIdIdx: index("agent_ratings_user_id_idx").on(table.user_id),
    ratingIdx: index("agent_ratings_rating_idx").on(table.rating),
    uniqueRating: index("agent_ratings_unique_idx").on(table.shared_agent_id, table.user_id),
  }),
);

export type AgentRating = typeof agentRatings.$inferSelect;

export const artificialAnalysisModels = sqliteTable(
  "artificial_analysis_models",
  {
    id: text().primaryKey(),
    name: text().notNull(),
    slug: text(),
    creator_id: text(),
    creator_name: text(),
    creator_slug: text(),
    evaluations: text().notNull(),
    pricing: text().notNull(),
    intelligence_index: real(),
    coding_index: real(),
    agentic_index: real(),
    intelligence_index_version: real(),
    price_1m_blended_3_to_1: real(),
    price_1m_input_tokens: real(),
    price_1m_output_tokens: real(),
    median_output_tokens_per_second: real(),
    median_time_to_first_token_seconds: real(),
    median_time_to_first_answer_token_seconds: real(),
    median_end_to_end_response_time_seconds: real(),
    derived_strengths: text(),
    derived_scores: text(),
    source: text().notNull().default("artificial_analysis"),
    source_url: text().notNull().default("https://artificialanalysis.ai/"),
    ingested_at: text().notNull(),
    created_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
    updated_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    slugIdx: index("artificial_analysis_models_slug_idx").on(table.slug),
    creatorSlugIdx: index("artificial_analysis_models_creator_slug_idx").on(table.creator_slug),
    ingestedAtIdx: index("artificial_analysis_models_ingested_at_idx").on(table.ingested_at),
  }),
);

export type ArtificialAnalysisModel = typeof artificialAnalysisModels.$inferSelect;

export const tasks = sqliteTable(
  "tasks",
  {
    id: text().primaryKey(),
    task_type: text({
      enum: [
        "memory_synthesis",
        "research_polling",
        "replicate_polling",
        "async_message_polling",
        "podcast_transcription_polling",
        "training_quality_scoring",
        "usage_update",
        "recipe_execution",
        "sandbox_run_dispatch",
        "artificial_analysis_ingest",
        "artificial_analysis_scoring",
        "inbound_message",
        "project_task_run",
        "ocr_batch_polling",
      ],
    }).notNull(),
    status: text({
      enum: ["pending", "queued", "running", "completed", "failed", "cancelled"],
    })
      .notNull()
      .default("pending"),
    priority: integer().default(5),
    user_id: integer().references(() => user.id),
    project_id: text().references(() => project.id, { onDelete: "cascade" }),
    task_data: text(),
    schedule_type: text({
      enum: ["immediate", "scheduled", "recurring", "event_triggered"],
    }).default("immediate"),
    scheduled_at: text(),
    cron_expression: text(),
    created_by: text({ enum: ["system", "user"] }).notNull(),
    attempts: integer().default(0),
    max_attempts: integer().default(3),
    last_attempted_at: text(),
    completed_at: text(),
    error_message: text(),
    metadata: text(),
    created_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
    updated_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    userIdIdx: index("tasks_user_id_idx").on(table.user_id),
    projectIdIdx: index("tasks_project_id_idx").on(table.project_id),
    statusIdx: index("tasks_status_idx").on(table.status),
    taskTypeIdx: index("tasks_task_type_idx").on(table.task_type),
    scheduledAtIdx: index("tasks_scheduled_at_idx").on(table.scheduled_at),
  }),
);

export type Task = typeof tasks.$inferSelect;

export const taskExecutions = sqliteTable(
  "task_executions",
  {
    id: text().primaryKey(),
    task_id: text()
      .notNull()
      .references(() => tasks.id),
    status: text({
      enum: ["running", "completed", "failed"],
    }).notNull(),
    started_at: text().notNull(),
    completed_at: text(),
    execution_time_ms: integer(),
    error_message: text(),
    result_data: text(),
    created_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
    updated_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    taskIdIdx: index("task_executions_task_id_idx").on(table.task_id),
  }),
);

export type TaskExecution = typeof taskExecutions.$inferSelect;

export const memorySyntheses = sqliteTable(
  "memory_syntheses",
  {
    id: text().primaryKey(),
    user_id: integer()
      .notNull()
      .references(() => user.id),
    synthesis_text: text().notNull(),
    synthesis_version: integer().default(1),
    memory_ids: text(),
    memory_count: integer().default(0),
    tokens_used: integer(),
    namespace: text().default("global"),
    is_active: integer({ mode: "boolean" }).default(true),
    superseded_by: text(),
    created_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
    updated_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    userIdIdx: index("memory_syntheses_user_id_idx").on(table.user_id),
    namespaceIdx: index("memory_syntheses_namespace_idx").on(table.namespace),
    isActiveIdx: index("memory_syntheses_is_active_idx").on(table.is_active),
  }),
);

export type MemorySynthesis = typeof memorySyntheses.$inferSelect;

export const trainingExamples = sqliteTable(
  "training_examples",
  {
    id: text().primaryKey(),
    user_id: integer().references(() => user.id),
    conversation_id: text().references(() => conversation.id),
    source: text({
      enum: ["chat", "app"],
    }).notNull(),
    app_name: text(),
    user_prompt: text().notNull(),
    assistant_response: text().notNull(),
    system_prompt: text(),
    model_used: text(),
    feedback_rating: integer(),
    feedback_comment: text(),
    metadata: text({
      mode: "json",
    }),
    exported: integer({ mode: "boolean" }).default(false),
    exported_at: text(),
    quality_score: integer(),
    include_in_training: integer({ mode: "boolean" }).default(true),
    task_category: text(),
    difficulty_level: text({
      enum: ["easy", "medium", "hard", "expert"],
    }),
    language_code: text().default("en"),
    user_prompt_tokens: integer(),
    assistant_response_tokens: integer(),
    response_time_ms: integer(),
    conversation_turn: integer().default(1),
    conversation_context: text({
      mode: "json",
    }),
    user_satisfaction_signals: text({
      mode: "json",
    }),
    created_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
    updated_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    userIdIdx: index("training_examples_user_id_idx").on(table.user_id),
    conversationIdIdx: index("training_examples_conversation_id_idx").on(table.conversation_id),
    sourceIdx: index("training_examples_source_idx").on(table.source),
    appNameIdx: index("training_examples_app_name_idx").on(table.app_name),
    exportedIdx: index("training_examples_exported_idx").on(table.exported),
    includeInTrainingIdx: index("training_examples_include_in_training_idx").on(
      table.include_in_training,
    ),
    feedbackRatingIdx: index("training_examples_feedback_rating_idx").on(table.feedback_rating),
    qualityScoreIdx: index("training_examples_quality_score_idx").on(table.quality_score),
    taskCategoryIdx: index("training_examples_task_category_idx").on(table.task_category),
    difficultyLevelIdx: index("training_examples_difficulty_level_idx").on(table.difficulty_level),
    languageCodeIdx: index("training_examples_language_code_idx").on(table.language_code),
    conversationTurnIdx: index("training_examples_conversation_turn_idx").on(
      table.conversation_turn,
    ),
  }),
);

export type TrainingExample = typeof trainingExamples.$inferSelect;

export const trainingJobs = sqliteTable(
  "training_jobs",
  {
    provider: text().notNull(),
    job_name: text().notNull(),
    provider_job_id: text(),
    user_id: integer().references(() => user.id, { onDelete: "set null" }),
    status: text().notNull(),
    model_id: text().notNull(),
    base_model: text().notNull(),
    training_image: text(),
    training_data_s3_uri: text(),
    validation_data_s3_uri: text(),
    output_s3_uri: text(),
    model_artifacts_s3_uri: text(),
    failure_reason: text(),
    request_json: text({
      mode: "json",
    }),
    response_json: text({
      mode: "json",
    }),
    created_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
    updated_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.provider, table.job_name] }),
    userIdIdx: index("training_jobs_user_id_idx").on(table.user_id),
    statusIdx: index("training_jobs_status_idx").on(table.status),
    updatedAtIdx: index("training_jobs_updated_at_idx").on(table.updated_at),
  }),
);

export type TrainingJob = typeof trainingJobs.$inferSelect;

export const trainingDeployments = sqliteTable(
  "training_deployments",
  {
    provider: text().notNull(),
    endpoint_name: text().notNull(),
    deployment_name: text().notNull(),
    model_name: text().notNull(),
    endpoint_config_name: text().notNull(),
    user_id: integer().references(() => user.id, { onDelete: "set null" }),
    status: text().notNull(),
    model_id: text().notNull(),
    model_artifacts_s3_uri: text(),
    failure_reason: text(),
    request_json: text({
      mode: "json",
    }),
    response_json: text({
      mode: "json",
    }),
    created_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
    updated_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.provider, table.endpoint_name] }),
    userIdIdx: index("training_deployments_user_id_idx").on(table.user_id),
    statusIdx: index("training_deployments_status_idx").on(table.status),
  }),
);

export type TrainingDeployment = typeof trainingDeployments.$inferSelect;

export const trainingJobEvents = sqliteTable(
  "training_job_events",
  {
    id: text().primaryKey(),
    provider: text().notNull(),
    job_name: text().notNull(),
    level: text({
      enum: ["info", "warn", "error"],
    }).notNull(),
    message: text().notNull(),
    metadata_json: text({
      mode: "json",
    }),
    created_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
  },
  (table) => ({
    jobIdx: index("training_job_events_job_idx").on(table.provider, table.job_name),
    createdAtIdx: index("training_job_events_created_at_idx").on(table.created_at),
  }),
);

export type TrainingJobEvent = typeof trainingJobEvents.$inferSelect;

export const projectTask = sqliteTable(
  "project_task",
  {
    id: text().primaryKey(),
    project_id: text()
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    workspace_id: text()
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    objective: text().notNull(),
    acceptance_criteria: text({ mode: "json" }).$type<ProjectTaskCriterion[]>(),
    expected_output: text(),
    context: text({ mode: "json" }).$type<ProjectTaskContext>(),
    constraints: text({ mode: "json" }).$type<ProjectTaskConstraints>(),
    depends_on_task_ids: text({ mode: "json" }).$type<string[]>(),
    require_approval_for: text({ mode: "json" }).$type<ToolPermission[]>(),
    status: text({
      enum: ["backlog", "queued", "running", "blocked", "review", "done", "cancelled"],
    })
      .default("backlog")
      .notNull(),
    source: text({ enum: ["user", "model"] })
      .default("user")
      .notNull(),
    blocked_reason: text({
      enum: [
        "awaiting_input",
        "awaiting_approval",
        "stalled",
        "usage_limits",
        "token_budget",
        "missing_capability",
        "dispatch_failed",
        "run_failed",
        "dependencies_unmet",
      ],
    }),
    blocked_detail: text(),
    stage_id: text(),
    runner: text({ mode: "json" }).$type<ProjectTaskRunner>(),
    created_by_user_id: integer()
      .notNull()
      .references(() => user.id),
    assignee_user_id: integer().references(() => user.id),
    runner_identity_user_id: integer().references(() => user.id),
    conversation_id: text().references(() => conversation.id, {
      onDelete: "set null",
    }),
    goal_id: text(),
    dispatch_task_id: text(),
    completions: text({ mode: "json" }).$type<ProjectTaskCompletion[]>(),
    position: real().default(0).notNull(),
    token_budget: integer(),
    tokens_spent: integer().default(0).notNull(),
    created_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
    updated_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
    started_at: text(),
    completed_at: text(),
  },
  (table) => ({
    projectStatusIdx: index("project_task_project_status_idx").on(
      table.project_id,
      table.status,
      table.position,
    ),
    workspaceStatusIdx: index("project_task_workspace_status_idx").on(
      table.workspace_id,
      table.status,
    ),
    assigneeIdx: index("project_task_assignee_idx").on(table.assignee_user_id),
    conversationIdx: uniqueIndex("project_task_conversation_idx")
      .on(table.conversation_id)
      .where(sql`${table.conversation_id} IS NOT NULL`),
  }),
);

export type ProjectTaskRow = typeof projectTask.$inferSelect;
