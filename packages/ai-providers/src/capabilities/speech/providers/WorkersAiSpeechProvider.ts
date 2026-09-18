import { MODEL_DEFAULTS } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { buildInputSchemaInput } from "../../../input-schema.js";
import type { ProviderRuntime } from "../../../runtime.js";
import { extractGeneratedAsset } from "../../../utils/helpers.js";
import type { SpeechGenerationRequest, SpeechGenerationResult, SpeechProvider } from "../index.js";

const DEFAULT_MODEL = MODEL_DEFAULTS.speech.workersAi.model;

export class WorkersAiSpeechProvider implements SpeechProvider {
  constructor(protected readonly runtime: ProviderRuntime) {}

  name = "workers-ai";
  models = [DEFAULT_MODEL];

  async generate(request: SpeechGenerationRequest): Promise<SpeechGenerationResult> {
    const modelId = request.model || DEFAULT_MODEL;
    const modelConfig = await this.runtime.host.models.getModelConfigByModel(modelId);

    if (!modelConfig) {
      throw new AssistantError(
        `Model configuration not found for ${modelId}`,
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    const provider = this.runtime.providers.resolve("chat", "workers-ai", {
      env: request.env,
      user: request.user,
    });
    const context = { env: request.env, user: request.user };
    const input = buildInputSchemaInput(
      {
        messages: [{ role: "user", content: request.prompt }],
        body: {
          input: {
            text: request.prompt,
            prompt: request.prompt,
            voice: request.voice,
            voice_id: request.voice,
            language: request.locale,
            lang: request.locale,
            ...request.metadata,
          },
        },
      },
      modelConfig,
    ).input;

    const response = await provider.getResponse({
      completion_id: request.completion_id,
      model: modelConfig.matchingModel,
      app_url: request.app_url,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: request.prompt,
            },
          ],
        },
      ],
      body: {
        input,
      },
      lang: request.locale,
      env: request.env,
      context,
    });

    const attachment = extractGeneratedAsset(response);

    return {
      url: attachment.url,
      key: attachment.key,
      metadata: attachment,
      raw: response,
    };
  }
}
