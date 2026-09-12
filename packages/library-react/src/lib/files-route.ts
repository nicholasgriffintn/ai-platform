import { getProjectBasePath } from "./conversation-route.js";
import { getPlacePaths } from "./navigation/places.js";

export type FilesTab = "given" | "made" | "memory";

export const DEFAULT_FILES_TAB: FilesTab = "made";

export interface FilesLocation {
  tab: FilesTab;
  itemPath: string;
}

export function parseFilesSubpath(subpath: string): FilesLocation {
  const segments = subpath.split("/").filter(Boolean);
  const [first, ...rest] = segments;

  if (first === "given" || first === "made" || first === "memory") {
    return { tab: first, itemPath: rest.join("/") };
  }

  return { tab: DEFAULT_FILES_TAB, itemPath: segments.join("/") };
}

export function getFilesTabPath(basePath: string, tab: FilesTab, itemPath?: string): string {
  const tabPath = `${basePath}/${tab}`;

  return itemPath ? `${tabPath}/${itemPath.replace(/^\/+/, "")}` : tabPath;
}

export function getPersonalFilesPath(tab: FilesTab = DEFAULT_FILES_TAB, itemPath?: string): string {
  return getFilesTabPath(getPlacePaths("chat").files, tab, itemPath);
}

export function getProjectFilesPath(
  workspaceId: string,
  projectId: string,
  tab: FilesTab = DEFAULT_FILES_TAB,
  itemPath?: string,
): string {
  return getFilesTabPath(`${getProjectBasePath(workspaceId, projectId)}/files`, tab, itemPath);
}

export function getOutputPath(pathname: string, outputId: string): string {
  const projectPath = pathname.match(/^(\/work\/[^/]+\/projects\/[^/]+)(?:\/|$)/u)?.[1];
  const filesPath = projectPath ? `${projectPath}/files` : getPlacePaths("chat").files;

  return getFilesTabPath(filesPath, "made", encodeURIComponent(outputId));
}
