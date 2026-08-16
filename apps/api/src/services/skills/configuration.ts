import type { SkillAvailability } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { AssistantError, ErrorType } from "~/utils/errors";
import { listSkillAvailability, resolveSkillAvailability } from "./availability";
import { resolveSkillCatalog } from "./catalog";
import {
	buildSkillAvailabilityInput,
	resolvePersonalSkillScope,
	SKILL_CAPABILITY_KIND,
} from "./scope";

async function loadDisabledSkillIds(context: ServiceContext, userId: number): Promise<Set<string>> {
	const scope = await resolvePersonalSkillScope(
		context.repositories.capabilityConfigurations,
		userId,
	);
	return new Set(scope.disabledSkillIds);
}

export async function getPersonalSkillAvailability(
	context: ServiceContext,
	userId: number,
): Promise<SkillAvailability[]> {
	const disabledSkillIds = await loadDisabledSkillIds(context, userId);
	const catalog = await resolveSkillCatalog(context, { type: "personal", id: userId });

	return await listSkillAvailability(
		buildSkillAvailabilityInput({
			skillScope: { scope: "personal", disabledSkillIds },
			supportsToolCalls: true,
		}),
		catalog.listDefinitions(),
	);
}

export async function setPersonalSkillEnabled(
	context: ServiceContext,
	userId: number,
	skillId: string,
	enabled: boolean,
): Promise<SkillAvailability> {
	const catalog = await resolveSkillCatalog(context, { type: "personal", id: userId });
	const skill = catalog.getDefinition(skillId);
	if (!skill) {
		throw new AssistantError("Unknown skill", ErrorType.NOT_FOUND, 404);
	}

	if (skill.alwaysOn) {
		throw new AssistantError(
			`${skill.name} is always available and cannot be turned off.`,
			ErrorType.PARAMS_ERROR,
			400,
		);
	}

	await context.repositories.capabilityConfigurations.save({
		scope: { type: "user", id: userId },
		capabilityKind: SKILL_CAPABILITY_KIND,
		capabilityId: skillId,
		configuration: { enabled },
	});

	const disabledSkillIds = await loadDisabledSkillIds(context, userId);

	return resolveSkillAvailability(
		skill,
		buildSkillAvailabilityInput({
			skillScope: { scope: "personal", disabledSkillIds },
			supportsToolCalls: true,
		}),
	);
}
