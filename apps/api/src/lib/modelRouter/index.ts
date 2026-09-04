import type {
  ModelConfigItem,
  ModelRouterMode,
  PromptRequirements,
} from "@ngriffin_uk/polychat-schemas";
import { filterModelsByRouterMode } from "@ngriffin_uk/polychat-schemas";

import { PromptAnalyzer } from "~/lib/modelRouter/promptAnalyser";
import { trackModelRoutingMetrics } from "~/lib/monitoring";
import { getIncludedInRouterModelsForUser, getModels } from "~/lib/providers/models";
import { resolveDefaultChatModel } from "~/lib/providers/models/policy";
import type { Attachment, IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import { modelSupportsInput } from "~/utils/models";

const logger = getLogger({ prefix: "lib/modelRouter" });

interface ModelScore {
  model: string;
  score: number;
  reason: string;
  provider: string;
}

export class ModelRouter {
  private static readonly WEIGHTS = {
    COMPLEXITY_MATCH: 2,
    BUDGET_EFFICIENCY: 4,
    RELIABILITY: 2,
    SPEED: 2,
    MULTIMODAL: 5,
    FUNCTIONS: 0,
    CAPABILITY_MATCH: 5,
    COST_EFFICIENCY: 3,
  } as const;

  private static readonly CAPABILITY_WEIGHTS: Record<string, number> = {
    reasoning: 5,
    math: 5,
    coding: 4,
    academic: 4,
    analysis: 4,
    creative: 3,
    research: 3,
    search: 3,
    vision: 5,
    audio: 5,
    summarization: 2,
    instruction: 2,
    multilingual: 3,
    chat: 1,
    general_knowledge: 1,
  };
  private static readonly DEFAULT_CAPABILITY_WEIGHT = 1;

  private static readonly COMPARISON_SCORE_THRESHOLD = 3.0;
  private static readonly MAX_COMPARISON_MODELS = 2;

  static selectFimModel(options?: { preferredProvider?: string }): string {
    const models = getModels({ shouldUseCache: false });
    const fimModels = Object.entries(models).filter(([, config]) => config.supportsFim);

    if (fimModels.length === 0) {
      throw new AssistantError("No FIM-capable models available", ErrorType.PARAMS_ERROR);
    }

    const filteredModels =
      options?.preferredProvider != null
        ? fimModels.filter(([, config]) => config.provider === options.preferredProvider)
        : fimModels;

    if (filteredModels.length === 0) {
      throw new AssistantError(
        `No FIM-capable models available for provider ${options.preferredProvider}`,
        ErrorType.PARAMS_ERROR,
      );
    }

    const scored = filteredModels
      .map(([key, config]) => {
        const speed = config.speed ?? 3;
        const reliability = config.reliability ?? 3;
        const complexity = config.contextComplexity ?? 3;

        const score = speed * 10 + reliability * 5 + (5 - complexity) * 2;

        return { key, score };
      })
      .sort((a, b) => b.score - a.score);

    return scored[0].key;
  }

  static selectNextEditModel(options?: { preferredProvider?: string }): string {
    return ModelRouter.selectEditModel("supportsNextEdit", options);
  }

  static selectApplyEditModel(options?: { preferredProvider?: string }): string {
    return ModelRouter.selectEditModel("supportsApplyEdit", options);
  }

  private static selectEditModel(
    capability: "supportsNextEdit" | "supportsApplyEdit",
    options?: { preferredProvider?: string },
  ): string {
    const models = getModels({ shouldUseCache: false });
    const editModels = Object.entries(models).filter(([, config]) =>
      capability === "supportsNextEdit" ? config.supportsNextEdit : config.supportsApplyEdit,
    );

    if (editModels.length === 0) {
      throw new AssistantError(
        `No models available with capability ${capability}`,
        ErrorType.PARAMS_ERROR,
      );
    }

    const filtered = options?.preferredProvider
      ? editModels.filter(([, config]) => config.provider === options.preferredProvider)
      : editModels;

    if (filtered.length === 0) {
      throw new AssistantError(
        `No models for provider ${options?.preferredProvider} support ${capability}`,
        ErrorType.PARAMS_ERROR,
      );
    }

    const scored = filtered
      .map(([key, config]) => {
        const speed = config.speed ?? 3;
        const reliability = config.reliability ?? 3;
        const complexity = config.contextComplexity ?? 3;

        const score = speed * 10 + reliability * 5 + (5 - complexity) * 2;

        return { key, score };
      })
      .sort((a, b) => b.score - a.score);

    return scored[0].key;
  }

  private static async scoreModel(
    requirements: PromptRequirements,
    model: string,
    capabilities: ModelConfigItem,
  ): Promise<ModelScore> {
    if (!capabilities) {
      return {
        model,
        score: Number.NEGATIVE_INFINITY,
        reason: "Missing model configuration",
        provider: "unknown",
      };
    }

    if (capabilities.deprecated) {
      return {
        model,
        score: Number.NEGATIVE_INFINITY,
        reason: "Deprecated model",
        provider: capabilities.provider,
      };
    }

    if (
      requirements.hasImages &&
      !capabilities.multimodal &&
      !modelSupportsInput(capabilities, "image")
    ) {
      return {
        model,
        score: Number.NEGATIVE_INFINITY,
        reason: "Missing image support",
        provider: capabilities.provider,
      };
    }

    if (
      requirements.hasDocuments &&
      !capabilities.supportsDocuments &&
      !modelSupportsInput(capabilities, "pdf") &&
      !modelSupportsInput(capabilities, "document")
    ) {
      return {
        model,
        score: Number.NEGATIVE_INFINITY,
        reason: "Missing document support",
        provider: capabilities.provider,
      };
    }

    if (requirements.needsFunctions && !capabilities.supportsToolCalls) {
      return {
        model,
        score: Number.NEGATIVE_INFINITY,
        reason: "Missing tool-call support",
        provider: capabilities.provider,
      };
    }

    if (
      requirements.criticalStrengths?.some(
        (strength) => !capabilities.strengths?.includes(strength),
      )
    ) {
      return {
        model,
        score: Number.NEGATIVE_INFINITY,
        reason: "Missing critical capabilities",
        provider: capabilities.provider,
      };
    }

    const score = ModelRouter.calculateScore(requirements, capabilities);

    return {
      model,
      score,
      reason: "Matched requirements",
      provider: capabilities.provider,
    };
  }

  private static calculateTotalCost(
    requirements: PromptRequirements,
    model: ModelConfigItem,
  ): number {
    if (!model.costPer1kInputTokens || !model.costPer1kOutputTokens) {
      return 0;
    }

    const estimatedInputCost =
      (requirements.estimatedInputTokens / 1000) * model.costPer1kInputTokens;
    const estimatedOutputCost =
      (requirements.estimatedOutputTokens / 1000) * model.costPer1kOutputTokens;

    return estimatedInputCost + estimatedOutputCost;
  }

  private static calculateScore(requirements: PromptRequirements, model: ModelConfigItem): number {
    let score = 0;

    if (model.contextComplexity) {
      score +=
        Math.max(0, 5 - Math.abs(requirements.expectedComplexity - model.contextComplexity)) *
        ModelRouter.WEIGHTS.COMPLEXITY_MATCH;
    }

    const inputCost = model.costPer1kInputTokens ?? 0;
    const outputCost = model.costPer1kOutputTokens ?? 0;
    const combinedCost = inputCost + outputCost;

    if (combinedCost >= 0) {
      score += (1 / (1 + combinedCost * 10)) * ModelRouter.WEIGHTS.COST_EFFICIENCY;
    }

    if (model.reliability) {
      score += model.reliability * ModelRouter.WEIGHTS.RELIABILITY;
    }

    if (model.speed) {
      score += model.speed * ModelRouter.WEIGHTS.SPEED;
    }

    if (requirements.hasImages && model.multimodal) {
      score += ModelRouter.WEIGHTS.MULTIMODAL;
    }

    if (requirements.needsFunctions && model.supportsToolCalls) {
      score += ModelRouter.WEIGHTS.FUNCTIONS;
    }

    const requiredStrengths = requirements.requiredStrengths;
    let totalRequiredWeight = 0;
    let matchedWeight = 0;

    for (const strength of requiredStrengths) {
      const weight =
        ModelRouter.CAPABILITY_WEIGHTS[strength] ?? ModelRouter.DEFAULT_CAPABILITY_WEIGHT;

      totalRequiredWeight += weight;
      if (model.strengths?.includes(strength)) {
        matchedWeight += weight;
      }
    }

    const capabilityMatchScore = totalRequiredWeight > 0 ? matchedWeight / totalRequiredWeight : 1;

    score += capabilityMatchScore * ModelRouter.WEIGHTS.CAPABILITY_MATCH;

    if (requirements.budget_constraint && requirements.budget_constraint > 0) {
      const totalCost = ModelRouter.calculateTotalCost(requirements, model);
      const costRatio = totalCost / requirements.budget_constraint;
      const budgetWeight = ModelRouter.WEIGHTS.BUDGET_EFFICIENCY;
      let budgetAdjustment = 0;

      if (costRatio <= 1) {
        budgetAdjustment = (1 - costRatio) * budgetWeight;
      } else {
        budgetAdjustment = -Math.log(costRatio) * budgetWeight;
      }

      score += budgetAdjustment;
    }

    return score;
  }

  private static async rankModels(
    models: Record<string, ModelConfigItem>,
    requirements: PromptRequirements,
  ): Promise<ModelScore[]> {
    const modelScoresRaw = await Promise.all(
      Object.entries(models).map(([model, config]) =>
        ModelRouter.scoreModel(requirements, model, config),
      ),
    );

    return modelScoresRaw
      .filter((candidate) => Number.isFinite(candidate.score))
      .sort((a, b) => b.score - a.score);
  }

  private static async rankSuitableModels(
    availableModels: Record<string, ModelConfigItem>,
    requirements: PromptRequirements,
    routerMode: ModelRouterMode,
  ): Promise<ModelScore[]> {
    const preferredModels = filterModelsByRouterMode(availableModels, routerMode);
    const preferredScores = await ModelRouter.rankModels(preferredModels, requirements);
    const suitablePreferredModels = preferredScores.filter((model) => model.score > 0);

    if (suitablePreferredModels.length > 0 || routerMode === "auto") {
      return suitablePreferredModels;
    }

    const fallbackScores = await ModelRouter.rankModels(availableModels, requirements);
    const suitableFallbackModels = fallbackScores.filter((model) => model.score > 0);

    if (suitableFallbackModels.length > 0) {
      logger.warn("Preferred automatic mode had no suitable models. Using the accessible pool.", {
        routerMode,
      });
    }

    return suitableFallbackModels;
  }

  private static selectBestModel(
    modelScores: ModelScore[],
    options: { fallbackModel?: string; routerMode?: ModelRouterMode } = {},
  ): string {
    if (modelScores.length === 0) {
      if (options.fallbackModel) {
        logger.warn("No suitable model found. Falling back to default model.");

        return options.fallbackModel;
      }

      throw new AssistantError(
        `No suitable models found for ${options.routerMode ?? "requested"} automatic mode.`,
        ErrorType.PARAMS_ERROR,
      );
    }

    return modelScores[0].model;
  }

  private static shouldCompareModels(requirements: PromptRequirements): boolean {
    if (requirements.benefitsFromMultipleModels) {
      return true;
    }

    return (
      requirements.expectedComplexity >= 3 &&
      (requirements.requiredStrengths.includes("general_knowledge") ||
        requirements.requiredStrengths.includes("creative") ||
        requirements.requiredStrengths.includes("reasoning"))
    );
  }

  private static async selectModelsForComparison(
    modelScores: ModelScore[],
    fallbackModel: string,
  ): Promise<string[]> {
    if (modelScores.length <= 1) {
      return modelScores.length === 1 ? [modelScores[0].model] : [fallbackModel];
    }

    const topRawScore = modelScores[0].score;
    const comparisonModels = [modelScores[0].model];

    for (let i = 1; i < modelScores.length; i++) {
      const model = modelScores[i];

      if (
        model.provider !== modelScores[0].provider &&
        topRawScore - model.score <= ModelRouter.COMPARISON_SCORE_THRESHOLD &&
        comparisonModels.length < ModelRouter.MAX_COMPARISON_MODELS
      ) {
        comparisonModels.push(model.model);
      }
    }

    return comparisonModels;
  }

  public static async selectModel(
    env: IEnv,
    prompt: string,
    attachments?: Attachment[],
    budget_constraint?: number,
    user?: IUser,
    completion_id?: string,
    routerMode: ModelRouterMode = "auto",
  ): Promise<string> {
    const availableModels = await getIncludedInRouterModelsForUser(env, user);
    const fallbackModel = resolveDefaultChatModel(availableModels, user).id;

    return trackModelRoutingMetrics(
      async () => {
        const requirements = await PromptAnalyzer.analyzePrompt(
          env,
          prompt,
          attachments,
          budget_constraint,
          user,
        );

        const suitableModels = await ModelRouter.rankSuitableModels(
          availableModels,
          requirements,
          routerMode,
        );

        return ModelRouter.selectBestModel(suitableModels, {
          fallbackModel: routerMode === "auto" ? fallbackModel : undefined,
          routerMode,
        });
      },
      env.ANALYTICS,
      { prompt },
      user?.id,
      completion_id,
    ).catch((error) => {
      logger.error("Error in model selection:", { error });
      if (routerMode !== "auto") {
        throw error;
      }

      return fallbackModel;
    });
  }

  public static async selectMultipleModels(
    env: IEnv,
    prompt: string,
    attachments?: Attachment[],
    budget_constraint?: number,
    user?: IUser,
    completion_id?: string,
    routerMode: ModelRouterMode = "auto",
  ): Promise<string[]> {
    const availableModels = await getIncludedInRouterModelsForUser(env, user);
    const fallbackModel = resolveDefaultChatModel(availableModels, user).id;

    return trackModelRoutingMetrics(
      async () => {
        const requirements = await PromptAnalyzer.analyzePrompt(
          env,
          prompt,
          attachments,
          budget_constraint,
          user,
        );

        const suitableModels = await ModelRouter.rankSuitableModels(
          availableModels,
          requirements,
          routerMode,
        );

        if (suitableModels.length === 0) {
          return [
            ModelRouter.selectBestModel(suitableModels, {
              fallbackModel: routerMode === "auto" ? fallbackModel : undefined,
              routerMode,
            }),
          ];
        }

        const doesComplexityRequireComparison = ModelRouter.shouldCompareModels(requirements);

        if (doesComplexityRequireComparison) {
          return await ModelRouter.selectModelsForComparison(suitableModels, fallbackModel);
        }

        return [
          ModelRouter.selectBestModel(suitableModels, {
            fallbackModel: routerMode === "auto" ? fallbackModel : undefined,
            routerMode,
          }),
        ];
      },
      env.ANALYTICS,
      { prompt },
      user?.id,
      completion_id,
    ).catch((error) => {
      logger.error("Error in multi-model selection:", { error });
      if (routerMode !== "auto") {
        throw error;
      }

      return [fallbackModel];
    });
  }
}
