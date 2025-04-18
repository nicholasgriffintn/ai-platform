import type {
  Attachment,
  IEnv,
  IUser,
  ModelConfigItem,
  PromptRequirements,
} from "../../types";
import {
  defaultModel,
  filterModelsForUserAccess,
  getIncludedInRouterModels,
  getModelConfig,
} from "../models";
import { trackModelRoutingMetrics } from "../monitoring";
import { PromptAnalyzer } from "./promptAnalyser";

interface ModelScore {
  model: string;
  score: number;
  reason: string;
}

// biome-ignore lint/complexity/noStaticOnlyClass: i want to use this class as a static class
export class ModelRouter {
  private static readonly WEIGHTS = {
    COMPLEXITY_MATCH: 2,
    BUDGET_EFFICIENCY: 3,
    RELIABILITY: 1,
    SPEED: 1,
    MULTIMODAL: 5,
    FUNCTIONS: 5,
    CAPABILITY_MATCH: 4,
    COST_EFFICIENCY: 2,
  } as const;

  // Minimum score difference to consider models distinct enough for comparison
  private static readonly COMPARISON_SCORE_THRESHOLD = 3.0;
  // Maximum number of models to compare
  private static readonly MAX_COMPARISON_MODELS = 2;

  private static scoreModel(
    requirements: PromptRequirements,
    model: string,
  ): ModelScore {
    const capabilities = getModelConfig(model);

    if (requirements.requiredCapabilities.length === 0) {
      return { model, score: 0, reason: "No required capabilities" };
    }

    if (!ModelRouter.isWithinBudget(requirements, capabilities)) {
      return { model, score: 0, reason: "Over budget" };
    }

    const score = ModelRouter.calculateScore(requirements, capabilities);

    return {
      model,
      score,
      reason: "Matched requirements",
    };
  }

