import { validateReplicatePayload } from "@ngriffin_uk/polychat-ai-models";
import { MODEL_DEFAULTS } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { omitNullishValues } from "@ngriffin_uk/polychat-utility-server/objects";

import type { ProviderRuntime } from "../../../runtime.js";
import { extractGeneratedAsset } from "../../../utils/helpers.js";
import type { VideoGenerationRequest, VideoGenerationResult, VideoProvider } from "../index.js";

const DEFAULT_MODEL = MODEL_DEFAULTS.video.replicate.model;

export class ReplicateVideoProvider implements VideoProvider {
  constructor(protected readonly runtime: ProviderRuntime) {}

  name = "replicate";
  models = [DEFAULT_MODEL];

  async generate(request: VideoGenerationRequest): Promise<VideoGenerationResult> {
    const modelId = request.model || DEFAULT_MODEL;
    const modelConfig = await this.runtime.host.models.getModelConfigByModel(modelId);

    if (!modelConfig) {
      throw new AssistantError(
        `Model configuration not found for ${modelId}`,
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    const replicatePayload = omitNullishValues({
      prompt: request.prompt,
      negative_prompt: request.negativePrompt,
      aspect_ratio: request.aspectRatio,
      width: request.width,
      height: request.height,
      duration: request.duration ?? request.videoLength,
      guidance_scale: request.guidanceScale,
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
