import z from "zod/v4";

import { deviceActivitySourceSchema } from "./machines.js";

export const DEVICE_ACTIVITY_CHANGED_EVENT = "polychat://activity-changed";
export const DEVICE_ACTIVITY_PAUSE_CHOICES = ["hour", "tomorrow", "untilResumed"] as const;
export const deviceActivityPauseChoiceSchema = z.enum(DEVICE_ACTIVITY_PAUSE_CHOICES);
export type DeviceActivityPauseChoice = z.infer<typeof deviceActivityPauseChoiceSchema>;

export const deviceActivitySettingsSchema = z.object({
  enabled: z.boolean(),
  browsing: z.object({
    enabled: z.boolean(),
    browsers: z.array(z.object({ browser: z.string(), profiles: z.array(z.string()) })),
    titles: z.boolean(),
    searches: z.boolean(),
  }),
  agents: z.object({ claudeCode: z.boolean(), codex: z.boolean(), prompts: z.boolean() }),
  apps: z.object({ enabled: z.boolean(), windowTitles: z.boolean() }),
  music: z.object({ appleMusic: z.boolean(), spotify: z.boolean() }),
  neverShare: z.object({
    domains: z.array(z.string()),
    apps: z.array(z.string()),
    projects: z.array(z.string()),
  }),
});

export type DeviceActivitySettings = z.infer<typeof deviceActivitySettingsSchema>;

export const deviceActivityNeverShareKeySchema = z.object({
  kind: z.enum(["domain", "app", "project"]),
  value: z.string().min(1),
});

export type DeviceActivityNeverShareKey = z.infer<typeof deviceActivityNeverShareKeySchema>;

export const deviceActivityCollectionSchema = z.object({
  machineId: z.string().min(1),
  label: z.string().min(1),
  periodStart: z.string(),
  periodEnd: z.string(),
  sources: z.array(
    z.object({
      source: deviceActivitySourceSchema,
      items: z.array(
        z.object({ line: z.string(), neverShare: deviceActivityNeverShareKeySchema.nullable() }),
      ),
    }),
  ),
});

export type DeviceActivityCollection = z.infer<typeof deviceActivityCollectionSchema>;

export const deviceActivitySentSchema = z.object({
  sentAt: z.string(),
  collection: deviceActivityCollectionSchema,
});

export type DeviceActivitySent = z.infer<typeof deviceActivitySentSchema>;

export const deviceActivityStatusSchema = z.object({
  enabled: z.boolean(),
  sharing: z.array(deviceActivitySourceSchema),
  paused: z.boolean(),
  pausedUntil: z.string().nullable(),
  lastSentAt: z.string().nullable(),
});

export type DeviceActivityStatus = z.infer<typeof deviceActivityStatusSchema>;

export const deviceActivityBrowserSchema = z.object({
  id: z.string(),
  name: z.string(),
  profiles: z.array(z.object({ id: z.string(), name: z.string() })),
});

export type DeviceActivityBrowser = z.infer<typeof deviceActivityBrowserSchema>;

export const deviceActivityPermissionsSchema = z.object({
  accessibility: z.boolean(),
  refused: z.array(z.string()),
});

export type DeviceActivityPermissions = z.infer<typeof deviceActivityPermissionsSchema>;
