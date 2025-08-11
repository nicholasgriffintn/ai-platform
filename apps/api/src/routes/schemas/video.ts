import z from "zod/v4";

export const videoToNotesSchema = z.object({
  url: z.string().url(),
  timestamps: z.coerce.boolean().optional(),
  provider: z.enum(["workers", "mistral"]).optional(),
  generateSummary: z.coerce.boolean().optional(),
});

export const videoNotesResponseSchema = z.object({
  response: z.object({
    status: z.enum(["success", "error"]),
    content: z.string().optional(),
    data: z
      .object({
        noteId: z.string(),
        processingStatus: z.string(),
        transcript: z.string().optional(),
        metadata: z.record(z.any()).optional(),
      })
      .optional(),
    message: z.string().optional(),
  }),
});

export const videoStatusResponseSchema = z.object({
  status: z.enum(["pending", "processing", "complete", "error"]).optional(),
  progress: z.number().min(0).max(100).optional(),
  error: z.string().optional(),
  data: z.any().optional(),
});