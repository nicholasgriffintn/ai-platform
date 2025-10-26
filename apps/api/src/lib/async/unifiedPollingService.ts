import type { UnifiedAsyncInvocation } from "~/types";
import { AIProviderFactory } from "~/lib/providers/factory";
import { AssistantError, ErrorType } from "~/utils/errors";
import { trackProviderMetrics } from "~/lib/monitoring";
import type { ChatCompletionParameters } from "~/types";

export interface PollingResult {
  status: "in_progress" | "completed" | "failed";
  result?: any;
  error?: string;
  metadata: UnifiedAsyncInvocation;
}

export class UnifiedPollingService {
  static async pollStatus(
    metadata: UnifiedAsyncInvocation,
    params: ChatCompletionParameters,
    userId?: number,
  ): Promise<PollingResult> {
    const provider = AIProviderFactory.getProvider(metadata.provider);

    if (!provider || typeof provider.pollAsyncStatus !== "function") {
      throw new AssistantError(
        `Provider ${metadata.provider} does not support async polling`,
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    return trackProviderMetrics({
      provider: metadata.provider,
      model: params.model || "unknown",
      operation: async () => {
        const result = await provider.pollAsyncStatus(
          metadata.id,
          params,
          userId,
        );

        const updatedMetadata: UnifiedAsyncInvocation = {
          ...metadata,
          ...result.metadata,
          lastCheckedAt: Date.now(),
        };

        if (result.status === "completed") {
          updatedMetadata.completedAt = Date.now();
          updatedMetadata.result = result.result;
        }

        if (result.status === "failed") {
          updatedMetadata.error = result.error;
        }

        return {
          ...result,
          metadata: updatedMetadata,
        };
      },
      analyticsEngine: params.env?.ANALYTICS,
      userId,
      completion_id: params.completion_id,
    });
  }

  static createUnifiedMetadata(
    provider: string,
    id: string,
    initialResponse?: Record<string, any>,
    pollIntervalMs: number = 4000,
  ): UnifiedAsyncInvocation {
    return {
      provider,
      id,
      status: "in_progress",
      pollIntervalMs,
      createdAt: Date.now(),
      initialResponse,
    };
  }
}
