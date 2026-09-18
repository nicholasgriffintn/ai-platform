import z from "zod/v4";

import type { FunctionToolDescriptor } from "./types";

export const processRecordingInputSchema = z.object({
  recordingId: z
    .string()
    .min(1)
    .max(200)
    .describe("Identifier of an uploaded recording to transcribe."),
  speakers: z
    .number()
    .int()
    .min(1)
    .max(12)
    .describe("How many people speak in the recording, which the transcriber needs up front."),
  prompt: z
    .string()
    .trim()
    .min(1)
    .max(2000)
    .describe("What the transcript is for, so the transcriber keeps the right detail."),
});

export const process_recording: FunctionToolDescriptor = {
  name: "process_recording",
  description:
    "Transcribe a recording that has already been uploaded, keeping the transcript as a durable result. Use it when someone asks what was said in a recording they have added.",
  type: "premium",
  permissions: ["reasoning", "write"],
  inputSchema: processRecordingInputSchema,
};
