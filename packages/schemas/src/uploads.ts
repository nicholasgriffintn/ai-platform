import z from "zod/v4";

export const markdownDescriptionLanguageSchema = z.enum(["en", "it", "de", "es", "fr", "pt"]);

export const markdownConversionOptionsSchema = z.object({
  output: z
    .object({
      format: z.enum(["markdown", "text"]).optional(),
    })
    .optional(),
  image: z
    .object({
      descriptionLanguage: markdownDescriptionLanguageSchema.optional(),
    })
    .optional(),
  html: z
    .object({
      hostname: z.string().trim().min(1).optional(),
      cssSelector: z.string().trim().min(1).optional(),
    })
    .optional(),
  pdf: z
    .object({
      metadata: z.boolean().optional(),
    })
    .optional(),
});

export type MarkdownConversionOptions = z.infer<typeof markdownConversionOptionsSchema>;

export const uploadRequestSchema = z.object({
  file: z.any().refine((file) => file && file instanceof File, {
    error: "File is required",
  }),
  file_type: z.enum(["image", "document", "audio", "video", "code"]),
});

export const uploadResponseSchema = z.object({
  sourceId: z.string(),
  key: z.string(),
  url: z.string(),
  type: z.enum(["image", "document", "audio", "video", "code", "markdown_document"]),
  name: z.string().optional(),
  markdown: z.string().optional(),
});

export type UploadFileType = z.infer<typeof uploadRequestSchema>["file_type"];

/** Picks the upload pipeline for a file from its type: media is kept as-is, text is read. */
export function getUploadFileType(mimeType: string): UploadFileType {
  const [group] = mimeType.toLowerCase().split("/");

  if (group === "image" || group === "audio" || group === "video") {
    return group;
  }

  return mimeType.startsWith("text/plain") || mimeType.includes("json") ? "code" : "document";
}
