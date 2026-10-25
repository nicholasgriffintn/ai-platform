import {
  createDiscoverWindDownSchema,
  discoverSeasonParamsSchema,
  discoverWindDownBedParamsSchema,
  discoverWindDownParamsSchema,
  discoverWindDownSchema,
  discoverWindDownTonightSchema,
  discoverWindDownStepParamsSchema,
  discoverEpisodeChapterParamsSchema,
  discoverHealthSummarySchema,
  discoverEpisodeProgressResponseSchema,
  discoverEpisodeProgressSchema,
  discoverEpisodeParamsSchema,
  discoverEpisodeSchema,
  discoverEpisodeShotParamsSchema,
  discoverQueuedResponseSchema,
  discoverEditionIdParamsSchema,
  discoverEditionRecordingParamsSchema,
  discoverListenResponseSchema,
  discoverFollowParamsSchema,
  discoverFollowSchema,
  discoverUnfollowResponseSchema,
  followDiscoverTopicSchema,
  discoverCoverParamsSchema,
  discoverEditionParamsSchema,
  discoverEditionQuerySchema,
  discoverEditionSchema,
  discoverFeedbackRequestSchema,
  discoverFeedbackResponseSchema,
  discoverRefreshResponseSchema,
  discoverResponseSchema,
  discoverSettingsSchema,
  errorResponseSchema,
  sourceSchema,
  updateDiscoverSettingsSchema,
} from "@ngriffin_uk/polychat-schemas";
import { readCountryCode } from "@ngriffin_uk/polychat-utility-core";
import { Hono } from "hono";

import { addRoute } from "~/infrastructure/http/routeBuilder";
import { readDiscoverCover } from "~/modules/discover/application/covers";
import { readDiscover, readDiscoverEditionByDate } from "~/modules/discover/application/editions";
import {
  readEpisodeChapterAudio,
  readEpisodeShot,
  retryEpisodeChapter,
} from "~/modules/discover/application/episode-render";
import {
  queueDiscoverEpisode,
  readDiscoverEpisode,
  recordDiscoverEpisodeProgress,
} from "~/modules/discover/application/episodes";
import { recordDiscoverFeedback } from "~/modules/discover/application/feedback";
import { followDiscoverTopic, unfollowDiscoverTopic } from "~/modules/discover/application/follows";
import {
  clearDiscoverHealthSummary,
  saveDiscoverHealthSummary,
} from "~/modules/discover/application/health";
import { produceDiscoverListen } from "~/modules/discover/application/listen";
import {
  readEditionRecording,
  readEditionRecordingAudio,
} from "~/modules/discover/application/recordings";
import { queueSeasonListen } from "~/modules/discover/application/season-listen";
import {
  refreshDiscoverEdition,
  updateDiscoverSettings,
} from "~/modules/discover/application/settings";
import { queueYourWeek } from "~/modules/discover/application/week";
import {
  readDiscoverWindDown,
  readWindDownStepAudio,
  startDiscoverWindDown,
} from "~/modules/discover/application/wind-down";
import { readWindDownBed } from "~/modules/discover/application/wind-down-beds";
import { readWindDownTonight } from "~/modules/discover/application/wind-down-context";

const app = new Hono();

addRoute(app, "get", "/", {
  tags: ["discover"],
  summary: "Read Discover",
  description: "Your Discover settings and your latest edition, with your feedback on each card.",
  auth: true,
  responses: {
    200: { description: "Discover", schema: discoverResponseSchema },
    401: { description: "Authentication required", schema: errorResponseSchema },
  },
  handler: async ({ serviceContext }) => readDiscover(serviceContext),
});

addRoute(app, "get", "/editions/:date", {
  tags: ["discover"],
  summary: "Read a day's Discover edition",
  auth: true,
  paramSchema: discoverEditionParamsSchema,
  querySchema: discoverEditionQuerySchema,
  responses: {
    200: { description: "The edition", schema: discoverEditionSchema },
    404: { description: "No edition that day", schema: errorResponseSchema },
  },
  handler: async ({ serviceContext, params, query }) =>
    readDiscoverEditionByDate(serviceContext, params.date, query.edition),
});

