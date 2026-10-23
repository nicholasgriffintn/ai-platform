import { getProjectBasePath } from "./conversation-route.js";
import { getPlacePaths } from "./navigation/places.js";

export const FILES_FILTERS = ["all", "made", "sources", "memory"] as const;

export type FilesFilter = (typeof FILES_FILTERS)[number];

export type FilesSection = Exclude<FilesFilter, "all"> | "folders" | "studio" | "replicate";

export type FilesLocation =
  | { view: "library"; filter: FilesFilter }
  | { view: "folder"; folderId: string }
  | { view: "output"; outputId: string }
  | { view: "source"; sourceId: string }
  | { view: "memory"; name: string }
  | { view: "studio" }
  | { view: "replicate"; subpath: string };

export function parseFilesSubpath(subpath: string): FilesLocation {
  const [first, second, ...rest] = subpath.split("/").filter(Boolean);
  const item = second ? decodeURIComponent(second) : null;

  switch (first) {
    case undefined:
      return { view: "library", filter: "all" };
    case "made":
      return item ? { view: "output", outputId: item } : { view: "library", filter: "made" };
    case "sources":
      return item ? { view: "source", sourceId: item } : { view: "library", filter: "sources" };
    case "memory":
      return item ? { view: "memory", name: item } : { view: "library", filter: "memory" };
    case "folders":
      return item ? { view: "folder", folderId: item } : { view: "library", filter: "all" };
    case "studio":
      return { view: "studio" };
    case "replicate":
      return { view: "replicate", subpath: [second, ...rest].filter(Boolean).join("/") };
    default:
      return { view: "library", filter: "all" };
  }
}

export function getFilesPath(basePath: string, section?: FilesSection, itemPath?: string): string {
  if (!section) {
    return basePath;
  }

  const sectionPath = `${basePath}/${section}`;

  return itemPath ? `${sectionPath}/${itemPath.replace(/^\/+/, "")}` : sectionPath;
}

export function getFilesFilterPath(basePath: string, filter: FilesFilter): string {
  return filter === "all" ? basePath : getFilesPath(basePath, filter);
}

export function getProjectFilesPath(
  workspaceId: string,
  projectId: string,
  section?: FilesSection,
  itemPath?: string,
): string {
  return getFilesPath(`${getProjectBasePath(workspaceId, projectId)}/files`, section, itemPath);
}

export function getOutputPath(pathname: string, outputId: string): string {
  const projectPath = pathname.match(/^(\/work\/[^/]+\/projects\/[^/]+)(?:\/|$)/u)?.[1];
  const filesPath = projectPath ? `${projectPath}/files` : getPlacePaths("chat").files;

  return getFilesPath(filesPath, "made", encodeURIComponent(outputId));
}
