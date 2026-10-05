import { slugify } from "@ngriffin_uk/polychat-utility-core";
import z from "zod/v4";

import { nativeRecordViewSchema, type NativeRecordView } from "./native-records.js";

export const DOCUMENT_OUTPUT_KIND = "document";
export const DOCUMENT_WRITE_TOOL_NAME = "write_document";
export const DOCUMENT_READ_TOOL_NAME = "get_document";
export const DOCUMENT_CAPABILITY_ID = "document-writer";

export const DOCUMENT_MAX_BODY = 200 * 1024;

export const readDocumentInputSchema = z
  .object({
    outputId: z.string().min(1),
    commentId: z.string().min(1).optional(),
  })
  .strict();
export type ReadDocumentInput = z.infer<typeof readDocumentInputSchema>;

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

export const documentEditorialGradeSchema = z.object({
  overall: z.number().min(0).max(1),
  grade: z.enum(["A", "B", "C", "D", "E"]),
  dimensions: z.record(z.string(), z.number().min(0).max(1)),
  confidence: z.number().min(0).max(1),
  provider: z.string(),
  model: z.string(),
});
export type DocumentEditorialGrade = z.infer<typeof documentEditorialGradeSchema>;

export const documentMetadataSchema = z
  .object({
    summary: z.string().optional(),
    editorial: documentEditorialGradeSchema.optional(),
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
  recordViews: z.array(nativeRecordViewSchema).max(12).default([]),
});

export const writeDocumentInputSchema = z
  .object({
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
    recordViews: z.array(nativeRecordViewSchema).max(12).optional(),
    expectedRevision: z
      .number()
      .int()
      .positive()
      .optional()
      .describe(
        "The revision you read before editing. Required when revising an existing document.",
      ),
    projectId: z
      .string()
      .min(1)
      .optional()
      .describe("Project the document belongs to. Omit for a personal document."),
  })
  .superRefine((input, context) => {
    if (input.outputId && input.expectedRevision === undefined) {
      context.addIssue({
        code: "custom",
        path: ["expectedRevision"],
        message: "Pass the revision you read before editing this document",
      });
    }
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
  sourceRevision: z.number().int().positive(),
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

export function readDocumentRecordViews(
  content: Record<string, unknown> | undefined,
): NativeRecordView[] {
  const parsed = documentOutputContentSchema.safeParse(content);

  return parsed.success ? parsed.data.recordViews : [];
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
  recordViews: NativeRecordView[] = [],
): DocumentOutputContent {
  const statistics = deriveDocumentStatistics(body);

  return {
    format: "markdown",
    body,
    metadata: { ...metadata, ...statistics },
    recordViews,
  };
}

export function documentExportFilename(title: string): string {
  return `${slugify(title, 80) || "document"}.md`;
}
