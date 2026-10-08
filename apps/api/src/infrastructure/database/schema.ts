import type { AuthChallengeKind } from "@ngriffin_uk/auth-protocol";
import type {
  DocumentAnchor,
  TaskNotificationPreferences,
  ProjectTaskConstraints,
  ProjectTaskCompletion,
  ProjectTaskContext,
  ProjectTaskCriterion,
  ProjectFlow,
  ProjectTaskRunner,
  OutputProvenance,
  ToolPermission,
  MachineCapability,
  MachineRuntime,
  DatasetGovernance,
  DatasetMapping,
  DatasetStats,
  ModelPlatformAction,
  ModelVersionAttributes,
  TeammateStandingApproval,
  DATASET_COLLECTION_METHODS,
  DATASET_SHAPES,
} from "@ngriffin_uk/polychat-schemas";
import {
  COST_SUBJECTS,
  LINEAGE_RELATIONS,
  MODEL_ASSET_KINDS,
  MODEL_ASSET_SOURCES,
  MODEL_PROVIDER_IDS,
} from "@ngriffin_uk/polychat-schemas";
import { sql } from "drizzle-orm";
import {
  type AnySQLiteColumn,
  check,
  foreignKey,
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
  included_credits: integer(),
  grace_credits: integer(),
  stripe_meter_id: text(),
  overage_price_id: text(),
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
  credit_period: text("credit_period"),
  spent_credit_micros: integer("spent_credit_micros").notNull().default(0),
  reserved_credit_micros: integer("reserved_credit_micros").notNull().default(0),
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
  plan_id: text().references(() => plans.id),
  message_count: integer("message_count").default(0),
  last_active_at: text("last_active_at"),
  stripe_customer_id: text(),
  stripe_subscription_id: text(),
  task_notification_preferences: text({ mode: "json" }).$type<
    TaskNotificationPreferences & { updated_at: string | null }
  >(),
});

export type User = typeof user.$inferSelect;

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

export const authenticationToken = sqliteTable(
  "authentication_token",
  {
    purpose: text({
      enum: ["oauth_state", "challenge", "native_exchange", "channel_pairing"],
    }).notNull(),
    token_hash: text().notNull(),
    provider: text(),
    kind: text().$type<AuthChallengeKind>(),
    payload: text({ mode: "json" }).$type<Readonly<Record<string, unknown>>>(),
    oauth_data: text({ mode: "json" }).$type<{
      codeVerifier?: string;
      nonce?: string;
      redirectUri?: string;
      context?: Readonly<Record<string, string>>;
    }>(),
    session_id: text().references(() => session.id, { onDelete: "cascade" }),
    binding_id: text().references((): AnySQLiteColumn => channelBinding.id, {
      onDelete: "cascade",
    }),
    user_id: integer().references(() => user.id, { onDelete: "cascade" }),
    consumed_at: text(),
    created_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
    expires_at: text().notNull(),
    attempts: integer().default(0).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.purpose, table.token_hash] }),
    expiresAtIdx: index("authentication_token_expires_at_idx").on(table.purpose, table.expires_at),
    sessionIdx: index("authentication_token_session_idx").on(table.session_id),
    userIdx: index("authentication_token_user_idx").on(table.user_id),
    pairingOwnerIdx: uniqueIndex("authentication_token_pairing_owner_idx")
      .on(table.binding_id, table.user_id)
      .where(sql`${table.purpose} = 'channel_pairing'`),
    purposeCheck: check(
      "authentication_token_purpose_check",
      sql`
      (${table.purpose} = 'oauth_state' AND ${table.provider} IS NOT NULL AND ${table.oauth_data} IS NOT NULL AND ${table.kind} IS NULL AND ${table.payload} IS NULL AND ${table.session_id} IS NULL AND ${table.binding_id} IS NULL AND ${table.user_id} IS NULL AND ${table.consumed_at} IS NULL)
      OR (${table.purpose} = 'challenge' AND ${table.provider} IS NOT NULL AND ${table.kind} IS NOT NULL AND ${table.payload} IS NOT NULL AND ${table.oauth_data} IS NULL AND ${table.session_id} IS NULL AND ${table.binding_id} IS NULL AND ${table.user_id} IS NULL AND ${table.consumed_at} IS NULL)
      OR (${table.purpose} = 'native_exchange' AND ${table.session_id} IS NOT NULL AND ${table.user_id} IS NOT NULL AND ${table.consumed_at} IS NOT NULL AND ${table.binding_id} IS NULL AND ${table.provider} IS NULL AND ${table.kind} IS NULL AND ${table.payload} IS NULL AND ${table.oauth_data} IS NULL)
      OR (${table.purpose} = 'channel_pairing' AND ${table.binding_id} IS NOT NULL AND ${table.user_id} IS NOT NULL AND ${table.session_id} IS NULL AND ${table.provider} IS NULL AND ${table.kind} IS NULL AND ${table.payload} IS NULL AND ${table.oauth_data} IS NULL AND ${table.consumed_at} IS NULL)
    `,
    ),
  }),
);

export const notificationEndpoint = sqliteTable(
  "notification_endpoint",
  {
    id: text().notNull(),
    user_id: integer()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    token: text(),
    environment: text({ enum: ["sandbox", "production"] }),
    app_bundle_id: text(),
    last_registered_at: text().default(sql`(CURRENT_TIMESTAMP)`),
    invalidated_at: text(),
    created_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
    installation_id: text(),
    platform: text({ enum: ["ios", "web"] })
      .notNull()
      .default("ios"),
    endpoint_hash: text(),
    destination_json: text({ mode: "json" }).$type<{ v: 1; iv: string; data: string }>(),
    state: text({ enum: ["registered", "failed", "disabled"] }).default("registered"),
    failure_code: text(),
    updated_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.platform, table.id] }),
    tokenIdx: uniqueIndex("notification_endpoint_token_idx")
      .on(table.token)
      .where(sql`token IS NOT NULL`),
    ownerInstallationIdx: uniqueIndex("notification_endpoint_owner_installation_idx")
      .on(table.user_id, table.platform, table.installation_id)
      .where(sql`platform = 'web'`),
    endpointIdx: uniqueIndex("notification_endpoint_endpoint_idx")
      .on(table.platform, table.endpoint_hash)
      .where(sql`platform = 'web'`),
    activeUserIdx: index("notification_endpoint_active_user_idx")
      .on(table.user_id, table.invalidated_at)
      .where(sql`platform = 'ios'`),
    ownerPlatformIdx: index("notification_endpoint_owner_platform_idx")
      .on(table.user_id, table.platform, table.updated_at)
      .where(sql`platform = 'web'`),
    requiredFields: check(
      "notification_endpoint_required_fields",
      sql`(platform = 'ios' AND id IS NOT NULL AND user_id IS NOT NULL AND token IS NOT NULL AND environment IS NOT NULL AND app_bundle_id IS NOT NULL AND last_registered_at IS NOT NULL AND created_at IS NOT NULL) OR (platform = 'web' AND id IS NOT NULL AND user_id IS NOT NULL AND installation_id IS NOT NULL AND platform IS NOT NULL AND endpoint_hash IS NOT NULL AND destination_json IS NOT NULL AND state IS NOT NULL AND created_at IS NOT NULL)`,
    ),
    check0: check(
      "notification_endpoint_shape_0",
      sql`(platform = 'ios' AND token IS NOT NULL AND environment IN ('sandbox','production') AND app_bundle_id IS NOT NULL AND last_registered_at IS NOT NULL AND installation_id IS NULL) OR (platform = 'web' AND installation_id IS NOT NULL AND endpoint_hash IS NOT NULL AND destination_json IS NOT NULL AND state IN ('registered','failed','disabled') AND token IS NULL)`,
    ),
  }),
);

export const machine = sqliteTable(
  "machine",
  {
    user_id: integer()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    machine_id: text().notNull(),
    label: text().notNull(),
    platform: text({ enum: ["macos", "windows", "linux"] }).notNull(),
    app_version: text().notNull(),
    runtimes: text({ mode: "json" }).$type<MachineRuntime[]>().notNull(),
    capabilities: text({ mode: "json" }).$type<MachineCapability[]>().notNull(),
    last_seen_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
    created_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
    updated_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    primaryKey: primaryKey({ columns: [table.user_id, table.machine_id] }),
    userIdx: index("machine_user_idx").on(table.user_id, table.last_seen_at),
  }),
);

export const delivery = sqliteTable(
  "delivery",
  {
    id: text().notNull(),
    device_id: text(),
    trigger_id: text().references(() => eventSubscription.id, { onDelete: "cascade" }),
    event_id: text(),
    decision_receipt: text({ mode: "json" }).$type<Record<string, unknown>>(),
    queued_task_id: text(),
    status: text({ enum: ["sending", "sent", "failed", "pending", "delivered", "obsolete"] }),
    error_code: text(),
    created_at: text()
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updated_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
    user_id: integer().references(() => user.id, { onDelete: "cascade" }),
    kind: text(),
    scope_id: text(),
    operation_id: text(),
    payload_digest: text(),
    payload_json: text({ mode: "json" }).$type<Record<string, unknown>>(),
    state: text({
      enum: ["prepared", "sending", "sent", "indeterminate", "evaluating", "skipped", "queued"],
    }).default("prepared"),
    execution_token: text(),
    execution_lease_expires_at: text(),
    sent_at: text(),
    dedupe_key: text(),
    registration_id: text(),
    task_id: text().references(() => projectTask.id, { onDelete: "cascade" }),
    task_version: integer(),
    category: text({
      enum: ["decisions", "failures", "completions", "assignments"],
    }),
    attempts: integer().default(0),
    provider_message_id: text(),
    failure_code: text(),
    next_attempt_at: text(),
    endpoint_platform: text().generatedAlwaysAs(
      sql`CASE WHEN delivery_type = 'mobile' THEN 'ios' WHEN delivery_type = 'task' THEN 'web' END`,
    ),
    endpoint_id: text().generatedAlwaysAs(sql`COALESCE(device_id, registration_id)`),
    delivery_type: text({ enum: ["mobile", "task", "outbound", "recipe_event"] }).notNull(),
  },
  (table) => ({
    triggerEventIdx: uniqueIndex("delivery_recipe_event_idx")
      .on(table.trigger_id, table.event_id)
      .where(sql`delivery_type = 'recipe_event'`),
    recipeLeaseIdx: index("delivery_recipe_lease_idx")
      .on(table.delivery_type, table.state, table.execution_lease_expires_at)
      .where(sql`delivery_type = 'recipe_event'`),
    endpointReference: foreignKey({
      columns: [table.endpoint_platform, table.endpoint_id],
      foreignColumns: [notificationEndpoint.platform, notificationEndpoint.id],
    }).onDelete("cascade"),
    pk: primaryKey({ columns: [table.delivery_type, table.id] }),
    dedupeIdx: uniqueIndex("delivery_dedupe_idx")
      .on(table.dedupe_key)
      .where(sql`delivery_type = 'task'`),
    outboundOperationIdx: uniqueIndex("delivery_outbound_operation_idx")
      .on(table.kind, table.scope_id, table.operation_id)
      .where(sql`delivery_type = 'outbound'`),
    endpointIdx: index("delivery_endpoint_idx").on(table.endpoint_platform, table.endpoint_id),
    dueIdx: index("delivery_due_idx")
      .on(table.delivery_type, table.status, table.next_attempt_at)
      .where(sql`delivery_type = 'task'`),
    taskVersionIdx: index("delivery_task_version_idx")
      .on(table.task_id, table.task_version)
      .where(sql`task_id IS NOT NULL`),
    outboundOwnerStateIdx: index("delivery_outbound_owner_state_idx")
      .on(table.delivery_type, table.user_id, table.state)
      .where(sql`delivery_type = 'outbound'`),
    requiredFields: check(
      "delivery_required_fields",
      sql`(delivery_type = 'mobile' AND id IS NOT NULL AND device_id IS NOT NULL AND status IS NOT NULL AND created_at IS NOT NULL) OR (delivery_type = 'task' AND id IS NOT NULL AND dedupe_key IS NOT NULL AND registration_id IS NOT NULL AND user_id IS NOT NULL AND task_id IS NOT NULL AND task_version IS NOT NULL AND category IS NOT NULL AND status IS NOT NULL AND attempts IS NOT NULL AND created_at IS NOT NULL) OR (delivery_type = 'outbound' AND id IS NOT NULL AND user_id IS NOT NULL AND kind IS NOT NULL AND scope_id IS NOT NULL AND operation_id IS NOT NULL AND payload_digest IS NOT NULL AND payload_json IS NOT NULL AND state IS NOT NULL AND created_at IS NOT NULL AND updated_at IS NOT NULL) OR (delivery_type = 'recipe_event' AND trigger_id IS NOT NULL AND event_id IS NOT NULL AND state IS NOT NULL AND created_at IS NOT NULL)`,
    ),
    check0: check(
      "delivery_shape_0",
      sql`(delivery_type = 'mobile' AND device_id IS NOT NULL AND registration_id IS NULL AND operation_id IS NULL AND status IN ('sending','sent','failed')) OR (delivery_type = 'task' AND registration_id IS NOT NULL AND device_id IS NULL AND operation_id IS NULL AND user_id IS NOT NULL AND task_id IS NOT NULL AND task_version IS NOT NULL AND dedupe_key IS NOT NULL AND category IN ('decisions','failures','completions','assignments') AND status IN ('pending','delivered','failed','obsolete')) OR (delivery_type = 'outbound' AND device_id IS NULL AND registration_id IS NULL AND user_id IS NOT NULL AND kind IS NOT NULL AND scope_id IS NOT NULL AND operation_id IS NOT NULL AND payload_digest IS NOT NULL AND payload_json IS NOT NULL AND state IN ('prepared','sending','sent','indeterminate')) OR (delivery_type = 'recipe_event' AND trigger_id IS NOT NULL AND event_id IS NOT NULL AND state IN ('evaluating','skipped','queued') AND device_id IS NULL AND registration_id IS NULL AND task_id IS NULL AND operation_id IS NULL)`,
    ),
  }),
);

