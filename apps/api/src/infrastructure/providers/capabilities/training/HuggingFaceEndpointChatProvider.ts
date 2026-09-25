import type { AIProvider } from "@ngriffin_uk/polychat-ai-providers";
import { formatMessages, stringifyMessageContent } from "@ngriffin_uk/polychat-ai-providers";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { omitNullishValues } from "@ngriffin_uk/polychat-utility-server/objects";

import { providerMetrics } from "~/infrastructure/telemetry";
import { resolveEndpointToken } from "~/modules/model-registry/application/endpoints";
import { getHuggingFaceEndpointRuntimeRecord } from "~/modules/models/application/training-deployments";
import type { ChatCompletionParameters } from "~/types";

function readCompletionText(data: unknown): string {
  if (!isRecord(data) || !Array.isArray(data.choices)) {
    return "";
  }

  const [choice] = data.choices;
  const message = isRecord(choice) && isRecord(choice.message) ? choice.message : null;

  return message && typeof message.content === "string" ? message.content : "";
}

function readUsage(data: unknown) {
  const usage = isRecord(data) && isRecord(data.usage) ? data.usage : {};
  const prompt = typeof usage.prompt_tokens === "number" ? usage.prompt_tokens : 0;
  const completion = typeof usage.completion_tokens === "number" ? usage.completion_tokens : 0;

  return {
    prompt_tokens: prompt,
    completion_tokens: completion,
    total_tokens: prompt + completion,
  };
}

export class HuggingFaceEndpointProvider implements AIProvider {
  name = "huggingface-endpoint";
  supportsStreaming = false;

  async getResponse(params: ChatCompletionParameters, userId?: number): Promise<any> {
    const endpointName = params.model;

    if (!endpointName) {
      throw new AssistantError("Endpoint name is required", ErrorType.PARAMS_ERROR);
    }

    const token = await resolveEndpointToken(params.env, endpointName);

    if (!token) {
      throw new AssistantError(
        "Connect Hugging Face under Models › Govern to call this endpoint",
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    const deployment = await getHuggingFaceEndpointRuntimeRecord(params.env, endpointName);

    if (!deployment?.url || deployment.status.toLowerCase() !== "inservice") {
      throw new AssistantError(
        `Inference Endpoint ${endpointName} is not ready${deployment ? `: ${deployment.status}` : ""}`,
        ErrorType.PROVIDER_ERROR,
      );
    }

    const url = deployment.url;

    return providerMetrics.trackProviderOperation(
      {
        provider: this.name,
        model: endpointName,
        settings: {},
        userId: userId || params.context?.user?.id,
        completion_id: params.completion_id,
        request: params,
      },
      async () => {
        const response = await fetch(`${url.replace(/\/$/, "")}/v1/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(
            omitNullishValues({
              messages: formatMessages(
                this.name,
                params.messages ?? [],
                params.system_prompt,
                params.model,
              ).map((message) => ({
                role: message.role === "developer" ? "system" : message.role,
                content: stringifyMessageContent(message.content),
              })),
              max_tokens: typeof params.max_tokens === "number" ? params.max_tokens : undefined,
              temperature: typeof params.temperature === "number" ? params.temperature : undefined,
              top_p: typeof params.top_p === "number" ? params.top_p : undefined,
              stop: params.stop,
              stream: false,
            }),
          ),
        });
        const data: unknown = await response.json().catch(() => null);

        if (!response.ok) {
          throw new AssistantError(
            `Inference Endpoint request failed with status ${response.status}`,
            ErrorType.PROVIDER_ERROR,
            response.status,
          );
        }

        return {
          response: readCompletionText(data),
          usage: readUsage(data),
          data: { providerResponse: data },
        };
      },
    );
  }
}
