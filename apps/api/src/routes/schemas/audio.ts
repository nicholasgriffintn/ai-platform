import z from "zod";
import "zod-openapi/extend";

export const transcribeFormSchema = z.object({
  audio: z.instanceof(Blob),
});

export const textToSpeechSchema = z.object({
  input: z.string().openapi({
    description:
      "The text to generate audio for. The maximum length is 4096 characters.",
  }),
  provider: z.enum(["polly", "cartesia", "elevenlabs", "melotts"]).optional(),
  lang: z.string().optional(),
});