export const searchDocument = sqliteTable(
  "search_document",
  {
    id: text().notNull(),
    metadata: text(),
    title: text(),
    content: text(),
    type: text(),
    namespace: text(),
    user_id: integer(),
    created_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
    updated_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
    scope_type: text().default("personal"),
    logical_id: text(),
    lifecycle_status: text().default("pending"),
    provider: text(),
    provider_target: text().default("quarantined-legacy"),
    embedding_model: text().default("unknown-legacy"),
    vector_space: text(),
    vector_space_version: text().default("legacy"),
    embedding_dimensions: integer().default(1),
    distance_metric: text().default("unknown"),
    task_mode: text().default("unknown"),
    source_id: text(),
    source_revision: integer(),
    project_id: text(),
    status: text({ enum: ["lexical", "active", "stale"] }).default("lexical"),
    target: text(),
    lease_token: text(),
    lease_expires_at: text(),
    document_type: text({ enum: ["legacy", "embedding", "source"] }).notNull(),
    legacy_user_id: integer()
      .generatedAlwaysAs(sql`CASE WHEN document_type = 'legacy' THEN user_id END`)
      .references(() => user.id),
    embedding_user_id: integer()
      .generatedAlwaysAs(sql`CASE WHEN document_type = 'embedding' THEN user_id END`)
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => ({
    primaryKey: primaryKey({ columns: [table.document_type, table.id] }),
    legacyNamespaceIdx: index("search_document_legacy_namespace_idx")
      .on(table.namespace)
      .where(sql`document_type = 'legacy'`),
    legacyUserIdx: index("search_document_legacy_user_idx")
      .on(table.user_id)
      .where(sql`document_type = 'legacy'`),
    legacyScopeIdx: index("search_document_legacy_scope_idx")
      .on(table.id, table.type, table.namespace, table.user_id)
      .where(sql`document_type = 'legacy'`),
    embeddingLogicalIdx: uniqueIndex("search_document_embedding_logical_idx")
      .on(table.user_id, table.logical_id)
      .where(sql`document_type = 'embedding'`),
    embeddingLifecycleIdx: index("search_document_embedding_lifecycle_idx")
      .on(table.user_id, table.lifecycle_status)
      .where(sql`document_type = 'embedding'`),
    sourceRevisionIdx: uniqueIndex("search_document_source_revision_idx")
      .on(table.source_id, table.source_revision)
      .where(sql`document_type = 'source'`),
    sourceScopeIdx: index("search_document_source_scope_idx")
      .on(table.project_id, table.status)
      .where(sql`document_type = 'source'`),
    sourceStatusIdx: index("search_document_source_status_idx")
      .on(table.status)
      .where(sql`document_type = 'source'`),
    legacyOwnerIdx: index("search_document_legacy_owner_idx")
      .on(table.legacy_user_id)
      .where(sql`legacy_user_id IS NOT NULL`),
    embeddingOwnerIdx: index("search_document_embedding_owner_idx")
      .on(table.embedding_user_id)
      .where(sql`embedding_user_id IS NOT NULL`),
    shape0: check(
      "search_document_shape_0",
      sql`document_type IN ('legacy', 'embedding', 'source')`,
    ),
    shape1: check(
      "search_document_shape_1",
      sql`document_type != 'embedding' OR (scope_type = 'personal' AND lifecycle_status IN ('pending','active','delete_pending'))`,
    ),
    shape2: check(
      "search_document_shape_2",
      sql`document_type != 'source' OR (status IN ('lexical','active','stale') AND source_revision > 0)`,
    ),
    shape3: check(
      "search_document_shape_3",
      sql`(document_type = 'legacy' AND id IS NOT NULL AND created_at IS NOT NULL) OR (document_type = 'embedding' AND id IS NOT NULL AND scope_type IS NOT NULL AND user_id IS NOT NULL AND logical_id IS NOT NULL AND type IS NOT NULL AND title IS NOT NULL AND metadata IS NOT NULL AND lifecycle_status IS NOT NULL AND provider IS NOT NULL AND provider_target IS NOT NULL AND embedding_model IS NOT NULL AND vector_space IS NOT NULL AND vector_space_version IS NOT NULL AND created_at IS NOT NULL AND embedding_dimensions IS NOT NULL AND distance_metric IS NOT NULL AND task_mode IS NOT NULL) OR (document_type = 'source' AND id IS NOT NULL AND source_id IS NOT NULL AND source_revision IS NOT NULL AND user_id IS NOT NULL AND status IS NOT NULL AND target IS NOT NULL AND created_at IS NOT NULL)`,
    ),
  }),
);

export const searchChunk = sqliteTable(
  "search_chunk",
  {
    id: text().notNull(),
    document_id: text().notNull(),
    vector_id: text(),
    chunk_index: integer().notNull(),
    content: text().notNull(),
    metadata: text({ mode: "json" }).$type<Readonly<Record<string, unknown>>>(),
    lifecycle_status: text().default("pending"),
    provider: text(),
    provider_target: text().default("quarantined-legacy"),
    embedding_model: text().default("unknown-legacy"),
    vector_space: text(),
    vector_space_version: text().default("legacy"),
    created_at: text().default(sql`(CURRENT_TIMESTAMP)`),
    updated_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
    embedding_dimensions: integer().default(1),
    distance_metric: text().default("unknown"),
    task_mode: text().default("unknown"),
    title: text(),
    document_type: text({ enum: ["embedding", "source"] }).notNull(),
  },
  (table) => ({
    primaryKey: primaryKey({ columns: [table.document_type, table.id] }),
    documentReference: foreignKey({
      columns: [table.document_type, table.document_id],
      foreignColumns: [searchDocument.document_type, searchDocument.id],
    }).onDelete("cascade"),
    embeddingOrdinalIdx: uniqueIndex("search_chunk_embedding_ordinal_idx")
      .on(table.document_id, table.chunk_index)
      .where(sql`document_type = 'embedding'`),
    embeddingVectorIdx: uniqueIndex("search_chunk_embedding_vector_idx")
      .on(table.vector_id)
      .where(sql`document_type = 'embedding'`),
    documentIdx: index("search_chunk_document_idx").on(table.document_type, table.document_id),
    embeddingLifecycleIdx: index("search_chunk_embedding_lifecycle_idx")
      .on(table.document_id, table.lifecycle_status)
      .where(sql`document_type = 'embedding'`),
    shape0: check("search_chunk_shape_0", sql`document_type IN ('embedding', 'source')`),
    shape1: check(
      "search_chunk_shape_1",
      sql`document_type != 'embedding' OR lifecycle_status IN ('pending','active','delete_pending')`,
    ),
    shape2: check(
      "search_chunk_shape_2",
      sql`(document_type = 'embedding' AND id IS NOT NULL AND document_id IS NOT NULL AND vector_id IS NOT NULL AND chunk_index IS NOT NULL AND content IS NOT NULL AND metadata IS NOT NULL AND lifecycle_status IS NOT NULL AND provider IS NOT NULL AND provider_target IS NOT NULL AND embedding_model IS NOT NULL AND vector_space IS NOT NULL AND vector_space_version IS NOT NULL AND created_at IS NOT NULL AND embedding_dimensions IS NOT NULL AND distance_metric IS NOT NULL AND task_mode IS NOT NULL) OR (document_type = 'source' AND id IS NOT NULL AND document_id IS NOT NULL AND chunk_index IS NOT NULL AND title IS NOT NULL AND content IS NOT NULL)`,
    ),
  }),
);

export const workspace = sqliteTable(
  "workspace",
  {
    id: text().primaryKey(),
    name: text().notNull(),
    model_permissions: text({ mode: "json" }).$type<{
      grants: { admin: ModelPlatformAction[]; member: ModelPlatformAction[] };
      separation_of_duties: boolean;
      updated_at: string;
    }>(),
    model_permissions_updated_by: integer().references(() => user.id, { onDelete: "set null" }),
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

export interface WorkspaceMember {
  workspace_id: string;
  user_id: number;
  role: "owner" | "admin" | "member";
  joined_at: string;
}

export interface WorkspaceInvitation {
  id: string;
  workspace_id: string;
  email: string;
  role: "admin" | "member";
  token_hash: string;
  status: "pending" | "accepted" | "revoked";
  invited_by: number;
  accepted_by: number | null;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
  updated_at: string | null;
}

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
    default_model_tier: text({ enum: ["low", "medium", "high", "ultra"] }),
    coding_enabled: integer({ mode: "boolean" }).default(false).notNull(),
    coding_execution_provider: text({ enum: ["polychat", "openai"] })
      .default("polychat")
      .notNull(),
    coding_installation_id: integer(),
    coding_repository: text(),
    coding_prompt_strategy: text().default("auto").notNull(),
    coding_should_commit: integer({ mode: "boolean" }).default(true).notNull(),
    coding_delivery_policy: text({ mode: "json" }).$type<Record<string, unknown> | null>(),
    coding_environment_setup: text({ mode: "json" }).$type<Record<string, unknown> | null>(),
    coding_environment_cache: text({ mode: "json" }).$type<Record<string, unknown> | null>(),
    coding_cache_generation: integer().default(0).notNull(),
    coding_timeout_seconds: integer().default(900).notNull(),
    coding_inspection_window_seconds: integer().default(0).notNull(),
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

export const resource = sqliteTable(
  "resource",
  {
    resource_type: text({ enum: ["source", "output", "memory", "skill", "synthesis"] }).notNull(),
    id: text().notNull(),
    created_by_user_id: integer()
      .notNull()
      .references(() => user.id),
    scope_type: text({ enum: ["personal", "project"] }).notNull(),
    scope_id: text().notNull(),
    project_id: text().generatedAlwaysAs(sql`CASE WHEN scope_type = 'project' THEN scope_id END`),
    cascading_project_id: text()
      .generatedAlwaysAs(
        sql`CASE WHEN resource_type IN ('source', 'output') AND scope_type = 'project' THEN scope_id END`,
      )
      .references(() => project.id, { onDelete: "cascade" }),
    source_id: text()
      .generatedAlwaysAs(sql`CASE WHEN resource_type = 'source' THEN id END`)
      .unique(),
    output_id: text()
      .generatedAlwaysAs(sql`CASE WHEN resource_type = 'output' THEN id END`)
      .unique(),
    memory_id: text()
      .generatedAlwaysAs(sql`CASE WHEN resource_type = 'memory' THEN id END`)
      .unique(),
    skill_id: text()
      .generatedAlwaysAs(sql`CASE WHEN resource_type = 'skill' THEN id END`)
      .unique(),
    conversation_id: text().references(() => conversation.id, { onDelete: "set null" }),
    connection_id: text().references(() => providerConnection.id, { onDelete: "set null" }),
    kind: text(),
    title: text(),
    content: text(),
    status: text(),
    revision: integer().default(1),
    deleted_at: text(),
    archived_at: text(),
    storage_key: text(),
    mime_type: text(),
    filename: text(),
    byte_size: integer(),
    provider: text(),
    external_uri: text(),
    vector_id: text(),
    search_revision: integer().default(1),
    metadata: text({ mode: "json" }).$type<Record<string, unknown>>().default({}),
    parent_output_id: text(),
    capability_id: text(),
    group_id: text(),
    sensitivity: text({ enum: ["personal", "internal", "confidential"] }),
    provenance_json: text({ mode: "json" }).$type<OutputProvenance>(),
    revision_created_by_user_id: integer().references(() => user.id),
    revision_created_at: text(),
    revision_operation: text({ enum: ["created", "updated", "restored"] }),
    restored_from_revision: integer(),
    draft_revision_id: text(),
    stable_revision_id: text(),
    state_version: integer().default(1),
    namespace: text().default("global"),
    memory_ids: text(),
    memory_count: integer().default(0),
    tokens_used: integer(),
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
    pk: primaryKey({ columns: [table.resource_type, table.id] }),
    scopeIdx: index("resource_scope_idx").on(table.resource_type, table.scope_type, table.scope_id),
    creatorIdx: index("resource_creator_idx").on(table.resource_type, table.created_by_user_id),
    projectIdx: index("resource_project_idx").on(table.resource_type, table.project_id),
    conversationIdx: index("resource_conversation_idx").on(
      table.resource_type,
      table.conversation_id,
    ),
    storageIdx: uniqueIndex("resource_storage_idx")
      .on(table.resource_type, table.storage_key)
      .where(sql`storage_key IS NOT NULL`),
    memoryNameIdx: uniqueIndex("resource_memory_name_idx")
      .on(table.scope_type, table.scope_id, table.title)
      .where(sql`resource_type = 'memory' AND deleted_at IS NULL`),
    skillNameIdx: uniqueIndex("resource_skill_name_idx")
      .on(table.scope_type, table.scope_id, table.title)
      .where(sql`resource_type = 'skill' AND archived_at IS NULL`),
    sourceConnectionIdx: index("resource_source_connection_idx")
      .on(table.connection_id)
      .where(sql`resource_type = 'source'`),
    sourceKindIdx: index("resource_source_kind_idx")
      .on(table.kind)
      .where(sql`resource_type = 'source'`),
    sourceVectorIdx: index("resource_source_vector_idx")
      .on(table.vector_id)
      .where(sql`resource_type = 'source'`),
    outputParentIdx: index("resource_output_parent_idx")
      .on(table.parent_output_id)
      .where(sql`resource_type = 'output'`),
    outputCapabilityIdx: index("resource_output_capability_idx")
      .on(table.capability_id)
      .where(sql`resource_type = 'output'`),
    outputGroupIdx: index("resource_output_group_idx")
      .on(table.group_id)
      .where(sql`resource_type = 'output'`),
    outputLookupIdx: index("resource_output_lookup_idx")
      .on(table.created_by_user_id, table.capability_id, table.group_id, table.kind)
      .where(sql`resource_type = 'output'`),
    synthesisOwnerIdx: index("resource_synthesis_owner_idx")
      .on(table.created_by_user_id, table.created_at)
      .where(sql`resource_type = 'synthesis'`),
    synthesisActiveIdx: index("resource_synthesis_active_idx")
      .on(table.created_by_user_id, table.namespace, table.is_active, table.created_at)
      .where(sql`resource_type = 'synthesis'`),
    scopeCheck: check("resource_scope_check", sql`scope_type IN ('personal', 'project')`),
    shapeCheck: check(
      "resource_shape_check",
      sql`(resource_type = 'source' AND kind IS NOT NULL AND title IS NOT NULL AND status IS NOT NULL AND search_revision IS NOT NULL AND metadata IS NOT NULL) OR (resource_type = 'output' AND kind IS NOT NULL AND title IS NOT NULL AND capability_id IS NOT NULL AND status IS NOT NULL AND sensitivity IS NOT NULL AND content IS NOT NULL AND revision IS NOT NULL) OR (resource_type = 'memory' AND kind IS NOT NULL AND title IS NOT NULL AND content IS NOT NULL AND revision IS NOT NULL AND updated_at IS NOT NULL) OR (resource_type = 'skill' AND title IS NOT NULL AND draft_revision_id IS NOT NULL AND stable_revision_id IS NOT NULL AND state_version IS NOT NULL AND state_version >= 1 AND updated_at IS NOT NULL) OR (resource_type = 'synthesis' AND content IS NOT NULL AND scope_type = 'personal')`,
    ),
  }),
);

export interface MemoryDocumentRow {
  id: string;
  scope_type: "personal" | "project";
  scope_id: string;
  kind: "memory" | "conversation_brief" | "teammate_context";
  name: string;
  content: string;
  revision: number;
  created_by: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export const resourceRevision = sqliteTable(
  "resource_revision",
  {
    id: text()
      .notNull()
      .default(sql`(lower(hex(randomblob(16))))`),
    document_id: text().references(() => resource.memory_id, { onDelete: "cascade" }),
    revision: integer().notNull(),
    text_content: text().default(""),
    change_note: text(),
    created_by: integer().references(() => user.id),
    created_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
    operation_id: text(),
    skill_id: text().references(() => resource.skill_id, { onDelete: "cascade" }),
    description: text(),
    digest: text(),
    storage_key: text(),
    size: integer(),
    source_skill_id: text(),
    source_revision_id: text(),
    output_id: text().references(() => resource.output_id, { onDelete: "cascade" }),
    title: text(),
    status: text({
      enum: ["pending", "ready", "failed", "archived"],
    }),
    sensitivity: text({
      enum: ["personal", "internal", "confidential"],
    }),
    content: text({ mode: "json" }).$type<Record<string, unknown>>(),
    created_by_user_id: integer().references(() => user.id),
    provenance_json: text({ mode: "json" }).$type<OutputProvenance>(),
    operation: text({ enum: ["created", "updated", "restored"] }),
    restored_from_revision: integer(),
    resource_type: text({ enum: ["memory", "skill", "output"] }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.resource_type, table.id] }),
    memoryRevisionIdx: uniqueIndex("resource_revision_memory_revision_idx")
      .on(table.document_id, table.revision)
      .where(sql`document_id IS NOT NULL`),
    memoryOperationIdx: uniqueIndex("resource_revision_memory_operation_idx")
      .on(table.document_id, table.operation_id)
      .where(sql`document_id IS NOT NULL AND operation_id IS NOT NULL`),
    skillRevisionIdx: uniqueIndex("resource_revision_skill_revision_idx")
      .on(table.skill_id, table.revision)
      .where(sql`skill_id IS NOT NULL`),
    outputRevisionIdx: uniqueIndex("resource_revision_output_revision_idx")
      .on(table.output_id, table.revision)
      .where(sql`output_id IS NOT NULL`),
    storageKeyIdx: uniqueIndex("resource_revision_storage_key_idx")
      .on(table.storage_key)
      .where(sql`storage_key IS NOT NULL`),
    requiredFields: check(
      "resource_revision_required_fields",
      sql`(resource_type = 'memory' AND id IS NOT NULL AND document_id IS NOT NULL AND revision IS NOT NULL AND text_content IS NOT NULL AND created_by IS NOT NULL AND created_at IS NOT NULL) OR (resource_type = 'skill' AND id IS NOT NULL AND skill_id IS NOT NULL AND revision IS NOT NULL AND description IS NOT NULL AND digest IS NOT NULL AND storage_key IS NOT NULL AND size IS NOT NULL AND created_by IS NOT NULL AND created_at IS NOT NULL) OR (resource_type = 'output' AND output_id IS NOT NULL AND revision IS NOT NULL AND title IS NOT NULL AND status IS NOT NULL AND sensitivity IS NOT NULL AND content IS NOT NULL AND created_by_user_id IS NOT NULL AND created_at IS NOT NULL)`,
    ),
    check0: check(
      "resource_revision_shape_0",
      sql`(resource_type = 'memory' AND document_id IS NOT NULL AND skill_id IS NULL AND output_id IS NULL AND text_content IS NOT NULL AND created_by IS NOT NULL) OR (resource_type = 'skill' AND skill_id IS NOT NULL AND document_id IS NULL AND output_id IS NULL AND description IS NOT NULL AND digest IS NOT NULL AND storage_key IS NOT NULL AND size IS NOT NULL AND size >= 0 AND revision >= 1 AND created_by IS NOT NULL) OR (resource_type = 'output' AND output_id IS NOT NULL AND document_id IS NULL AND skill_id IS NULL AND title IS NOT NULL AND status IN ('pending','ready','failed','archived') AND sensitivity IN ('personal','internal','confidential') AND content IS NOT NULL AND created_by_user_id IS NOT NULL)`,
    ),
    check1: check(
      "resource_revision_shape_1",
      sql`(source_skill_id IS NULL AND source_revision_id IS NULL) OR (source_skill_id IS NOT NULL AND source_revision_id IS NOT NULL)`,
    ),
  }),
);

