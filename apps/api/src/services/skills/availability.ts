import type { SkillAvailability } from "@ngriffin_uk/polychat-schemas";

import { listSkillDefinitions } from "./catalog";
import { toSkillSummary, type SkillDefinition } from "./types";

export type SkillScopeKind = "personal" | "project";

export interface SkillAvailabilityInput {
	/**
	 * Personal scope treats skills as curation: everything is on until the user turns it off.
	 * Project scope treats them as authorisation: nothing is on until the project enables it.
	 */
	scope: SkillScopeKind;
	modelCapabilities: Record<string, boolean | undefined>;
	enabledToolIds?: ReadonlySet<string>;
	enabledSkillIds?: ReadonlySet<string>;
	disabledSkillIds?: ReadonlySet<string>;
}

function getMissingModelCapabilities(
	skill: SkillDefinition,
	modelCapabilities: Record<string, boolean | undefined>,
): string[] {
	return skill.requirement.modelCapabilities.filter(
		(capability) => modelCapabilities[capability] !== true,
	);
}

function getMissingTools(
	skill: SkillDefinition,
	enabledToolIds: ReadonlySet<string> | undefined,
): string[] {
	const required = skill.requirement.tools;
	if (required.length === 0) return [];

	return required.filter((toolId) => !enabledToolIds?.has(toolId));
}

export function resolveSkillAvailability(
	skill: SkillDefinition,
	input: SkillAvailabilityInput,
): SkillAvailability {
	const summary = toSkillSummary(skill);
	const missingModelCapabilities = getMissingModelCapabilities(skill, input.modelCapabilities);
	if (missingModelCapabilities.length > 0) {
		return {
			...summary,
			state: "unavailable",
			reason: `The selected model does not support ${missingModelCapabilities.join(", ")}.`,
		};
	}

	const missingTools = getMissingTools(skill, input.enabledToolIds);
	if (missingTools.length > 0) {
		return {
			...summary,
			state: "unavailable",
			reason: `Requires these tools to be enabled: ${missingTools.join(", ")}.`,
		};
	}

	if (skill.alwaysOn) {
		return { ...summary, state: "ready", reason: "Always available." };
	}

	const enabled =
		input.scope === "project"
			? Boolean(input.enabledSkillIds?.has(skill.id))
			: !input.disabledSkillIds?.has(skill.id);

	return enabled
		? { ...summary, state: "ready", reason: "Enabled for this conversation." }
		: {
				...summary,
				state: "disabled",
				reason:
					input.scope === "project"
						? "Not enabled for this project."
						: "Turned off in your capabilities.",
			};
}

export async function listSkillAvailability(
	input: SkillAvailabilityInput,
	definitions?: readonly SkillDefinition[],
): Promise<SkillAvailability[]> {
	return (definitions ?? (await listSkillDefinitions())).map((skill) =>
		resolveSkillAvailability(skill, input),
	);
}

export async function listReadySkills(input: SkillAvailabilityInput): Promise<SkillAvailability[]> {
	return (await listSkillAvailability(input)).filter((skill) => skill.state === "ready");
}
