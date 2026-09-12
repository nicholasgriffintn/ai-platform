import type { RecipeInstallationTrigger } from "@ngriffin_uk/polychat-schemas";

import { canonicalJson } from "~/utils/canonical-json";
import { sha256Hex } from "~/utils/crypto";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";

function validateTimezone(timezone: string): void {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: timezone }).format(new Date());
  } catch {
    throw new AssistantError(`Unknown schedule timezone: ${timezone}`, ErrorType.PARAMS_ERROR, 400);
  }
}

export async function normaliseRecipeInstallationTriggers(
  triggers: readonly RecipeInstallationTrigger[],
  identitySeed?: string,
): Promise<RecipeInstallationTrigger[]> {
  const ids = new Set<string>();
  const normalised: RecipeInstallationTrigger[] = [];

  for (const [index, trigger] of triggers.entries()) {
    const generatedId = identitySeed
      ? `recipe_trigger_${(
          await sha256Hex(
            canonicalJson({ identitySeed, index, trigger: { ...trigger, id: undefined } }),
          )
        ).slice(0, 40)}`
      : `recipe_trigger_${generateId()}`;
    const id = trigger.id ?? generatedId;
    const timezone = trigger.timezone ?? "UTC";

    if (ids.has(id)) {
      throw new AssistantError("Recipe trigger IDs must be unique", ErrorType.PARAMS_ERROR, 400);
    }

    ids.add(id);

    if (trigger.type === "schedule" || trigger.type === "once") {
      validateTimezone(timezone);
    }

    normalised.push({ ...trigger, id, timezone });
  }

  return normalised;
}