addRoute(app, "get", "/covers/:cover_id", {
  tags: ["discover"],
  summary: "Download a topic cover",
  auth: true,
  paramSchema: discoverCoverParamsSchema,
  responses: { 200: { description: "Cover image" } },
  handler: async ({ serviceContext, params, raw }) =>
    readDiscoverCover(serviceContext, params.cover_id, raw.req.header("range")),
});

addRoute(app, "patch", "/settings", {
  tags: ["discover"],
  summary: "Turn Discover on or off",
  description:
    "Installs or removes Poly's morning pass that writes your Discover edition, and saves what you'd like it to cover.",
  auth: true,
  bodySchema: updateDiscoverSettingsSchema,
  responses: {
    200: { description: "Discover settings", schema: discoverSettingsSchema },
    401: { description: "Authentication required", schema: errorResponseSchema },
  },
  handler: async ({ serviceContext, body, raw }) =>
    updateDiscoverSettings(serviceContext, body, readCountryCode(raw.req.raw.cf?.country)),
});

addRoute(app, "post", "/refresh", {
  tags: ["discover"],
  summary: "Write today's edition now",
  description: "Queues Poly's Discover pass straight away instead of waiting for the morning.",
  auth: true,
  responses: {
    200: { description: "Whether the pass was queued", schema: discoverRefreshResponseSchema },
    401: { description: "Authentication required", schema: errorResponseSchema },
  },
  handler: async ({ serviceContext }) => refreshDiscoverEdition(serviceContext),
});

addRoute(app, "post", "/feedback", {
  tags: ["discover"],
  summary: "Tell Discover what you think of a card",
  description: "More, less and hide shape later editions. Saved and opened are kept for you.",
  auth: true,
  bodySchema: discoverFeedbackRequestSchema,
  responses: {
    200: { description: "The card's signals", schema: discoverFeedbackResponseSchema },
    404: { description: "Not one of your cards", schema: errorResponseSchema },
  },
  handler: async ({ serviceContext, body }) => recordDiscoverFeedback(serviceContext, body),
});

addRoute(app, "post", "/editions/:edition_id/listen", {
  tags: ["discover"],
  summary: "Record the edition's listen",
  description:
    "Queues The Perch, a short two-host episode of the edition, in your podcast show of the same name.",
  auth: true,
  paramSchema: discoverEditionIdParamsSchema,
  responses: {
    200: { description: "The episode being recorded", schema: discoverListenResponseSchema },
    404: { description: "Not one of your editions", schema: errorResponseSchema },
  },
  handler: async ({ serviceContext, params }) =>
    produceDiscoverListen(serviceContext, params.edition_id),
});

addRoute(app, "put", "/health", {
  tags: ["discover"],
  summary: "Share yesterday's Apple Health summary",
  description:
    "Sleep, mindful and exercise minutes from the iPhone, used for one line in the brief and never to infer interests.",
  auth: true,
  bodySchema: discoverHealthSummarySchema,
  responses: { 200: { description: "The saved summary", schema: discoverHealthSummarySchema } },
  handler: async ({ serviceContext, body }) => saveDiscoverHealthSummary(serviceContext, body),
});

addRoute(app, "delete", "/health", {
  tags: ["discover"],
  summary: "Stop sharing Apple Health",
  auth: true,
  responses: { 204: { description: "The summary is cleared" } },
  handler: async ({ serviceContext }) => {
    await clearDiscoverHealthSummary(serviceContext);

    return new Response(null, { status: 204 });
  },
});

addRoute(app, "post", "/editions/:edition_id/week", {
  tags: ["discover"],
  summary: "Record your week",
  description: "Queues a short private recap of what you made, learned and finished this week.",
  auth: true,
  paramSchema: discoverEditionIdParamsSchema,
  responses: {
    200: { description: "The recap is queued", schema: discoverQueuedResponseSchema },
    404: { description: "Not one of your editions", schema: errorResponseSchema },
  },
  handler: async ({ serviceContext, params }) => queueYourWeek(serviceContext, params.edition_id),
});

addRoute(app, "get", "/editions/:edition_id/recordings/:recording", {
  tags: ["discover"],
  summary: "Read the edition's Perch or week recording",
  description:
    "The source behind the edition's listen or weekly recap, so a Discover-only device can play it.",
  auth: true,
  paramSchema: discoverEditionRecordingParamsSchema,
  responses: {
    200: { description: "The recording", schema: sourceSchema },
    404: {
      description: "Not one of your editions, or nothing recorded yet",
      schema: errorResponseSchema,
    },
  },
  handler: async ({ serviceContext, params }) =>
    readEditionRecording(serviceContext, params.edition_id, params.recording),
});

