import type {
  AssistantActionItem,
  ProjectCapabilityKind,
  ProjectExperienceDefinition,
} from "@ngriffin_uk/polychat-schemas";

import { getExperienceCapabilityId } from "./app-addresses.js";
import { createRecipeManagementActionPath } from "./assistant-action-launch.js";
import { getActivePlace, getPlacePaths } from "./navigation/places.js";

export interface CapabilitySurface {
  basePath: string;
  projectId?: string;
  workspaceId?: string;
}

export interface EnabledCapability {
  id: string;
  kind: ProjectCapabilityKind;
  capabilityId: string;
  configuration: Record<string, unknown>;
  excluded?: boolean;
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

const PROJECT_SURFACE_PATTERN = /^\/work\/([^/]+)\/projects\/([^/]+)/;

export function getSurfaceFromPathname(pathname: string): CapabilitySurface {
  const match = PROJECT_SURFACE_PATTERN.exec(pathname);

  return match ? getProjectSurface(match[1], match[2]) : PERSONAL_SURFACE;
}

export const NEW_TEAMMATE_ID = "new";

export function getTeammateHomePath(surface: CapabilitySurface, teammateId: string): string {
  return `${surface.basePath}/teammates/${encodeURIComponent(teammateId)}`;
}

export function getTeammateSettingsPath(surface: CapabilitySurface, teammateId: string): string {
  return `${getTeammateHomePath(surface, teammateId)}/settings`;
}

export function getNotebookPath(
  surface: CapabilitySurface,
  notebookId: string,
  conversationId?: string,
): string {
  const base = `${surface.basePath}/notebooks/${encodeURIComponent(notebookId)}`;

  return conversationId ? `${base}/${encodeURIComponent(conversationId)}` : base;
}

const NOTEBOOK_PATH_PATTERN = /\/notebooks\/([^/]+)/;

export function matchNotebookId(pathname: string): string | undefined {
  const match = NOTEBOOK_PATH_PATTERN.exec(pathname);

  return match ? decodeURIComponent(match[1]) : undefined;
}

export function getSkillEditorPath(surface: CapabilitySurface, skillId: string): string {
  return `${surface.basePath}/skills/${encodeURIComponent(skillId)}`;
}

export function getConversationPath(surface: CapabilitySurface): string {
  return surface.basePath;
}

export function getPluginsPath(surface: CapabilitySurface): string {
  return surface.projectId ? `${surface.basePath}/plugins` : getPlacePaths("chat").plugins;
}

export function getScheduledLibraryPath(surface: CapabilitySurface): string {
  return surface.projectId ? `${surface.basePath}/scheduled` : getPlacePaths("chat").scheduled;
}

export function getAppPath(surface: CapabilitySurface, appSlug: string, suffix?: string): string {
  const base = `${surface.basePath}/apps/${appSlug}`;

  return suffix ? `${base}/${suffix.replace(/^\/+/, "")}` : base;
}

export interface AppBackLink {
  to: string;
  label: string;
}

export function getAppBackLink(
  surface: CapabilitySurface,
  appSlug: string,
  subpath: string,
  appName?: string,
): AppBackLink | null {
  const segments = subpath.split("/").filter(Boolean);

  if (segments.length === 0) {
    const appPath = getAppPath(surface, appSlug);

    return getActivePlace(appPath) === getActivePlace(getPluginsPath(surface))
      ? { to: getPluginsPath(surface), label: "Back to plugins" }
      : null;
  }

  const parent = segments.slice(0, -1).join("/");

  return {
    to: getAppPath(surface, appSlug, parent || undefined),
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
      candidate.requirement.capabilityKind === "app" &&
      getExperienceCapabilityId(candidate) === capabilityId,
  );

  return app ? getAppPath(surface, app.slug) : getPluginsPath(surface);
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
    return getTeammateHomePath(surface, item.capability.id);
  }

  if (item.kind === "recipe" || item.kind === "installed_recipe") {
    const recipeId = item.metadata?.recipeId ?? item.capability.id;

    return createRecipeManagementActionPath(
      getScheduledLibraryPath(surface),
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
