import type {
  AssistantActionItem,
  ProjectCapabilityKind,
  ProjectExperienceDefinition,
} from "@ngriffin_uk/polychat-schemas";

import {
  createTeammateConversationActionPath,
  createRecipeManagementActionPath,
} from "./assistant-action-launch";
import { getPlacePaths } from "./navigation/places";

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

export interface AppProjectScope {
  name?: string;
  capabilities?: EnabledCapability[];
  isLoading: boolean;
  error?: Error | null;
}

export function getProjectSurface(workspaceId: string, projectId: string): CapabilitySurface {
  return { basePath: `/work/${workspaceId}/projects/${projectId}`, projectId, workspaceId };
}

export const NEW_TEAMMATE_ID = "new";

export function getTeammateEditorPath(surface: CapabilitySurface, teammateId: string): string {
  return `${surface.basePath}/teammates/${teammateId}`;
}

export function getConversationPath(surface: CapabilitySurface): string {
  return surface.projectId ? `${surface.basePath}/chat` : surface.basePath;
}

export function getCapabilityLibraryPath(surface: CapabilitySurface): string {
  return surface.projectId ? `${surface.basePath}/teammates` : getPlacePaths("chat").teammates;
}

export function getAppPath(surface: CapabilitySurface, appId: string, suffix?: string): string {
  const base = `${surface.basePath}/apps/${appId}`;

  return suffix ? `${base}/${suffix.replace(/^\/+/, "")}` : base;
}

export interface AppBackLink {
  to: string;
  label: string;
}

export function getAppBackLink(
  surface: CapabilitySurface,
  appId: string,
  subpath: string,
  appName?: string,
): AppBackLink {
  const segments = subpath.split("/").filter(Boolean);

  if (segments.length === 0) {
    return { to: getCapabilityLibraryPath(surface), label: "Back to teammates" };
  }

  const parent = segments.slice(0, -1).join("/");

  return {
    to: getAppPath(surface, appId, parent || undefined),
    label: parent ? "Back" : `Back to ${appName ?? "list"}`,
  };
}

export function getToolRunPath(surface: CapabilitySurface, toolId: string): string {
  return `${surface.basePath}/tools/${encodeURIComponent(toolId)}`;
}

export function getAppOpenPath(
  surface: CapabilitySurface,
  capabilityId: string,
  apps: ProjectExperienceDefinition[],
): string {
  const app = apps.find(
    (candidate) =>
      candidate.requirement.kind === "capability" &&
      candidate.requirement.capabilityKind === "app" &&
      candidate.requirement.capabilityId === capabilityId,
  );

  return app ? getAppPath(surface, app.id) : getCapabilityLibraryPath(surface);
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

  if (item.kind === "teammate") {
    return createTeammateConversationActionPath(getConversationPath(surface), item.capability.id);
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
