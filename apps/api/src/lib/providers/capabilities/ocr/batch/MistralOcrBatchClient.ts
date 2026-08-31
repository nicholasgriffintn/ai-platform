import { z } from "zod";

import { gatewayId } from "~/constants/app";
import { resolveProviderApiKey } from "~/lib/providers/utils/apiKeys";
import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { readResponseTextWithinLimit, ResponseBodyTooLargeError } from "~/utils/http";
import { safeParseJson } from "~/utils/json";
import { getLogger } from "~/utils/logger";
import { redactSensitiveTokens } from "~/utils/redaction";

import type { OcrConfidenceGranularity, OcrDocument, OcrTableFormat } from "../types";

const logger = getLogger({ prefix: "lib/providers/ocr/mistral-batch" });

export const MAX_OCR_BATCH_REQUESTS = 25;
export const MAX_OCR_BATCH_PAYLOAD_BYTES = 20 * 1024 * 1024;
export const MAX_OCR_BATCH_RESULT_BYTES = 20 * 1024 * 1024;
const MAX_OCR_BATCH_JOB_BYTES = 2 * 1024 * 1024;
const MAX_OCR_BATCH_ERROR_BYTES = 64 * 1024;
const OCR_BATCH_REQUEST_TIMEOUT_MS = 30_000;

export type MistralOcrBatchStatus =
  | "QUEUED"
  | "RUNNING"
  | "SUCCESS"
  | "FAILED"
  | "TIMEOUT_EXCEEDED"
  | "CANCELLATION_REQUESTED"
  | "CANCELLED";

export interface MistralOcrBatchRequestBody {
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
  document_annotation_format?: Record<string, unknown>;
  bbox_annotation_format?: Record<string, unknown>;
  document_annotation_prompt?: string;
}

export interface MistralOcrBatchRequest {
  customId: string;
  body: MistralOcrBatchRequestBody;
}

export interface MistralOcrBatchOutput {
  custom_id?: string;
  response?: {
    status_code?: number;
    body?: Record<string, unknown>;
  };
  error?: { message?: string } | null;
}

export interface MistralOcrBatchJob {
  id: string;
  status: MistralOcrBatchStatus;
  total_requests: number;
  completed_requests: number;
  succeeded_requests: number;
  failed_requests: number;
  output_file?: string | null;
  error_file?: string | null;
  outputs?: MistralOcrBatchOutput[] | null;
  errors?: Array<{ message?: string }>;
}

export interface OcrBatchProviderCleanupState {
  jobId: string;
  outputFileId?: string;
  errorFileId?: string;
}

export function getOcrBatchProviderCleanupState(
  content: Record<string, unknown>,
): OcrBatchProviderCleanupState | null {
  const value = content.providerCleanup;

  if (!value || typeof value !== "object" || !("jobId" in value)) {
    return null;
  }

  const state = value as Record<string, unknown>;

  if (typeof state.jobId !== "string" || !state.jobId) {
    return null;
  }

  return {
    jobId: state.jobId,
    ...(typeof state.outputFileId === "string" ? { outputFileId: state.outputFileId } : {}),
    ...(typeof state.errorFileId === "string" ? { errorFileId: state.errorFileId } : {}),
  };
}

export function withOcrBatchProviderCleanup(
  content: Record<string, unknown>,
  job: Pick<MistralOcrBatchJob, "id" | "output_file" | "error_file">,
): Record<string, unknown> {
  return {
    ...content,
    providerCleanup: {
      jobId: job.id,
      ...(job.output_file ? { outputFileId: job.output_file } : {}),
      ...(job.error_file ? { errorFileId: job.error_file } : {}),
    },
  };
}

export function withoutOcrBatchProviderCleanup(
  content: Record<string, unknown>,
): Record<string, unknown> {
  const { providerCleanup: _providerCleanup, ...rest } = content;

  return rest;
}