export type MemoryDocumentRevisionRow = {
  id: string;
  document_id: string;
  revision: number;
  content: string;
  change_note: string | null;
  operation_id: string | null;
  created_by: number;
  created_at: string;
};

export const memoryReflection = sqliteTable(
  "memory_reflection",
  {
    record_kind: text({ enum: ["checkpoint", "result"] }).notNull(),
    id: text().notNull(),
    context_id: text()
      .notNull()
      .references(() => teammateContext.id, { onDelete: "cascade" }),
    conversation_id: text()
      .notNull()
      .references(() => conversation.id, { onDelete: "cascade" }),
    through_message_id: text().notNull(),
    revision: integer(),
    status: text({ enum: ["applied", "no_change"] }),
    evidence_json: text(),
    created_at: text()
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updated_at: text()
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    primaryKey: primaryKey({ columns: [table.record_kind, table.id] }),
    checkpointIdx: uniqueIndex("memory_reflection_checkpoint_idx")
      .on(table.context_id, table.conversation_id)
      .where(sql`record_kind = 'checkpoint'`),
    contextIdx: index("memory_reflection_context_idx").on(table.context_id),
    conversationIdx: index("memory_reflection_conversation_idx").on(table.conversation_id),
    shape: check(
      "memory_reflection_shape",
      sql`record_kind = 'checkpoint' OR (record_kind = 'result' AND revision IS NOT NULL AND status IS NOT NULL AND status IN ('applied', 'no_change') AND evidence_json IS NOT NULL)`,
    ),
  }),
);

export interface MemoryReflectionResultRow {
  id: string;
  context_id: string;
  conversation_id: string;
  through_message_id: string;
  revision: number;
  status: "applied" | "no_change";
  evidence_json: string;
  created_at: string;
}

export const userResourceState = sqliteTable(
  "user_resource_state",
  {
    id: text()
      .notNull()
      .default(sql`(lower(hex(randomblob(16))))`),
    user_id: integer().notNull(),
    saved_conversation_id: text(),
    message_id: text(),
    note: text(),
    saved_at: text().default(sql`(CURRENT_TIMESTAMP)`),
    conversation_id: text().references(() => conversation.id, { onDelete: "cascade" }),
    is_pinned: integer({ mode: "boolean" }).default(false),
    is_unread: integer({ mode: "boolean" }).default(false),
    snoozed_until: text(),
    snoozed_next_response_at: text(),
    revision: integer().default(1),
    updated_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
    task_id: text().references(() => projectTask.id, { onDelete: "cascade" }),
    task_version: integer(),
    read_at: text(),
    dismissed_at: text(),
    teammate_id: text(),
    publication_id: text().references((): AnySQLiteColumn => template.publication_id),
    feedback_conversation_id: text(),
    rating: integer(),
    verdict: text({ enum: ["good", "bad"] }),
    created_at: text().default(sql`(CURRENT_TIMESTAMP)`),
    feedback_teammate_id: text()
      .generatedAlwaysAs(sql`CASE WHEN resource_type = 'teammate_feedback' THEN teammate_id END`)
      .references(() => teammates.id, { onDelete: "cascade" }),
    installed_teammate_id: text()
      .generatedAlwaysAs(sql`CASE WHEN resource_type = 'teammate_install' THEN teammate_id END`)
      .references(() => teammates.id),
    teammate_user_id: integer()
      .generatedAlwaysAs(
        sql`CASE WHEN resource_type IN ('teammate_install', 'teammate_rating', 'teammate_feedback') THEN user_id END`,
      )
      .references(() => user.id),
    resource_type: text({
      enum: [
        "conversation",
        "message",
        "task",
        "teammate_install",
        "teammate_rating",
        "teammate_feedback",
      ],
    }).notNull(),
    state_user_id: integer()
      .generatedAlwaysAs(sql`CASE WHEN resource_type IN ('conversation', 'task') THEN user_id END`)
      .references(() => user.id, { onDelete: "cascade" }),
    saved_user_id: integer()
      .generatedAlwaysAs(sql`CASE WHEN resource_type = 'message' THEN user_id END`)
      .references(() => user.id),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.resource_type, table.id] }),
    savedMessageIdx: uniqueIndex("user_resource_state_saved_message_idx")
      .on(table.user_id, table.message_id)
      .where(sql`message_id IS NOT NULL`),
    conversationUserIdx: uniqueIndex("user_resource_state_conversation_user_idx")
      .on(table.conversation_id, table.user_id)
      .where(sql`conversation_id IS NOT NULL`),
    taskReceiptIdx: uniqueIndex("user_resource_state_task_receipt_idx")
      .on(table.user_id, table.task_id, table.task_version)
      .where(sql`task_id IS NOT NULL`),
    savedAtIdx: index("user_resource_state_saved_at_idx")
      .on(table.resource_type, table.user_id, table.saved_at)
      .where(sql`resource_type = 'message'`),
    pinnedIdx: index("user_resource_state_pinned_idx")
      .on(table.resource_type, table.user_id, table.is_pinned)
      .where(sql`resource_type = 'conversation'`),
    unreadIdx: index("user_resource_state_unread_idx")
      .on(table.resource_type, table.user_id, table.is_unread)
      .where(sql`resource_type = 'conversation'`),
    snoozeIdx: index("user_resource_state_snooze_idx")
      .on(table.resource_type, table.user_id, table.snoozed_until)
      .where(sql`resource_type = 'conversation'`),
    taskVersionIdx: index("user_resource_state_task_version_idx")
      .on(table.task_id, table.task_version)
      .where(sql`task_id IS NOT NULL`),
    stateOwnerIdx: index("user_resource_state_state_owner_idx")
      .on(table.state_user_id)
      .where(sql`state_user_id IS NOT NULL`),
    savedOwnerIdx: index("user_resource_state_saved_owner_idx")
      .on(table.saved_user_id)
      .where(sql`saved_user_id IS NOT NULL`),
    publicationUserIdx: index("user_resource_state_publication_user_idx").on(
      table.resource_type,
      table.publication_id,
      table.user_id,
    ),
    publicationRecentIdx: index("user_resource_state_publication_recent_idx").on(
      table.resource_type,
      table.publication_id,
      table.created_at,
    ),
    teammateIdx: index("user_resource_state_teammate_idx").on(
      table.resource_type,
      table.teammate_id,
      table.user_id,
    ),
    feedbackConversationIdx: uniqueIndex("user_resource_state_feedback_conversation_idx")
      .on(table.user_id, table.teammate_id, table.feedback_conversation_id)
      .where(sql`resource_type = 'teammate_feedback'`),
    feedbackOwnerIdx: index("user_resource_state_feedback_owner_idx").on(
      table.feedback_teammate_id,
    ),
    installedOwnerIdx: index("user_resource_state_installed_owner_idx").on(
      table.installed_teammate_id,
    ),
    teammateUserIdx: index("user_resource_state_teammate_user_idx").on(table.teammate_user_id),
    publicationOwnerIdx: index("user_resource_state_publication_owner_idx").on(
      table.publication_id,
    ),
    requiredFields: check(
      "user_resource_state_required_fields",
      sql`(resource_type = 'message' AND id IS NOT NULL AND user_id IS NOT NULL AND saved_conversation_id IS NOT NULL AND message_id IS NOT NULL AND saved_at IS NOT NULL) OR (resource_type = 'conversation' AND conversation_id IS NOT NULL AND user_id IS NOT NULL AND is_pinned IS NOT NULL AND is_unread IS NOT NULL AND revision IS NOT NULL) OR (resource_type = 'task' AND user_id IS NOT NULL AND task_id IS NOT NULL AND task_version IS NOT NULL) OR (resource_type = 'teammate_install' AND teammate_id IS NOT NULL AND publication_id IS NOT NULL AND created_at IS NOT NULL AND rating IS NULL AND verdict IS NULL AND feedback_conversation_id IS NULL) OR (resource_type = 'teammate_rating' AND publication_id IS NOT NULL AND rating IS NOT NULL AND created_at IS NOT NULL AND teammate_id IS NULL AND verdict IS NULL AND feedback_conversation_id IS NULL) OR (resource_type = 'teammate_feedback' AND teammate_id IS NOT NULL AND verdict IS NOT NULL AND created_at IS NOT NULL AND publication_id IS NULL AND rating IS NULL)`,
    ),
    check0: check(
      "user_resource_state_shape_0",
      sql`(((resource_type = 'conversation' AND conversation_id IS NOT NULL AND message_id IS NULL AND task_id IS NULL) OR (resource_type = 'message' AND message_id IS NOT NULL AND saved_conversation_id IS NOT NULL AND conversation_id IS NULL AND task_id IS NULL) OR (resource_type = 'task' AND task_id IS NOT NULL AND task_version IS NOT NULL AND conversation_id IS NULL AND message_id IS NULL)) AND teammate_id IS NULL AND publication_id IS NULL AND rating IS NULL AND verdict IS NULL AND feedback_conversation_id IS NULL) OR (((resource_type = 'teammate_install' AND teammate_id IS NOT NULL AND publication_id IS NOT NULL AND created_at IS NOT NULL AND rating IS NULL AND verdict IS NULL AND feedback_conversation_id IS NULL) OR (resource_type = 'teammate_rating' AND publication_id IS NOT NULL AND rating IS NOT NULL AND created_at IS NOT NULL AND teammate_id IS NULL AND verdict IS NULL AND feedback_conversation_id IS NULL) OR (resource_type = 'teammate_feedback' AND teammate_id IS NOT NULL AND verdict IS NOT NULL AND created_at IS NOT NULL AND publication_id IS NULL AND rating IS NULL)) AND conversation_id IS NULL AND message_id IS NULL AND saved_conversation_id IS NULL AND task_id IS NULL)`,
    ),
  }),
);

