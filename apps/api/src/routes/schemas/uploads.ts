import { z } from "zod";

export const uploadRequestSchema = z.object({
  file: z.any().refine((file) => file && file instanceof File, {
    message: "File is required",
  }),
  file_type: z.enum(["image", "document"]),
});

export const uploadResponseSchema = z.object({
  url: z.string(),
  type: z.enum(["image", "document", "markdown_document"]),
  name: z.string().optional(),
  markdown: z.string().optional(),
});
