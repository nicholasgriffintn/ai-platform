import { statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { OWNER } from "./identity.mjs";
import { at, insert, seedId } from "./sql.mjs";

const ASSET_DIRECTORY = path.join(path.dirname(fileURLToPath(import.meta.url)), "assets");

export function seedFile(filename, contentType, key = `seed/sources/${filename}`) {
  return {
    key,
    path: path.join(ASSET_DIRECTORY, filename),
    contentType,
    byteSize: statSync(path.join(ASSET_DIRECTORY, filename)).size,
    filename,
  };
}

export const SEED_SOURCE_FILES = {
  photo: seedFile("harbour-photo.png", "image/png"),
  recording: seedFile("standup-recording.mp3", "audio/mpeg"),
  video: seedFile("product-demo.mp4", "video/mp4"),
  podcast: seedFile("podcast-episode.mp3", "audio/mpeg"),
  podcastCover: seedFile("podcast-cover.png", "image/png"),
  pdf: seedFile("quarterly-review.pdf", "application/pdf"),
};

function personalSource({ key, created, ...fields }) {
  return insert("resource", {
    resource_type: "source",
    id: seedId("source", key),
    created_by_user_id: OWNER.id,
    scope_type: "personal",
    scope_id: String(OWNER.id),
    status: "available",
    metadata: {},
    created_at: at(created),
    updated_at: at(created),
    ...fields,
  });
}

function fileFields(file) {
  return {
    storage_key: file.key,
    mime_type: file.contentType,
    filename: file.filename,
    byte_size: file.byteSize,
  };
}

const STANDUP_TRANSCRIPT = {
  status: "ready",
  speakers: { S1: "Maya", S2: "Tom" },
  segments: [
    { speaker: "S1", start: 0, end: 2.6, text: "Morning. The Files viewer is ready for review." },
    { speaker: "S2", start: 2.6, end: 5.1, text: "I'll test it on tablet and phone today." },
    {
      speaker: "S1",
      start: 5.1,
      end: 8,
      text: "Good. Let's ship it on Thursday if nothing breaks.",
    },
  ],
};

const DEMO_TRANSCRIPT = {
  status: "ready",
  speakers: { S1: "Narrator" },
  segments: [
    { speaker: "S1", start: 0, end: 3, text: "Open any file and it comes up beside your chat." },
    { speaker: "S1", start: 3, end: 6, text: "Ask about it, and the answer comes from the file." },
  ],
};

const PODCAST_TRANSCRIPT = {
  status: "ready",
  speakers: { S1: "Host", S2: "Guest" },
  segments: [
    {
      speaker: "S1",
      start: 0,
      end: 4,
      text: "This week: why back-pressure matters for WebSockets.",
    },
    {
      speaker: "S2",
      start: 4,
      end: 10,
      text: "If you ignore bufferedAmount, slow clients eat your memory.",
    },
  ],
};

export function sourceStatements() {
  const files = SEED_SOURCE_FILES;

  return [
    personalSource({
      key: "harbour-photo",
      created: { days: 4 },
      kind: "file",
      title: "Harbour at dusk",
      ...fileFields(files.photo),
    }),
    personalSource({
      key: "standup-recording",
      created: { days: 2, hours: 3 },
      kind: "file",
      title: "Monday stand-up",
      ...fileFields(files.recording),
      content:
        "Maya: Morning. The Files viewer is ready for review.\nTom: I'll test it on tablet and phone today.\nMaya: Good. Let's ship it on Thursday if nothing breaks.",
      metadata: {
        media: {
          durationSeconds: 8,
          transcript: STANDUP_TRANSCRIPT,
          notes: {
            summary: "A short stand-up about releasing the Files viewer this week.",
            decisions: ["Ship the Files viewer on Thursday if testing passes."],
            actionItems: [
              { task: "Test the Files viewer on tablet and phone", owner: "Tom", due: "Today" },
            ],
          },
        },
      },
    }),
    personalSource({
      key: "product-demo",
      created: { days: 5 },
      kind: "file",
      title: "Files viewer demo",
      ...fileFields(files.video),
      content:
        "Narrator: Open any file and it comes up beside your chat.\nNarrator: Ask about it, and the answer comes from the file.",
      metadata: { media: { durationSeconds: 6, transcript: DEMO_TRANSCRIPT } },
    }),
    personalSource({
      key: "podcast-episode",
      created: { days: 6 },
      kind: "podcast",
      title: "Episode 12: Back-pressure, briefly",
      ...fileFields(files.podcast),
      content:
        "Host: This week: why back-pressure matters for WebSockets.\nGuest: If you ignore bufferedAmount, slow clients eat your memory.",
      metadata: {
        generation: {
          type: "podcast",
          modelName: "Polychat voices",
          prompt: "A two-voice explainer on WebSocket back-pressure",
          sourceIds: [seedId("source", "d1-limits")],
        },
        media: {
          durationSeconds: 10,
          transcript: PODCAST_TRANSCRIPT,
          cover: { key: files.podcastCover.key, mimeType: files.podcastCover.contentType },
        },
      },
    }),
    personalSource({
      key: "quarterly-review",
      created: { days: 9 },
      kind: "file",
      title: "Quarterly review",
      ...fileFields(files.pdf),
      content:
        "Polychat quarterly review\n\nRevenue grew 18 per cent on the quarter.\n\nChurn fell to 2.1 per cent.\n\nNext quarter: ship Files viewer and teammate routines.",
    }),
    personalSource({
      key: "launch-plan",
      created: { days: 12 },
      kind: "file",
      title: "launch-plan.md",
      mime_type: "text/markdown",
      filename: "launch-plan.md",
      byte_size: 412,
      content:
        "# Autumn launch plan\n\n## Goals\n\n- Ship the Files viewer\n- Publish the changelog\n\n## Risks\n\n- Tablet layout needs testing\n- PDF previews depend on the browser",
    }),
    personalSource({
      key: "inbox-thread",
      created: { days: 1, hours: 2 },
      kind: "connector",
      title: "Re: Thursday release",
      provider: "gmail",
      external_uri: "https://mail.google.com/mail/u/0/#inbox/seed-thread",
      content:
        "From: Maya\nTo: Nicholas\nSubject: Re: Thursday release\n\nTesting looks good on desktop. Tom is checking tablet and phone today, then we are clear to ship.",
    }),
    personalSource({
      key: "polychat-repository",
      created: { days: 20 },
      kind: "repository",
      title: "polychat",
      provider: "github",
      external_uri: "https://github.com/nicholasgriffintn/polychat",
      content:
        "# Polychat\n\nA pnpm monorepo with Chat, Work, the API, web, desktop and iOS apps.\n\nRun `pnpm dev` to start the app and API locally.",
    }),
    personalSource({
      key: "remembered-preferences",
      created: { days: 15 },
      kind: "memory",
      title: "Writing preferences",
      content: "Prefers British English, short paragraphs and no exclamation marks.",
    }),
    personalSource({
      key: "board-meeting",
      created: { minutes: 20 },
      kind: "file",
      title: "board-meeting.m4a",
      status: "processing",
      mime_type: "audio/mp4",
      filename: "board-meeting.m4a",
      byte_size: 18_400_000,
    }),
  ];
}