export type MessageUserStateRow = typeof userResourceState.$inferSelect;

export const channelBinding = sqliteTable(
  "channel_binding",
  {
    id: text().primaryKey(),
    channel: text({ enum: ["sms", "slack", "telegram"] }).notNull(),
    scope_type: text({ enum: ["personal", "project"] }).notNull(),
    scope_id: text().notNull(),
    external_id: text().notNull(),
    label: text(),
    teammate_id: text().references(() => teammates.id, {
      onDelete: "set null",
    }),
    interaction_mode: text({ enum: ["direct", "automated"] })
      .notNull()
      .default("automated"),
    created_by: integer()
      .notNull()
      .references(() => user.id),
    enabled: integer({ mode: "boolean" }).default(true).notNull(),
    created_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
  },
  (table) => ({
    channelExternalIdx: uniqueIndex("channel_binding_channel_external_idx").on(
      table.channel,
      table.external_id,
    ),
    scopeIdx: index("channel_binding_scope_idx").on(table.scope_type, table.scope_id),
  }),
);

export type ChannelBindingRow = typeof channelBinding.$inferSelect;

export const channelSender = sqliteTable(
  "channel_sender",
  {
    id: text().primaryKey(),
    binding_id: text()
      .notNull()
      .references(() => channelBinding.id, { onDelete: "cascade" }),
    sender_id: text().notNull(),
    user_id: integer()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    revision: integer().notNull().default(1),
    revoked_at: text(),
    created_at: text()
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    identityIdx: uniqueIndex("channel_sender_identity_idx").on(table.binding_id, table.sender_id),
    userIdx: index("channel_sender_user_idx").on(table.user_id),
  }),
);

export type ChannelSenderRow = typeof channelSender.$inferSelect;

export type OutboundDeliveryRow = {
  id: string;
  user_id: number;
  kind: string;
  scope_id: string;
  operation_id: string;
  payload_digest: string;
  payload_json: Record<string, unknown>;
  state: "prepared" | "sending" | "sent" | "indeterminate";
  execution_token: string | null;
  execution_lease_expires_at: string | null;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
};

export const teammateContext = sqliteTable(
  "teammate_context",
  {
    id: text().primaryKey(),
    computer_id: text(),
    computer_provider: text(),
    computer_provider_handle: text(),
    computer_checkpoint_reference: text(),
    computer_status: text({
      enum: ["stopped", "provisioning", "ready", "checkpointing", "takeover", "error", "destroyed"],
    }),
    computer_lease_kind: text({ enum: ["agent", "user"] }),
    computer_lease_owner_id: text(),
    computer_lease_expires_at: text(),
    computer_lease_fence: integer(),
    computer_last_error: text(),
    computer_created_at: text(),
    computer_updated_at: text(),

    teammate_id: text()
      .notNull()
      .references(() => teammates.id, { onDelete: "cascade" }),
    actor_user_id: integer()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    scope_type: text({ enum: ["personal", "project"] }).notNull(),
    scope_id: text().notNull(),
    home_conversation_id: text()
      .notNull()
      .references(() => conversation.id, { onDelete: "cascade" }),
    memory_document_id: text()
      .notNull()
      .references(() => resource.memory_id, { onDelete: "cascade" }),
    status: text({ enum: ["active", "paused", "archived"] })
      .notNull()
      .default("active"),
    autonomy_level: text({ enum: ["observer", "assistant", "partner"] }),
    standing_approvals: text({ mode: "json" })
      .$type<TeammateStandingApproval[]>()
      .default([])
      .notNull(),
    created_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
    updated_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    computerShapeCheck: check(
      "teammate_context_computer_shape_check",
      sql`computer_id IS NULL OR (computer_provider IS NOT NULL AND computer_status IS NOT NULL AND computer_lease_fence IS NOT NULL AND computer_created_at IS NOT NULL)`,
    ),
    computerIdentityIdx: uniqueIndex("teammate_context_computer_identity_idx").on(
      table.computer_id,
    ),
    computerLeaseIdx: index("teammate_context_computer_lease_idx").on(
      table.computer_lease_expires_at,
    ),
    identityIdx: uniqueIndex("teammate_context_identity_idx").on(
      table.teammate_id,
      table.actor_user_id,
      table.scope_type,
      table.scope_id,
    ),
    homeConversationIdx: uniqueIndex("teammate_context_home_conversation_idx").on(
      table.home_conversation_id,
    ),
    memoryDocumentIdx: uniqueIndex("teammate_context_memory_document_idx").on(
      table.memory_document_id,
    ),
  }),
);

export type TeammateContextRow = Omit<typeof teammateContext.$inferSelect, `computer_${string}`>;

export interface TeammateConnectionGrantRow {
  id: string;
  context_id: string;
  connection_id: string;
  allowed_operations: string[];
  revision: number;
  created_at: string;
  updated_at: string | null;
}

export interface TeammateComputerRow {
  id: string;
  context_id: string;
  provider: string;
  provider_handle: string | null;
  checkpoint_reference: string | null;
  status:
    | "stopped"
    | "provisioning"
    | "ready"
    | "checkpointing"
    | "takeover"
    | "error"
    | "destroyed";
  lease_kind: "agent" | "user" | null;
  lease_owner_id: string | null;
  lease_expires_at: string | null;
  lease_fence: number;
  last_error: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface TeammateFeedbackRow {
  id: string;
  teammate_id: string;
  user_id: number;
  conversation_id: string | null;
  verdict: "good" | "bad";
  note: string | null;
  created_at: string;
}

export type AuthoredSkillRevision = typeof resourceRevision.$inferSelect;

export const conversation = sqliteTable(
  "conversation",
  {
    id: text().primaryKey(),
    user_id: integer()
      .notNull()
      .references(() => user.id),
    type: text({ enum: ["chat", "task", "poly", "delegate"] })
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
    model_id: text(),
    model_tier: text({ enum: ["low", "medium", "high", "ultra"] }),
    permission_mode: text({
      enum: ["supervised", "auto_accept_edits", "auto", "full_access"],
    })
      .notNull()
      .default("auto_accept_edits"),
    group_id: text().references((): AnySQLiteColumn => resourceCollection.id, {
      onDelete: "set null",
    }),
    group_assigned_by_user_id: integer().references(() => user.id),
    group_assigned_at: text(),
    brief_document_id: text().references(() => resource.memory_id, {
      onDelete: "set null",
    }),
    created_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
    updated_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    groupIdx: index("conversation_group_idx").on(table.group_id),
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
    briefDocumentIdx: index("conversation_brief_document_idx").on(table.brief_document_id),
    userProjectArchivedUpdatedIdx: index("conversation_user_project_archived_updated_idx").on(
      table.user_id,
      table.project_id,
      table.is_archived,
      table.updated_at,
    ),
  }),
);

export type Conversation = typeof conversation.$inferSelect;

export const conversationRun = sqliteTable(
  "conversation_run",
  {
    id: text().primaryKey(),
    conversation_id: text().notNull(),
    project_id: text().references(() => project.id, { onDelete: "cascade" }),
    project_task_id: text(),
    stage_id: text(),
    initiator_user_id: integer()
      .notNull()
      .references(() => user.id),
    teammate_context_id: text().references(() => teammateContext.id, {
      onDelete: "set null",
    }),
    computer_id: text().references(() => teammateContext.computer_id, {
      onDelete: "set null",
    }),
    trigger: text({
      enum: ["user", "delegation", "handle", "schedule", "channel"],
    })
      .notNull()
      .default("user"),
    status: text({
      enum: [
        "accepted",
        "running",
        "awaiting_input",
        "awaiting_approval",
        "awaiting_takeover",
        "cancelling",
        "succeeded",
        "failed",
        "cancelled",
        "interrupted",
      ],
    })
      .notNull()
      .default("accepted"),
    attempt: integer().notNull().default(1),
    event_sequence: integer().notNull().default(0),
    terminal_reason: text(),
    interaction_kind: text({ enum: ["question", "approval", "takeover"] }),
    last_message_id: text(),
    context_json: text(),
    retry_json: text(),
    provenance_json: text(),
    resolved_configuration_json: text(),
    created_at: text().notNull(),
    updated_at: text().notNull(),
    started_at: text(),
    completed_at: text(),
    cancellation_requested_at: text(),
    partial_content: text(),
  },
  (table) => ({
    conversationUpdatedIdx: index("conversation_run_conversation_updated_idx").on(
      table.conversation_id,
      table.updated_at,
    ),
    projectUpdatedIdx: index("conversation_run_project_updated_idx").on(
      table.project_id,
      table.updated_at,
    ),
    projectTaskIdx: index("conversation_run_project_task_idx").on(table.project_task_id),
    initiatorIdx: index("conversation_run_initiator_idx").on(table.initiator_user_id),
    statusUpdatedIdx: index("conversation_run_status_updated_idx").on(
      table.status,
      table.updated_at,
    ),
  }),
);

export type ConversationRunRow = typeof conversationRun.$inferSelect;

export const conversationRunEvent = sqliteTable(
  "conversation_run_event",
  {
    id: text().primaryKey(),
    run_id: text()
      .notNull()
      .references(() => conversationRun.id, { onDelete: "cascade" }),
    sequence: integer().notNull(),
    protocol_version: integer().notNull().default(1),
    attempt: integer().notNull(),
    type: text().notNull(),
    occurred_at: text().notNull(),
    data: text().notNull().default("{}"),
  },
  (table) => ({
    runSequenceIdx: uniqueIndex("conversation_run_event_run_sequence_idx").on(
      table.run_id,
      table.sequence,
    ),
    runOccurredIdx: index("conversation_run_event_run_occurred_idx").on(
      table.run_id,
      table.occurred_at,
    ),
  }),
);

export type ConversationRunEventRow = typeof conversationRunEvent.$inferSelect;

export const delegation = sqliteTable(
  "delegation",
  {
    id: text().primaryKey(),
    parent_conversation_id: text()
      .notNull()
      .references(() => conversation.id, { onDelete: "cascade" }),
    child_conversation_id: text()
      .notNull()
      .references(() => conversation.id, { onDelete: "cascade" }),
    parent_run_id: text()
      .notNull()
      .references(() => conversationRun.id, { onDelete: "cascade" }),
    depth: integer().notNull(),
    teammate_id: text().notNull(),
    goal: text().notNull(),
    wait_for: text({ enum: ["all", "any", "none"] }).notNull(),
    max_credit_micros: integer().notNull(),
    max_steps: integer().notNull(),
    deadline: text().notNull(),
    state: text({
      enum: [
        "queued",
        "running",
        "awaiting_input",
        "awaiting_approval",
        "awaiting_takeover",
        "done",
        "failed",
        "cancelled",
        "expired",
      ],
    })
      .notNull()
      .default("queued"),
    result_json: text({ mode: "json" }).$type<Record<string, unknown> | null>(),
    memory_bindings_json: text({ mode: "json" })
      .$type<Array<{ documentId: string; access: "read" | "read-write" }>>()
      .default([])
      .notNull(),
    predecessor_delegation_id: text(),
    continuation_mode: text({ enum: ["new", "resume", "fresh"] })
      .notNull()
      .default("new"),
    created_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
    updated_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    parentConversationIdx: index("delegation_parent_conversation_idx").on(
      table.parent_conversation_id,
    ),
    childConversationIdx: index("delegation_child_conversation_idx").on(
      table.child_conversation_id,
    ),
  }),
);

export type DelegationRow = typeof delegation.$inferSelect;

export interface ConversationHandleRow {
  id: string;
  conversation_id: string;
  delegation_id: string;
  granted_by: "spawn" | "user";
  granted_at: string;
  expires_at: string | null;
  revoked_at: string | null;
}

export const conversationRunCommand = sqliteTable(
  "conversation_run_command",
  {
    id: text().primaryKey(),
    run_id: text()
      .notNull()
      .references(() => conversationRun.id, { onDelete: "cascade" }),
    user_id: integer()
      .notNull()
      .references(() => user.id),
    command_id: text().notNull(),
    kind: text({ enum: ["turn", "interaction_response", "cancel"] }).notNull(),
    input_digest: text().notNull(),
    accepted_at: text().notNull(),
  },
  (table) => ({
    userCommandIdx: uniqueIndex("conversation_run_command_user_command_idx").on(
      table.user_id,
      table.command_id,
    ),
    runAcceptedIdx: index("conversation_run_command_run_accepted_idx").on(
      table.run_id,
      table.accepted_at,
    ),
  }),
);

export type ConversationRunCommandRow = typeof conversationRunCommand.$inferSelect;

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
    run_id: text().references(() => conversationRun.id),
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
      enum: ["normal", "local", "remote", "no_system", "teammate", "plan", "build", "explore"],
    }),
    log_id: text(),
    data: text({
      mode: "json",
    }),
    usage: text({
      mode: "json",
    }),
    provenance_json: text(),
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
    runIdx: index("message_run_id_idx").on(table.run_id),
  }),
);

export type Message = typeof message.$inferSelect;

