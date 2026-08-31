import type { OcrInput, OcrRequest } from "@ngriffin_uk/polychat-schemas";

import { resolveServiceContext } from "~/lib/context/serviceContext";
import { DEFAULT_OCR_PROVIDER } from "~/lib/providers/capabilities/ocr/constants";
import { performOcr } from "~/services/apps/retrieval/ocr";
import { resolveRequestProjectId } from "~/services/functions/request-context";

import type { ApiToolDefinition } from "../../types/functions";
import { extract_text_from_document as extract_text_from_documentDescriptor } from "./definitions/ocr";

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

export const extract_text_from_document: ApiToolDefinition = {
  ...extract_text_from_documentDescriptor,
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
