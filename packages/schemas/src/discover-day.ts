import { isValidTimeZone } from "@ngriffin_uk/polychat-utility-core";
import z from "zod/v4";

import { externalHttpUrlSchema, internalNavigationPathSchema } from "./navigation.js";
import { placeSchema } from "./places.js";

export const DISCOVER_DAY_CONFIGURATION_ID = "discover.day";
export const DISCOVER_LIVE_KIND = "discover.live";
export const DISCOVER_SEEN_KIND = "discover.seen";
export const DISCOVER_AUDIO_KIND = "discover.audio";
export const DISCOVER_LIVE_LIMIT = 120;
export const DISCOVER_FEED_PAGE_SIZE = 24;

export const discoverLocalTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/u);
export const discoverTimezoneSchema = z.string().min(1).max(120).refine(isValidTimeZone);
export const discoverDayModeSchema = z.enum(["office", "remote", "off"]);
export const discoverMomentSchema = z.enum(["morning", "lunch", "afternoon", "evening"]);
export const discoverRoutineOperationSchema = z.enum([
  "current",
  "feed",
  "research",
  "morning_audio",
  "evening_audio",
]);

export const discoverPlaceSchema = placeSchema;

export const discoverWorkdaySchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    mode: discoverDayModeSchema,
    start: discoverLocalTimeSchema.default("09:00"),
    end: discoverLocalTimeSchema.default("17:00"),
    outbound: discoverLocalTimeSchema.default("08:00"),
    returning: discoverLocalTimeSchema.default("17:30"),
  })
  .strict();

export const discoverDayOverrideSchema = z
  .object({
    date: z.iso.date(),
    mode: discoverDayModeSchema,
    outbound: discoverLocalTimeSchema.optional(),
    returning: discoverLocalTimeSchema.optional(),
  })
  .strict();

export const discoverMomentsSchema = z
  .object({
    morning: discoverLocalTimeSchema.default("07:00"),
    lunch: discoverLocalTimeSchema.default("12:15"),
    afternoon: discoverLocalTimeSchema.default("16:30"),
    evening: discoverLocalTimeSchema.default("19:00"),
  })
  .strict();

export const discoverNotificationPreferencesSchema = z
  .object({
    enabled: z.boolean().default(false),
    commute: z.boolean().default(true),
    weather: z.boolean().default(false),
    news: z.boolean().default(false),
    briefings: z.boolean().default(false),
    dailyLimit: z.number().int().min(0).max(2).default(2),
    quietStart: discoverLocalTimeSchema.default("21:00"),
    quietEnd: discoverLocalTimeSchema.default("07:00"),
    quietWhileWorking: z.boolean().default(true),
  })
  .strict();

export const discoverCommuteSchema = z
  .object({
    provider: z.literal("tfl"),
    origin: discoverPlaceSchema,
    destination: discoverPlaceSchema,
    alertDelayMinutes: z.number().int().min(5).max(120).default(15),
  })
  .strict();

export const discoverTransitLineIdSchema = z.enum([
  "bakerloo",
  "central",
  "circle",
  "district",
  "hammersmith-city",
  "jubilee",
  "metropolitan",
  "northern",
  "piccadilly",
  "victoria",
  "waterloo-city",
  "elizabeth",
  "dlr",
  "liberty",
  "lioness",
  "mildmay",
  "suffragette",
  "weaver",
  "windrush",
  "tram",
]);