export const scopedConfiguration = sqliteTable(
  "scoped_configuration",
  {
    kind: text({
      enum: ["preferences", "provider", "model", "capability", "environment", "review_policy"],
    }).notNull(),
    id: text().notNull(),
    user_id: integer().references(() => user.id, { onDelete: "cascade" }),
    project_id: text().references(() => project.id, { onDelete: "cascade" }),
    workspace_id: text().references(() => workspace.id, { onDelete: "cascade" }),
    owner_user_id: integer().references(() => user.id, { onDelete: "cascade" }),
    connection_id: text().references(() => providerConnection.id, { onDelete: "cascade" }),
    account_id: text(),
    revision: text(),
    scope_type: text().generatedAlwaysAs(
      sql`CASE WHEN project_id IS NOT NULL THEN 'project' ELSE 'user' END`,
    ),
    scope_id: text().generatedAlwaysAs(sql`COALESCE(project_id, CAST(user_id AS TEXT))`),
    target_kind: text().default("").notNull(),
    target_id: text(),
    payload: text({ mode: "json" }).$type<Record<string, unknown>>().default({}).notNull(),
    encrypted_value: text(),
    public_key: text(),
    enabled: integer({ mode: "boolean" }),
    attached: integer({ mode: "boolean" }).default(false).notNull(),
    excluded: integer({ mode: "boolean" }).default(false).notNull(),
    created_by: integer().references(() => user.id),
    configuration_id: text(),
    configuration_created_at: text(),
    created_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
    updated_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.kind, table.id] }),
    userTargetIdx: index("scoped_configuration_user_target_idx").on(
      table.user_id,
      table.kind,
      table.target_id,
    ),
    projectTargetIdx: index("scoped_configuration_project_target_idx").on(
      table.project_id,
      table.kind,
      table.target_kind,
      table.target_id,
    ),
    targetIdx: index("scoped_configuration_target_idx").on(
      table.kind,
      table.target_kind,
      table.target_id,
    ),
    capabilityIdx: uniqueIndex("scoped_configuration_capability_idx")
      .on(table.scope_type, table.scope_id, table.target_kind, table.target_id)
      .where(sql`${table.kind} = 'capability'`),
    environmentIdx: uniqueIndex("scoped_configuration_environment_idx")
      .on(table.project_id, table.target_id)
      .where(sql`${table.kind} = 'environment'`),
    reviewIdentityIdx: uniqueIndex("scoped_configuration_review_identity_idx")
      .on(
        table.workspace_id,
        table.project_id,
        table.target_kind,
        table.connection_id,
        table.target_id,
      )
      .where(sql`${table.kind} = 'review_policy'`),
    reviewRepositoryIdx: index("scoped_configuration_review_repository_idx")
      .on(table.target_kind, table.account_id, table.target_id, table.enabled)
      .where(sql`${table.kind} = 'review_policy'`),
    workspaceIdx: index("scoped_configuration_workspace_idx").on(table.workspace_id),
    ownerIdx: index("scoped_configuration_owner_idx").on(table.owner_user_id),
    connectionIdx: index("scoped_configuration_connection_idx").on(table.connection_id),
    reviewShape: check(
      "scoped_configuration_review_shape",
      sql`${table.kind} = 'review_policy' OR (${table.workspace_id} IS NULL AND ${table.owner_user_id} IS NULL AND ${table.connection_id} IS NULL AND ${table.account_id} IS NULL AND ${table.revision} IS NULL)`,
    ),
    scopeCheck: check(
      "scoped_configuration_scope_check",
      sql`(${table.user_id} IS NOT NULL) != (${table.project_id} IS NOT NULL)`,
    ),
    kindCheck: check(
      "scoped_configuration_kind_check",
      sql`(${table.kind} IN ('preferences', 'provider', 'model') AND ${table.user_id} IS NOT NULL AND (${table.kind} != 'provider' OR ${table.target_id} IS NOT NULL)) OR (${table.kind} = 'capability' AND ${table.target_id} IS NOT NULL) OR (${table.kind} = 'environment' AND ${table.project_id} IS NOT NULL AND ${table.target_id} IS NOT NULL AND ${table.encrypted_value} IS NOT NULL) OR (${table.kind} = 'review_policy' AND ${table.project_id} IS NOT NULL AND ${table.workspace_id} IS NOT NULL AND ${table.owner_user_id} IS NOT NULL AND ${table.connection_id} IS NOT NULL AND ${table.account_id} IS NOT NULL AND ${table.target_id} IS NOT NULL AND ${table.enabled} IS NOT NULL AND ${table.revision} IS NOT NULL AND json_extract(${table.payload}, '$.token_budget') IS NOT NULL)`,
    ),
    attachmentCheck: check(
      "scoped_configuration_attachment_check",
      sql`${table.attached} = 0 OR (${table.kind} = 'capability' AND ${table.project_id} IS NOT NULL AND ${table.created_by} IS NOT NULL)`,
    ),
  }),
);

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

export const userCredential = sqliteTable(
  "user_credential",
  {
    id: integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
    kind: text({ enum: ["oauth", "api_key", "passkey"] }).notNull(),
    user_id: integer()
      .notNull()
      .references(() => user.id),
    public_id: text(),
    provider: text(),
    external_id: text(),
    encrypted_value: text(),
    token_hash: text(),
    name: text().default("API Key"),
    public_key: text({ mode: "json" }).$type<JsonWebKey>(),
    counter: integer(),
    device_type: text(),
    backed_up: integer({ mode: "boolean" }),
    transports: text({ mode: "json" }).$type<readonly AuthenticatorTransport[]>(),
    created_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
    updated_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    ownerIdx: index("user_credential_owner_idx").on(table.user_id, table.kind, table.created_at),
    oauthIdentityIdx: uniqueIndex("user_credential_oauth_identity_idx")
      .on(table.provider, table.external_id)
      .where(sql`${table.kind} = 'oauth'`),
    apiPublicIdIdx: uniqueIndex("user_credential_api_public_id_idx")
      .on(table.public_id)
      .where(sql`${table.kind} = 'api_key'`),
    apiHashIdx: uniqueIndex("user_credential_api_hash_idx")
      .on(table.token_hash)
      .where(sql`${table.kind} = 'api_key'`),
    passkeyIdIdx: uniqueIndex("user_credential_passkey_id_idx")
      .on(table.external_id)
      .where(sql`${table.kind} = 'passkey'`),
    shapeCheck: check(
      "user_credential_shape_check",
      sql`
      (${table.kind} = 'oauth' AND ${table.public_id} IS NULL AND ${table.encrypted_value} IS NULL AND ${table.token_hash} IS NULL AND ${table.public_key} IS NULL AND ${table.counter} IS NULL AND ${table.device_type} IS NULL AND ${table.backed_up} IS NULL AND ${table.transports} IS NULL)
      OR (${table.kind} = 'api_key' AND ${table.public_id} IS NOT NULL AND ${table.encrypted_value} IS NOT NULL AND ${table.token_hash} IS NOT NULL AND ${table.provider} IS NULL AND ${table.external_id} IS NULL AND ${table.public_key} IS NULL AND ${table.counter} IS NULL AND ${table.device_type} IS NULL AND ${table.backed_up} IS NULL AND ${table.transports} IS NULL)
      OR (${table.kind} = 'passkey' AND ${table.external_id} IS NOT NULL AND ${table.public_key} IS NOT NULL AND ${table.counter} IS NOT NULL AND ${table.device_type} IS NOT NULL AND ${table.backed_up} IS NOT NULL AND ${table.public_id} IS NULL AND ${table.provider} IS NULL AND ${table.encrypted_value} IS NULL AND ${table.token_hash} IS NULL)
    `,
    ),
  }),
);

export type UserCredential = typeof userCredential.$inferSelect;

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

export const sourceKnowledgeSync = sqliteTable(
  "source_knowledge_sync",
  {
    id: text().primaryKey(),
    user_id: integer()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    project_id: text()
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    connection_id: text()
      .notNull()
      .references(() => providerConnection.id, { onDelete: "cascade" }),
    recipe_id: text().notNull(),
    integration_id: text().notNull(),
    title: text().notNull(),
    resources: text().notNull(),
    status: text({ enum: ["active", "paused"] })
      .notNull()
      .default("active"),
    interval_minutes: integer().notNull().default(60),
    cursor: integer().notNull().default(0),
    generation: integer().notNull().default(1),
    next_sync_at: text()
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    last_successful_at: text(),
    last_error: text(),
    lease_token: text(),
    lease_expires_at: text(),
  },
  (table) => ({
    dueIdx: index("source_knowledge_sync_due_idx").on(table.status, table.next_sync_at),
    projectIdx: index("source_knowledge_sync_project_idx").on(table.project_id),
  }),
);

export const resourceCollection = sqliteTable(
  "resource_collection",
  {
    id: text().primaryKey(),
    collection_type: text({ enum: ["source", "conversation"] })
      .default("source")
      .notNull(),
    created_by_user_id: integer()
      .notNull()
      .references(() => user.id),
    owner_user_id: integer().references(() => user.id, { onDelete: "cascade" }),
    project_id: text().references(() => project.id, { onDelete: "cascade" }),
    title: text().notNull(),
    normalised_name: text(),
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
    creatorIdx: index("resource_collection_creator_idx").on(
      table.collection_type,
      table.created_by_user_id,
    ),
    projectIdx: index("resource_collection_project_idx").on(
      table.collection_type,
      table.project_id,
    ),
    personalNameIdx: uniqueIndex("resource_collection_personal_group_name_idx")
      .on(table.owner_user_id, table.normalised_name)
      .where(sql`${table.collection_type} = 'conversation' AND ${table.owner_user_id} IS NOT NULL`),
    projectNameIdx: uniqueIndex("resource_collection_project_group_name_idx")
      .on(table.project_id, table.normalised_name)
      .where(sql`${table.collection_type} = 'conversation' AND ${table.project_id} IS NOT NULL`),
    scopeCheck: check(
      "resource_collection_scope_check",
      sql`(${table.collection_type} = 'source' AND ${table.owner_user_id} IS NULL) OR (${table.collection_type} = 'conversation' AND ${table.normalised_name} IS NOT NULL AND ((${table.owner_user_id} IS NULL) <> (${table.project_id} IS NULL)))`,
    ),
  }),
);

export const resourceGrant = sqliteTable(
  "resource_grant",
  {
    kind: text({
      enum: ["conversation", "output", "connection", "membership", "invitation"],
    }).notNull(),
    id: text()
      .notNull()
      .default(sql`(lower(hex(randomblob(16))))`),
    workspace_id: text().references(() => workspace.id, { onDelete: "cascade" }),
    user_id: integer().references(() => user.id, { onDelete: "cascade" }),
    role: text({ enum: ["owner", "admin", "member"] }),
    email: text(),
    status: text({ enum: ["pending", "accepted", "revoked"] }),
    accepted_by: integer().references(() => user.id),
    accepted_at: text(),
    conversation_id: text().references(() => conversation.id, { onDelete: "cascade" }),
    delegation_id: text().references(() => delegation.id, { onDelete: "cascade" }),
    granted_by: text({ enum: ["spawn", "user"] }),
    output_id: text().references(() => resource.output_id, { onDelete: "cascade" }),
    token_hash: text(),
    permission: text({ enum: ["view"] }).default("view"),
    created_by_user_id: integer().references(() => user.id),
    context_id: text().references(() => teammateContext.id, { onDelete: "cascade" }),
    connection_id: text().references(() => providerConnection.id, { onDelete: "cascade" }),
    allowed_operations: text({ mode: "json" }).$type<string[]>(),
    revision: integer().notNull().default(1),
    expires_at: text(),
    revoked_at: text(),
    created_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
    updated_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.kind, table.id] }),
    delegationIdx: uniqueIndex("resource_grant_delegation_idx")
      .on(table.delegation_id)
      .where(sql`${table.delegation_id} IS NOT NULL`),
    conversationIdx: index("resource_grant_conversation_idx")
      .on(table.conversation_id)
      .where(sql`${table.conversation_id} IS NOT NULL`),
    tokenIdx: uniqueIndex("resource_grant_token_idx")
      .on(table.kind, table.token_hash)
      .where(sql`${table.token_hash} IS NOT NULL`),
    outputIdx: index("resource_grant_output_idx")
      .on(table.output_id)
      .where(sql`${table.output_id} IS NOT NULL`),
    contextConnectionIdx: uniqueIndex("resource_grant_context_connection_idx")
      .on(table.context_id, table.connection_id)
      .where(sql`${table.context_id} IS NOT NULL`),
    connectionIdx: index("resource_grant_connection_idx")
      .on(table.connection_id)
      .where(sql`${table.connection_id} IS NOT NULL`),
    membershipIdx: uniqueIndex("resource_grant_membership_idx")
      .on(table.workspace_id, table.user_id)
      .where(sql`${table.kind} = 'membership'`),
    memberUserIdx: index("resource_grant_member_user_idx")
      .on(table.user_id, table.workspace_id)
      .where(sql`${table.kind} = 'membership'`),
    invitationEmailIdx: uniqueIndex("resource_grant_invitation_email_idx")
      .on(table.workspace_id, table.email)
      .where(sql`${table.kind} = 'invitation'`),
    invitationStatusIdx: index("resource_grant_invitation_status_idx")
      .on(table.workspace_id, table.status)
      .where(sql`${table.kind} = 'invitation'`),
    workspaceIdx: index("resource_grant_workspace_idx").on(table.workspace_id),
    acceptedByIdx: index("resource_grant_accepted_by_idx").on(table.accepted_by),
    organisationShape: check(
      "resource_grant_organisation_shape",
      sql`
      (${table.kind} NOT IN ('membership', 'invitation') AND ${table.workspace_id} IS NULL AND ${table.user_id} IS NULL AND ${table.role} IS NULL AND ${table.email} IS NULL AND ${table.status} IS NULL AND ${table.accepted_by} IS NULL AND ${table.accepted_at} IS NULL)
      OR (${table.kind} = 'membership' AND ${table.workspace_id} IS NOT NULL AND ${table.user_id} IS NOT NULL AND ${table.role} IS NOT NULL AND ${table.email} IS NULL AND ${table.status} IS NULL AND ${table.accepted_by} IS NULL AND ${table.accepted_at} IS NULL AND ${table.created_by_user_id} IS NULL AND ${table.token_hash} IS NULL AND ${table.expires_at} IS NULL AND ${table.revoked_at} IS NULL)
      OR (${table.kind} = 'invitation' AND ${table.workspace_id} IS NOT NULL AND ${table.user_id} IS NULL AND ${table.role} IS NOT NULL AND ${table.email} IS NOT NULL AND ${table.status} IS NOT NULL AND ${table.created_by_user_id} IS NOT NULL AND ${table.token_hash} IS NOT NULL AND ${table.expires_at} IS NOT NULL)
    `,
    ),
    shapeCheck: check(
      "resource_grant_shape_check",
      sql`
      (${table.kind} = 'conversation' AND ${table.conversation_id} IS NOT NULL AND ${table.delegation_id} IS NOT NULL AND ${table.granted_by} IS NOT NULL AND ${table.granted_by} IN ('spawn', 'user') AND ${table.output_id} IS NULL AND ${table.context_id} IS NULL AND ${table.connection_id} IS NULL AND ${table.token_hash} IS NULL AND ${table.created_by_user_id} IS NULL AND ${table.allowed_operations} IS NULL)
      OR (${table.kind} = 'output' AND ${table.output_id} IS NOT NULL AND ${table.token_hash} IS NOT NULL AND ${table.permission} IS NOT NULL AND ${table.created_by_user_id} IS NOT NULL AND ${table.conversation_id} IS NULL AND ${table.delegation_id} IS NULL AND ${table.context_id} IS NULL AND ${table.connection_id} IS NULL AND ${table.granted_by} IS NULL AND ${table.allowed_operations} IS NULL)
      OR (${table.kind} = 'connection' AND ${table.context_id} IS NOT NULL AND ${table.connection_id} IS NOT NULL AND ${table.allowed_operations} IS NOT NULL AND ${table.conversation_id} IS NULL AND ${table.delegation_id} IS NULL AND ${table.output_id} IS NULL AND ${table.token_hash} IS NULL AND ${table.created_by_user_id} IS NULL AND ${table.granted_by} IS NULL AND ${table.expires_at} IS NULL AND ${table.revoked_at} IS NULL)
      OR (${table.kind} IN ('membership', 'invitation') AND ${table.conversation_id} IS NULL AND ${table.delegation_id} IS NULL AND ${table.granted_by} IS NULL AND ${table.output_id} IS NULL AND ${table.context_id} IS NULL AND ${table.connection_id} IS NULL AND ${table.allowed_operations} IS NULL)
    `,
    ),
  }),
);

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
    project_id: text().references(() => project.id),
    kind: text({ enum: ["project", "recipe", "capability", "teammate_publication"] }).notNull(),
    capability_id: text(),
    publication_id: text(),
    source_teammate_id: text().references(() => teammates.id),
    avatar_url: text(),
    category: text(),
    tags: text({ mode: "json" }),
    is_featured: integer({ mode: "boolean" }).default(false),
    is_public: integer({ mode: "boolean" }).default(true),
    usage_count: integer().default(0),
    rating_count: integer().default(0),
    rating_average: text().default("0"),
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
    publicationIdIdx: uniqueIndex("template_publication_id_idx").on(table.publication_id),
    publicationSourceIdx: index("template_publication_source_idx").on(table.source_teammate_id),
    publicationCategoryIdx: index("template_publication_category_idx").on(
      table.kind,
      table.is_public,
      table.category,
    ),
    publicationFeaturedIdx: index("template_publication_featured_idx").on(
      table.kind,
      table.is_public,
      table.is_featured,
      table.usage_count,
    ),
    publicationUsageIdx: index("template_publication_usage_idx").on(
      table.kind,
      table.is_public,
      table.usage_count,
      table.created_at,
    ),
    publicationRatingIdx: index("template_publication_rating_idx").on(
      table.kind,
      table.is_public,
      sql`CAST(rating_average AS REAL)`,
      table.rating_count,
      table.created_at,
    ),
    publicationRecentIdx: index("template_publication_recent_idx").on(
      table.kind,
      table.is_public,
      table.created_at,
    ),
    creatorIdx: index("template_created_by_user_id_idx").on(table.created_by_user_id),
    workspaceIdx: index("template_workspace_id_idx").on(table.workspace_id),
    projectIdx: index("template_project_id_idx").on(table.project_id),
    capabilityIdx: index("template_capability_id_idx").on(table.capability_id),
  }),
);

