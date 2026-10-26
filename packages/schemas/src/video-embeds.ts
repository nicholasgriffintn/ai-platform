import { YOUTUBE_VIDEO_ID_PATTERN } from "@ngriffin_uk/polychat-utility-core";
import z from "zod/v4";

export const youTubeVideoSchema = z.object({
  videoId: z.string().regex(YOUTUBE_VIDEO_ID_PATTERN),
  url: z.url(),
  title: z.string().optional(),
  author: z.string().optional(),
  hasTranscript: z.boolean(),
});

export type YouTubeVideo = z.infer<typeof youTubeVideoSchema>;
