import type { ProjectCapabilityKind } from "@assistant/schemas";

import { getRecipeById } from "~/services/apps/recipes";
import { getDynamicAppCatalog } from "~/services/dynamic-apps";
import { AssistantError, ErrorType } from "~/utils/errors";

export async function validateProjectCapabilityReference(
	kind: ProjectCapabilityKind,
	capabilityId: string,
): Promise<void> {
	if (kind === "app") {
		const apps = await getDynamicAppCatalog();
		if (!apps.some((app) => app.id === capabilityId)) {
			throw new AssistantError("Unknown project app", ErrorType.NOT_FOUND, 404);
		}
		return;
	}

	if (kind === "recipe" && !getRecipeById(capabilityId)) {
		throw new AssistantError("Unknown project recipe", ErrorType.NOT_FOUND, 404);
	}
}
