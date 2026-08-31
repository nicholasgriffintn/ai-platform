import type { OcrInput, OcrRequest } from "@ngriffin_uk/polychat-schemas";

import { resolveServiceContext } from "~/lib/context/serviceContext";
import {
  DEFAULT_OCR_MODEL,
  DEFAULT_OCR_PROVIDER,
} from "~/lib/providers/capabilities/ocr/constants";
import { performOcr } from "~/services/apps/retrieval/ocr";
import { resolveRequestProjectId } from "~/services/functions/request-context";

import type { ApiToolDefinition } from "../../types/functions";
import { jsonSchemaToZod } from "../../utils/jsonSchema";

function resolveToolInput(args: Record<string, any>): OcrInput {
  const inputs = [args.document_url, args.image_url, args.source_id, args.output_id].filter(
    (value) => typeof value === "string" && value.trim(),
  );

  if (inputs.length !== 1) {
    throw new Error("Provide exactly one document_url, image_url, source_id, or output_id");
  }

  if (args.source_id) {
    return { type: "source", source_id: args.source_id };
  }

  if (args.output_id) {
    return { type: "output", output_id: args.output_id };
  }

  if (args.image_url) {
    return {
      type: "image_url",
      image_url: args.image_url,
    };
  }

  return {
    type: "document_url",
    document_url: args.document_url,
    document_name: args.document_name,
  };
}

const annotationFormat = {
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

export const extract_text_from_document: ApiToolDefinition = {
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
  costPerCall: 2,
  permissions: ["read"],
  execute: async (args, context) => {
    const request = context.request;
    const user = request.user;

    if (!user?.id) {
      throw new Error("OCR requires an authenticated user");
    }

    const serviceContext = resolveServiceContext({
      context: request.context,
      env: request.env,
      user,
    });
    const ocrRequest: OcrRequest = {
      document: resolveToolInput(args),
      provider: args.provider,
      model: args.model,
      pages: args.pages,
      include_image_base64: args.include_image_base64,
      image_limit: args.image_limit,
      image_min_size: args.image_min_size,
      include_blocks: args.include_blocks,
      confidence_scores_granularity: args.confidence_scores_granularity,
      table_format: args.table_format,
      extract_header: args.extract_header,
      extract_footer: args.extract_footer,
      document_annotation_format: args.document_annotation_format,
      bbox_annotation_format: args.bbox_annotation_format,
      document_annotation_prompt: args.document_annotation_prompt,
      output_format: args.output_format,
    };
    const provider = ocrRequest.provider ?? DEFAULT_OCR_PROVIDER;
    const response = await performOcr({
      context: serviceContext,
      userId: user.id,
      projectId: resolveRequestProjectId(request) ?? undefined,
      conversationId: request.request?.completion_id,
      request: ocrRequest,
    });
    const title = args.document_name || args.source_id || args.output_id || "document";
    const extractedText = response.extractedText.trim() || "No text was detected.";

    return {
      status: "success",
      name: "extract_text_from_document",
      content: `OCR completed for ${title}. Full result: [download](${response.url})\n\n${extractedText}`,
      data: {
        model: response.model,
        provider,
        outputId: response.outputId,
        url: response.url,
        key: response.key,
        outputFormat: response.outputFormat,
        usage: response.response.usage,
      },
      role: "tool",
    };
  },
};
