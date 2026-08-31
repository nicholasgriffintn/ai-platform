import { z } from "zod/v4";

import { ocrSchema } from "./ocr";

export const MAX_OCR_BATCH_REQUESTS = 25;

export const ocrBatchRequestItemSchema = z
  .object({
    document: ocrSchema.shape.document,
    pages: ocrSchema.shape.pages,
    include_image_base64: ocrSchema.shape.include_image_base64,
    image_limit: ocrSchema.shape.image_limit,
    image_min_size: ocrSchema.shape.image_min_size,
    include_blocks: ocrSchema.shape.include_blocks,
    confidence_scores_granularity: ocrSchema.shape.confidence_scores_granularity,
    table_format: ocrSchema.shape.table_format,
    extract_header: ocrSchema.shape.extract_header,
    extract_footer: ocrSchema.shape.extract_footer,
    document_annotation_format: ocrSchema.shape.document_annotation_format,
    bbox_annotation_format: ocrSchema.shape.bbox_annotation_format,
    document_annotation_prompt: ocrSchema.shape.document_annotation_prompt,
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

export const ocrBatchStartRequestSchema = z
  .object({
    title: z.string().trim().min(1).max(200).prefault("OCR batch"),
    model: z.enum(["mistral-ocr-latest", "mistral-ocr-4-1"]).prefault("mistral-ocr-latest"),
    requests: z.array(ocrBatchRequestItemSchema).min(1).max(MAX_OCR_BATCH_REQUESTS),
  })
  .strict();

export const ocrBatchStartResponseSchema = z
  .object({
    outputId: z.string().min(1),
    status: z.literal("pending"),
  })
  .strict();

export const ocrBatchCancelResponseSchema = z
  .object({
    outputId: z.string().min(1),
    status: z.enum(["cancellation_requested", "cancelled"]),
  })
  .strict();

export type OcrBatchRequestItem = z.infer<typeof ocrBatchRequestItemSchema>;
export type OcrBatchStartRequest = z.infer<typeof ocrBatchStartRequestSchema>;
