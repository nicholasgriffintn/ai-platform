import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

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
      enum: ["user", "assistant", "system", "tool"],
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
      enum: ["web", "mobile", "api"],
    }),
    mode: text({
      enum: ["chat", "tool"],
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
