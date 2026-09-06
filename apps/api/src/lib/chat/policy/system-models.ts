import {
  getSystemModelLineup,
  resolveLineupCandidate,
  type ModelConfigItem,
  type SystemModelRole,
} from "@ngriffin_uk/polychat-schemas";

import { getModels } from "~/lib/providers/models";
import { AssistantError, ErrorType } from "~/utils/errors";

const SYSTEM_ROLE_CAPABILITIES: Partial<Record<SystemModelRole, keyof ModelConfigItem>> = {
  fim: "supportsFim",
  nextEdit: "supportsNextEdit",
  applyEdit: "supportsApplyEdit",
};

export function resolveSystemModelId(
  role: SystemModelRole,
  options: { preferredProvider?: string } = {},
): string {
  const lineup = getSystemModelLineup(role);
  const capability = SYSTEM_ROLE_CAPABILITIES[role];
  const selected = resolveLineupCandidate(getModels({ shouldUseCache: false }), lineup.candidates, {
    isEligible: (model) =>
      (!capability || Boolean(model[capability])) &&
      (!options.preferredProvider || model.provider === options.preferredProvider),
  });

  if (!selected) {
    throw new AssistantError(
      `No ${lineup.label.toLowerCase()} model is available${
        options.preferredProvider ? ` for provider ${options.preferredProvider}` : ""
      }`,
      ErrorType.PARAMS_ERROR,
    );
  }

  return selected.id;
}
