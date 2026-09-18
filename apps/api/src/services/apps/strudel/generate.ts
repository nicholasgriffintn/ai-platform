import { getModels } from "@ngriffin_uk/polychat-ai-models";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import type { strudelGenerateResponseSchema } from "@ngriffin_uk/polychat-schemas";
import {
  AssistantError,
  ErrorType,
  getErrorMessage,
} from "@ngriffin_uk/polychat-utility-server/errors";
import { generateId } from "@ngriffin_uk/polychat-utility-server/id";
import type { z } from "zod";

import { ai } from "~/lib/ai";
import { resolveServiceContext, type ServiceContext } from "~/lib/context/serviceContext";
import { captureTrainingExample } from "~/lib/providers/capabilities/training/captureTrainingExample";
import { buildStrudelSystemPrompt } from "~/services/apps/strudel/prompt";
import { getAuxiliaryModel, filterModelsForUserAccess } from "~/services/models/resolve";
import type { IEnv, IUser } from "~/types";

const logger = getLogger({ prefix: "services/strudel/generate" });

interface StrudelGenerateRequest {
  prompt: string;
  style?: "techno" | "ambient" | "house" | "jazz" | "drums" | "experimental";
  tempo?: number;
  complexity?: "simple" | "medium" | "complex";
  model?: string;
  options?: Record<string, any>;
}

type StrudelGenerateResponse = z.infer<typeof strudelGenerateResponseSchema>;

export async function generateStrudelCode({
  context,
  env,
  request,
  user,
  conversationId,
}: {
  context?: ServiceContext;
  env?: IEnv;
  request: StrudelGenerateRequest;
  user: IUser;
  conversationId?: string;
}): Promise<StrudelGenerateResponse> {
  const serviceContext = resolveServiceContext({ context, env, user });
  const runtimeEnv = serviceContext.env;

  if (!request.prompt || request.prompt.trim().length === 0) {
    throw new AssistantError("Prompt is required", ErrorType.PARAMS_ERROR);
  }

  try {
    const systemPrompt = buildStrudelSystemPrompt(request.style, request.complexity || "medium");

    let userPrompt = `Generate Strudel code for: ${request.prompt}`;

    if (request.tempo) {
      userPrompt += `\nTempo: ${request.tempo} BPM (use .fast() or .slow() to adjust)`;
    }

    logger.info("Generating Strudel code", {
      prompt: request.prompt,
      style: request.style,
      complexity: request.complexity,
      model: request.model,
    });

    let model: string;
    let providerName: string;

    if (request.model) {
      const allModels = getModels();
      const accessibleModels = await filterModelsForUserAccess(
        allModels,
        runtimeEnv,
        user?.id || null,
      );

      const selectedModelConfig = accessibleModels[request.model];

      if (!selectedModelConfig) {
        throw new AssistantError("Selected model is not available", ErrorType.PARAMS_ERROR);
      }

      model = selectedModelConfig.matchingModel;
      providerName = selectedModelConfig.provider;
    } else {
      const auxiliaryModel = await getAuxiliaryModel(runtimeEnv, user);

      model = auxiliaryModel.model;
      providerName = auxiliaryModel.provider;
    }

    const rawContent = await ai.generateText({
      env: runtimeEnv,
      user,
      model,
      provider: providerName,
      system: systemPrompt,
      prompt: userPrompt,
      store: false,
      completion_id: `strudel-${generateId()}`,
      enabled_tools: [],
      tools: [],
      mode: "normal",
      platform: "tool-run",
      options: request.options || {
        cache_ttl_seconds: 0,
      },
      reasoning: { effort: "none" },
    });

    if (!rawContent) {
      throw new AssistantError("No response from AI provider", ErrorType.UNKNOWN_ERROR);
    }

    const generatedCode = rawContent
      .replace(/^```(?:javascript|js|strudel)?\n?/gm, "")
      .replace(/\n?```$/gm, "")
      .trim();

    logger.info("Successfully generated Strudel code", {
      codeLength: generatedCode.length,
    });

    const generationId = generateId();

    captureTrainingExample({
      context: serviceContext,
      source: "app",
      appName: "strudel",
      userPrompt: request.prompt,
      assistantResponse: generatedCode,
      systemPrompt,
      modelUsed: model,
      conversationId,
      metadata: {
        style: request.style,
        complexity: request.complexity,
        tempo: request.tempo,
      },
    }).catch((err) => {
      logger.error("Failed to capture training example", err);
    });

    return {
      code: generatedCode,
      explanation: `Generated a ${request.style || "musical"} pattern${request.tempo ? ` at ${request.tempo} BPM` : ""}`,
      generationId,
    };
  } catch (error) {
    logger.error("Error generating Strudel code:", {
      error_message: error instanceof Error ? error.message : "Unknown error",
      error_stack: error instanceof Error ? error.stack : undefined,
      error_cause: error instanceof Error ? error.cause : undefined,
      prompt: request.prompt,
    });

    if (error instanceof AssistantError) {
      throw error;
    }

    throw new AssistantError(
      `Failed to generate Strudel code: ${error instanceof Error ? error.message : "Unknown error"}`,
      ErrorType.UNKNOWN_ERROR,
      500,
      {
        originalError: getErrorMessage(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
    );
  }
}
