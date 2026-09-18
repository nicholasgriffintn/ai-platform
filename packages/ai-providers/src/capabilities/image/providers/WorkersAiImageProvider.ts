import { getTextToImageSystemPrompt, isImagePromptStyle } from "@ngriffin_uk/polychat-ai-prompts";
import { MODEL_DEFAULTS } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { buildInputSchemaInput } from "../../../input-schema.js";
import type { ProviderRuntime } from "../../../runtime.js";
import { extractGeneratedAsset } from "../../../utils/helpers.js";
import type { ImageGenerationRequest, ImageGenerationResult, ImageProvider } from "../index.js";

const DEFAULT_MODEL = MODEL_DEFAULTS.image.workersAi.model;

function resolveStylePrompt(style?: string): string {
  const styleKey = style && isImagePromptStyle(style) ? style : "default";

  return getTextToImageSystemPrompt(styleKey);
}

export class WorkersAiImageProvider implements ImageProvider {
  constructor(protected readonly runtime: ProviderRuntime) {}

  name = "workers-ai";
  models = [DEFAULT_MODEL];

  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const modelId = request.model || DEFAULT_MODEL;
    const modelConfig = await this.runtime.host.models.findModelConfig(
      modelId,
      request.env,
      "workers-ai",
    );

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

    const stylePrompt = resolveStylePrompt(request.style);
    const prompt = stylePrompt ? `${stylePrompt}\n\n${request.prompt}` : request.prompt;
    const input = buildInputSchemaInput(
      {
        messages: [{ role: "user", content: prompt }],
        body: {
          input: {
            prompt,
            style: request.style,
            aspect_ratio: request.aspectRatio,
            width: request.width,
            height: request.height,
            steps: request.steps,
            num_steps: request.steps,
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
              text: prompt,
            },
          ],
        },
      ],
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
