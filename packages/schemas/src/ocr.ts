import { z } from "zod/v4";

const MAX_ANNOTATION_SCHEMA_BYTES = 64 * 1024;
const MAX_ANNOTATION_PROMPT_LENGTH = 16_384;
const MAX_IMAGE_DATA_URL_LENGTH = 28 * 1024 * 1024;
const pageRangePattern = /^\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*$/;
const imageDataUrlPattern = /^data:image\/(?:avif|jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/i;

const publicDocumentSchema = z
  .object({
    type: z.literal("document_url"),
    document_url: z.url().refine((value) => /^https?:\/\//i.test(value), {
      error: "Document URL must use HTTP or HTTPS",
    }),
    document_name: z.string().trim().min(1).max(255).optional(),
  })
  .strict();

const publicImageSchema = z
  .object({
    type: z.literal("image_url"),
    image_url: z
      .string()
      .max(MAX_IMAGE_DATA_URL_LENGTH)
      .refine((value) => /^https?:\/\//i.test(value) || imageDataUrlPattern.test(value), {
        error: "Image URL must use HTTP, HTTPS, or a supported base64 image data URL",
      }),
  })
  .strict();

const privateSourceSchema = z
  .object({
    type: z.literal("source"),
    source_id: z.string().trim().min(1),
  })
  .strict();

const privateOutputSchema = z
  .object({
    type: z.literal("output"),
    output_id: z.string().trim().min(1),
  })
  .strict();

export const ocrInputSchema = z.discriminatedUnion("type", [
  publicDocumentSchema,
  publicImageSchema,
  privateSourceSchema,
  privateOutputSchema,
]);

const annotationFormatSchema = z
  .object({
    type: z.literal("json_schema"),
    json_schema: z
      .object({
        name: z.string().trim().min(1).max(128),
        strict: z.boolean().optional().prefault(true),
        schema: z.record(z.string(), z.unknown()),
      })
      .strict(),
  })
  .strict()
  .superRefine((value, context) => {
    if (new TextEncoder().encode(JSON.stringify(value)).byteLength > MAX_ANNOTATION_SCHEMA_BYTES) {
      context.addIssue({
        code: "custom",
        message: "Annotation schema must be 64 KiB or smaller",
      });
    }
  });

export const ocrSchema = z
  .object({
    provider: z.enum(["mistral"]).optional(),
    model: z.enum(["mistral-ocr-latest", "mistral-ocr-4-1"]).optional(),
    document: ocrInputSchema,
    pages: z
      .union([
        z.array(z.number().int().nonnegative()).min(1).max(1_000),
        z
          .string()
          .regex(pageRangePattern, "Pages must be a comma-separated list of pages or ranges"),
      ])
      .optional(),
    include_image_base64: z.boolean().optional(),
    image_limit: z.number().int().nonnegative().max(1_000).optional(),
    image_min_size: z.number().int().nonnegative().max(100_000).optional(),
    include_blocks: z.boolean().optional(),
    confidence_scores_granularity: z.enum(["page", "block", "word"]).optional(),
    table_format: z.enum(["markdown", "html"]).optional(),
    extract_header: z.boolean().optional(),
    extract_footer: z.boolean().optional(),
    document_annotation_format: annotationFormatSchema.optional(),
    bbox_annotation_format: annotationFormatSchema.optional(),
    document_annotation_prompt: z.string().max(MAX_ANNOTATION_PROMPT_LENGTH).optional(),
    output_format: z.enum(["json", "html", "markdown"]).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.document_annotation_prompt && !value.document_annotation_format) {
      context.addIssue({
        code: "custom",
        path: ["document_annotation_format"],
        message: "Document annotation format is required when a prompt is provided",
      });
    }
  });

const ocrBoundingBoxSchema = z.object({
  topLeftX: z.number().nullable(),
  topLeftY: z.number().nullable(),
  bottomRightX: z.number().nullable(),
  bottomRightY: z.number().nullable(),
});

const ocrWordConfidenceSchema = z.object({
  text: z.string(),
  confidence: z.number(),
  startIndex: z.number(),
});

export const ocrNormalisedResponseSchema = z.object({
  model: z.string(),
  pages: z.array(
    z.object({
      index: z.number().int().nonnegative(),
      markdown: z.string(),
      images: z.array(
        z.object({
          id: z.string(),
          boundingBox: ocrBoundingBoxSchema,
          base64: z.string().nullable().optional(),
          annotation: z.string().nullable().optional(),
        }),
      ),
      tables: z.array(
        z.object({
          id: z.string(),
          content: z.string(),
          format: z.enum(["markdown", "html"]),
          wordConfidenceScores: z.array(ocrWordConfidenceSchema).nullable().optional(),
        }),
      ),
      hyperlinks: z.array(z.string()),
      header: z.string().nullable().optional(),
      footer: z.string().nullable().optional(),
      dimensions: z
        .object({ dpi: z.number(), height: z.number(), width: z.number() })
        .nullable()
        .optional(),
      confidenceScores: z
        .object({
          averagePageConfidenceScore: z.number(),
          minimumPageConfidenceScore: z.number(),
          wordConfidenceScores: z.array(ocrWordConfidenceSchema),
        })
        .nullable()
        .optional(),
      blocks: z
        .array(
          z.object({
            type: z.enum([
              "text",
              "title",
              "list",
              "table",
              "image",
              "equation",
              "caption",
              "code",
              "references",
              "aside_text",
              "header",
              "footer",
              "signature",
            ]),
            boundingBox: ocrBoundingBoxSchema,
            content: z.string(),
            confidenceScores: z
              .object({
                averageContentConfidenceScore: z.number().nullable(),
                minimumContentConfidenceScore: z.number().nullable(),
                blockTypeConfidenceScore: z.number().nullable(),
              })
              .nullable()
              .optional(),
            imageId: z.string().optional(),
            tableId: z.string().nullable().optional(),
          }),
        )
        .nullable()
        .optional(),
    }),
  ),
  documentAnnotation: z.string().nullable().optional(),
  usage: z.object({
    pagesProcessed: z.number().int().nonnegative(),
    documentSizeBytes: z.number().int().nonnegative().nullable().optional(),
  }),
});

export const ocrResultSchema = z.object({
  model: z.string(),
  outputId: z.string(),
  key: z.string(),
  url: z.string(),
  outputFormat: z.enum(["json", "html", "markdown", "text"]),
  extractedText: z.string(),
  response: ocrNormalisedResponseSchema,
});

export type OcrRequest = z.infer<typeof ocrSchema>;
export type OcrInput = z.infer<typeof ocrInputSchema>;
export type OcrResult = z.infer<typeof ocrResultSchema>;