export const DISCOVER_TRANSIT_LINES: readonly {
  id: z.infer<typeof discoverTransitLineIdSchema>;
  name: string;
}[] = [
  { id: "bakerloo", name: "Bakerloo" },
  { id: "central", name: "Central" },
  { id: "circle", name: "Circle" },
  { id: "district", name: "District" },
  { id: "hammersmith-city", name: "Hammersmith & City" },
  { id: "jubilee", name: "Jubilee" },
  { id: "metropolitan", name: "Metropolitan" },
  { id: "northern", name: "Northern" },
  { id: "piccadilly", name: "Piccadilly" },
  { id: "victoria", name: "Victoria" },
  { id: "waterloo-city", name: "Waterloo & City" },
  { id: "elizabeth", name: "Elizabeth line" },
  { id: "dlr", name: "DLR" },
  { id: "liberty", name: "Liberty" },
  { id: "lioness", name: "Lioness" },
  { id: "mildmay", name: "Mildmay" },
  { id: "suffragette", name: "Suffragette" },
  { id: "weaver", name: "Weaver" },
  { id: "windrush", name: "Windrush" },
  { id: "tram", name: "Tram" },
];

export const discoverLineStatusPreferencesSchema = z
  .object({
    enabled: z.boolean().default(false),
    lines: z.array(discoverTransitLineIdSchema).max(12).default([]),
    nearby: z.boolean().default(true),
  })
  .strict();

export const discoverDeviceLocationSchema = z
  .object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  })
  .strict();

export const discoverAudioPreferencesSchema = z
  .object({
    morning: z
      .object({
        enabled: z.boolean().default(true),
        time: discoverLocalTimeSchema.default("07:15"),
      })
      .strict()
      .prefault({}),
    evening: z
      .object({
        enabled: z.boolean().default(false),
        time: discoverLocalTimeSchema.default("19:15"),
      })
      .strict()
      .prefault({}),
  })
  .strict();

export const discoverDayProfileContentSchema = z
  .object({
    version: z.literal(1).default(1),
    timezone: discoverTimezoneSchema.default("UTC"),
    onboarded: z.boolean().default(false),
    week: z
      .array(discoverWorkdaySchema)
      .length(7)
      .refine(
        (week) => new Set(week.map((day) => day.weekday)).size === 7,
        "Choose each weekday once",
      )
      .default((): z.infer<typeof discoverWorkdaySchema>[] =>
        Array.from({ length: 7 }, (_, weekday) => ({
          weekday,
          mode: weekday === 0 || weekday === 6 ? "off" : "remote",
          start: "09:00",
          end: "17:00",
          outbound: "08:00",
          returning: "17:30",
        })),
      ),
    moments: discoverMomentsSchema.prefault({}),
    weatherLocation: discoverPlaceSchema.nullable().default(null),
    commute: discoverCommuteSchema.nullable().default(null),
    lineStatus: discoverLineStatusPreferencesSchema.prefault({}),
    topics: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
    mutedTopics: z.array(z.string().trim().min(1).max(60)).max(40).default([]),
    overrides: z.array(discoverDayOverrideSchema).max(60).default([]),
    notifications: discoverNotificationPreferencesSchema.prefault({}),
    audio: discoverAudioPreferencesSchema.prefault({}),
  })
  .strict();

export const discoverDayProfileSchema = discoverDayProfileContentSchema.extend({
  revision: z.number().int().nonnegative(),
  updatedAt: z.iso.datetime().nullable(),
});

export const updateDiscoverDayProfileSchema = z
  .object({
    expectedRevision: z.number().int().nonnegative(),
    enabled: z.boolean().optional(),
    timezone: discoverTimezoneSchema.optional(),
    onboarded: z.boolean().optional(),
    week: discoverDayProfileContentSchema.shape.week.removeDefault().optional(),
    moments: discoverMomentsSchema.optional(),
    weatherLocation: discoverPlaceSchema.nullable().optional(),
    commute: discoverCommuteSchema.nullable().optional(),
    lineStatus: discoverLineStatusPreferencesSchema.optional(),
    topics: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
    mutedTopics: z.array(z.string().trim().min(1).max(60)).max(40).optional(),
    notifications: discoverNotificationPreferencesSchema.optional(),
    audio: discoverAudioPreferencesSchema.optional(),
    override: discoverDayOverrideSchema.optional(),
    removeOverride: z.iso.date().optional(),
  })
  .strict()
  .refine(
    (input) => !(input.override && input.removeOverride === input.override.date),
    "Set or remove a dated override, not both",
  );

