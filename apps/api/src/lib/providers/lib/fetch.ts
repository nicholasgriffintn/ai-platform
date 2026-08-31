import { gatewayId } from "~/constants/app";
import { listFunctionTools } from "~/services/functions";
import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import {
  readHttpResponseBody,
  readResponseTextWithinLimit,
  ResponseBodyTooLargeError,
  setDefaultHeader,
} from "~/utils/http";
import { safeParseJson } from "~/utils/json";
import { getLogger } from "~/utils/logger";
import { omitUndefinedValues } from "~/utils/objects";
import {
  buildProviderResponseErrorDetails,
  getProviderErrorMessage,
  getProviderResponseErrorMessage,
  isProviderRateLimit,
} from "~/utils/providerErrors";
import { redactSensitiveTokens } from "~/utils/redaction";
import { detectStreaming } from "~/utils/streaming";
import { appendUrlPath } from "~/utils/urls";

const logger = getLogger({ prefix: "lib/providers/fetch" });

const DEFAULT_REQUEST_TIMEOUT_MS = 100000;
const MAX_PROVIDER_ERROR_BODY_BYTES = 64 * 1024;

export interface FetchAIResponseOptions {
  requestTimeout?: number;
  retryDelay?: number;
  maxAttempts?: number;
  backoff?: "exponential" | "linear";
  responseType?: "json" | "raw";
  maxResponseBytes?: number;
}

export interface FetchProviderJsonOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  apiKey?: string;
  allowNullResponse?: boolean;
}

function getAiGatewayRequestHeaders(
  headers: Record<string, string>,
  options: FetchAIResponseOptions,
): Record<string, string> {
  return omitUndefinedValues({
    ...headers,
    "cf-aig-request-timeout": options.requestTimeout?.toString(),
    "cf-aig-max-attempts": options.maxAttempts?.toString(),
    "cf-aig-retry-delay": options.retryDelay?.toString(),
    "cf-aig-backoff": options.backoff,
  });
}

export async function fetchAIResponse<
  T = {
    [key: string]: any;
    eventId?: string;
    log_id?: string;
    cacheStatus?: string;
  },
