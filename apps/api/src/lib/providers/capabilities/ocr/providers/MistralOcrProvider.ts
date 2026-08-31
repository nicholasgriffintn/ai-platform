import { createServiceContext } from "~/lib/context/serviceContext";
import { fetchAIResponse } from "~/lib/providers/lib/fetch";
import { resolveModelConfig } from "~/lib/providers/models";
import { resolveProviderApiKey } from "~/lib/providers/utils/apiKeys";
import { formatProviderError } from "~/lib/providers/utils/errors";
import { getAiGatewayMetadataHeaders } from "~/utils/aiGateway";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";

import { requireOcrAccess } from "../access";
import { DEFAULT_OCR_MODEL } from "../constants";
import {
  buildOcrMarkdown,
  getOcrResponseModel,
  normaliseOcrResponse,
  persistOcrOutput,
  type OcrApiResponse,
} from "../format";
import type {
  OcrConfidenceGranularity,
  OcrDocument,
  OcrExtractionRequest,
  OcrExtractionResult,
  OcrJsonSchemaFormat,
  OcrProvider,
  OcrTableFormat,
} from "../types";

const logger = getLogger({ prefix: "lib/providers/ocr/mistral" });
const MAX_INLINE_OCR_TEXT_LENGTH = 20_000;
const MAX_OCR_RESPONSE_BYTES = 20 * 1024 * 1024;

interface MistralOcrPayload {
  model: string;
  document: OcrDocument;
  pages?: number[] | string;
  include_image_base64?: boolean;
  image_limit?: number;
  image_min_size?: number;
  include_blocks?: boolean;
  confidence_scores_granularity?: OcrConfidenceGranularity;
  table_format?: OcrTableFormat;
  extract_header?: boolean;
  extract_footer?: boolean;
  document_annotation_format?: OcrJsonSchemaFormat;
  document_annotation_prompt?: string;
  bbox_annotation_format?: OcrJsonSchemaFormat;
}

export class MistralOcrProvider implements OcrProvider {
  name = "mistral";
  models = [DEFAULT_OCR_MODEL, "mistral-ocr-4-1"];

  async extractText(request: OcrExtractionRequest): Promise<OcrExtractionResult> {
    try {
      this.validateRequest(request);
      await requireOcrAccess({ env: request.env, user: request.user, providerName: this.name });

      const modelConfig = await resolveModelConfig(
        request.model ?? DEFAULT_OCR_MODEL,
        request.env,
        this.name,
        request.user?.id,
      );

      if (!modelConfig.strengths?.includes("ocr")) {
        throw new AssistantError(
          `Model ${modelConfig.name ?? modelConfig.matchingModel} is not configured for OCR`,
          ErrorType.CONFIGURATION_ERROR,
        );
      }

      const requestId = request.id || generateId();
      const response = await this.createOcrResponse(
        request,
        this.buildPayload(request, modelConfig.matchingModel),
        requestId,
        modelConfig.timeout,
      );

      if (!request.user?.id) {
        throw new AssistantError("User data required", ErrorType.AUTHENTICATION_ERROR);
      }

      const outputFormat = request.output_format ?? "markdown";
      const asset = await persistOcrOutput({
        requestId,
        response,
        outputFormat,
        context: createServiceContext({ env: request.env, user: request.user }),
        ownerUserId: request.user.id,
        projectId: request.projectId,
        conversationId: request.conversationId,
        parentOutputId: request.parentOutputId,
      });

      return {
        model: getOcrResponseModel(response) ?? modelConfig.matchingModel,
        ...asset,
        extractedText: buildOcrMarkdown(response).slice(0, MAX_INLINE_OCR_TEXT_LENGTH),
        response: normaliseOcrResponse(response),
      };
    } catch (error) {
      logger.error("Mistral OCR error:", { error });

      if (error instanceof AssistantError) {
        throw error;
      }

      throw new AssistantError(
        await formatProviderError(error, "Mistral OCR error"),
        ErrorType.EXTERNAL_API_ERROR,
      );
    }
  }

  private validateRequest(request: OcrExtractionRequest): void {
    if (!request.document) {
      throw new AssistantError("Document is required", ErrorType.PARAMS_ERROR);
    }

    this.validateDocument(request.document);
    this.validatePages(request.pages);
    this.validateOptionalInteger(request.image_limit, "image_limit");
    this.validateOptionalInteger(request.image_min_size, "image_min_size");

    if (request.document_annotation_prompt && !request.document_annotation_format) {
      throw new AssistantError(
        "document_annotation_prompt requires document_annotation_format",
        ErrorType.PARAMS_ERROR,
      );
    }
  }

