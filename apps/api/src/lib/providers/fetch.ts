import { gatewayId } from "~/constants/app";
import { availableFunctions } from "~/services/functions";
import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

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
  body: Record<string, any>,
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
  const isStreaming = body?.stream === true;

  const tools = provider === "tool-use" ? availableFunctions : undefined;
  const bodyWithTools = tools ? { ...body, tools } : body;

  let response: Response;
  if (!isUrl) {
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
      body: JSON.stringify(bodyWithTools),
    });
  }

  if (!response.ok) {
    const responseJson = await response.json();
    logger.error(
      `Failed to get response for ${provider} from ${endpointOrUrl}`,
      responseJson,
    );
    throw new AssistantError(
      `Failed to get response for ${provider} from ${endpointOrUrl}`,
    );
  }

  if (isStreaming) {
    return response.body as unknown as T;
  }

  const data = (await response.json()) as Record<string, any>;

  const eventId = response.headers.get("cf-aig-event-id");
  const log_id = response.headers.get("cf-aig-log-id");
  const cacheStatus = response.headers.get("cf-aig-cache-status");

  return { ...data, eventId, log_id, cacheStatus } as T;
}
