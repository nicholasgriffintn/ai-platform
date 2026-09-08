import { slugify } from "@ngriffin_uk/polychat-utility-core";
import z from "zod/v4";

export const DOCUMENT_OUTPUT_KIND = "document";
export const DOCUMENT_WRITE_TOOL_NAME = "write_document";
export const DOCUMENT_CAPABILITY_ID = "document-writer";

export const DOCUMENT_MAX_BODY = 200 * 1024;

export const WORDS_READ_PER_MINUTE = 200;

export const DOCUMENT_CONTENT_TYPES = ["text", "list", "outline", "mixed"] as const;
export const DOCUMENT_SENTIMENTS = ["positive", "neutral", "negative"] as const;
export const DOCUMENT_SOURCE_TYPES = [
  "manual",
  "assistant",
  "transcription",
  "media",
  "capture",
] as const;

export const documentContentTypeSchema = z.enum(DOCUMENT_CONTENT_TYPES);
export const documentSentimentSchema = z.enum(DOCUMENT_SENTIMENTS);
export const documentSourceTypeSchema = z.enum(DOCUMENT_SOURCE_TYPES);

export const documentCaptureSchema = z.object({
  title: z.string().optional(),
  url: z.string().optional(),
  timestamp: z.string().optional(),
});

export const documentMetadataSchema = z
  .object({
    summary: z.string().optional(),
    tags: z.array(z.string()).optional(),
    keyTopics: z.array(z.string()).optional(),
    wordCount: z.number().int().nonnegative().optional(),
    readingTime: z.number().int().positive().optional(),
    contentType: documentContentTypeSchema.optional(),
    sentiment: documentSentimentSchema.optional(),
    sourceType: documentSourceTypeSchema.optional(),
    capturedFrom: documentCaptureSchema.optional(),
    themeMode: z.string().optional(),
    fontFamily: z.string().optional(),
    fontSize: z.number().optional(),
  })
  .catchall(z.unknown());

export const documentOutputContentSchema = z.object({
  format: z.literal("markdown"),
  body: z.string().max(DOCUMENT_MAX_BODY),
  metadata: documentMetadataSchema.optional(),
});

export const writeDocumentInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .describe("What the document is called, as the reader would name it."),
  body: z
    .string()
    .min(1)
    .max(DOCUMENT_MAX_BODY)
    .describe("The document itself, in Markdown. Write the whole thing, not a summary of it."),
  outputId: z
    .string()
    .min(1)
    .optional()
    .describe("Revise this document instead of writing a new one. Omit to write a new one."),
  projectId: z
    .string()
    .min(1)
    .optional()
    .describe("Project the document belongs to. Omit for a personal document."),
});

export const formatDocumentInputSchema = z.object({
  prompt: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .describe("Extra instructions for the rewrite, such as a tone or an audience."),
});

export const formatDocumentResponseSchema = z.object({
  body: z.string().describe("The rewritten document, in Markdown."),
});

export const describeDocumentResponseSchema = z.object({
  metadata: documentMetadataSchema,
});

export const describeDocumentInputSchema = z.object({
  expectedRevision: z.number().int().positive(),
});

export type DocumentMetadata = z.infer<typeof documentMetadataSchema>;
export type DocumentOutputContent = z.infer<typeof documentOutputContentSchema>;
export type WriteDocumentInput = z.infer<typeof writeDocumentInputSchema>;
export type FormatDocumentInput = z.infer<typeof formatDocumentInputSchema>;

export function readDocumentBody(content: Record<string, unknown> | undefined): string | null {
  const parsed = documentOutputContentSchema.safeParse(content);

  return parsed.success ? parsed.data.body : null;
}

export function readDocumentMetadata(
  content: Record<string, unknown> | undefined,
): DocumentMetadata | null {
  const parsed = documentOutputContentSchema.safeParse(content);

  return parsed.success ? (parsed.data.metadata ?? null) : null;
}

export function countDocumentWords(body: string): number {
  let words = 0;
  let inWord = false;

  for (const character of body) {
    const isSpace =
      character === " " || character === "\n" || character === "\t" || character === "\r";

    if (isSpace) {
      inWord = false;
      continue;
    }

    if (!inWord) {
      words += 1;
      inWord = true;
    }
  }

  return words;
}

export function deriveDocumentStatistics(body: string): {
  wordCount: number;
  readingTime: number;
} {
  const wordCount = countDocumentWords(body);

  return { wordCount, readingTime: Math.max(1, Math.ceil(wordCount / WORDS_READ_PER_MINUTE)) };
}

export function buildDocumentContent(
  body: string,
  metadata?: DocumentMetadata,
): DocumentOutputContent {
  const statistics = deriveDocumentStatistics(body);

  return {
    format: "markdown",
    body,
    metadata: { ...metadata, ...statistics },
  };
}

export function documentExportFilename(title: string): string {
  return `${slugify(title, 80) || "document"}.md`;
}
