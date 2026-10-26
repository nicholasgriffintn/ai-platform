import type { YouTubeVideo } from "@ngriffin_uk/polychat-schemas";
import {
  formatDuration,
  readYouTubeVideoId,
  youTubeWatchUrl,
} from "@ngriffin_uk/polychat-utility-core";
import z from "zod/v4";

const INNERTUBE_PLAYER_URL = "https://www.youtube.com/youtubei/v1/player?prettyPrint=false";
const INNERTUBE_CLIENT = { clientName: "ANDROID", clientVersion: "20.10.38", hl: "en" };
const REQUEST_HEADERS = {
  "accept-language": "en-GB,en;q=0.9",
  "user-agent": "Mozilla/5.0 (compatible; Polychat/1.0)",
};

const oEmbedSchema = z.object({
  title: z.string().optional(),
  author_name: z.string().optional(),
});

const captionTrackSchema = z.object({
  baseUrl: z.url(),
  languageCode: z.string(),
  kind: z.string().optional(),
});

const playerSchema = z.object({
  captions: z
    .object({
      playerCaptionsTracklistRenderer: z.object({
        captionTracks: z.array(captionTrackSchema).default([]),
      }),
    })
    .optional(),
});

const captionEventsSchema = z.object({
  events: z
    .array(
      z.object({
        tStartMs: z.number().optional(),
        segs: z.array(z.object({ utf8: z.string() })).optional(),
      }),
    )
    .default([]),
});

export interface YouTubeVideoContent {
  video: YouTubeVideo;
  transcript: string | null;
}

function chooseTrack(tracks: z.infer<typeof captionTrackSchema>[]) {
  const english = tracks.filter((track) => track.languageCode.startsWith("en"));

  return (
    english.find((track) => track.kind !== "asr") ??
    english[0] ??
    tracks.find((track) => track.kind !== "asr") ??
    tracks[0]
  );
}

async function readOEmbed(videoId: string) {
  const endpoint = new URL("https://www.youtube.com/oembed");

  endpoint.searchParams.set("url", youTubeWatchUrl(videoId));
  endpoint.searchParams.set("format", "json");

  const response = await fetch(endpoint, { headers: REQUEST_HEADERS });

  if (!response.ok) {
    return null;
  }

  const parsed = oEmbedSchema.safeParse(await response.json());

  return parsed.success ? parsed.data : null;
}

async function readCaptionTracks(videoId: string) {
  const response = await fetch(INNERTUBE_PLAYER_URL, {
    method: "POST",
    headers: { ...REQUEST_HEADERS, "content-type": "application/json" },
    body: JSON.stringify({ context: { client: INNERTUBE_CLIENT }, videoId }),
  });

  if (!response.ok) {
    return [];
  }

  const parsed = playerSchema.safeParse(await response.json());

  return parsed.success
    ? (parsed.data.captions?.playerCaptionsTracklistRenderer.captionTracks ?? [])
    : [];
}

async function readTranscript(videoId: string): Promise<string | null> {
  const track = chooseTrack(await readCaptionTracks(videoId));

  if (!track) {
    return null;
  }

  const captionsUrl = new URL(track.baseUrl);

  if (captionsUrl.hostname !== "www.youtube.com") {
    return null;
  }

  captionsUrl.searchParams.set("fmt", "json3");

  const response = await fetch(captionsUrl, { headers: REQUEST_HEADERS });

  if (!response.ok) {
    return null;
  }

  const captions = captionEventsSchema.safeParse(await response.json());

  if (!captions.success) {
    return null;
  }

  const lines = captions.data.events.flatMap((event) => {
    const text = (event.segs ?? [])
      .map((segment) => segment.utf8)
      .join("")
      .replace(/\s+/g, " ")
      .trim();

    return text ? [`[${formatDuration((event.tStartMs ?? 0) / 1000) || "0:00"}] ${text}`] : [];
  });

  return lines.length > 0 ? lines.join("\n") : null;
}

export async function readYouTubeVideo(url: string): Promise<YouTubeVideoContent | null> {
  const videoId = readYouTubeVideoId(url);

  if (!videoId) {
    return null;
  }

  const [details, transcript] = await Promise.all([
    readOEmbed(videoId).catch(() => null),
    readTranscript(videoId),
  ]);

  return {
    video: {
      videoId,
      url,
      ...(details?.title ? { title: details.title } : {}),
      ...(details?.author_name ? { author: details.author_name } : {}),
      hasTranscript: transcript !== null,
    },
    transcript,
  };
}