export type Template = typeof template.$inferSelect;

export const eventSubscription = sqliteTable(
  "event_subscription",
  {
    id: text().primaryKey(),
    broker: text().notNull(),
    installation_id: text()
      .notNull()
      .references(() => template.id, { onDelete: "cascade" }),
    created_by_user_id: integer()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    project_id: text().references(() => project.id, { onDelete: "cascade" }),
    provider_id: text().notNull(),
    trigger_slug: text().notNull(),
    external_trigger_id: text().notNull(),
    connected_account_id: text().notNull(),
    external_user_id: text().notNull(),
    configuration: text({ mode: "json" }).$type<Record<string, unknown>>().default({}).notNull(),
    condition: text(),
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
    externalIdentityIdx: uniqueIndex("event_subscription_external_identity_idx").on(
      table.broker,
      table.external_trigger_id,
    ),
    installationIdx: index("event_subscription_installation_idx").on(table.installation_id),
    ownerIdx: index("event_subscription_owner_idx").on(table.created_by_user_id),
    accountIdx: index("event_subscription_account_idx").on(table.connected_account_id),
  }),
);

export type RecipeComposioTrigger = Omit<typeof eventSubscription.$inferSelect, "broker">;

export interface RecipeEventReceiptRow {
  id: string;
  trigger_id: string;
  event_id: string;
  state: "evaluating" | "skipped" | "queued";
  execution_token: string | null;
  execution_lease_expires_at: string | null;
  decision_receipt: Record<string, unknown> | null;
  queued_task_id: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface ComposioConnectorSession {
  id: string;
  remote_session_id: string;
  kind: "tool" | "connection";
  user_id: number;
  provider: string;
  toolkit_slug: string;
  auth_config_id: string | null;
  connected_account_id: string | null;
  allowed_operation_ids: readonly string[];
  run_id: string;
  completion_id: string | null;
  recipe_id: string | null;
  installation_id: string | null;
  project_id: string | null;
  teammate_context_id: string | null;
  state: "active" | "claimed" | "cleanup_pending";
  created_at: string;
  expires_at: string;
  claimed_at: string | null;
  cleanup_attempts: number;
  cleanup_after: string | null;
}

export interface ConnectorOperationApproval {
  id: string;
  user_id: number;
  run_id: string;
  run_attempt: number;
  completion_id: string;
  provider: string;
  operation: string;
  connected_account_id: string;
  channel: string;
  argument_digest: string;
  arguments_json: Record<string, unknown>;
  authority_revision: number;
  recipe_id: string | null;
  installation_id: string | null;
  project_id: string | null;
  teammate_context_id: string | null;
  state: "pending" | "approved" | "rejected" | "consumed";
  created_at: string;
  expires_at: string;
  resolved_at: string | null;
  consumed_at: string | null;
  execution_state: "running" | "completed" | "indeterminate" | null;
  execution_token: string | null;
  execution_lease_expires_at: string | null;
  execution_result_json: Record<string, unknown> | null;
}

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
    operationalIdx: index("activity_record_operational_idx").on(
      table.capability_id,
      table.status,
      table.updated_at,
    ),
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

export const teammates = sqliteTable(
  "teammates",
  {
    id: text().primaryKey(),
    user_id: integer()
      .notNull()
      .references(() => user.id),
    owner_scope_type: text({ enum: ["user", "workspace", "platform"] })
      .default("user")
      .notNull(),
    owner_scope_id: text().default("").notNull(),
    derived_from_teammate_id: text(),
    kind: text({ enum: ["colleague", "bot"] })
      .default("colleague")
      .notNull(),
    workspace_default: integer({ mode: "boolean" }).default(false).notNull(),
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
    skill_ids: text({ mode: "json" }),
    mode: text({ enum: ["chat", "plan", "build", "explore"] }),
    created_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
    updated_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    userIdIdx: index("teammates_user_id_idx").on(table.user_id),
    ownerScopeIdx: index("teammates_owner_scope_idx").on(
      table.owner_scope_type,
      table.owner_scope_id,
    ),
  }),
);

export type Teammate = typeof teammates.$inferSelect;

export interface SharedTeammate {
  id: string;
  teammate_id: string;
  user_id: number;
  name: string;
  description: string;
  avatar_url: string | null;
  category: string | null;
  tags: unknown;
  is_featured: boolean | null;
  is_public: boolean | null;
  usage_count: number | null;
  rating_count: number | null;
  rating_average: string | null;
  template_data: unknown;
  created_at: string;
  updated_at: string | null;
}

export interface TeammateInstall {
  id: string;
  shared_teammate_id: string;
  user_id: number;
  teammate_id: string;
  created_at: string;
}

export interface TeammateRating {
  id: string;
  shared_teammate_id: string;
  user_id: number;
  rating: number;
  review: string | null;
  created_at: string;
  updated_at: string | null;
}

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
        "memory_reflection",
        "research_polling",
        "replicate_polling",
        "async_message_polling",
        "recording_transcription_polling",
        "training_quality_scoring",
        "recipe_execution",
        "sandbox_run_dispatch",
        "artificial_analysis_ingest",
        "artificial_analysis_scoring",
        "inbound_message",
        "project_task_run",
        "ocr_batch_polling",
        "usage_rollup",
        "realtime_reconciliation",
        "infra_reconciliation",
        "stripe_usage_sync",
        "task_notification_delivery",
        "delegation_run",
        "delegation_wake",
        "delegation_message",
        "delegation_expiry",
        "teammate_run_reconciliation",
        "teammate_context_cleanup",
        "model_registry_inspect",
        "model_registry_eval",
        "model_dataset_process",
        "model_training_sync",
        "model_deployment_sync",
        "model_upload_finalise",
        "model_platform_reconcile",
      ],
    }).notNull(),
    status: text({
      enum: ["pending", "queued", "running", "suspended", "completed", "failed", "cancelled"],
    })
      .notNull()
      .default("pending"),
    priority: integer().default(5),
    user_id: integer().references(() => user.id),
    project_id: text().references(() => project.id),
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
    execution_owner_token: text(),
    execution_lease_expires_at: text(),
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
    executionLeaseIdx: index("tasks_execution_lease_idx").on(
      table.status,
      table.execution_lease_expires_at,
    ),
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
    execution_profile: text({ enum: ["diff_review"] }),
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
    flow_snapshot: text({ mode: "json" }).$type<ProjectFlow>(),
    runner: text({ mode: "json" }).$type<ProjectTaskRunner>(),
    created_by_user_id: integer()
      .notNull()
      .references(() => user.id),
    assignee_user_id: integer().references(() => user.id),
    runner_identity_user_id: integer().references(() => user.id),
    conversation_id: text().references(() => conversation.id, {
      onDelete: "set null",
    }),
    origin_conversation_id: text().references(() => conversation.id),
    goal_id: text(),
    dispatch_task_id: text(),
    run_id: text().references(() => conversationRun.id),
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
    attention_version: integer().default(1).notNull(),
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
    runIdx: index("project_task_run_idx").on(table.run_id),
    originConversationIdx: index("project_task_origin_conversation_idx").on(
      table.origin_conversation_id,
    ),
  }),
);

export type ProjectTaskRow = typeof projectTask.$inferSelect;

export const projectTaskIntegration = sqliteTable(
  "project_task_integration",
  {
    id: text().notNull(),
    workspace_id: text()
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    project_id: text()
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    task_id: text()
      .notNull()

      .references(() => projectTask.id, { onDelete: "cascade" }),
    source_id: text()
      .notNull()
      .references(() => resource.source_id),
    owner_user_id: integer()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    provider: text(),
    account_id: text(),
    external_id: text(),
    created_at: text()
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    target: text(),
    policy_id: text(),
    policy_revision: text(),
    publication_status: text({
      enum: ["unpublished", "publishing", "published", "unknown"],
    }).default("unpublished"),
    publication_body: text(),
    published_url: text(),
    kind: text({ enum: ["import", "review"] }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.kind, table.id] }),
    taskIdx: uniqueIndex("project_task_integration_task_idx").on(table.task_id, table.kind),
    sourceIdx: index("project_task_integration_source_idx").on(table.source_id),
    externalIdentityIdx: uniqueIndex("project_task_integration_external_identity_idx")
      .on(
        table.workspace_id,
        table.project_id,
        table.owner_user_id,
        table.provider,
        table.account_id,
        table.external_id,
      )
      .where(sql`kind = 'import'`),
    projectCreatedIdx: index("project_task_integration_project_created_idx").on(
      table.project_id,
      table.kind,
      table.created_at,
    ),
    requiredFields: check(
      "project_task_integration_required_fields",
      sql`(kind = 'import' AND id IS NOT NULL AND workspace_id IS NOT NULL AND project_id IS NOT NULL AND task_id IS NOT NULL AND source_id IS NOT NULL AND owner_user_id IS NOT NULL AND provider IS NOT NULL AND account_id IS NOT NULL AND external_id IS NOT NULL AND created_at IS NOT NULL) OR (kind = 'review' AND id IS NOT NULL AND workspace_id IS NOT NULL AND project_id IS NOT NULL AND task_id IS NOT NULL AND source_id IS NOT NULL AND owner_user_id IS NOT NULL AND target IS NOT NULL AND publication_status IS NOT NULL AND created_at IS NOT NULL)`,
    ),
    check0: check(
      "project_task_integration_shape_0",
      sql`(kind = 'import' AND provider IS NOT NULL AND account_id IS NOT NULL AND external_id IS NOT NULL AND target IS NULL) OR (kind = 'review' AND target IS NOT NULL AND provider IS NULL AND publication_status IN ('unpublished','publishing','published','unknown'))`,
    ),
  }),
);

export type TaskNotificationRegistrationRow = typeof notificationEndpoint.$inferSelect;

export type TaskInboxReceiptRow = typeof userResourceState.$inferSelect;

export type TaskNotificationDeliveryRow = {
  id: string;
  dedupe_key: string;
  registration_id: string;
  user_id: number;
  task_id: string;
  task_version: number;
  category: "decisions" | "failures" | "completions" | "assignments";
  status: "pending" | "delivered" | "failed" | "obsolete";
  attempts: number;
  provider_message_id: string | null;
  failure_code: string | null;
  next_attempt_at: string | null;
  created_at: string;
  updated_at: string | null;
};

export const usageEvent = sqliteTable(
  "usage_event",
  {
    id: text().primaryKey(),
    idempotency_key: text().notNull().unique(),
    user_id: integer()
      .notNull()
      .references(() => user.id),
    workspace_id: text().references(() => workspace.id),
    project_id: text().references(() => project.id),
    conversation_id: text().references(() => conversation.id, {
      onDelete: "set null",
    }),
    message_id: text(),
    activity_id: text(),
    completion_id: text(),
    run_id: text(),
    run_attempt: integer(),
    occurred_at: text().notNull(),
    period: text().notNull(),
    source: text({
      enum: ["model", "hosted_tool", "capability", "infrastructure"],
    }).notNull(),
    vendor: text().notNull(),
    resource: text().notNull(),
    unit: text().notNull(),
    quantity: real().notNull(),
    rate_version: text(),
    unit_cost_micros: real(),
    cost_micros: integer().notNull().default(0),
    credit_micros: integer().notNull().default(0),
    billable: integer({ mode: "boolean" }).notNull().default(true),
    byok: integer({ mode: "boolean" }).notNull().default(false),
    estimated: integer({ mode: "boolean" }).notNull().default(false),
    vendor_units: real(),
    reason: text({ enum: ["ran_off_platform"] }),
    site: text({ enum: ["hosted", "browser", "device", "machine"] }),
    raw: text({ mode: "json" }),
    created_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
  },
  (table) => ({
    userPeriodIdx: index("usage_event_user_period_idx").on(table.user_id, table.period),
    periodSourceIdx: index("usage_event_period_source_idx").on(table.period, table.source),
    conversationIdx: index("usage_event_conversation_idx").on(table.conversation_id),
    runIdx: index("usage_event_run_idx").on(table.run_id, table.run_attempt),
    workspacePeriodIdx: index("usage_event_workspace_period_idx").on(
      table.workspace_id,
      table.period,
    ),
  }),
);

