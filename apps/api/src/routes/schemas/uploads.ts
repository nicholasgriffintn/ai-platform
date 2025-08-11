import { z } from "zod/v4";

export const uploadRequestSchema = z.object({
  file: z.any().refine((file) => file && file instanceof File, {
    error: "File is required",
  }),
  file_type: z.enum(["image", "document", "audio", "video"]),
  size: z.number().optional(),
});

export const uploadResponseSchema = z.object({
  url: z.string(),
  type: z.enum(["image", "document", "markdown_document", "audio", "video"]),
  name: z.string().optional(),
  markdown: z.string().optional(),
  size: z.number().optional(),
  mimeType: z.string().optional(),
  metadata: z
    .object({
      duration: z.number().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
      thumbnailUrl: z.string().optional(),
    })
    .optional(),
});
