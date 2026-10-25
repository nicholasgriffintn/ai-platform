import type { ModelTier } from "@ngriffin_uk/polychat-schemas";

import { selectModels } from "~/modules/models/application/access";
import type { ModelFallback } from "~/modules/models/application/model-fallback";
import { resolveRequestModelConfig } from "~/modules/models/application/request-config";
import type { AgentModelSelection } from "~/modules/responses/application/engine/agent/agent-loop";
import { resolveRunProvenance } from "~/modules/responses/application/engine/core/run-provenance";
import { applyProjectModelGovernance } from "~/modules/responses/application/engine/policy/project-model-governance";
import type { ChatRunLifecycle } from "~/modules/responses/application/runs/lifecycle";
import type { Attachment, CoreChatOptions } from "~/types";

export interface TierModelSelection {
  tier: ModelTier;
  attachments: Attachment[];
}

export function createTierModelFallback(params: {
  options: CoreChatOptions;
  selection: TierModelSelection;
  runLifecycle: ChatRunLifecycle | null;
  teammateId?: string;
}): ModelFallback<AgentModelSelection> {
  const { options, selection, runLifecycle } = params;

  return {
    sameAs: (left, right) => left.model === right.model && left.provider === right.provider,
    reselect: async () => {
      const selected = await selectModels({
        env: options.env,
        user: options.context?.user,
        attachments: selection.attachments,
        tier: selection.tier,
        requestedProvider: options.provider,
        shouldUseCache: false,
      });
      const governed = await applyProjectModelGovernance(options, {
        models: selected.models,
        provider: options.provider,
        usesModelTier: true,
      });
      const model = governed.models[0];
      const modelConfig = model
        ? await resolveRequestModelConfig(options, model, governed.provider)
        : null;

      if (!modelConfig || modelConfig.kind === "agent") {
        return null;
      }

      const provenance = resolveRunProvenance({
        requestedSite: options.compute_site,
        model: modelConfig.matchingModel,
        provider: modelConfig.provider,
        modelConfig,
        teammateId: params.teammateId,
      });

      if (provenance.site !== "hosted") {
        return null;
      }

      await runLifecycle?.recordProvenance(provenance);

      return { model: modelConfig.matchingModel, provider: modelConfig.provider, provenance };
    },
  };
}
