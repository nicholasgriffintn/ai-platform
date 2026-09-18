import { MODEL_DEFAULTS } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { buildInputSchemaInput } from "../../../input-schema.js";
import type { ProviderRuntime } from "../../../runtime.js";
import { extractGeneratedAsset } from "../../../utils/helpers.js";
import type { VideoGenerationRequest, VideoGenerationResult, VideoProvider } from "../index.js";

const DEFAULT_MODEL = MODEL_DEFAULTS.video.workersAi.model;

export class WorkersAiVideoProvider implements VideoProvider {
  constructor(protected readonly runtime: ProviderRuntime) {}

  name = "workers-ai";
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
            prompt: request.prompt,
            negative_prompt: request.negativePrompt,
            aspect_ratio: request.aspectRatio,
            duration: request.duration ?? request.videoLength,
            width: request.width,
            height: request.height,
            guidance_scale: request.guidanceScale,
            ...request.metadata,
          },
        },
      },
      modelConfig,
    ).input;

    const response = await provider.getResponse({
      completion_id: request.completion_id,
      app_url: request.app_url,
      model: modelConfig.matchingModel,
      messages: [{ role: "user", content: request.prompt }],
      body: {
        input,
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