addRoute(app, "get", "/editions/:edition_id/recordings/:recording/audio", {
  tags: ["discover"],
  summary: "Stream the edition's Perch or week recording",
  auth: true,
  paramSchema: discoverEditionRecordingParamsSchema,
  responses: { 200: { description: "Recording audio" } },
  handler: async ({ serviceContext, params, raw }) =>
    readEditionRecordingAudio(
      serviceContext,
      params.edition_id,
      params.recording,
      raw.req.header("range"),
    ),
});

addRoute(app, "post", "/editions/:edition_id/episode", {
  tags: ["discover"],
  summary: "Make the edition's episode",
  description:
    "Queues today's part of the season on your top topic. It is scripted, then illustrated and narrated chapter by chapter.",
  auth: true,
  paramSchema: discoverEditionIdParamsSchema,
  responses: {
    200: { description: "The episode is queued", schema: discoverQueuedResponseSchema },
    404: { description: "Not one of your editions", schema: errorResponseSchema },
  },
  handler: async ({ serviceContext, params }) =>
    queueDiscoverEpisode(serviceContext, params.edition_id),
});

addRoute(app, "get", "/episodes/:episode_id", {
  tags: ["discover"],
  summary: "Read an episode",
  auth: true,
  paramSchema: discoverEpisodeParamsSchema,
  responses: {
    200: { description: "The episode", schema: discoverEpisodeSchema },
    404: { description: "Not one of your episodes", schema: errorResponseSchema },
  },
  handler: async ({ serviceContext, params }) =>
    readDiscoverEpisode(serviceContext, params.episode_id),
});

addRoute(app, "post", "/episodes/:episode_id/progress", {
  tags: ["discover"],
  summary: "Record how far you have watched",
  description:
    "Keeps your furthest point in the episode, so tomorrow's part is only made ahead when you watch.",
  auth: true,
  paramSchema: discoverEpisodeParamsSchema,
  bodySchema: discoverEpisodeProgressSchema,
  responses: {
    200: { description: "Your furthest point", schema: discoverEpisodeProgressResponseSchema },
    404: { description: "Not one of your episodes", schema: errorResponseSchema },
  },
  handler: async ({ serviceContext, params, body }) =>
    recordDiscoverEpisodeProgress(serviceContext, params.episode_id, body),
});

addRoute(app, "get", "/episodes/:episode_id/chapters/:chapter/audio", {
  tags: ["discover"],
  summary: "Stream a chapter's narration",
  auth: true,
  paramSchema: discoverEpisodeChapterParamsSchema,
  responses: { 200: { description: "Narration audio" } },
  handler: async ({ serviceContext, params, raw }) =>
    readEpisodeChapterAudio(
      serviceContext,
      params.episode_id,
      params.chapter,
      raw.req.header("range"),
    ),
});

addRoute(app, "post", "/episodes/:episode_id/chapters/:chapter/retry", {
  tags: ["discover"],
  summary: "Try a failed chapter again",
  auth: true,
  paramSchema: discoverEpisodeChapterParamsSchema,
  responses: {
    200: { description: "The chapter is queued", schema: discoverQueuedResponseSchema },
    409: { description: "The chapter has not failed", schema: errorResponseSchema },
  },
  handler: async ({ serviceContext, params }) =>
    retryEpisodeChapter(serviceContext, params.episode_id, params.chapter),
});

addRoute(app, "get", "/episodes/:episode_id/chapters/:chapter/scenes/:scene/shots/:shot", {
  tags: ["discover"],
  summary: "Download a shot's illustration",
  auth: true,
  paramSchema: discoverEpisodeShotParamsSchema,
  responses: { 200: { description: "Shot image" } },
  handler: async ({ serviceContext, params }) =>
    readEpisodeShot(serviceContext, params.episode_id, {
      chapter: params.chapter,
      scene: params.scene,
      shot: params.shot,
    }),
});

