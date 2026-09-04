import type {
  AssistantActionItem,
  ProjectCapabilityKind,
  ProjectExperienceDefinition,
} from "@ngriffin_uk/polychat-schemas";

import {
  createAgentConversationActionPath,
  createRecipeManagementActionPath,
} from "./assistant-action-launch";

/**
 * Where a set of capability surfaces lives. Work nests them under a project; Chat nests them
 * under the personal conversation. Everything below takes the base path rather than ids so
 * both scopes share one implementation.
 */
export interface CapabilitySurface {
  basePath: string;
  projectId?: string;
  workspaceId?: string;
}

/**
 * The shape both a project capability and a personal capability satisfy. `createdBy` is
 * absent personally, where there is only ever one owner.
 */
export interface EnabledCapability {
  id: string;
  kind: ProjectCapabilityKind;
  capabilityId: string;
  configuration: Record<string, unknown>;
  createdAt: string;
  createdBy?: number;
  projectId?: string;
}

export const PERSONAL_SURFACE: CapabilitySurface = { basePath: "/chat" };

export function getProjectSurface(workspaceId: string, projectId: string): CapabilitySurface {
  return { basePath: `/work/${workspaceId}/projects/${projectId}`, projectId, workspaceId };
}

export function getAgentEditorPath(surface: CapabilitySurface, agentId: string): string {
  return `${surface.basePath}/agents/${agentId}`;
}

export function getSkillEditorPath(surface: CapabilitySurface, skillId: string): string {
  const librarySegment = surface.projectId ? "library" : "capabilities";

  return `${surface.basePath}/${librarySegment}/skills/${encodeURIComponent(skillId)}`;
}

export function getConversationPath(surface: CapabilitySurface): string {
  return surface.projectId ? `${surface.basePath}/chat` : surface.basePath;
}

export function getExperiencesPath(surface: CapabilitySurface): string {
  return `${surface.basePath}/experiences`;
}

export function getCapabilityLibraryPath(surface: CapabilitySurface): string {
  return `${surface.basePath}/capabilities`;
}

export function getExperiencePath(
  surface: CapabilitySurface,
  experienceId: string,
  suffix?: string,
): string {
  const base = `${getExperiencesPath(surface)}/${experienceId}`;

  return suffix ? `${base}/${suffix.replace(/^\/+/, "")}` : base;
}

export interface ExperienceBackLink {
  to: string;
  label: string;
}

/**
 * Walk one level up rather than jumping straight back to the hub, so a pattern returns to its
 * list and a prediction returns to the prediction list.
 */
export function getExperienceBackLink(
  surface: CapabilitySurface,
  experienceId: string,
  subpath: string,
  experienceName?: string,
): ExperienceBackLink {
  const segments = subpath.split("/").filter(Boolean);

  if (segments.length === 0) {
    return { to: getExperiencesPath(surface), label: "Back to experiences" };
  }

  const parent = segments.slice(0, -1).join("/");

  return {
    to: getExperiencePath(surface, experienceId, parent || undefined),
    label: parent ? "Back" : `Back to ${experienceName ?? "list"}`,
  };
}

export function getToolRunPath(surface: CapabilitySurface, toolId: string): string {
  return `${surface.basePath}/tools/${encodeURIComponent(toolId)}`;
}

export function getAppOpenPath(
  surface: CapabilitySurface,
  appId: string,
  experiences: ProjectExperienceDefinition[],
): string {
  const experience = experiences.find(
    (candidate) =>
      candidate.requirement.kind === "capability" &&
      candidate.requirement.capabilityKind === "app" &&
      candidate.requirement.capabilityId === appId,
  );

  return experience ? getExperiencePath(surface, experience.id) : getExperiencesPath(surface);
}

function capabilityEnablesExperience(
  capability: EnabledCapability,
  experience: ProjectExperienceDefinition,
): boolean {
  const requirement = experience.requirement;

  if (capability.kind !== requirement.capabilityKind) {
    return false;
  }

  if (requirement.kind === "capability") {
    return capability.capabilityId === requirement.capabilityId;
  }

  return true;
}

export function getCapabilityOpenPath(
  item: AssistantActionItem,
  surface: CapabilitySurface,
  experiences: ProjectExperienceDefinition[],
): string | null {
  if (item.capability.availability === "unavailable") {
    return null;
  }

  if (item.kind === "agent") {
    return createAgentConversationActionPath(getConversationPath(surface), item.capability.id);
  }

  if (item.kind === "recipe" || item.kind === "installed_recipe") {
    const recipeId = item.metadata?.recipeId ?? item.capability.id;

    return createRecipeManagementActionPath(
      getCapabilityLibraryPath(surface),
      "configure",
      recipeId,
    );
  }

  if (item.kind === "tool" && item.metadata?.toolRunnable && item.metadata.toolId) {
    return getToolRunPath(surface, item.metadata.toolId);
  }

  if (item.kind !== "app") {
    return null;
  }

  return getAppOpenPath(surface, item.capability.id, experiences);
}

export function getEnabledExperiences(
  capabilities: EnabledCapability[],
  experiences: ProjectExperienceDefinition[],
): ProjectExperienceDefinition[] {
  return experiences.filter((experience) =>
    capabilities.some((capability) => capabilityEnablesExperience(capability, experience)),
  );
}

export function isExperienceEnabled(
  experience: ProjectExperienceDefinition,
  capabilities: EnabledCapability[],
): boolean {
  return capabilities.some((capability) => capabilityEnablesExperience(capability, experience));
}
