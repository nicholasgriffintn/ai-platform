import { getTextToImageSystemPrompt, isImagePromptStyle } from "@ngriffin_uk/polychat-ai-prompts";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { omitNullishValues } from "@ngriffin_uk/polychat-utility-server/objects";

import { buildInputSchemaInput } from "../../../input-schema.js";
import type { ProviderRuntime } from "../../../runtime.js";
import { extractGeneratedAsset } from "../../../utils/helpers.js";
import { requireRequestModel } from "../../../utils/required-model.js";
import type { ImageGenerationRequest, ImageGenerationResult, ImageProvider } from "../index.js";

function withStylePrompt(prompt: string, style?: string): string {
  const stylePrompt = getTextToImageSystemPrompt(
    style && isImagePromptStyle(style) ? style : "default",
  );

  return stylePrompt ? `${stylePrompt}\n\n${prompt}` : prompt;
}

export class ModelImageProvider implements ImageProvider {
  constructor(
    protected readonly runtime: ProviderRuntime,
    readonly name: string,
  ) {}

  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const modelId = requireRequestModel(request.model, "image");
    const modelConfig = await this.runtime.host.models.findModelConfig(modelId, request.env);

    if (!modelConfig) {
      throw new AssistantError(
        `Model configuration not found for ${modelId}`,
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    const prompt = withStylePrompt(request.prompt, request.style);
    const messages = [{ role: "user" as const, content: prompt }];
    const requestedInput = omitNullishValues({
      prompt,
      aspect_ratio: request.aspectRatio,
      width: request.width,
      height: request.height,
      steps: request.steps,
      num_steps: request.steps,
      seed: request.seed,
      ...request.metadata,
    });
    const input = modelConfig.inputSchema?.fields?.length
      ? buildInputSchemaInput({ messages, body: { input: requestedInput } }, modelConfig).input
      : requestedInput;
    const context = { env: request.env, user: request.user };
    const response = await this.runtime.providers
      .resolve("chat", modelConfig.provider, context)
      .getResponse({
        completion_id: request.completion_id,
        app_url: request.app_url,
        model: modelConfig.matchingModel,
        messages,
        body: { input },
        disable_functions: true,
        env: request.env,
        context,
      });
    const asset = extractGeneratedAsset(response);

    if (!asset.url) {
      throw new AssistantError(
        `${modelConfig.name ?? modelId} returned no picture`,
        ErrorType.PROVIDER_ERROR,
      );
    }

    return { url: asset.url, key: asset.key, metadata: asset, raw: response };
  }
}