addRoute(app, "post", "/seasons/:season_id/listen", {
  tags: ["discover"],
  summary: "Save a season as one long listen",
  description:
    "Joins every finished chapter of the season into one episode of The Perch, so it plays in your podcast app.",
  auth: true,
  paramSchema: discoverSeasonParamsSchema,
  responses: {
    200: { description: "The long listen is queued", schema: discoverQueuedResponseSchema },
    404: { description: "Not one of your seasons", schema: errorResponseSchema },
  },
  handler: async ({ serviceContext, params }) =>
    queueSeasonListen(serviceContext, params.season_id),
});

addRoute(app, "post", "/wind-down", {
  tags: ["discover"],
  summary: "Make a wind-down session",
  description:
    "A narrated session with quiet pauses over a sound bed: breathing, body scan, unwind, a slow story, your highlights read back, parking tomorrow, or just the sound.",
  auth: true,
  bodySchema: createDiscoverWindDownSchema,
  responses: {
    200: { description: "The session being made", schema: discoverWindDownSchema },
    401: { description: "Authentication required", schema: errorResponseSchema },
    409: { description: "Nothing to read back yet", schema: errorResponseSchema },
  },
  handler: async ({ serviceContext, body }) => startDiscoverWindDown(serviceContext, body),
});

addRoute(app, "get", "/wind-down/tonight", {
  tags: ["discover"],
  summary: "Suggest tonight's wind down",
  description: "One session picked from your day, your sleep and what you played recently.",
  auth: true,
  responses: {
    200: { description: "Tonight's pick", schema: discoverWindDownTonightSchema },
    401: { description: "Authentication required", schema: errorResponseSchema },
  },
  handler: async ({ serviceContext }) => readWindDownTonight(serviceContext),
});

addRoute(app, "get", "/wind-down/beds/:bed", {
  tags: ["discover"],
  summary: "Stream a wind-down sound bed",
  auth: true,
  paramSchema: discoverWindDownBedParamsSchema,
  responses: {
    200: { description: "The sound bed" },
    404: { description: "Not made yet", schema: errorResponseSchema },
  },
  handler: async ({ serviceContext, params, raw }) =>
    readWindDownBed(serviceContext, params.bed, raw.req.header("range")),
});

addRoute(app, "get", "/wind-down/:wind_down_id", {
  tags: ["discover"],
  summary: "Read a wind-down session",
  auth: true,
  paramSchema: discoverWindDownParamsSchema,
  responses: {
    200: { description: "The session", schema: discoverWindDownSchema },
    404: { description: "Not one of your sessions", schema: errorResponseSchema },
  },
  handler: async ({ serviceContext, params }) =>
    readDiscoverWindDown(serviceContext, params.wind_down_id),
});

addRoute(app, "get", "/wind-down/:wind_down_id/steps/:step/audio", {
  tags: ["discover"],
  summary: "Stream one step of a wind-down session",
  auth: true,
  paramSchema: discoverWindDownStepParamsSchema,
  responses: { 200: { description: "Step audio" } },
  handler: async ({ serviceContext, params, raw }) =>
    readWindDownStepAudio(
      serviceContext,
      params.wind_down_id,
      params.step,
      raw.req.header("range"),
    ),
});

addRoute(app, "post", "/follows", {
  tags: ["discover"],
  summary: "Follow a topic",
  description:
    "Keeps a notebook for the topic. Each edition files its best links on the topic there as sources.",
  auth: true,
  bodySchema: followDiscoverTopicSchema,
  responses: {
    200: { description: "The followed topic", schema: discoverFollowSchema },
    401: { description: "Authentication required", schema: errorResponseSchema },
  },
  handler: async ({ serviceContext, body }) => followDiscoverTopic(serviceContext, body.topic),
});

addRoute(app, "delete", "/follows/:notebook_id", {
  tags: ["discover"],
  summary: "Stop following a topic",
  description: "The notebook and everything in it stays.",
  auth: true,
  paramSchema: discoverFollowParamsSchema,
  responses: {
    200: {
      description: "The notebook that stopped following",
      schema: discoverUnfollowResponseSchema,
    },
    404: { description: "Not your notebook", schema: errorResponseSchema },
  },
  handler: async ({ serviceContext, params }) =>
    unfollowDiscoverTopic(serviceContext, params.notebook_id),
});

export default app;