  private validateDocument(document: OcrDocument): void {
    if (document.type === "file") {
      if (!document.file_id.trim()) {
        throw new AssistantError("file_id is required", ErrorType.PARAMS_ERROR);
      }

      return;
    }

    const url = document.type === "image_url" ? document.image_url : document.document_url;
    const label = document.type === "image_url" ? "image_url" : "document_url";

    if (!url) {
      throw new AssistantError(`${label} is required`, ErrorType.PARAMS_ERROR);
    }

    this.validateAssetUrl(url, label);
  }

  private validateAssetUrl(url: string, label: "document_url" | "image_url"): void {
    try {
      const parsedUrl = new URL(url);

      if (
        parsedUrl.protocol === "http:" ||
        parsedUrl.protocol === "https:" ||
        parsedUrl.protocol === "data:"
      ) {
        return;
      }
    } catch {
      // The error below keeps the public validation message stable.
    }

    throw new AssistantError(
      `${label} must be an HTTP, HTTPS, or data URL`,
      ErrorType.PARAMS_ERROR,
    );
  }

  private validatePages(pages: number[] | string | undefined): void {
    if (pages === undefined) {
      return;
    }

    if (Array.isArray(pages)) {
      if (pages.every((value) => Number.isInteger(value) && value >= 0)) {
        return;
      }

      throw new AssistantError("pages must contain non-negative integers", ErrorType.PARAMS_ERROR);
    }

    if (!/^\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*$/.test(pages)) {
      throw new AssistantError(
        "pages must be comma-separated page numbers or ranges",
        ErrorType.PARAMS_ERROR,
      );
    }
  }

  private validateOptionalInteger(value: number | undefined, label: string): void {
    if (value === undefined) {
      return;
    }

    if (!Number.isInteger(value) || value < 0) {
      throw new AssistantError(`${label} must be a non-negative integer`, ErrorType.PARAMS_ERROR);
    }
  }

  private buildPayload(request: OcrExtractionRequest, model: string): MistralOcrPayload {
    return {
      model,
      document: request.document,
      include_image_base64: request.include_image_base64 ?? false,
      ...(request.pages ? { pages: request.pages } : {}),
      ...(request.image_limit !== undefined ? { image_limit: request.image_limit } : {}),
      ...(request.image_min_size !== undefined ? { image_min_size: request.image_min_size } : {}),
      ...(request.include_blocks !== undefined ? { include_blocks: request.include_blocks } : {}),
      ...(request.confidence_scores_granularity
        ? { confidence_scores_granularity: request.confidence_scores_granularity }
        : {}),
      ...(request.table_format ? { table_format: request.table_format } : {}),
      ...(request.extract_header !== undefined ? { extract_header: request.extract_header } : {}),
      ...(request.extract_footer !== undefined ? { extract_footer: request.extract_footer } : {}),
      ...(request.document_annotation_format
        ? { document_annotation_format: request.document_annotation_format }
        : {}),
      ...(request.document_annotation_prompt
        ? { document_annotation_prompt: request.document_annotation_prompt }
        : {}),
      ...(request.bbox_annotation_format
        ? { bbox_annotation_format: request.bbox_annotation_format }
        : {}),
    };
  }

  private async buildHeaders(
    request: OcrExtractionRequest,
    requestId: string,
  ): Promise<Record<string, string>> {
    if (!request.env.AI_GATEWAY_TOKEN) {
      throw new AssistantError("Missing AI_GATEWAY_TOKEN", ErrorType.CONFIGURATION_ERROR);
    }

    const apiKey = await resolveProviderApiKey({
      env: request.env,
      providerName: this.name,
      envKeyName: "MISTRAL_API_KEY",
      userId: request.user?.id,
      logger,
    });

    return {
      "cf-aig-authorization": request.env.AI_GATEWAY_TOKEN,
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "cf-aig-metadata": JSON.stringify({
        ...getAiGatewayMetadataHeaders({
          user: request.user,
          completion_id: requestId,
        }),
        provider: this.name,
        feature: "ocr",
      }),
    };
  }

  private async createOcrResponse(
    request: OcrExtractionRequest,
    payload: MistralOcrPayload,
    requestId: string,
    timeout?: number,
  ): Promise<OcrApiResponse> {
    const headers = await this.buildHeaders(request, requestId);

    return fetchAIResponse<OcrApiResponse>(
      false,
      this.name,
      "v1/ocr",
      headers,
      payload,
      request.env,
      {
        requestTimeout: timeout ?? 100000,
        retryDelay: 500,
        maxAttempts: 2,
        backoff: "exponential",
        responseType: "json",
        maxResponseBytes: MAX_OCR_RESPONSE_BYTES,
      },
    );
  }
}
