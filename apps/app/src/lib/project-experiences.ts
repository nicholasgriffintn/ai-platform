import type {
	AssistantActionItem,
	DynamicAppCatalogItem,
	ProjectCapability,
	ProjectExperienceDefinition,
} from "@ngriffin_uk/polychat-schemas";

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

export function getProjectAppOpenPath(
	appId: string,
	appKind: "dynamic" | "frontend" | undefined,
	workspaceId: string,
	projectId: string,
	experiences: ProjectExperienceDefinition[],
): string {
	if (appKind !== "frontend") {
		return `/work/${workspaceId}/projects/${projectId}/apps/${encodeURIComponent(appId)}`;
	}

	const experience = experiences.find(
		(candidate) =>
			candidate.requirement.kind === "capability" &&
			candidate.requirement.capabilityKind === "app" &&
			candidate.requirement.capabilityId === appId,
	);
	return experience
		? getProjectExperiencePath(workspaceId, projectId, experience.id)
		: getProjectExperiencesPath(workspaceId, projectId);
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
	return getProjectAppOpenPath(
		item.capability.id,
		item.metadata?.appKind,
		workspaceId,
		projectId,
		experiences,
	);
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

export function getEnabledProjectDynamicApps(
	capabilities: ProjectCapability[],
	apps: DynamicAppCatalogItem[],
): DynamicAppCatalogItem[] {
	const enabledAppIds = new Set(
		capabilities
			.filter((capability) => capability.kind === "app")
			.map((capability) => capability.capabilityId),
	);
	return apps.filter((app) => app.kind === "dynamic" && enabledAppIds.has(app.id));
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
