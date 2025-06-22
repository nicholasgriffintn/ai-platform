import { PromptAnalyzer } from "~/lib/modelRouter/promptAnalyser";
import {
  defaultModel,
  filterModelsForUserAccess,
  getIncludedInRouterModels,
  getModelConfig,
} from "~/lib/models";
import { trackModelRoutingMetrics } from "~/lib/monitoring";
import type {
  Attachment,
  IEnv,
  IUser,
  ModelConfigItem,
  PromptRequirements,
} from "~/types";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "MODEL_ROUTER" });

interface ModelScore {
  model: string;
  score: number;
  reason: string;
  normalizedScore: number;
}

// biome-ignore lint/complexity/noStaticOnlyClass: i want to use this class as a static class
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

  private static async scoreModel(
    requirements: PromptRequirements,
    model: string,
  ): Promise<Omit<ModelScore, "normalizedScore">> {
    const capabilities = await getModelConfig(model);

    if (
      requirements.criticalCapabilities?.some(
        (cap) => !capabilities.strengths?.includes(cap as any),
      )
    ) {
      return {
        model,
        score: Number.NEGATIVE_INFINITY,
        reason: "Missing critical capabilities",
      };
    }

    if (requirements.requiredCapabilities.length === 0) {
      return { model, score: 0, reason: "No required capabilities" };
    }

    const score = ModelRouter.calculateScore(requirements, capabilities);

    return {
      model,
      score,
      reason: "Matched requirements",
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

    if (requirements.needsFunctions && model.supportsFunctions) {
      score += ModelRouter.WEIGHTS.FUNCTIONS;
    }

    const requiredCapabilities = requirements.requiredCapabilities;
    let totalRequiredWeight = 0;
    let matchedWeight = 0;

    for (const cap of requiredCapabilities) {
      const weight =
        ModelRouter.CAPABILITY_WEIGHTS[cap] ??
        ModelRouter.DEFAULT_CAPABILITY_WEIGHT;
      totalRequiredWeight += weight;
      if (model.strengths?.includes(cap as any)) {
        matchedWeight += weight;
      }
    }

    const capabilityMatchScore =
      totalRequiredWeight > 0 ? matchedWeight / totalRequiredWeight : 1;
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
      Object.keys(models).map((model) =>
        ModelRouter.scoreModel(requirements, model),
      ),
    );

    if (modelScoresRaw.length === 0) {
      return [];
    }

    const rawScores = modelScoresRaw.map((s) => s.score);
    const maxScore = Math.max(...rawScores);
    const minScore = Math.min(...rawScores);
    const scoreRange = maxScore - minScore;

    const modelScoresNormalized: ModelScore[] = modelScoresRaw.map((s) => ({
      ...s,
      normalizedScore: scoreRange > 0 ? (s.score - minScore) / scoreRange : 1,
    }));

    return modelScoresNormalized.sort(
      (a, b) => b.normalizedScore - a.normalizedScore,
    );
  }

  private static selectBestModel(modelScores: ModelScore[]): string {
    if (modelScores.length === 0) {
      logger.warn("No suitable model found. Falling back to default model.");
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

  private static async selectModelsForComparison(
    modelScores: ModelScore[],
  ): Promise<string[]> {
    if (modelScores.length <= 1) {
      return modelScores.length === 1 ? [modelScores[0].model] : [defaultModel];
    }

    const topRawScore = modelScores[0].score;
    const comparisonModels = [modelScores[0].model];

    for (let i = 1; i < modelScores.length; i++) {
      const model = modelScores[i];
      const modelConfig = await getModelConfig(model.model);
      const topModelConfig = await getModelConfig(modelScores[0].model);

      if (
        modelConfig.provider !== topModelConfig.provider &&
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
  ): Promise<string> {
    return trackModelRoutingMetrics(
      async () => {
        const allRouterModels = getIncludedInRouterModels();

        const availableModels = await filterModelsForUserAccess(
          allRouterModels,
          env,
          user?.id,
        );

        const requirements = await PromptAnalyzer.analyzePrompt(
          env,
          prompt,
          attachments,
          budget_constraint,
          user,
        );

        const modelScores = await ModelRouter.rankModels(
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
      logger.error("Error in model selection:", { error });
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
        const allRouterModels = getIncludedInRouterModels();

        const availableModels = await filterModelsForUserAccess(
          allRouterModels,
          env,
          user?.id,
        );

        const requirements = await PromptAnalyzer.analyzePrompt(
          env,
          prompt,
          attachments,
          budget_constraint,
          user,
        );

        const modelScores = await ModelRouter.rankModels(
          availableModels,
          requirements,
        );

        const suitableModels = modelScores.filter((model) => model.score > 0);

        const doesComplexityRequireComparison =
          ModelRouter.shouldCompareModels(requirements);

        if (doesComplexityRequireComparison) {
          return await ModelRouter.selectModelsForComparison(suitableModels);
        }

        return [ModelRouter.selectBestModel(suitableModels)];
      },
      env.ANALYTICS,
      { prompt },
      user?.id,
      completion_id,
    ).catch((error) => {
      logger.error("Error in multi-model selection:", { error });
      return [defaultModel];
    });
  }
}
