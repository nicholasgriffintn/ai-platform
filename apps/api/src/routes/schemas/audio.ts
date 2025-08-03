import z from "zod";

export const transcribeQuerySchema = z.object({
  provider: z.enum(["workers", "mistral"]).optional(),
  timestamps: z.coerce.boolean().optional(),
});

export const transcribeFormSchema = z.object({
  audio: z.instanceof(File).or(z.instanceof(Blob)).or(z.string()).meta({
    description:
      "The audio file to transcribe. Can be a File, Blob, or a URL string. If a URL, it must start with http:// or https://.",
  }),
});

export const textToSpeechSchema = z.object({
  input: z.string().meta({
    description:
      "The text to generate audio for. The maximum length is 4096 characters.",
  }),
  provider: z.enum(["polly", "cartesia", "elevenlabs", "melotts"]).optional(),
  lang: z.string().optional(),
});
