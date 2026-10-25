import { priceUsageDraft } from "@ngriffin_uk/polychat-ai-billing";
import {
  modelRateResource,
  rateEntriesFromModelConfig,
  type ModelConfigItem,
  type SpendLedger,
  type UsageUnit,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  episodeUsagePlan,
  listenUsagePlan,
  pickAffordableLength,
  remainingCreditMicros,
  type MediaUsagePlan,
  type PaidEpisodeLength,
} from "~/modules/discover/domain/cost";
import { DISCOVER_MODEL_TIER } from "~/modules/discover/domain/settings";
import {
  findModelConfig,
  getImageModel,
  getSpeechModel,
  getTierModel,
} from "~/modules/models/application/resolve";
import { getRecipeInstallationSpend } from "~/modules/recipes/application/installation-budget";

interface PricedModels {
  text: ModelConfigItem | null;
  speech: ModelConfigItem | null;
  image: ModelConfigItem | null;
}

export interface DiscoverCosts {
  episode: Record<PaidEpisodeLength, number>;
  listen: number;
}

function price(model: ModelConfigItem | null, unit: UsageUnit, quantity: number): number {
  if (!model || quantity <= 0) {
    return 0;
  }

  const resource = modelRateResource(model);

  return priceUsageDraft({
    source: "model",
    vendor: model.provider,
    resource,
    unit,
    quantity,
    rates: rateEntriesFromModelConfig(model, { resource }),
  }).creditMicros;
}

function pricePlan(models: PricedModels, plan: MediaUsagePlan): number {
  return (
    price(models.text, "input_tokens", plan.inputTokens) +
    price(models.text, "output_tokens", plan.outputTokens) +
    price(models.speech, "characters", plan.characters) +
    price(models.image, "images", plan.images)
  );
}

async function resolvePricedModels(context: ServiceContext): Promise<PricedModels> {
  const user = context.requireUser();
  const [text, speech, image] = await Promise.all([
    getTierModel(context.env, user, DISCOVER_MODEL_TIER),
    getSpeechModel(context.env, user),
    getImageModel(context.env, user),
  ]);
  const [textConfig, speechConfig, imageConfig] = await Promise.all([
    findModelConfig(text.model, context.env, text.provider, user.id),
    findModelConfig(speech.model, context.env, speech.provider, user.id),
    image?.id ? findModelConfig(image.id, context.env, image.provider, user.id) : null,
  ]);

  return { text: textConfig, speech: speechConfig, image: imageConfig };
}

export async function estimateDiscoverCosts(context: ServiceContext): Promise<DiscoverCosts> {
  const models = await resolvePricedModels(context);

  return {
    episode: {
      short: pricePlan(models, episodeUsagePlan("short")),
      standard: pricePlan(models, episodeUsagePlan("standard")),
      long: pricePlan(models, episodeUsagePlan("long")),
    },
    listen: pricePlan(models, listenUsagePlan()),
  };
}

export async function affordableEpisodeLength(
  context: ServiceContext,
  installationId: string | null,
  preferred: PaidEpisodeLength,
): Promise<PaidEpisodeLength | null> {
  const remaining = remainingCreditMicros(await readDiscoverSpend(context, installationId));

  return remaining === null
    ? preferred
    : pickAffordableLength(preferred, (await estimateDiscoverCosts(context)).episode, remaining);
}

export async function canAffordDiscoverListen(
  context: ServiceContext,
  installationId: string | null,
): Promise<boolean> {
  const remaining = remainingCreditMicros(await readDiscoverSpend(context, installationId));

  return remaining === null || (await estimateDiscoverCosts(context)).listen <= remaining;
}

export async function requireDiscoverBudgetLeft(
  context: ServiceContext,
  installationId: string | null,
): Promise<void> {
  const remaining = remainingCreditMicros(await readDiscoverSpend(context, installationId));

  if (remaining !== null && remaining <= 0) {
    throw new AssistantError(
      "This month's Discover budget is spent. Raise it in Discover settings.",
      ErrorType.PARAMS_ERROR,
      402,
    );
  }
}

export async function readDiscoverSpend(
  context: ServiceContext,
  installationId: string | null,
): Promise<SpendLedger | null> {
  return installationId
    ? getRecipeInstallationSpend({
        context,
        userId: context.requireUser().id,
        installationId,
      })
    : null;
}
