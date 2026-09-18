import { validateReplicatePayload } from "@ngriffin_uk/polychat-ai-models";
import { MODEL_DEFAULTS } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { omitNullishValues } from "@ngriffin_uk/polychat-utility-server/objects";

import type { ProviderRuntime } from "../../../runtime.js";
import { extractGeneratedAsset } from "../../../utils/helpers.js";
import type { MusicGenerationRequest, MusicGenerationResult, MusicProvider } from "../index.js";

const DEFAULT_MODEL = MODEL_DEFAULTS.music.replicate.model;

export class ReplicateMusicProvider implements MusicProvider {
  constructor(protected readonly runtime: ProviderRuntime) {}

  name = "replicate";
  models = [DEFAULT_MODEL];

  protected getDefaultModel(): string {
    return DEFAULT_MODEL;
  }

  async generate(request: MusicGenerationRequest): Promise<MusicGenerationResult> {
    const modelId = request.model || this.getDefaultModel();
    const modelConfig = await this.runtime.host.models.getModelConfigByModel(modelId);

    if (!modelConfig) {
      throw new AssistantError(
        `Model configuration not found for ${modelId}`,
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    const replicatePayload = omitNullishValues({
      prompt: request.prompt,
      input_audio: request.inputAudio,
      duration: request.duration,
      ...request.metadata,
    });

    validateReplicatePayload({
      payload: replicatePayload,
      schema: modelConfig.inputSchema,
      modelName: modelConfig.name || modelId,
    });

    const provider = this.runtime.providers.resolve("chat", modelConfig.provider || "replicate", {
      env: request.env,
      user: request.user,
    });
    const context = { env: request.env, user: request.user };

    const response = await provider.getResponse({
      completion_id: request.completion_id,
      app_url: request.app_url,
      model: modelConfig.matchingModel,
      messages: [
        {
          role: "user",
          content: request.prompt,
        },
      ],
      body: {
        input: replicatePayload,
      },
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
