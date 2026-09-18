import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";
import { generateId } from "@ngriffin_uk/polychat-utility-server/id";

import { getLogger } from "./logger.js";
import { createWorkerTelemetry } from "./telemetry.js";
import type { Telemetry } from "./telemetry.js";
import type { AiErrorInfo, TelemetryEnv, TelemetryIdentity } from "./types.js";

const logger = getLogger({ prefix: "ai-telemetry/embedding" });

const EMBED_DOCUMENT_SPAN_NAME = "embed_document";
const EMBED_QUERY_SPAN_NAME = "embed_query";

export interface EmbeddingProviderLike {
  generate(
    type: string,
    content: string,
    id: string,
    metadata: Record<string, unknown>,
  ): Promise<unknown>;
  getQuery(query: string): Promise<unknown>;
}

export type EmbeddingTelemetryOptions = {
  env?: TelemetryEnv;
  telemetry?: Telemetry;
  identity?: TelemetryIdentity;
  provider: string;
  model: string;
  estimateInputTokens?: (input: string) => number;
};

type EmbeddingOutcome = {
  traceId: string;
  spanId: string;
  spanName: string;
  input: string;
  latencyMs: number;
  error?: AiErrorInfo;
};

export function withEmbeddingTelemetry<T extends EmbeddingProviderLike>(
  provider: T,
  options: EmbeddingTelemetryOptions,
): T {
  const telemetry = options.telemetry ?? createWorkerTelemetry({ env: options.env ?? {} });

  const emit = (outcome: EmbeddingOutcome): void => {
    try {
      telemetry.captureAiEmbedding({
        ...options.identity,
        ...outcome,
        inputTokens: options.estimateInputTokens?.(outcome.input),
        provider: options.provider,
        model: options.model,
      });
    } catch (error) {
      logger.warn("Failed to capture embedding telemetry", {
        error: getErrorMessage(error),
      });
    }
  };

  const track = async <R>(
    spanName: string,
    input: string,
    operation: () => Promise<R>,
  ): Promise<R> => {
    const traceId = generateId();
    const spanId = generateId();
    const startedAt = performance.now();

    try {
      const result = await operation();

      emit({ traceId, spanId, spanName, input, latencyMs: performance.now() - startedAt });

      return result;
    } catch (error) {
      emit({
        traceId,
        spanId,
        spanName,
        input,
        latencyMs: performance.now() - startedAt,
        error: { message: getErrorMessage(error) },
      });

      throw error;
    }
  };

  return new Proxy(provider, {
    get(target, property, receiver) {
      if (property === "generate") {
        return (type: string, content: string, id: string, metadata: Record<string, unknown>) =>
          track(EMBED_DOCUMENT_SPAN_NAME, content, () =>
            target.generate(type, content, id, metadata),
          );
      }

      if (property === "getQuery") {
        return (query: string) => track(EMBED_QUERY_SPAN_NAME, query, () => target.getQuery(query));
      }

      return Reflect.get(target, property, receiver);
    },
  });
}
