import z from "zod/v4";

import type { FunctionToolDescriptor } from "~/types/functions";

export const processMediaInputSchema = z.object({
  source_id: z.string().min(1).max(200).describe("The audio, video or podcast source to process."),
  action: z
    .enum(["transcribe", "notes", "cover"])
    .describe(
      "transcribe queues a transcript; notes writes a summary, decisions and action items from the transcript; cover generates cover art.",
    ),
  speakers: z
    .record(z.string(), z.string().trim().min(1).max(80))
    .optional()
    .describe(
      'For notes: names for the transcript\'s speaker labels, such as {"SPEAKER_00": "Ada"}.',
    ),
});

export const process_media: FunctionToolDescriptor = {
  name: "process_media",
  description:
    "Transcribe, take notes on or make cover art for an audio or video source. The transcript becomes searchable source content. Use it when someone asks what was said in something they recorded or uploaded.",
  type: "premium",
  permissions: ["reasoning", "write"],
  effects: { effectClass: "draft" },
  intentEvidence: (input) => ({ operation: "process_media", ...input }),
  inputSchema: processMediaInputSchema,
};