export type UsageEventRow = typeof usageEvent.$inferSelect;

export const usageBalance = sqliteTable(
  "usage_balance",
  {
    id: text().primaryKey(),
    user_id: integer()
      .notNull()
      .references(() => user.id),
    period: text().notNull(),
    plan_id: text(),
    included_credit_micros: integer().notNull().default(0),
    grace_credit_micros: integer().notNull().default(0),
    spent_credit_micros: integer().notNull().default(0),
    reserved_credit_micros: integer().notNull().default(0),
    overrun_credit_micros: integer().notNull().default(0),
    overage_credit_micros: integer().notNull().default(0),
    stripe_synced_overage_credit_micros: integer().notNull().default(0),
    overage_enabled: integer({ mode: "boolean" }).notNull().default(false),
    last_event_at: text(),
    created_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
    updated_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    userPeriodIdx: uniqueIndex("usage_balance_user_period_idx").on(table.user_id, table.period),
  }),
);

export type UsageBalanceRow = typeof usageBalance.$inferSelect;

export const usageReservation = sqliteTable(
  "usage_reservation",
  {
    id: text().primaryKey(),
    user_id: integer()
      .notNull()
      .references(() => user.id),
    period: text().notNull(),
    kind: text({ enum: ["realtime", "sandbox", "chat_run"] }).notNull(),
    ref_id: text().notNull(),
    credit_micros: integer().notNull(),
    status: text({
      enum: ["held", "releasing", "settled", "released"],
    }).notNull(),
    expires_at: text(),
    created_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
    updated_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    kindRefIdx: uniqueIndex("usage_reservation_kind_ref_idx").on(table.kind, table.ref_id),
    userPeriodIdx: index("usage_reservation_user_period_idx").on(table.user_id, table.period),
  }),
);

export type UsageReservationRow = typeof usageReservation.$inferSelect;

export const infraCostDaily = sqliteTable(
  "infra_cost_daily",
  {
    id: text().primaryKey(),
    day: text().notNull(),
    resource: text().notNull(),
    unit: text().notNull(),
    quantity: real().notNull().default(0),
    cost_micros: integer().notNull().default(0),
    attributed_cost_micros: integer().notNull().default(0),
    source: text().notNull().default("graphql"),
    created_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
    updated_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    dayIdx: index("infra_cost_daily_day_idx").on(table.day),
  }),
);

export type InfraCostDailyRow = typeof infraCostDaily.$inferSelect;

const createdAtColumn = () =>
  text()
    .default(sql`(CURRENT_TIMESTAMP)`)
    .notNull();

export const modelConfiguration = sqliteTable(
  "model_configuration",
  {
    id: text().notNull(),
    kind: text().notNull(),
    workspace_id: text()
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    project_id: text().references(() => project.id, { onDelete: "cascade" }),
    scope_key: text().notNull(),
    name: text(),
    revision: integer().default(1).notNull(),
    encrypted_secret: text(),
    asset_type: text({ enum: MODEL_ASSET_KINDS }),
    source: text({ enum: MODEL_ASSET_SOURCES }),
    source_ref: text(),
    version_id: text().references((): AnySQLiteColumn => modelAssetVersion.id, {
      onDelete: "cascade",
    }),
    provider: text(),
    provider_model_id: text(),
    status: text(),
    route_id: text(),
    route_kind: text(),
    canary_route_id: text(),
    canary_route_kind: text(),
    data: text({ mode: "json" }).$type<Record<string, unknown>>().notNull(),
    created_by: integer().references(() => user.id, { onDelete: "set null" }),
    updated_by: integer().references(() => user.id, { onDelete: "set null" }),
    created_at: createdAtColumn(),
    updated_at: createdAtColumn(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.kind, table.id] }),
    scopeIdx: uniqueIndex("model_configuration_scope_idx")
      .on(table.workspace_id, table.kind, table.scope_key)
      .where(sql`${table.kind} IN ('policy', 'budget', 'connection')`),
    routeFk: foreignKey({
      columns: [table.route_kind, table.route_id],
      foreignColumns: [table.kind, table.id],
    }).onDelete("set null"),
    canaryRouteFk: foreignKey({
      columns: [table.canary_route_kind, table.canary_route_id],
      foreignColumns: [table.kind, table.id],
    }).onDelete("set null"),
    aliasRouteCheck: check(
      "model_configuration_alias_route_check",
      sql`(${table.route_id} IS NULL OR ${table.route_kind} = 'route') AND (${table.canary_route_id} IS NULL OR ${table.canary_route_kind} = 'route')`,
    ),
    assetSourceIdx: uniqueIndex("model_configuration_asset_source_idx")
      .on(table.workspace_id, table.asset_type, table.source, table.source_ref)
      .where(sql`${table.kind} = 'asset'`),
    routeTargetIdx: uniqueIndex("model_configuration_route_target_idx")
      .on(table.workspace_id, table.version_id, table.provider, table.provider_model_id)
      .where(sql`${table.kind} = 'route'`),
    routeProviderIdx: index("model_configuration_route_provider_idx").on(
      table.kind,
      table.provider,
      table.provider_model_id,
      table.status,
    ),
    routeVersionIdx: index("model_configuration_route_version_idx").on(
      table.kind,
      table.workspace_id,
      table.version_id,
      table.status,
    ),
    aliasNameIdx: uniqueIndex("model_configuration_alias_name_idx")
      .on(table.workspace_id, table.scope_key, table.name)
      .where(sql`${table.kind} = 'alias'`),
    aliasRouteIdx: index("model_configuration_alias_route_idx").on(table.kind, table.route_id),
    aliasCanaryIdx: index("model_configuration_alias_canary_idx").on(
      table.kind,
      table.canary_route_id,
    ),
    workspaceIdx: index("model_configuration_workspace_idx").on(
      table.workspace_id,
      table.kind,
      table.project_id,
    ),
    shapeCheck: check(
      "model_configuration_shape_check",
      sql`(${table.kind} IN ('policy', 'budget')) OR (${table.kind} IN ('suite', 'grader') AND ${table.name} IS NOT NULL) OR (${table.kind} = 'connection' AND ${table.project_id} IS NULL AND ${table.encrypted_secret} IS NOT NULL) OR (${table.kind} = 'asset' AND ${table.asset_type} IS NOT NULL AND ${table.source} IS NOT NULL AND ${table.source_ref} IS NOT NULL AND ${table.name} IS NOT NULL AND ${table.version_id} IS NULL) OR (${table.kind} = 'route' AND ${table.version_id} IS NOT NULL AND ${table.provider} IS NOT NULL AND ${table.provider_model_id} IS NOT NULL AND ${table.status} IS NOT NULL) OR (${table.kind} = 'alias' AND ${table.name} IS NOT NULL AND ${table.version_id} IS NULL)`,
    ),
  }),
);

export const modelOperation = sqliteTable(
  "model_operation",
  {
    id: text().notNull(),
    kind: text().notNull(),
    workspace_id: text()
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    project_id: text().references(() => project.id, { onDelete: "cascade" }),
    status: text().notNull(),
    name: text(),
    provider: text(),
    provider_ref: text(),
    claim_started_at: text(),
    desired_state: text(),
    version_id: text().references(() => modelAssetVersion.id, { onDelete: "cascade" }),
    output_version_id: text().references(() => modelAssetVersion.id, { onDelete: "set null" }),
    subject_version_id: text(),
    suite_id: text(),
    suite_kind: text().default("suite").notNull(),
    route_id: text(),
    evaluation_route_id: text(),
    evaluation_route_kind: text().default("route").notNull(),
    trigger: text(),
    billed_until: text(),
    data: text({ mode: "json" }).$type<Record<string, unknown>>().notNull(),
    failure_reason: text(),
    created_by: integer().references(() => user.id, { onDelete: "set null" }),
    created_at: createdAtColumn(),
    updated_at: createdAtColumn(),
    started_at: text(),
    completed_at: text(),
    last_checked_at: text(),
  },
  (table) => ({
    evaluationRouteFk: foreignKey({
      columns: [table.evaluation_route_kind, table.evaluation_route_id],
      foreignColumns: [modelConfiguration.kind, modelConfiguration.id],
    }).onDelete("cascade"),
    evaluationRouteKindCheck: check(
      "model_operation_evaluation_route_kind_check",
      sql`${table.evaluation_route_kind} = 'route'`,
    ),
    pk: primaryKey({ columns: [table.kind, table.id] }),
    workspaceIdx: index("model_operation_workspace_idx").on(
      table.kind,
      table.workspace_id,
      table.status,
      table.created_at,
    ),
    suiteFk: foreignKey({
      columns: [table.suite_kind, table.suite_id],
      foreignColumns: [modelConfiguration.kind, modelConfiguration.id],
    }).onDelete("cascade"),
    suiteKindCheck: check("model_operation_suite_kind_check", sql`${table.suite_kind} = 'suite'`),
    activeIdx: index("model_operation_active_idx").on(
      table.kind,
      table.status,
      table.last_checked_at,
    ),
    suiteIdx: index("model_operation_suite_idx").on(
      table.kind,
      table.suite_id,
      table.evaluation_route_id,
      table.created_at,
    ),
    routeIdx: index("model_operation_route_idx").on(
      table.kind,
      table.evaluation_route_id,
      table.created_at,
    ),
    completedIdx: index("model_operation_completed_idx").on(
      table.kind,
      table.suite_id,
      table.evaluation_route_id,
      table.status,
      table.completed_at,
    ),
    nameIdx: uniqueIndex("model_operation_deployment_name_idx")
      .on(table.workspace_id, table.name)
      .where(sql`${table.kind} = 'deployment'`),
    shapeCheck: check(
      "model_operation_shape_check",
      sql`(${table.kind} = 'training' AND ${table.provider} IS NOT NULL) OR (${table.kind} = 'evaluation' AND ${table.suite_id} IS NOT NULL AND ${table.evaluation_route_id} IS NOT NULL AND ${table.subject_version_id} IS NOT NULL AND ${table.trigger} IS NOT NULL) OR (${table.kind} = 'deployment' AND ${table.name} IS NOT NULL AND ${table.version_id} IS NOT NULL AND ${table.provider} IS NOT NULL AND ${table.desired_state} IS NOT NULL) OR (${table.kind} = 'upload' AND ${table.name} IS NOT NULL)`,
    ),
  }),
);

export const modelRecord = sqliteTable(
  "model_record",
  {
    id: text().notNull(),
    kind: text().notNull(),
    version_id: text().references(() => modelAssetVersion.id, { onDelete: "cascade" }),
    route_id: text(),
    configuration_id: text(),
    configuration_kind: text().default("policy").notNull(),
    alias_id: text(),
    alias_kind: text().default("alias").notNull(),
    operation_id: text(),
    operation_kind: text().default("training").notNull(),
    output_version_id: text().references(() => modelAssetVersion.id, { onDelete: "set null" }),
    event_kind: text(),
    ordinal: integer(),
    status: text(),
    source: text(),
    path: text(),
    workspace_id: text().references(() => workspace.id, { onDelete: "cascade" }),
    project_id: text().references(() => project.id, { onDelete: "set null" }),
    subject_type: text({ enum: COST_SUBJECTS }),
    subject_id: text(),
    provider: text({ enum: MODEL_PROVIDER_IDS }),
    usd: real(),
    period_start: text(),
    period_end: text(),
    data: text({ mode: "json" }).$type<Record<string, unknown>>().notNull(),
    actor_user_id: integer().references(() => user.id, { onDelete: "set null" }),
    created_by: integer(),
    created_at: createdAtColumn(),
  },
  (table) => ({
    aliasFk: foreignKey({
      columns: [table.alias_kind, table.alias_id],
      foreignColumns: [modelConfiguration.kind, modelConfiguration.id],
    }).onDelete("cascade"),
    aliasKindCheck: check("model_record_alias_kind_check", sql`${table.alias_kind} = 'alias'`),
    filePathIdx: uniqueIndex("model_record_file_path_idx")
      .on(table.version_id, table.path)
      .where(sql`${table.kind} = 'file'`),
    costPeriodIdx: index("model_record_cost_period_idx").on(
      table.kind,
      table.workspace_id,
      table.period_start,
    ),
    costSubjectIdx: index("model_record_cost_subject_idx").on(
      table.kind,
      table.subject_type,
      table.subject_id,
    ),
    pk: primaryKey({ columns: [table.kind, table.id] }),
    configurationFk: foreignKey({
      columns: [table.configuration_kind, table.configuration_id],
      foreignColumns: [modelConfiguration.kind, modelConfiguration.id],
    }).onDelete("cascade"),
    operationFk: foreignKey({
      columns: [table.operation_kind, table.operation_id],
      foreignColumns: [modelOperation.kind, modelOperation.id],
    }).onDelete("cascade"),
    parentKindCheck: check(
      "model_record_parent_kind_check",
      sql`${table.configuration_kind} = 'policy' AND ${table.operation_kind} = 'training'`,
    ),
    evidenceIdx: index("model_record_evidence_idx").on(
      table.kind,
      table.version_id,
      table.event_kind,
      table.created_at,
    ),
    aliasIdx: index("model_record_alias_idx").on(table.kind, table.alias_id, table.created_at),
    revisionIdx: uniqueIndex("model_record_revision_idx").on(table.configuration_id, table.ordinal),
    checkpointIdx: uniqueIndex("model_record_checkpoint_idx").on(table.operation_id, table.ordinal),
    shapeCheck: check(
      "model_record_shape_check",
      sql`(${table.kind} = 'evidence' AND ${table.version_id} IS NOT NULL AND ${table.event_kind} IS NOT NULL AND ${table.status} IS NOT NULL AND ${table.source} IS NOT NULL AND ${table.configuration_id} IS NULL AND ${table.alias_id} IS NULL AND ${table.operation_id} IS NULL) OR (${table.kind} = 'policy_revision' AND ${table.configuration_id} IS NOT NULL AND ${table.ordinal} IS NOT NULL AND ${table.version_id} IS NULL AND ${table.alias_id} IS NULL AND ${table.operation_id} IS NULL) OR (${table.kind} = 'alias_event' AND ${table.alias_id} IS NOT NULL AND ${table.event_kind} IS NOT NULL AND ${table.version_id} IS NULL AND ${table.configuration_id} IS NULL AND ${table.operation_id} IS NULL) OR (${table.kind} = 'checkpoint' AND ${table.operation_id} IS NOT NULL AND ${table.ordinal} IS NOT NULL AND ${table.version_id} IS NULL AND ${table.configuration_id} IS NULL AND ${table.alias_id} IS NULL) OR (${table.kind} = 'file' AND ${table.version_id} IS NOT NULL AND ${table.path} IS NOT NULL AND ${table.configuration_id} IS NULL AND ${table.alias_id} IS NULL AND ${table.operation_id} IS NULL) OR (${table.kind} = 'cost' AND ${table.workspace_id} IS NOT NULL AND ${table.subject_type} IS NOT NULL AND ${table.subject_id} IS NOT NULL AND ${table.provider} IS NOT NULL AND ${table.usd} IS NOT NULL AND ${table.period_start} IS NOT NULL AND ${table.period_end} IS NOT NULL AND ${table.version_id} IS NULL AND ${table.configuration_id} IS NULL AND ${table.alias_id} IS NULL AND ${table.operation_id} IS NULL)`,
    ),
  }),
);

