import {
  DEFAULT_OCR_MODEL,
  DEFAULT_OCR_PROVIDER,
} from "~/lib/providers/capabilities/ocr/constants";

import { jsonSchemaToZod } from "../../../utils/jsonSchema";
import type { FunctionToolDescriptor } from "./types";

export const annotationFormat = {
  type: "object",
  properties: {
    type: { type: "string", const: "json_schema" },
    json_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        strict: { type: "boolean" },
        schema: { type: "object", additionalProperties: true },
      },
      required: ["name", "schema"],
    },
  },
  required: ["type", "json_schema"],
} as const;

export const extract_text_from_document: FunctionToolDescriptor = {
  name: "extract_text_from_document",
  description:
    "Extract text and structure from a PDF or image with OCR. Accepts public URLs or private Polychat Source/Output IDs and returns immediately usable text plus a private full result.",
  inputSchema: jsonSchemaToZod({
    type: "object",
    properties: {
      document_url: { type: "string", description: "Public HTTP(S) PDF URL" },
      image_url: { type: "string", description: "Public HTTP(S) image URL or image data URL" },
      source_id: { type: "string", description: "Private Polychat Source file ID" },
      output_id: { type: "string", description: "Private Polychat Output file ID" },
      document_name: { type: "string", description: "Optional source filename" },
      model: {
        type: "string",
        description: "OCR model",
        enum: [DEFAULT_OCR_MODEL, "mistral-ocr-4-1"],
        default: DEFAULT_OCR_MODEL,
      },
      provider: {
        type: "string",
        description: "OCR provider",
        enum: [DEFAULT_OCR_PROVIDER],
        default: DEFAULT_OCR_PROVIDER,
      },
      pages: {
        description: "Zero-based pages as an integer list or comma-separated ranges such as 0-2,4",
        anyOf: [
          { type: "array", items: { type: "integer", minimum: 0 }, minItems: 1, maxItems: 1000 },
          { type: "string", pattern: "^\\d+(?:-\\d+)?(?:,\\d+(?:-\\d+)?)*$" },
        ],
      },
      include_image_base64: {
        type: "boolean",
        description: "Include extracted images as base64. Defaults to false",
        default: false,
      },
      image_limit: { type: "integer", minimum: 0, maximum: 1000 },
      image_min_size: { type: "integer", minimum: 0, maximum: 100000 },
      include_blocks: { type: "boolean", description: "Include OCR 4 structured blocks" },
      confidence_scores_granularity: {
        type: "string",
        enum: ["page", "block", "word"],
      },
      table_format: { type: "string", enum: ["markdown", "html"] },
      extract_header: { type: "boolean" },
      extract_footer: { type: "boolean" },
      document_annotation_format: annotationFormat,
      bbox_annotation_format: annotationFormat,
      document_annotation_prompt: { type: "string", maxLength: 16384 },
      output_format: {
        type: "string",
        enum: ["json", "html", "markdown"],
        default: "markdown",
      },
    },
    anyOf: [
      { required: ["document_url"] },
      { required: ["image_url"] },
      { required: ["source_id"] },
      { required: ["output_id"] },
    ],
  }),
  type: "byok",
  permissions: ["read"],
};
