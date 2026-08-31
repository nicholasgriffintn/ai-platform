import type { AgentMessage, AgentTokenUsage } from "@ngriffin_uk/polychat-library-agent-core";
import {
  parseRetryAfterBodyMs,
  parseRetryAfterHeaderMs,
  withRetry,
} from "@ngriffin_uk/polychat-library-client/retry";
import type { SandboxModelSettings } from "@ngriffin_uk/polychat-schemas";

const POLYCHAT_SANDBOX_USER_AGENT = "Polychat-Sandbox-Worker/1.0 (+https://polychat.app)";

const RETRYABLE_HTTP_STATUS_CODES = new Set([408, 409, 425, 429, 500, 502, 503, 504]);
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 400;
const DEFAULT_MAX_DELAY_MS = 3000;

interface PolychatChatCompletionParams extends SandboxModelSettings {
  messages: AgentMessage[];
  model: string;
  stream?: boolean;
  tools?: unknown[];
  tool_choice?: string;
}

export interface PolychatToolCall {
  id?: string;
  type?: string;
  function?: {
    name?: string;
    arguments?: string;
  };
  name?: string;
  arguments?: string;
}

export interface PolychatCompletionMessage {
  content: string;
  toolCalls: PolychatToolCall[];
  message: AgentMessage;
  usage: Omit<AgentTokenUsage, "iterations">;
}

function readTokenCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

function isPolychatToolCall(value: unknown): value is PolychatToolCall {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as PolychatToolCall;

  return (
    typeof candidate.name === "string" ||
    (candidate.function !== undefined && typeof candidate.function.name === "string")
  );
}

export class PolychatApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly retryable: boolean,
    public readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "PolychatApiError";
  }
}

export interface PolychatRetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

export class PolychatClient {
  private readonly userToken: string;
  private readonly polychatApi: Pick<Fetcher, "fetch">;

  constructor(userToken: string, polychatApi: Pick<Fetcher, "fetch">) {
    this.userToken = userToken;
    this.polychatApi = polychatApi;
  }

  private async fetchPolychat(path: string, init: RequestInit): Promise<Response> {
    return this.polychatApi.fetch(new Request(`http://polychat-api${path}`, init));
  }

  private isRetryableError(error: unknown): boolean {
    if (error instanceof PolychatApiError) {
      return error.retryable;
    }

    if (!(error instanceof Error)) {
      return false;
    }

    if (error.name === "AbortError") {
      return false;
    }

    return error.name === "TypeError";
  }

  private async requestChatCompletion(
    params: PolychatChatCompletionParams,
  ): Promise<PolychatCompletionMessage> {
    const chatId = crypto.randomUUID();

    const response = await this.fetchPolychat("/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.userToken}`,
        "User-Agent": POLYCHAT_SANDBOX_USER_AGENT,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        completion_id: chatId,
        platform: "api",
        store: false,
        ...params,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();

      throw new PolychatApiError(
        response.status,
        `Polychat API request failed (${response.status}): ${errorText.slice(0, 500)}`,
        RETRYABLE_HTTP_STATUS_CODES.has(response.status),
        parseRetryAfterHeaderMs(response.headers.get("Retry-After")) ??
          parseRetryAfterBodyMs(errorText),
      );
    }

    const data = (await response.json()) as {
      choices: Array<{
        message: AgentMessage;
      }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
        input_tokens?: number;
        output_tokens?: number;
        cached_input_tokens?: number;
        prompt_tokens_details?: { cached_tokens?: number };
      };
    };

    const message = data.choices?.[0]?.message;

    if (!message || typeof message !== "object") {
      throw new Error("Polychat API returned a completion without an assistant message");
    }

    const toolCalls = Array.isArray(message.tool_calls)
      ? message.tool_calls.filter(isPolychatToolCall)
      : [];
    const content = typeof message?.content === "string" ? message.content : "";

    if (!content && toolCalls.length === 0) {
      throw new Error("Polychat API returned an empty completion response");
    }

    const reportedTotal = readTokenCount(data.usage?.total_tokens);
    const reportedInput = readTokenCount(data.usage?.input_tokens ?? data.usage?.prompt_tokens);
    const reportedOutput = readTokenCount(
      data.usage?.output_tokens ?? data.usage?.completion_tokens,
    );
    const inputTokens = reportedInput || (reportedOutput === 0 ? reportedTotal : 0);
    const outputTokens = reportedOutput;

    return {
      content,
      toolCalls,
      message,
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        cachedInputTokens: Math.min(
          inputTokens,
          readTokenCount(
            data.usage?.cached_input_tokens ?? data.usage?.prompt_tokens_details?.cached_tokens,
          ),
        ),
      },
    };
  }

  async chatCompletion(
    params: PolychatChatCompletionParams,
    retryOptions?: PolychatRetryOptions,
  ): Promise<PolychatCompletionMessage> {
    const baseDelayMs = Math.max(100, retryOptions?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS);

    return withRetry(() => this.requestChatCompletion(params), {
      maxAttempts: Math.max(1, Math.min(retryOptions?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS, 5)),
      baseDelayMs,
      maxDelayMs: Math.max(baseDelayMs, retryOptions?.maxDelayMs ?? DEFAULT_MAX_DELAY_MS),
      isRetryable: (error) => this.isRetryableError(error),
      getRetryAfterMs: (error) =>
        error instanceof PolychatApiError ? error.retryAfterMs : undefined,
    });
  }
}
