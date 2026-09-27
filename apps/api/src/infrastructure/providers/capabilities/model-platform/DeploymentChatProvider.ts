import type { AIProvider } from "@ngriffin_uk/polychat-ai-providers";
import { formatMessages, stringifyMessageContent } from "@ngriffin_uk/polychat-ai-providers";
import {
  parsePlatformChatModelId,
  PLATFORM_DEPLOYMENT_CHAT_PROVIDER,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import { providerMetrics } from "~/infrastructure/telemetry";
import { canUserInvokeDeployment } from "~/modules/model-serving/application/chat-models";
import { invokeDeployment } from "~/modules/model-serving/application/invocation";
import type { ChatCompletionParameters } from "~/types";

const DEFAULT_MAX_TOKENS = 2048;

function toRole(role: string): "system" | "user" | "assistant" {
  return role === "assistant"
    ? "assistant"
    : role === "system" || role === "developer"
      ? "system"
      : "user";
}

export class DeploymentChatProvider implements AIProvider {
  name = PLATFORM_DEPLOYMENT_CHAT_PROVIDER;
  supportsStreaming = false;

  async getResponse(params: ChatCompletionParameters, userId?: number): Promise<any> {
    const parsed = params.model ? parsePlatformChatModelId(params.model) : null;

    if (!parsed || parsed.kind !== "deployment") {
      throw new AssistantError("A deployment model id is required", ErrorType.PARAMS_ERROR);
    }

    const actor = userId ?? params.context?.user?.id;

    if (!actor) {
      throw new AssistantError(
        "Sign in to use a workspace deployment",
        ErrorType.AUTHENTICATION_ERROR,
        401,
      );
    }

    const repositories = RepositoryManager.getInstance(params.env);
    const deployment = await canUserInvokeDeployment(params.env, actor, parsed.id);

    if (!deployment) {
      throw new AssistantError("Deployment not found", ErrorType.NOT_FOUND, 404);
    }

    return providerMetrics.trackProviderOperation(
      {
        provider: this.name,
        model: params.model ?? parsed.id,
        settings: {},
        userId: actor,
        completion_id: params.completion_id,
        request: params,
      },
      async () => {
        const result = await invokeDeployment(repositories, deployment, {
          messages: formatMessages(
            this.name,
            params.messages ?? [],
            params.system_prompt,
            params.model,
          ).map((message) => ({
            role: toRole(message.role),
            content: stringifyMessageContent(message.content),
          })),
          maxTokens: typeof params.max_tokens === "number" ? params.max_tokens : DEFAULT_MAX_TOKENS,
          temperature: typeof params.temperature === "number" ? params.temperature : 0.7,
          ...(typeof params.top_p === "number" ? { topP: params.top_p } : {}),
          ...(Array.isArray(params.stop) ? { stop: params.stop } : {}),
        });

        return {
          response: result.text,
          usage: {
            prompt_tokens: result.inputTokens,
            completion_tokens: result.outputTokens,
            total_tokens: result.inputTokens + result.outputTokens,
          },
          data: { deploymentId: deployment.id, routeId: deployment.route_id },
        };
      },
    );
  }
}
