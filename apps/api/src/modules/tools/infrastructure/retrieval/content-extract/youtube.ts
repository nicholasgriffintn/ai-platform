import {
  readBalancedJson,
  readYouTubeVideoId,
  safeParseJson,
} from "@ngriffin_uk/polychat-utility-core";
import z from "zod/v4";

const CAPTION_TRACKS_MARKER = '"captionTracks":';
const REQUEST_HEADERS = {
  "accept-language": "en-GB,en;q=0.9",
  "user-agent": "Mozilla/5.0 (compatible; Polychat/1.0)",
};

const captionTrackSchema = z.object({
  baseUrl: z.url(),
  languageCode: z.string(),
  kind: z.string().optional(),
});

const captionEventsSchema = z.object({
  events: z
    .array(z.object({ segs: z.array(z.object({ utf8: z.string() })).optional() }))
    .default([]),
});

function chooseTrack(tracks: z.infer<typeof captionTrackSchema>[]) {
  const english = tracks.filter((track) => track.languageCode.startsWith("en"));

  return (
    english.find((track) => track.kind !== "asr") ??
    english[0] ??
    tracks.find((track) => track.kind !== "asr") ??
    tracks[0]
  );
}

async function readCaptionTracks(videoId: string) {
  const response = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=en`, {
    headers: REQUEST_HEADERS,
  });

  if (!response.ok) {
    return [];
  }

  const page = await response.text();
  const marker = page.indexOf(CAPTION_TRACKS_MARKER);
  const json = marker === -1 ? null : readBalancedJson(page, marker + CAPTION_TRACKS_MARKER.length);
  const parsed = z.array(captionTrackSchema).safeParse(json ? safeParseJson(json) : []);

  return parsed.success ? parsed.data : [];
}

export async function readYouTubeTranscript(url: string): Promise<string | null> {
  const videoId = readYouTubeVideoId(url);

  if (!videoId) {
    return null;
  }

  const track = chooseTrack(await readCaptionTracks(videoId));

  if (!track || new URL(track.baseUrl).hostname !== "www.youtube.com") {
    return null;
  }

  const response = await fetch(`${track.baseUrl}&fmt=json3`, { headers: REQUEST_HEADERS });

  if (!response.ok) {
    return null;
  }

  const captions = captionEventsSchema.safeParse(await response.json());
  const text = captions.success
    ? captions.data.events
        .map((event) => (event.segs ?? []).map((segment) => segment.utf8).join(""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim()
    : "";

  return text || null;
}
