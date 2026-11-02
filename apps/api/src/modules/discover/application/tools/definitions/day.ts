import {
  readDiscoverContextInputSchema,
  updateDiscoverDayProfileSchema,
  type UpdateDiscoverDayProfile,
} from "@ngriffin_uk/polychat-schemas";

import type { FunctionToolDescriptor } from "~/types/functions";

export const read_discover_day: FunctionToolDescriptor = {
  name: "read_discover_day",
  type: "normal",
  permissions: ["read"],
  effects: { effectClass: "read" },
  description:
    "Read the person's explicit day preferences, timezone, work week, catch-up windows, followed and muted topics, weather place, saved commute, audio schedules and dated overrides. Read this before changing their day. These preferences take precedence over memory and inferred interests.",
  inputSchema: readDiscoverContextInputSchema,
};

export const update_discover_day: FunctionToolDescriptor = {
  name: "update_discover_day",
  type: "normal",
  permissions: ["write"],
  effects: { effectClass: "write" },
  description:
    "Save only the Discover preferences the person has asked to change. Read read_discover_day for expectedRevision and current enabled state first. During setup, ask one short question at a time about their usual week, interests and catch-up times. Summarise the agreed routine before saving onboarded=true. Use enabled=true when they agree to turn Discover on; enabled=false turns it off. For tomorrow or a particular day, resolve the date in their saved timezone and use override; use week only for a permanent weekly change. Use mutedTopics when they ask to stop a topic. Confirm the changed date and scope in your reply. Weather, commute, podcasts and notifications are optional. Never enable notifications without an explicit request. Editing audio schedules also enables podcasts when a slot is enabled. Explicit preferences take precedence over memory or inferred interests.",
  inputSchema: updateDiscoverDayProfileSchema,
  intentEvidence: (input: UpdateDiscoverDayProfile) => ({
    operation: "update_discover_day",
    destination: "the person's personal day preferences",
    date: input.override?.date ?? input.removeOverride,
    timezone: input.timezone,
    notifications: input.notifications?.enabled,
    enabled: input.enabled,
  }),
};