export const approval = sqliteTable(
  "approval",
  {
    id: text().notNull(),
    kind: text().notNull(),
    workspace_id: text().references(() => workspace.id, { onDelete: "cascade" }),
    project_id: text(),
    version_id: text().references(() => modelAssetVersion.id, { onDelete: "cascade" }),
    route_id: text(),
    route_kind: text().default("route").notNull(),
    state: text().notNull(),
    subject_type: text(),
    subject_id: text(),
    data: text({ mode: "json" }).$type<Record<string, unknown>>(),
    requested_by: integer().references(() => user.id, { onDelete: "set null" }),
    decided_by: integer().references(() => user.id, { onDelete: "set null" }),
    decided_at: text(),
    expires_at: text(),
    created_at: createdAtColumn(),
    user_id: integer().references(() => user.id, { onDelete: "cascade" }),
    run_id: text(),
    run_attempt: integer().default(1),
    completion_id: text(),
    provider: text(),
    operation: text(),
    connected_account_id: text(),
    channel: text(),
    argument_digest: text(),
    arguments_json: text({ mode: "json" }).$type<Record<string, unknown>>(),
    authority_revision: integer().default(0),
    recipe_id: text(),
    installation_id: text(),
    teammate_context_id: text(),
    resolved_at: text(),
    consumed_at: text(),
    execution_state: text({
      enum: ["running", "completed", "indeterminate"],
    }),
    execution_token: text(),
    execution_lease_expires_at: text(),
    execution_result_json: text({ mode: "json" }).$type<Record<string, unknown>>(),
    model_project_id: text()
      .generatedAlwaysAs(sql`CASE WHEN kind IN ('decision','spend') THEN project_id END`)
      .references(() => project.id, { onDelete: "cascade" }),
  },
  (table) => ({
    ownerStateIdx: index("approval_owner_state_idx").on(table.kind, table.user_id, table.state),
    runIdx: index("approval_run_idx").on(table.kind, table.run_id),
    routeFk: foreignKey({
      columns: [table.route_kind, table.route_id],
      foreignColumns: [modelConfiguration.kind, modelConfiguration.id],
    }).onDelete("cascade"),
    routeKindCheck: check("approval_route_kind_check", sql`${table.route_kind} = 'route'`),
    pk: primaryKey({ columns: [table.kind, table.id] }),
    workspaceIdx: index("approval_workspace_idx").on(
      table.kind,
      table.workspace_id,
      table.state,
      table.created_at,
    ),
    versionIdx: index("approval_version_idx").on(table.kind, table.version_id, table.route_id),
    expirationIdx: index("approval_expiration_idx").on(table.kind, table.state, table.expires_at),
    shapeCheck: check(
      "approval_shape_check",
      sql`(${table.kind} = 'decision' AND ${table.workspace_id} IS NOT NULL AND ${table.data} IS NOT NULL AND ${table.version_id} IS NOT NULL) OR (${table.kind} = 'spend' AND ${table.workspace_id} IS NOT NULL AND ${table.data} IS NOT NULL AND ${table.subject_type} IS NOT NULL AND ${table.subject_type} IN ('training_run', 'deployment')) OR (${table.kind} = 'connector' AND ${table.user_id} IS NOT NULL AND ${table.run_id} IS NOT NULL AND ${table.run_attempt} IS NOT NULL AND ${table.completion_id} IS NOT NULL AND ${table.provider} IS NOT NULL AND ${table.operation} IS NOT NULL AND ${table.connected_account_id} IS NOT NULL AND ${table.channel} IS NOT NULL AND ${table.argument_digest} IS NOT NULL AND ${table.arguments_json} IS NOT NULL AND ${table.authority_revision} IS NOT NULL AND ${table.expires_at} IS NOT NULL AND ${table.state} IN ('pending','approved','rejected','consumed') AND ${table.workspace_id} IS NULL AND ${table.version_id} IS NULL AND ${table.route_id} IS NULL)`,
    ),
  }),
);

export const modelAssetVersion = sqliteTable(
  "model_asset_version",
  {
    id: text().primaryKey(),
    asset_id: text().notNull(),
    asset_kind: text().default("asset").notNull(),
    workspace_id: text().notNull(),
    revision: text().notNull(),
    status: text({ enum: ["importing", "inspecting", "ready", "failed"] })
      .default("importing")
      .notNull(),
    dataset_profile: text({ mode: "json" }).$type<ModelDatasetProfileData>(),
    attributes: text({ mode: "json" }).$type<ModelVersionAttributes>().notNull(),
    failure_reason: text(),
    created_by: integer().references(() => user.id, { onDelete: "set null" }),
    created_at: createdAtColumn(),
    updated_at: createdAtColumn(),
  },
  (table) => ({
    assetFk: foreignKey({
      columns: [table.asset_kind, table.asset_id],
      foreignColumns: [modelConfiguration.kind, modelConfiguration.id],
    }).onDelete("cascade"),
    assetKindCheck: check(
      "model_asset_version_asset_kind_check",
      sql`${table.asset_kind} = 'asset'`,
    ),
    revisionIdx: uniqueIndex("model_asset_version_revision_idx").on(table.asset_id, table.revision),
    workspaceIdx: index("model_asset_version_workspace_idx").on(
      table.workspace_id,
      table.created_at,
    ),
  }),
);

export interface ModelDatasetProfileData {
  status: "processing" | "ready" | "failed";
  shape: (typeof DATASET_SHAPES)[number];
  mapping: DatasetMapping;
  governance: DatasetGovernance;
  collection_method: (typeof DATASET_COLLECTION_METHODS)[number];
  source_ref: string;
  request: Record<string, unknown>;
  stats: DatasetStats;
  failure_reason: string | null;
  processed_at: string | null;
  created_at: string;
}

export const resourceLink = sqliteTable(
  "resource_link",
  {
    kind: text({ enum: ["output_source", "source_collection", "model_lineage"] }).notNull(),
    output_id: text().references(() => resource.output_id, { onDelete: "cascade" }),
    collection_id: text().references(() => resourceCollection.id, { onDelete: "cascade" }),
    source_id: text().references(() => resource.source_id, { onDelete: "cascade" }),
    from_version_id: text().references(() => modelAssetVersion.id, { onDelete: "cascade" }),
    to_version_id: text().references(() => modelAssetVersion.id, { onDelete: "cascade" }),
    relation: text({ enum: LINEAGE_RELATIONS }),
    created_at: text()
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
  },
  (table) => ({
    outputSourceIdx: uniqueIndex("resource_link_output_source_idx")
      .on(table.output_id, table.source_id)
      .where(sql`${table.kind} = 'output_source'`),
    collectionSourceIdx: uniqueIndex("resource_link_collection_source_idx")
      .on(table.collection_id, table.source_id)
      .where(sql`${table.kind} = 'source_collection'`),
    lineageIdx: uniqueIndex("resource_link_lineage_idx")
      .on(table.from_version_id, table.to_version_id, table.relation)
      .where(sql`${table.kind} = 'model_lineage'`),
    sourceIdx: index("resource_link_source_idx").on(table.kind, table.source_id),
    lineageTargetIdx: index("resource_link_lineage_target_idx").on(table.kind, table.to_version_id),
    shapeCheck: check(
      "resource_link_shape_check",
      sql`(${table.kind} = 'output_source' AND ${table.output_id} IS NOT NULL AND ${table.source_id} IS NOT NULL AND ${table.collection_id} IS NULL AND ${table.from_version_id} IS NULL AND ${table.to_version_id} IS NULL AND ${table.relation} IS NULL) OR (${table.kind} = 'source_collection' AND ${table.collection_id} IS NOT NULL AND ${table.source_id} IS NOT NULL AND ${table.output_id} IS NULL AND ${table.from_version_id} IS NULL AND ${table.to_version_id} IS NULL AND ${table.relation} IS NULL) OR (${table.kind} = 'model_lineage' AND ${table.from_version_id} IS NOT NULL AND ${table.to_version_id} IS NOT NULL AND ${table.relation} IS NOT NULL AND ${table.output_id} IS NULL AND ${table.collection_id} IS NULL AND ${table.source_id} IS NULL)`,
    ),
  }),
);

export const documentComment = sqliteTable(
  "document_comment",
  {
    id: text().primaryKey().notNull(),
    output_id: text()
      .notNull()
      .references(() => resource.output_id, { onDelete: "cascade" }),
    parent_id: text().references((): AnySQLiteColumn => documentComment.id, {
      onDelete: "cascade",
    }),
    anchor_json: text({ mode: "json" }).$type<DocumentAnchor>(),
    source_revision: integer().notNull(),
    body: text().notNull(),
    author_user_id: integer()
      .notNull()
      .references(() => user.id),
    resolved: integer({ mode: "boolean" }).default(false).notNull(),
    revision: integer().default(1).notNull(),
    mentioned_teammate_id: text(),
    task_id: text().references(() => projectTask.id, { onDelete: "set null" }),
    created_at: text().notNull(),
    updated_at: text(),
  },
  (table) => ({
    outputIdx: index("document_comment_output_idx").on(table.output_id, table.created_at, table.id),
    sourceRevisionCheck: check(
      "document_comment_source_revision_check",
      sql`${table.source_revision} > 0`,
    ),
    revisionCheck: check("document_comment_revision_check", sql`${table.revision} > 0`),
  }),
);

export interface MemorySynthesis {
  id: string;
  user_id: number;
  synthesis_text: string;
  synthesis_version: number | null;
  memory_ids: string | null;
  memory_count: number | null;
  tokens_used: number | null;
  namespace: string | null;
  is_active: boolean | null;
  superseded_by: string | null;
  created_at: string;
  updated_at: string | null;
}

export const providerSession = sqliteTable(
  "provider_session",
  {
    session_type: text({ enum: ["connector", "browser"] }).notNull(),
    id: text().notNull(),
    remote_session_id: text(),
    kind: text({ enum: ["tool", "connection"] }),
    user_id: integer()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    provider: text().notNull(),
    toolkit_slug: text(),
    auth_config_id: text(),
    connected_account_id: text(),
    allowed_operation_ids: text({ mode: "json" }).$type<readonly string[]>(),
    run_id: text(),
    completion_id: text(),
    recipe_id: text(),
    installation_id: text().references(() => template.id, {
      onDelete: "cascade",
    }),
    project_id: text(),
    teammate_context_id: text().references(() => teammateContext.id, {
      onDelete: "set null",
    }),
    state: text({ enum: ["active", "claimed", "cleanup_pending"] }),
    created_at: text()
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    expires_at: text(),
    claimed_at: text(),
    cleanup_attempts: integer().default(0),
    cleanup_after: text(),
    conversation_id: text().references(() => conversation.id, { onDelete: "cascade" }),
    workspace_id: text().references(() => workspace.id, { onDelete: "cascade" }),
    credential_source: text({ enum: ["user", "workspace"] }),
    provider_session_id: text(),
    tool_call_id: text(),
    input_hash: text(),
    creation_claimed: integer().default(0),
    creation_started_at: integer(),
    last_error: text(),
    model: text(),
    destroyed_at: text(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.session_type, table.id] }),
    remoteIdentityIdx: uniqueIndex("provider_session_remote_identity_idx")
      .on(table.remote_session_id)
      .where(sql`session_type = 'connector'`),
    browserIdentityIdx: uniqueIndex("provider_session_browser_identity_idx")
      .on(table.user_id, table.conversation_id, table.tool_call_id)
      .where(sql`session_type = 'browser'`),
    conversationIdx: index("provider_session_conversation_idx").on(table.conversation_id),
    expiryIdx: index("provider_session_expiry_idx").on(table.session_type, table.expires_at),
    cleanupIdx: index("provider_session_cleanup_idx").on(
      table.session_type,
      table.state,
      table.cleanup_after,
    ),
    ownerProviderIdx: index("provider_session_owner_provider_idx").on(
      table.session_type,
      table.user_id,
      table.provider,
    ),
    runIdx: index("provider_session_run_idx").on(table.session_type, table.run_id),
    contextIdx: index("provider_session_context_idx").on(table.teammate_context_id),
    shape: check(
      "provider_session_shape",
      sql`(session_type = 'connector' AND remote_session_id IS NOT NULL AND kind IS NOT NULL AND kind IN ('tool','connection') AND toolkit_slug IS NOT NULL AND allowed_operation_ids IS NOT NULL AND run_id IS NOT NULL AND state IS NOT NULL AND state IN ('active','claimed','cleanup_pending') AND expires_at IS NOT NULL AND cleanup_attempts IS NOT NULL AND conversation_id IS NULL AND credential_source IS NULL) OR (session_type = 'browser' AND conversation_id IS NOT NULL AND credential_source IS NOT NULL AND credential_source IN ('user','workspace') AND tool_call_id IS NOT NULL AND input_hash IS NOT NULL AND creation_claimed IS NOT NULL AND model IS NOT NULL AND remote_session_id IS NULL AND kind IS NULL AND state IS NULL)`,
    ),
  }),
);