const mistralOcrBatchJobSchema = z.object({
  id: z.string().min(1),
  status: z.enum([
    "QUEUED",
    "RUNNING",
    "SUCCESS",
    "FAILED",
    "TIMEOUT_EXCEEDED",
    "CANCELLATION_REQUESTED",
    "CANCELLED",
  ]),
  total_requests: z.number().int().nonnegative(),
  completed_requests: z.number().int().nonnegative(),
  succeeded_requests: z.number().int().nonnegative(),
  failed_requests: z.number().int().nonnegative(),
  output_file: z.string().min(1).nullable().optional(),
  error_file: z.string().min(1).nullable().optional(),
  outputs: z
    .array(
      z.object({
        custom_id: z.string().optional(),
        response: z
          .object({
            status_code: z.number().int().optional(),
            body: z.record(z.string(), z.unknown()).optional(),
          })
          .optional(),
        error: z.object({ message: z.string().optional() }).nullable().optional(),
      }),
    )
    .nullable()
    .optional(),
  errors: z.array(z.object({ message: z.string().optional() })).optional(),
});

interface MistralBatchRequestContext {
  env: IEnv;
  user: IUser;
}

export interface OcrBatchClient {
  start(
    request: MistralBatchRequestContext & {
      model: string;
      requests: MistralOcrBatchRequest[];
      metadata?: Record<string, string>;
    },
  ): Promise<MistralOcrBatchJob>;
  get(request: MistralBatchRequestContext & { jobId: string }): Promise<MistralOcrBatchJob>;
  cancel(request: MistralBatchRequestContext & { jobId: string }): Promise<MistralOcrBatchJob>;
  downloadFile(
    request: MistralBatchRequestContext & { fileId: string; maxBytes?: number },
  ): Promise<string>;
  deleteJob(request: MistralBatchRequestContext & { jobId: string }): Promise<void>;
  deleteFile(request: MistralBatchRequestContext & { fileId: string }): Promise<void>;
}

export async function cleanupOcrBatchProviderResources(
  batchClient: OcrBatchClient,
  context: MistralBatchRequestContext,
  job: Pick<MistralOcrBatchJob, "id" | "output_file" | "error_file">,
): Promise<void> {
  const fileIds = [...new Set([job.output_file, job.error_file])].filter(
    (fileId): fileId is string => typeof fileId === "string" && Boolean(fileId),
  );

  // Keep the job until every referenced file is gone so a retry can rediscover their IDs.
  for (const fileId of fileIds) {
    // eslint-disable-next-line no-await-in-loop
    await batchClient.deleteFile({ ...context, fileId });
  }

  await batchClient.deleteJob({ ...context, jobId: job.id });
}