  private static isWithinBudget(
    requirements: PromptRequirements,
    model: ModelConfigItem,
  ): boolean {
    if (!requirements.budget_constraint) return true;

    const totalCost = ModelRouter.calculateTotalCost(requirements, model);
    return totalCost <= requirements.budget_constraint;
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

  private static calculateScore(
    requirements: PromptRequirements,
    model: ModelConfigItem,
  ): number {
    let score = 0;

    if (model.contextComplexity) {
      score +=
        Math.max(
          0,
          5 -
            Math.abs(requirements.expectedComplexity - model.contextComplexity),
        ) * ModelRouter.WEIGHTS.COMPLEXITY_MATCH;
    }

    if (requirements.budget_constraint) {
      const totalCost = ModelRouter.calculateTotalCost(requirements, model);
      const budgetFactor = Math.max(
        0,
        1 - totalCost / requirements.budget_constraint,
      );
      score += budgetFactor * ModelRouter.WEIGHTS.BUDGET_EFFICIENCY;
    }

    const inputCost = model.costPer1kInputTokens ?? 0;
    const outputCost = model.costPer1kOutputTokens ?? 0;
    const combinedCost = inputCost + outputCost;

    if (combinedCost >= 0) {
      score +=
        (1 / (1 + combinedCost * 10)) * ModelRouter.WEIGHTS.COST_EFFICIENCY;
    }

    if (model.reliability) {
      score += model.reliability * ModelRouter.WEIGHTS.RELIABILITY;
    }

    if (model.speed) {
      score += (6 - model.speed) * ModelRouter.WEIGHTS.SPEED;
    }

    if (requirements.hasImages && model.multimodal) {
      score += ModelRouter.WEIGHTS.MULTIMODAL;
    }

    // TODO: Put this back when we can work out how to not make this conflict with capabilities
    /* if (requirements.needsFunctions && model.supportsFunctions) {
      score += ModelRouter.WEIGHTS.FUNCTIONS;
    } */

    const matchedCapabilities = requirements.requiredCapabilities.filter(
      (cap) => model.strengths?.includes(cap),
    );
    const capabilityMatchPercentage =
      requirements.requiredCapabilities.length > 0
        ? matchedCapabilities.length / requirements.requiredCapabilities.length
        : 1;

    score += capabilityMatchPercentage * ModelRouter.WEIGHTS.CAPABILITY_MATCH;

    return score;
  }

  private static rankModels(
    models: Record<string, ModelConfigItem>,
    requirements: PromptRequirements,
  ): ModelScore[] {
    return Object.keys(models)
      .map((model) => ModelRouter.scoreModel(requirements, model))
      .sort((a, b) => b.score - a.score);
  }

  private static selectBestModel(modelScores: ModelScore[]): string {
    if (modelScores.length === 0) {
      console.warn("No suitable model found. Falling back to default model.");
      return defaultModel;
    }

    return modelScores[0].model;
  }

  private static shouldCompareModels(
    requirements: PromptRequirements,
  ): boolean {
    return (
      requirements.expectedComplexity >= 3 &&
      (requirements.requiredCapabilities.includes("general_knowledge") ||
        requirements.requiredCapabilities.includes("creative") ||
        requirements.requiredCapabilities.includes("reasoning"))
    );
  }

  private static selectModelsForComparison(
    modelScores: ModelScore[],
  ): string[] {
    if (modelScores.length <= 1) {
      return modelScores.length === 1 ? [modelScores[0].model] : [defaultModel];
    }

    const topScore = modelScores[0].score;
    const comparisonModels = [modelScores[0].model];

    // First try to add models from different providers
    for (let i = 1; i < modelScores.length; i++) {
      const model = modelScores[i];
      const modelConfig = getModelConfig(model.model);
      const topModelConfig = getModelConfig(modelScores[0].model);

      // Only add models from a different provider that are close in score
      if (
        modelConfig.provider !== topModelConfig.provider &&
        topScore - model.score <= ModelRouter.COMPARISON_SCORE_THRESHOLD &&
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
  ): Promise<string> {
    return trackModelRoutingMetrics(
      async () => {
        const requirements = await PromptAnalyzer.analyzePrompt(
          env,
          prompt,
          attachments,
          budget_constraint,
          user,
        );

        const allRouterModels = getIncludedInRouterModels();

        const availableModels = await filterModelsForUserAccess(
          allRouterModels,
          env,
          user?.id,
        );

        const modelScores = ModelRouter.rankModels(
          availableModels,
          requirements,
        );

        const suitableModels = modelScores.filter((model) => model.score > 0);

        return ModelRouter.selectBestModel(suitableModels);
      },
      env.ANALYTICS,
      { prompt },
      user?.id,
      completion_id,
    ).catch((error) => {
      console.error("Error in model selection:", error);
      return defaultModel;
    });
  }

  public static async selectMultipleModels(
    env: IEnv,
    prompt: string,
    attachments?: Attachment[],
    budget_constraint?: number,
    user?: IUser,
    completion_id?: string,
  ): Promise<string[]> {
    return trackModelRoutingMetrics(
      async () => {
        const requirements = await PromptAnalyzer.analyzePrompt(
          env,
          prompt,
          attachments,
          budget_constraint,
          user,
        );

        const allRouterModels = getIncludedInRouterModels();

        const availableModels = await filterModelsForUserAccess(
          allRouterModels,
          env,
          user?.id,
        );

        const modelScores = ModelRouter.rankModels(
          availableModels,
          requirements,
        );

        const suitableModels = modelScores.filter((model) => model.score > 0);

        if (ModelRouter.shouldCompareModels(requirements)) {
          return ModelRouter.selectModelsForComparison(suitableModels);
        }

        return [ModelRouter.selectBestModel(suitableModels)];
      },
      env.ANALYTICS,
      { prompt },
      user?.id,
      completion_id,
    ).catch((error) => {
      console.error("Error in multi-model selection:", error);
      return [defaultModel];
    });
  }
}
