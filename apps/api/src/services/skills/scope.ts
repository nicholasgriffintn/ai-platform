import type { SkillAvailability } from "@ngriffin_uk/polychat-schemas";

import { getModelConfigByMatchingModel } from "~/lib/providers/models";
import type { CapabilityConfigurationRepository } from "~/repositories/CapabilityConfigurationRepository";
import type { IRequest } from "~/types";
import {
	listSkillAvailability,
	type SkillAvailabilityInput,
	type SkillScopeKind,
} from "./availability";

export const SKILL_CAPABILITY_KIND = "skill";
const SKILL_DISABLED_CONFIGURATION_KEY = "enabled";

interface StoredSkillConfiguration {
	capabilityId: string;
	configuration: Record<string, unknown>;
}

export function resolveDisabledSkillIds(
	configurations: readonly StoredSkillConfiguration[],
): Set<string> {
	return new Set(
		configurations
			.filter((entry) => entry.configuration[SKILL_DISABLED_CONFIGURATION_KEY] === false)
			.map((entry) => entry.capabilityId),
	);
}

export interface RequestSkillScope {
	scope: SkillScopeKind;
	enabledSkillIds?: ReadonlySet<string>;
	disabledSkillIds?: ReadonlySet<string>;
}

export function createProjectSkillScope(skillIds: Iterable<string>): RequestSkillScope {
	return { scope: "project", enabledSkillIds: new Set(skillIds) };
}

export async function resolvePersonalSkillScope(
	repository: Pick<CapabilityConfigurationRepository, "list">,
	userId: number,
): Promise<RequestSkillScope> {
	const configurations = await repository.list({ type: "user", id: userId }, SKILL_CAPABILITY_KIND);
	return { scope: "personal", disabledSkillIds: resolveDisabledSkillIds(configurations) };
}

export function buildSkillAvailabilityInput(params: {
	skillScope: RequestSkillScope;
	supportsToolCalls: boolean;
	enabledToolIds?: ReadonlySet<string>;
}): SkillAvailabilityInput {
	return {
		scope: params.skillScope.scope,
		modelCapabilities: { supportsToolCalls: params.supportsToolCalls },
		...(params.enabledToolIds ? { enabledToolIds: params.enabledToolIds } : {}),
		...(params.skillScope.enabledSkillIds
			? { enabledSkillIds: params.skillScope.enabledSkillIds }
			: {}),
		...(params.skillScope.disabledSkillIds
			? { disabledSkillIds: params.skillScope.disabledSkillIds }
			: {}),
	};
}

export async function resolveSkillScope(request: IRequest): Promise<RequestSkillScope> {
	const context = request.context;
	const projectId =
		request.memoryScope?.type === "project" ? request.memoryScope.projectId : undefined;

	if (projectId && context) {
		const capabilities = await context.repositories.workspaces.listProjectCapabilities(projectId);
		return createProjectSkillScope(
			capabilities
				.filter((capability) => capability.kind === SKILL_CAPABILITY_KIND)
				.map((capability) => capability.capability_id),
		);
	}

	if (context && request.user?.id) {
		return resolvePersonalSkillScope(
			context.repositories.capabilityConfigurations,
			request.user.id,
		);
	}

	return { scope: "personal" };
}

export async function resolveRequestSkills(request: IRequest): Promise<SkillAvailability[]> {
	const model = request.request?.model;
	const modelConfig = model
		? await getModelConfigByMatchingModel(model, undefined, request.request?.provider)
		: undefined;
	const skillScope = await resolveSkillScope(request);

	return await listSkillAvailability(
		buildSkillAvailabilityInput({
			skillScope,
			supportsToolCalls: modelConfig?.supportsToolCalls ?? true,
			enabledToolIds: new Set(request.request?.enabled_tools ?? []),
		}),
	);
}