>(
  isOpenAiCompatible: boolean,
  provider: string,
  endpointOrUrl: string,
  headers: Record<string, string>,
  body: Record<string, any> | FormData,
  env?: IEnv,
  options: FetchAIResponseOptions = {
    requestTimeout: 100000,
    retryDelay: 500,
    maxAttempts: 2,
    backoff: "exponential",
    responseType: "json",
  },
): Promise<T> {
  const isUrl = endpointOrUrl.startsWith("http");

  const isFormData = body instanceof FormData;
  const isStreaming = isFormData ? false : detectStreaming(body, endpointOrUrl);

  const tools = provider === "tool-use" ? listFunctionTools() : undefined;
  const bodyWithTools = isFormData ? body : tools ? { ...body, tools } : body;
  const requestBody = isFormData ? bodyWithTools : omitUndefinedValues(bodyWithTools);

  let response: Response;

  /**
   * Bounds how long we wait for response headers without capping the stream
   * that follows, so a provider that accepts the connection and then goes
   * quiet cannot hold a turn (and its conversation lock) open indefinitely.
   */
  const controller = new AbortController();
  const headersTimeout = setTimeout(
    () => controller.abort(),
    options.requestTimeout ?? DEFAULT_REQUEST_TIMEOUT_MS,
  );

  try {
    if (!isUrl) {
      if (isFormData) {
        throw new AssistantError(
          "FormData requests are not supported through Cloudflare AI Gateway. Use direct URL endpoints for image edits.",
          ErrorType.PARAMS_ERROR,
        );
      }

      if (!env?.AI) {
        throw new AssistantError(
          "AI binding is required to fetch gateway responses",
          ErrorType.PARAMS_ERROR,
        );
      }

      const gateway = env.AI.gateway(gatewayId);

      const providerName = isOpenAiCompatible ? "compat" : provider;
      const providerBaseUrl = await gateway.getUrl(providerName);

      response = await fetch(appendUrlPath(providerBaseUrl, endpointOrUrl), {
        method: "POST",
        headers: getAiGatewayRequestHeaders(headers, options),
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
    } else {
      response = await fetch(endpointOrUrl, {
        method: "POST",
        headers,
        body: isFormData ? (requestBody as FormData) : JSON.stringify(requestBody),
        signal: controller.signal,
      });
    }
  } finally {
    clearTimeout(headersTimeout);
  }

  const requestId =
    response.headers.get("x-request-id") ??
    response.headers.get("request-id") ??
    response.headers.get("cf-aig-event-id") ??
    undefined;

  if (!response.ok) {
    let responseText: string;

    try {
      responseText = await readResponseTextWithinLimit(response, MAX_PROVIDER_ERROR_BODY_BYTES);
    } catch (textError) {
      if (textError instanceof ResponseBodyTooLargeError) {
        responseText = "[provider error body exceeded limit]";
      } else {
        logger.error(`Failed to read response body for ${provider} from ${endpointOrUrl}:`, {
          error: textError,
          status: response.status,
          statusText: response.statusText,
        });
        throw new AssistantError(
          `Failed to get response for ${provider} from ${endpointOrUrl}: ${response.statusText}`,
          ErrorType.PROVIDER_ERROR,
          response.status,
          { requestId },
        );
      }
    }

    const errorDetails = buildProviderResponseErrorDetails({
      provider,
      endpoint: endpointOrUrl,
      status: response.status,
      statusText: response.statusText,
      requestId,
      responseText,
    });

    logger.error(`Failed to get response for ${provider} from ${endpointOrUrl}`, errorDetails);

    if (isProviderRateLimit(response.status, errorDetails.responseJson)) {
      throw new AssistantError(
        getProviderErrorMessage(errorDetails.responseJson) || "Rate limit exceeded",
        ErrorType.RATE_LIMIT_ERROR,
        response.status,
        {
          ...errorDetails,
          upstreamStatus: errorDetails.responseJson?.raw_status_code ?? response.status,
        },
      );
    }

    throw new AssistantError(
      getProviderResponseErrorMessage(errorDetails),
      ErrorType.PROVIDER_ERROR,
      response.status,
      errorDetails,
    );
  }

  if (isStreaming) {
    return response.body as unknown as T;
  }

  if (options.responseType === "raw") {
    return response as unknown as T;
  }

  let data: Record<string, any>;
  let boundedResponseText: string | undefined;
  const responseForLogging = options.maxResponseBytes ? undefined : response.clone();

  try {
    if (options.maxResponseBytes) {
      boundedResponseText = await readResponseTextWithinLimit(response, options.maxResponseBytes);
      const parsed = safeParseJson<Record<string, any>>(boundedResponseText);

      if (!parsed) {
        throw new SyntaxError("Response is not a JSON object");
      }

      data = parsed;
    } else {
      data = (await response.json()) as Record<string, any>;
    }
  } catch (jsonError) {
    if (jsonError instanceof ResponseBodyTooLargeError) {
      throw new AssistantError(
        `${provider} returned a response larger than the configured limit`,
        ErrorType.PROVIDER_ERROR,
        502,
        { requestId },
      );
    }

    let responseText = boundedResponseText ?? "[unavailable]";

    if (responseForLogging) {
      try {
        responseText = await readResponseTextWithinLimit(
          responseForLogging,
          MAX_PROVIDER_ERROR_BODY_BYTES,
        );
      } catch {
        // Ignore secondary body read errors in logging path.
      }
    }

    logger.error(`Failed to parse JSON response from ${provider}`, {
      error: jsonError,
      responseText: redactSensitiveTokens(responseText.substring(0, 200)),
    });
    throw new AssistantError(
      `${provider} returned invalid JSON response: ${jsonError instanceof Error ? jsonError.message : "Unknown JSON parse error"}`,
      ErrorType.PROVIDER_ERROR,
      502,
      { requestId },
    );
  }

  const eventId = response.headers.get("cf-aig-event-id");
  const log_id = response.headers.get("cf-aig-log-id");
  const cacheStatus = response.headers.get("cf-aig-cache-status");

  return { ...data, eventId, log_id, cacheStatus } as T;
}

export async function fetchProviderJson<T>(
  provider: string,
  url: string,
  options: FetchProviderJsonOptions = {},
): Promise<T> {
  const headers = { ...options.headers };

  setDefaultHeader(headers, "Accept", "application/json");

  if (options.apiKey) {
    setDefaultHeader(headers, "Authorization", `Bearer ${options.apiKey}`);
  }

  if (options.body !== undefined) {
    setDefaultHeader(headers, "Content-Type", "application/json");
  }

  const response = await fetch(url, {
    method: options.method ?? "POST",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const responseBody = await readHttpResponseBody(response);

  if (!response.ok) {
    const errorDetails = buildProviderResponseErrorDetails({
      provider,
      endpoint: url,
      status: response.status,
      statusText: response.statusText,
      responseText: responseBody.raw,
    });

    logger.error(`Failed to get response for ${provider} from ${url}`, errorDetails);

    throw new AssistantError(
      getProviderResponseErrorMessage(errorDetails),
      ErrorType.PROVIDER_ERROR,
      response.status,
      errorDetails,
    );
  }

  if (responseBody.parsed === null && options.allowNullResponse) {
    return null;
  }

  if (responseBody.parsed === null) {
    throw new AssistantError(
      `${provider} returned invalid JSON response`,
      ErrorType.PROVIDER_ERROR,
      502,
      {
        provider,
        endpoint: url,
        responseText: redactSensitiveTokens(responseBody.raw.substring(0, 200)),
      },
    );
  }

  return responseBody.parsed as T;
}