export class MistralOcrBatchClient implements OcrBatchClient {
  async start(
    request: MistralBatchRequestContext & {
      model: string;
      requests: MistralOcrBatchRequest[];
      metadata?: Record<string, string>;
    },
  ): Promise<MistralOcrBatchJob> {
    this.validateRequests(request.requests);
    const body = {
      endpoint: "/v1/ocr",
      model: request.model,
      requests: request.requests.map((item) => ({
        custom_id: item.customId,
        body: item.body,
      })),
      ...(request.metadata ? { metadata: request.metadata } : {}),
    };

    this.requirePayloadWithinLimit(body);

    return this.requestJson(request, "/v1/batch/jobs", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async get(request: MistralBatchRequestContext & { jobId: string }): Promise<MistralOcrBatchJob> {
    return this.requestJson(request, `/v1/batch/jobs/${encodeURIComponent(request.jobId)}`, {
      method: "GET",
    });
  }

  async cancel(
    request: MistralBatchRequestContext & { jobId: string },
  ): Promise<MistralOcrBatchJob> {
    return this.requestJson(request, `/v1/batch/jobs/${encodeURIComponent(request.jobId)}/cancel`, {
      method: "POST",
      body: "{}",
    });
  }

  async downloadFile(
    request: MistralBatchRequestContext & { fileId: string; maxBytes?: number },
  ): Promise<string> {
    const response = await this.request(
      request,
      `/v1/files/${encodeURIComponent(request.fileId)}/content`,
      {
        method: "GET",
      },
    );

    return readResponseTextWithinLimit(
      response,
      Math.min(request.maxBytes ?? MAX_OCR_BATCH_RESULT_BYTES, MAX_OCR_BATCH_RESULT_BYTES),
    );
  }

  async deleteJob(request: MistralBatchRequestContext & { jobId: string }): Promise<void> {
    await this.request(
      request,
      `/v1/batch/jobs/${encodeURIComponent(request.jobId)}`,
      {
        method: "DELETE",
      },
      true,
    );
  }

  async deleteFile(request: MistralBatchRequestContext & { fileId: string }): Promise<void> {
    await this.request(
      request,
      `/v1/files/${encodeURIComponent(request.fileId)}`,
      {
        method: "DELETE",
      },
      true,
    );
  }

  private validateRequests(requests: MistralOcrBatchRequest[]): void {
    if (requests.length === 0 || requests.length > MAX_OCR_BATCH_REQUESTS) {
      throw new AssistantError(
        `OCR batches must contain between 1 and ${MAX_OCR_BATCH_REQUESTS} requests`,
        ErrorType.PARAMS_ERROR,
        400,
      );
    }

    const customIds = new Set<string>();

    for (const request of requests) {
      if (!request.customId.trim() || customIds.has(request.customId)) {
        throw new AssistantError(
          "OCR batch request identifiers must be non-empty and unique",
          ErrorType.PARAMS_ERROR,
          400,
        );
      }

      customIds.add(request.customId);
    }
  }

  private requirePayloadWithinLimit(body: unknown): void {
    const byteSize = new TextEncoder().encode(JSON.stringify(body)).byteLength;

    if (byteSize > MAX_OCR_BATCH_PAYLOAD_BYTES) {
      throw new AssistantError(
        `OCR batch payload must be ${MAX_OCR_BATCH_PAYLOAD_BYTES} bytes or smaller`,
        ErrorType.PARAMS_ERROR,
        400,
      );
    }
  }

  private async requestJson(
    context: MistralBatchRequestContext,
    path: string,
    init: RequestInit,
  ): Promise<MistralOcrBatchJob> {
    const response = await this.request(context, path, init);

    try {
      const responseText = await readResponseTextWithinLimit(response, MAX_OCR_BATCH_JOB_BYTES);
      const parsed = safeParseJson<unknown>(responseText);

      if (parsed === null) {
        throw new SyntaxError("Response is not valid JSON");
      }

      return mistralOcrBatchJobSchema.parse(parsed);
    } catch {
      throw new AssistantError(
        "Mistral returned an invalid batch response",
        ErrorType.EXTERNAL_API_ERROR,
        502,
      );
    }
  }

  private async request(
    { env, user }: MistralBatchRequestContext,
    path: string,
    init: RequestInit,
    allowNotFound = false,
  ): Promise<Response> {
    if (!env.ACCOUNT_ID || !env.AI_GATEWAY_TOKEN) {
      throw new AssistantError(
        "Missing ACCOUNT_ID or AI_GATEWAY_TOKEN",
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    const apiKey = await resolveProviderApiKey({
      env,
      providerName: "mistral",
      envKeyName: "MISTRAL_API_KEY",
      userId: user.id,
      logger,
    });
    const url = `https://gateway.ai.cloudflare.com/v1/${env.ACCOUNT_ID}/${gatewayId}/mistral${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OCR_BATCH_REQUEST_TIMEOUT_MS);
    let response: Response;

    try {
      response = await fetch(url, {
        ...init,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${apiKey}`,
          "cf-aig-authorization": env.AI_GATEWAY_TOKEN,
          ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok && !(allowNotFound && response.status === 404)) {
      let responseText = "";

      try {
        responseText = await readResponseTextWithinLimit(response, MAX_OCR_BATCH_ERROR_BYTES);
      } catch (error) {
        if (!(error instanceof ResponseBodyTooLargeError)) {
          logger.warn("Failed to read bounded Mistral OCR batch error response", {
            error,
            status: response.status,
          });
        }
      }

      logger.warn("Mistral OCR batch request failed", {
        status: response.status,
        statusText: response.statusText,
        responseText: redactSensitiveTokens(responseText).slice(0, 1_000),
      });
      throw new AssistantError(
        "Mistral OCR batch request failed",
        ErrorType.EXTERNAL_API_ERROR,
        response.status,
      );
    }

    return response;
  }
}
