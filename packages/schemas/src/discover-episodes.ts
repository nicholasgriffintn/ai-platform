import z from "zod/v4";

import { narrationVoiceSchema } from "./speech-voices.js";
import { videoOverviewStyleSchema } from "./study-outputs.js";

export const DISCOVER_EPISODES_CAPABILITY_ID = "discover-episodes";
export const DISCOVER_EPISODE_KIND = "discover.episode";
export const DISCOVER_SEASON_KIND = "discover.season";
export const DISCOVER_SEASON_PARTS = 5;
export const DISCOVER_EPISODE_MAX_SHOTS = 96;
export const DISCOVER_EPISODE_WATCHED_FRACTION = 0.5;

export const DISCOVER_EPISODE_LENGTHS = ["off", "short", "standard", "long"] as const;
export const discoverEpisodeLengthSchema = z.enum(DISCOVER_EPISODE_LENGTHS);
export const DISCOVER_EPISODE_MINUTES: Record<
  Exclude<z.infer<typeof discoverEpisodeLengthSchema>, "off">,
  number
> = { short: 5, standard: 12, long: 20 };

export const DISCOVER_SHOT_MOTIONS = [
  "push_in",
  "pull_back",
  "pan_left",
  "pan_right",
  "hold",
] as const;
export const discoverShotMotionSchema = z.enum(DISCOVER_SHOT_MOTIONS);

const plateSchema = z
  .string()
  .regex(/^[a-z0-9-]{1,40}$/u)
  .describe("A short lowercase-dashed name for a recurring person, creature or place.");

function text() {
  return z.string().trim().min(1);
}

const seasonCharacterSchema = z
  .object({
    plate: plateSchema,
    description: text().describe("How to draw it the same way every time, with no words."),
  })
  .strict();

export const discoverSeasonPlanDraftSchema = z
  .object({
    title: text().describe("The season's title."),
    parts: z
      .array(
        z
          .object({
            title: text(),
            angle: text(),
            beats: z.array(text()).min(2).max(5),
          })
          .strict(),
      )
      .length(DISCOVER_SEASON_PARTS),
    cast: z.array(seasonCharacterSchema).max(6),
    places: z.array(seasonCharacterSchema).max(4),
    motifs: z.array(text()).max(4),
  })
  .strict();

export const discoverSeasonContentSchema = discoverSeasonPlanDraftSchema
  .extend({
    format: z.literal("season"),
    topic: text(),
    style: videoOverviewStyleSchema,
    nextPart: z
      .number()
      .int()
      .min(1)
      .max(DISCOVER_SEASON_PARTS + 1),
    episodeIds: z.array(z.string().min(1)).max(DISCOVER_SEASON_PARTS),
  })
  .strict();

const shotDraftSchema = z
  .object({
    visual: text().describe("The illustration as a concrete picture with no words in it."),
    motion: discoverShotMotionSchema,
    plate: plateSchema.optional(),
  })
  .strict();

const sceneDraftSchema = z
  .object({
    title: text(),
    caption: z.string().trim().default(""),
    narration: text().describe("What the narrator says over this scene, written to be spoken."),
    shots: z.array(shotDraftSchema).min(1).max(4),
  })
  .strict();

export const discoverEpisodeOutlineDraftSchema = z
  .object({
    title: text(),
    recap: z.string().trim().default(""),
    chapters: z
      .array(
        z
          .object({
            title: text(),
            beats: z.array(text()).min(2).max(5).describe("What the chapter covers, in order."),
          })
          .strict(),
      )
      .min(2)
      .max(4),
  })
  .strict();

export const discoverChapterScriptDraftSchema = z
  .object({ scenes: z.array(sceneDraftSchema).min(1).max(6) })
  .strict();

export const discoverChapterCheckSchema = z
  .object({
    unsupported: z
      .array(z.string().trim().min(1))
      .max(20)
      .describe("Each unsupported claim, quoted exactly from the narration."),
  })
  .strict();

