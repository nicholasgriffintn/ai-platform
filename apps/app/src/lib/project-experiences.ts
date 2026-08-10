import type {
	AssistantActionItem,
	DynamicAppCatalogItem,
	ProjectCapability,
	ProjectExperienceDefinition,
} from "@assistant/schemas";

import { createRecipeManagementActionPath } from "./assistant-action-launch";

export function getProjectExperiencesPath(workspaceId: string, projectId: string): string {
	return `/work/${workspaceId}/projects/${projectId}/experiences`;
}

export function getProjectLibraryPath(workspaceId: string, projectId: string): string {
	return `/work/${workspaceId}/projects/${projectId}/library`;
}

export function getProjectExperiencePath(
	workspaceId: string,
	projectId: string,
	experienceId: string,
	suffix?: string,
): string {
	const base = `${getProjectExperiencesPath(workspaceId, projectId)}/${experienceId}`;
	return suffix ? `${base}/${suffix.replace(/^\/+/, "")}` : base;
}

function capabilityEnablesExperience(
	capability: ProjectCapability,
	experience: ProjectExperienceDefinition,
	apps: DynamicAppCatalogItem[],
): boolean {
	const requirement = experience.requirement;
	if (capability.kind !== requirement.capabilityKind) return false;
	if (requirement.kind === "capability") {
		return capability.capabilityId === requirement.capabilityId;
	}
	if (requirement.appKind && capability.kind === "app") {
		return apps.some(
			(app) => app.id === capability.capabilityId && app.kind === requirement.appKind,
		);
	}
	return true;
}

export function getProjectCapabilityOpenPath(
	item: AssistantActionItem,
	workspaceId: string,
	projectId: string,
	experiences: ProjectExperienceDefinition[],
): string | null {
	if (item.kind === "recipe" || item.kind === "installed_recipe") {
		const recipeId = item.metadata?.recipeId ?? item.capability.id;
		return createRecipeManagementActionPath(
			getProjectLibraryPath(workspaceId, projectId),
			"configure",
			recipeId,
		);
	}

	if (item.kind !== "app") return null;
	if (item.metadata?.appKind !== "frontend") {
		return `/work/${workspaceId}/projects/${projectId}/apps/${item.capability.id}`;
	}

	const experience = experiences.find(
		(candidate) =>
			candidate.requirement.kind === "capability" &&
			candidate.requirement.capabilityKind === "app" &&
			candidate.requirement.capabilityId === item.capability.id,
	);
	return experience
		? getProjectExperiencePath(workspaceId, projectId, experience.id)
		: getProjectExperiencesPath(workspaceId, projectId);
}

export function getEnabledProjectExperiences(
	capabilities: ProjectCapability[],
	experiences: ProjectExperienceDefinition[],
	apps: DynamicAppCatalogItem[],
): ProjectExperienceDefinition[] {
	return experiences.filter((experience) =>
		capabilities.some((capability) => capabilityEnablesExperience(capability, experience, apps)),
	);
}

export function isProjectExperienceEnabled(
	experience: ProjectExperienceDefinition,
	capabilities: ProjectCapability[],
	apps: DynamicAppCatalogItem[],
): boolean {
	return capabilities.some((capability) =>
		capabilityEnablesExperience(capability, experience, apps),
	);
}
