import { slugify } from "@ngriffin_uk/polychat-utility-core";
import z from "zod/v4";

export const DOCUMENT_OUTPUT_KIND = "document";
export const DOCUMENT_WRITE_TOOL_NAME = "write_document";
export const DOCUMENT_CAPABILITY_ID = "document-writer";

export const DOCUMENT_MAX_BODY = 200 * 1024;

export const documentOutputContentSchema = z.object({
  format: z.literal("markdown"),
  body: z.string().max(DOCUMENT_MAX_BODY),
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

export type DocumentOutputContent = z.infer<typeof documentOutputContentSchema>;
export type WriteDocumentInput = z.infer<typeof writeDocumentInputSchema>;

export function readDocumentBody(content: Record<string, unknown> | undefined): string | null {
  const parsed = documentOutputContentSchema.safeParse(content);

  return parsed.success ? parsed.data.body : null;
}

export function documentExportFilename(title: string): string {
  return `${slugify(title, 80) || "document"}.md`;
}
