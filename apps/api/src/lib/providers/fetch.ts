import { gatewayId } from "~/constants/app";
import { availableFunctions } from "~/services/functions";
import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import { detectStreaming } from "~/utils/streaming";

const logger = getLogger({ prefix: "FETCH" });

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
  options: {
    requestTimeout?: number;
    retryDelay?: number;
    maxAttempts?: number;
    backoff?: "exponential" | "linear";
  } = {
    requestTimeout: 100000,
    retryDelay: 500,
    maxAttempts: 2,
    backoff: "exponential",
  },
): Promise<T> {
  const isUrl = endpointOrUrl.startsWith("http");

  const isFormData = body instanceof FormData;
  const isStreaming = isFormData ? false : detectStreaming(body, endpointOrUrl);

  const tools = provider === "tool-use" ? availableFunctions : undefined;
  const bodyWithTools = isFormData ? body : tools ? { ...body, tools } : body;

  let response: Response;
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

    // @ts-expect-error - types seem to be wrong
    response = await gateway.run({
      provider: providerName,
      endpoint: endpointOrUrl,
      headers,
      query: bodyWithTools,
      // @ts-expect-error - types seem to be wrong
      config: {
        requestTimeout: options.requestTimeout,
        maxAttempts: options.maxAttempts,
        retryDelay: options.retryDelay,
        backoff: options.backoff,
      },
    });
  } else {
    response = await fetch(endpointOrUrl, {
      method: "POST",
      headers,
      body: isFormData
        ? (bodyWithTools as FormData)
        : JSON.stringify(bodyWithTools),
    });
  }

  if (!response.ok) {
    let responseJson: any;
    try {
      responseJson = await response.json();
    } catch (jsonError) {
      const responseText = await response.text();
      logger.error(
        `Failed to get response for ${provider} from ${endpointOrUrl}. Response not valid JSON:`,
        {
          responseText,
          status: response.status,
          statusText: response.statusText,
        },
      );
      throw new AssistantError(
        `Failed to get response for ${provider} from ${endpointOrUrl}: ${response.statusText}`,
        ErrorType.PROVIDER_ERROR,
      );
    }
    logger.error(
      `Failed to get response for ${provider} from ${endpointOrUrl}`,
      responseJson,
    );
    throw new AssistantError(
      `Failed to get response for ${provider} from ${endpointOrUrl}`,
      ErrorType.PROVIDER_ERROR,
    );
  }

  if (isStreaming) {
    return response.body as unknown as T;
  }

  let data: Record<string, any>;
  try {
    data = (await response.json()) as Record<string, any>;
  } catch (jsonError) {
    const responseText = await response.text();
    logger.error(`Failed to parse JSON response from ${provider}`, {
      error: jsonError,
      responseText: responseText.substring(0, 200),
    });
    throw new AssistantError(
      `${provider} returned invalid JSON response: ${jsonError instanceof Error ? jsonError.message : "Unknown JSON parse error"}`,
      ErrorType.PROVIDER_ERROR,
    );
  }

  const eventId = response.headers.get("cf-aig-event-id");
  const log_id = response.headers.get("cf-aig-log-id");
  const cacheStatus = response.headers.get("cf-aig-cache-status");

  return { ...data, eventId, log_id, cacheStatus } as T;
}
