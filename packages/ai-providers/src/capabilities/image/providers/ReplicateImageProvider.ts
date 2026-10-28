import { validateReplicatePayload } from "@ngriffin_uk/polychat-ai-models";
import { getTextToImageSystemPrompt, isImagePromptStyle } from "@ngriffin_uk/polychat-ai-prompts";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { omitNullishValues } from "@ngriffin_uk/polychat-utility-server/objects";

import type { ProviderRuntime } from "../../../runtime.js";
import { extractGeneratedAsset } from "../../../utils/helpers.js";
import { requireRequestModel } from "../../../utils/required-model.js";
import type { ImageGenerationRequest, ImageGenerationResult, ImageProvider } from "../index.js";

function resolveStylePrompt(style?: string): string {
  const styleKey = style && isImagePromptStyle(style) ? style : "default";

  return getTextToImageSystemPrompt(styleKey);
}

export class ReplicateImageProvider implements ImageProvider {
  constructor(protected readonly runtime: ProviderRuntime) {}

  name = "replicate";

  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const modelId = requireRequestModel(request.model, "image");
    const modelConfig = await this.runtime.host.models.findModelConfig(
      modelId,
      request.env,
      "replicate",
    );

    if (!modelConfig) {
      throw new AssistantError(
        `Model configuration not found for ${modelId}`,
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    const stylePrompt = resolveStylePrompt(request.style);
    const prompt = stylePrompt ? `${stylePrompt}\n\n${request.prompt}` : request.prompt;

    const replicatePayload = omitNullishValues({
      prompt,
      aspect_ratio: request.aspectRatio,
      width: request.width,
      height: request.height,
      steps: request.steps,
      seed: request.seed,
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
          content: prompt,
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
