import z from "zod/v4";

import type { FunctionToolDescriptor } from "./types";

export const captionVideoInputSchema = z.object({
  video_url: z
    .string()
    .trim()
    .min(1)
    .max(2048)
    .describe("The URL of a video the person attached or uploaded in this conversation."),
});

export const caption_video: FunctionToolDescriptor = {
  name: "caption_video",
  description:
    "Transcribe an uploaded video and return a copy with readable captions burned into the picture, ready to share on platforms that play video muted. Use it when someone asks to subtitle or caption a video they have added.",
  type: "premium",
  permissions: ["write"],
  effects: { effectClass: "draft" },
  intentEvidence: (input) => ({ operation: "caption_video", ...input }),
  inputSchema: captionVideoInputSchema,
};