export const discoverEpisodeChapterStatusSchema = z.enum([
  "pending",
  "scripting",
  "rendering",
  "ready",
  "failed",
]);

const shotSchema = shotDraftSchema.extend({ image: z.boolean().default(false) }).strict();

const sceneSchema = sceneDraftSchema.extend({ shots: z.array(shotSchema).min(1).max(4) }).strict();

export const discoverEpisodeChapterSchema = z
  .object({
    title: text(),
    beats: z.array(z.string()).max(5).default([]),
    scenes: z.array(sceneSchema).max(6),
    status: discoverEpisodeChapterStatusSchema,
    timings: z.array(z.object({ start: z.number(), end: z.number() }).strict()).default([]),
  })
  .strict();

export const discoverEpisodeContentSchema = z
  .object({
    format: z.literal("episode"),
    seasonId: z.string().min(1),
    editionId: z.string().min(1),
    notebookId: z.string().min(1).nullable(),
    minutes: z.number().int().min(1).max(30),
    topic: text(),
    part: z.number().int().min(1).max(DISCOVER_SEASON_PARTS),
    parts: z.number().int().min(1).max(DISCOVER_SEASON_PARTS),
    style: videoOverviewStyleSchema,
    title: text(),
    recap: z.string(),
    chapters: z.array(discoverEpisodeChapterSchema).min(1).max(4),
    voice: narrationVoiceSchema.optional(),
  })
  .strict();

export const discoverEpisodeResumeSchema = z.object({
  chapter: z.number().int().min(0).max(3),
  seconds: z.number().min(0),
});

export const discoverEpisodeViewerProgressSchema = z.object({
  furthest: z.number().min(0).max(1).catch(0),
  resume: discoverEpisodeResumeSchema.nullable().catch(null),
});

export const discoverEpisodeSchema = discoverEpisodeContentSchema.extend({
  id: z.string().min(1),
  createdAt: z.string(),
  progress: discoverEpisodeViewerProgressSchema,
});

export const discoverEpisodeParamsSchema = z.object({ episode_id: z.string().min(1) });

export const discoverEpisodeProgressSchema = z
  .object({ fraction: z.number().min(0).max(1), resume: discoverEpisodeResumeSchema.optional() })
  .strict();

export const discoverEpisodeProgressResponseSchema = discoverEpisodeViewerProgressSchema;

export const discoverEpisodeChapterParamsSchema = discoverEpisodeParamsSchema.extend({
  chapter: z.coerce.number().int().min(0).max(3),
});

export const discoverEpisodeShotParamsSchema = discoverEpisodeChapterParamsSchema.extend({
  scene: z.coerce.number().int().min(0).max(5),
  shot: z.coerce.number().int().min(0).max(3),
});

export type DiscoverEpisodeLength = z.infer<typeof discoverEpisodeLengthSchema>;
export type DiscoverShotMotion = z.infer<typeof discoverShotMotionSchema>;
export type DiscoverSeasonPlanDraft = z.infer<typeof discoverSeasonPlanDraftSchema>;
export type DiscoverSeasonContent = z.infer<typeof discoverSeasonContentSchema>;
export type DiscoverEpisodeOutlineDraft = z.infer<typeof discoverEpisodeOutlineDraftSchema>;
export type DiscoverChapterScriptDraft = z.infer<typeof discoverChapterScriptDraftSchema>;
export type DiscoverEpisodeChapter = z.infer<typeof discoverEpisodeChapterSchema>;
export type DiscoverEpisodeContent = z.infer<typeof discoverEpisodeContentSchema>;
export type DiscoverEpisode = z.infer<typeof discoverEpisodeSchema>;
export type DiscoverEpisodeProgress = z.infer<typeof discoverEpisodeProgressSchema>;
export type DiscoverEpisodeResume = z.infer<typeof discoverEpisodeResumeSchema>;
export type DiscoverEpisodeViewerProgress = z.infer<typeof discoverEpisodeViewerProgressSchema>;