export const discoverDayContextSchema = z.object({
  date: z.iso.date(),
  timezone: discoverTimezoneSchema,
  mode: discoverDayModeSchema,
  moment: discoverMomentSchema,
  working: z.boolean(),
  overridden: z.boolean(),
  outbound: discoverLocalTimeSchema,
  returning: discoverLocalTimeSchema,
});

export const discoverObservationSchema = z.object({
  id: z.string().min(1).max(100),
  kind: z.enum(["weather", "calendar", "task", "travel", "lines", "priority"]),
  title: z.string().min(1).max(200),
  text: z.string().min(1).max(1000),
  source: z.string().min(1).max(100),
  providerId: z.string().min(1).optional(),
  href: z.union([externalHttpUrlSchema, internalNavigationPathSchema]).optional(),
  observedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  actionable: z.boolean().default(false),
  fingerprint: z.string().min(1).max(100),
  stale: z.boolean().default(false),
  journey: z
    .object({ durationMinutes: z.number().positive(), baselineMinutes: z.number().positive() })
    .optional(),
});

export const discoverNowSchema = z.object({
  context: discoverDayContextSchema,
  title: z.string().min(1),
  observations: z.array(discoverObservationSchema).max(16),
  checkedAt: z.iso.datetime().nullable(),
  updatedAt: z.iso.datetime().nullable(),
  nextRefreshAt: z.iso.datetime(),
});

export const discoverAudioReleaseSchema = z.object({
  id: z.string().min(1),
  date: z.iso.date(),
  slot: z.enum(["morning", "evening"]),
  editionId: z.string().min(1).nullable(),
  sourceId: z.string().min(1).nullable(),
  status: z.enum(["pending", "ready", "failed", "over_budget"]),
  createdAt: z.iso.datetime(),
});

export const discoverFeedCursorSchema = z.string().regex(/^\d{1,12}$/u);
export const discoverFeedQuerySchema = z.object({
  after: discoverFeedCursorSchema.optional(),
  limit: z.coerce.number().int().min(1).max(48).default(DISCOVER_FEED_PAGE_SIZE),
});

export const discoverSeenRequestSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            id: z.string().min(1).max(80),
            revision: z.number().int().positive(),
          })
          .strict(),
      )
      .min(1)
      .max(48),
  })
  .strict();

export const discoverMutationResponseSchema = z.object({ updated: z.number().int().nonnegative() });
export const discoverFeedItemParamsSchema = z.object({ item_id: z.string().min(1).max(80) });
export type DiscoverDayMode = z.infer<typeof discoverDayModeSchema>;
export type DiscoverMoment = z.infer<typeof discoverMomentSchema>;
export type DiscoverRoutineOperation = z.infer<typeof discoverRoutineOperationSchema>;
export type DiscoverPlace = z.infer<typeof discoverPlaceSchema>;
export type DiscoverTransitLineId = z.infer<typeof discoverTransitLineIdSchema>;
export type DiscoverLineStatusPreferences = z.infer<typeof discoverLineStatusPreferencesSchema>;
export type DiscoverDeviceLocation = z.infer<typeof discoverDeviceLocationSchema>;
export type DiscoverDayProfileContent = z.infer<typeof discoverDayProfileContentSchema>;
export type DiscoverDayProfile = z.infer<typeof discoverDayProfileSchema>;
export type UpdateDiscoverDayProfile = z.infer<typeof updateDiscoverDayProfileSchema>;
export type DiscoverDayContext = z.infer<typeof discoverDayContextSchema>;
export type DiscoverObservation = z.infer<typeof discoverObservationSchema>;
export type DiscoverNow = z.infer<typeof discoverNowSchema>;
export type DiscoverAudioRelease = z.infer<typeof discoverAudioReleaseSchema>;
export type DiscoverFeedQuery = z.infer<typeof discoverFeedQuerySchema>;
export type DiscoverSeenRequest = z.infer<typeof discoverSeenRequestSchema>;
