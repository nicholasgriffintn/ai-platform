import { resolveTierModel } from "@ngriffin_uk/polychat-ai-models";
import { getPromptText } from "@ngriffin_uk/polychat-ai-prompts";
import type { ModelConfigItem, ModelTier } from "@ngriffin_uk/polychat-schemas";

import { MAX_COMPARISON_MODELS } from "~/config/limits";
import { getLineupModelsForUser } from "~/modules/models/application/resolve";
import type { PanelMember } from "~/modules/responses/application/engine/panel";
import type { IEnv, IUser } from "~/types";

const TIER_SEARCH_ORDER: readonly ModelTier[] = ["medium", "high", "low"];

interface OriginalModel {
  model?: string;
  provider?: string;
}

function selectComparisonModels(
  lineup: Awaited<ReturnType<typeof getLineupModelsForUser>>,
  user: IUser | undefined,
  original: OriginalModel,
): ModelConfigItem[] {
  const selected: ModelConfigItem[] = [];
  const isOriginal = (model: ModelConfigItem) => model.matchingModel === original.model;
  const isTaken = (model: ModelConfigItem) =>
    selected.some((taken) => taken.matchingModel === model.matchingModel);
  const isNewVendor = (model: ModelConfigItem) =>
    model.provider !== original.provider &&
    !selected.some((taken) => taken.provider === model.provider);
  const passes = [isNewVendor, () => true];

  for (const pass of passes) {
    for (const tier of TIER_SEARCH_ORDER) {
      while (selected.length < MAX_COMPARISON_MODELS) {
        const next = resolveTierModel(lineup, user, tier, "agent", {
          isEligible: (model) => !isOriginal(model) && !isTaken(model) && pass(model),
        });

        if (!next) {
          break;
        }

        selected.push(next.config);
      }
    }
  }

  return selected;
}

export async function resolveComparisonMembers(
  env: IEnv,
  user: IUser | undefined,
  original: OriginalModel,
): Promise<PanelMember[]> {
  const lineup = await getLineupModelsForUser(env, user);

  return selectComparisonModels(lineup, user, original).map((config, index) => ({
    id: `comparison_${index + 1}`,
    name: config.name || config.matchingModel,
    role: "Comparison",
    instruction: getPromptText("apps/functions/comparison-answer"),
    model: config.matchingModel,
    provider: config.provider,
  }));
}
