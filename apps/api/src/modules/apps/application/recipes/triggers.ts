import type { RecipeInstallationTrigger } from "@ngriffin_uk/polychat-schemas";
import { sha256Hex } from "@ngriffin_uk/polychat-utility-server/crypto";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { generateId } from "@ngriffin_uk/polychat-utility-server/id";

import { canonicalJson } from "~/infrastructure/canonical-json";

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
