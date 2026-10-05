import type { D1Database } from "@cloudflare/workers-types";

import type { ChannelBindingRow, ChannelThreadRow } from "~/infrastructure/database/schema";
import type { IUser, IEnv } from "~/types";

import { databaseTestEnvironment } from "./environment";

export const channelTestUser: IUser = {
  id: 42,
  email: "owner@example.test",
  plan_id: "pro",
  name: null,
  avatar_url: null,
  github_username: null,
  company: null,
  site: null,
  location: null,
  bio: null,
  twitter_username: null,
  created_at: "2026-10-01T00:00:00.000Z",
  updated_at: "2026-10-01T00:00:00.000Z",
  setup_at: null,
  terms_accepted_at: null,
};

export const channelTestBinding: ChannelBindingRow = {
  id: "binding-1",
  revision: 1,
  channel: "slack",
  external_id: "C123",
  workspace_id: "T123",
  allowed_sender_ids: JSON.stringify(["U9", "U42"]),
  reply_mode: "all",
  enabled: true,
  created_by: 42,
  scope_type: "personal",
  scope_id: "42",
  teammate_id: null,
  interaction_mode: "direct",
  label: "Test channel",
  created_at: "2026-10-01T00:00:00.000Z",
};

export const channelTestThread: ChannelThreadRow = {
  binding_id: "binding-1",
  thread_id: "171.1",
  revision: 1,
  muted: false,
  last_control_order: "",
  updated_at: "2026-10-01T00:00:00.000Z",
};

export function channelTestEnvironment(database: D1Database, overrides: Partial<IEnv> = {}): IEnv {
  return Object.assign(databaseTestEnvironment(database), overrides);
}
