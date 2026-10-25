import z from "zod/v4";

export const DECK_OUTPUT_KIND = "deck";
export const DECK_WRITE_TOOL_NAME = "write_deck";
export const DECK_CAPABILITY_ID = "deck-writer";

export const SHEET_OUTPUT_KIND = "sheet";
export const SHEET_WRITE_TOOL_NAME = "write_sheet";
export const SHEET_CAPABILITY_ID = "sheet-writer";

export const DECK_MAX_SLIDES = 60;
export const SHEET_MAX_TABLES = 10;
export const SHEET_MAX_COLUMNS = 40;
export const SHEET_MAX_ROWS = 2_000;

export const deckSlideLayoutSchema = z.enum(["title", "section", "content", "two_column", "quote"]);

export const deckSlideSchema = z
  .object({
    layout: deckSlideLayoutSchema
      .default("content")
      .describe(
        "title opens the deck, section introduces a part, content carries points, two_column compares, quote features one line.",
      ),
    title: z.string().trim().min(1).describe("The slide headline, as a statement."),
    subtitle: z.string().trim().optional(),
    bullets: z
      .array(z.string().trim().min(1))
      .max(8)
      .default([])
      .describe("Short points, one idea each. Keep to five or fewer."),
    body: z
      .string()
      .optional()
      .describe("Optional Markdown for the slide when bullets are not enough."),
    columns: z
      .array(z.string())
      .length(2)
      .optional()
      .describe("Left and right Markdown for two_column slides."),
    notes: z.string().optional().describe("Speaker notes, not shown on the slide."),
  })
  .strict();

export const deckOutputContentSchema = z
  .object({
    format: z.literal("slides"),
    slides: z.array(deckSlideSchema).min(1).max(DECK_MAX_SLIDES),
  })
  .strict();

const columnKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .regex(/^[a-z][a-z0-9_]*$/, "Column keys are lowercase snake_case");

export const sheetColumnTypeSchema = z.enum([
  "text",
  "number",
  "currency",
  "percent",
  "date",
  "boolean",
]);

export const sheetColumnSchema = z
  .object({
    key: columnKeySchema,
    label: z.string().trim().min(1),
    type: sheetColumnTypeSchema.default("text"),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .optional()
      .describe("ISO 4217 code for currency columns, such as GBP."),
  })
  .strict();

export const sheetCellSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const sheetTableSchema = z
  .object({
    name: z.string().trim().min(1),
    columns: z.array(sheetColumnSchema).min(1).max(SHEET_MAX_COLUMNS),
    rows: z.array(z.record(columnKeySchema, sheetCellSchema)).max(SHEET_MAX_ROWS).default([]),
  })
  .strict()
  .superRefine((table, context) => {
    const keys = new Set(table.columns.map((column) => column.key));

    if (keys.size !== table.columns.length) {
      context.addIssue({
        code: "custom",
        path: ["columns"],
        message: "Column keys must be unique",
      });
    }

    table.rows.forEach((row, index) => {
      const unknown = Object.keys(row).find((key) => !keys.has(key));

      if (unknown) {
        context.addIssue({
          code: "custom",
          path: ["rows", index, unknown],
          message: `Row ${index + 1} uses ${unknown}, which is not a column`,
        });
      }
    });
  });

export const sheetOutputContentSchema = z
  .object({
    format: z.literal("tables"),
    tables: z.array(sheetTableSchema).min(1).max(SHEET_MAX_TABLES),
  })
  .strict();

const revisionFields = {
  title: z.string().trim().min(1).describe("What the file is called, as the reader would name it."),
  outputId: z
    .string()
    .min(1)
    .optional()
    .describe("Revise this file instead of writing a new one. Omit to write a new one."),
  expectedRevision: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("The revision you read before editing. Required when revising."),
  projectId: z
    .string()
    .min(1)
    .optional()
    .describe("Project the file belongs to. Omit for a personal file."),
};

function requireRevisionWhenEditing(
  input: { outputId?: string; expectedRevision?: number },
  context: z.RefinementCtx,
) {
  if (input.outputId && input.expectedRevision === undefined) {
    context.addIssue({
      code: "custom",
      path: ["expectedRevision"],
      message: "Pass the revision you read before editing this file",
    });
  }
}

export const writeDeckInputSchema = z
  .object({
    ...revisionFields,
    slides: deckOutputContentSchema.shape.slides,
  })
  .superRefine(requireRevisionWhenEditing);

export const writeSheetInputSchema = z
  .object({
    ...revisionFields,
    tables: sheetOutputContentSchema.shape.tables,
  })
  .superRefine(requireRevisionWhenEditing);

export type DeckSlideLayout = z.infer<typeof deckSlideLayoutSchema>;
export type DeckSlide = z.infer<typeof deckSlideSchema>;
export type DeckOutputContent = z.infer<typeof deckOutputContentSchema>;
export type SheetColumnType = z.infer<typeof sheetColumnTypeSchema>;
export type SheetColumn = z.infer<typeof sheetColumnSchema>;
export type SheetCell = z.infer<typeof sheetCellSchema>;
export type SheetTable = z.infer<typeof sheetTableSchema>;
export type SheetOutputContent = z.infer<typeof sheetOutputContentSchema>;
export type WriteDeckInput = z.infer<typeof writeDeckInputSchema>;
export type WriteSheetInput = z.infer<typeof writeSheetInputSchema>;
