import z from "zod/v4";

export const uploadRequestSchema = z.object({
  file: z.any().refine((file) => file && file instanceof File, {
    error: "File is required",
  }),
  file_type: z.enum(["image", "document", "audio", "code"]),
});

export const uploadResponseSchema = z.object({
  url: z.string(),
  type: z.enum(["image", "document", "audio", "code", "markdown_document"]),
  name: z.string().optional(),
  markdown: z.string().optional(),
});
