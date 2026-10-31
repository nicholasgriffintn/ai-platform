import { getSourceContentUrl, getSourceCoverUrl } from "@ngriffin_uk/polychat-library-client";
import { getFilesPath, type FilesSort } from "@ngriffin_uk/polychat-library-react";
import {
  DISCOVER_EPISODE_KIND,
  getSourceMediaType,
  readSourceGeneration,
  readSourceMedia,
  type MemoryDocumentSummary,
  type OutputSummary,
  type SourceCollection,
  type SourceCollectionKind,
  type SourceSummary,
} from "@ngriffin_uk/polychat-schemas";
import {
  compareNaturalText,
  humaniseIdentifier,
  normaliseComparableText,
  parseTimestamp,
} from "@ngriffin_uk/polychat-utility-core";

export type FileOrigin = "output" | "source" | "memory" | "folder";

export type FileType =
  | "result"
  | "document"
  | "note"
  | "image"
  | "audio"
  | "video"
  | "podcast"
  | "link"
  | "connected"
  | "memory"
  | "folder";

export const LISTED_FOLDER_KINDS: readonly SourceCollectionKind[] = [
  "general",
  "memory",
  "podcast",
];

export const OPENABLE_FOLDER_KINDS: readonly SourceCollectionKind[] = [
  ...LISTED_FOLDER_KINDS,
  "topic",
  "entity",
];

export const FILE_TYPE_LABELS: Record<FileType, string> = {
  result: "Results",
  document: "Documents",
  note: "Notes",
  image: "Images",
  audio: "Audio",
  video: "Video",
  podcast: "Podcasts",
  link: "Links",
  connected: "Connected",
  memory: "Memories",
  folder: "Folders",
};

const FILE_TYPE_NAMES: Record<FileType, string> = {
  result: "Result",
  document: "Document",
  note: "Note",
  image: "Image",
  audio: "Audio",
  video: "Video",
  podcast: "Podcast",
  link: "Link",
  connected: "Connected record",
  memory: "Memory",
  folder: "Folder",
};

export interface FileItem {
  key: string;
  origin: FileOrigin;
  id: string;
  title: string;
  type: FileType;
  detail: string;
  updatedAt: string;
  href: string;
  excerpt?: string;
  previewUrl?: string;
  downloadUrl?: string;
  status?: "processing" | "failed";
  revision?: number;
  canRename: boolean;
  canDelete: boolean;
  canMoveToFolder: boolean;
}

function sourceType(source: SourceSummary): FileType {
  if (source.kind === "podcast") {
    return "podcast";
  }

  const mediaType = getSourceMediaType(source.file?.mimeType);

  if (mediaType === "image" || mediaType === "audio" || mediaType === "video") {
    return mediaType;
  }

  switch (source.kind) {
    case "url":
      return "link";
    case "connector":
    case "repository":
      return "connected";
    case "text":
      return "note";
    case "memory":
      return "memory";
    default:
      return "document";
  }
}

function sourceDetail(source: SourceSummary, type: FileType): string {
  const generation = readSourceGeneration(source.metadata);

  if (generation?.modelName) {
    return generation.modelName;
  }

  if (source.kind === "repository") {
    return "Repository";
  }

  if (source.kind === "connector") {
    return source.provider ? humaniseIdentifier(source.provider) : "Connected record";
  }

  return FILE_TYPE_NAMES[type];
}

function sourcePreviewUrl(source: SourceSummary, type: FileType): string | undefined {
  if (type === "image" && source.status === "available") {
    return getSourceContentUrl(source.id);
  }

  return readSourceMedia(source.metadata).cover ? getSourceCoverUrl(source.id) : undefined;
}

export function sourceToFileItem(source: SourceSummary, basePath: string): FileItem {
  const type = sourceType(source);
  const isSynced = source.kind === "connector" && typeof source.metadata.syncId === "string";

  return {
    key: `source:${source.id}`,
    origin: "source",
    id: source.id,
    title: source.title,
    type,
    detail: sourceDetail(source, type),
    updatedAt: source.updatedAt ?? source.createdAt,
    href: getFilesPath(basePath, "sources", encodeURIComponent(source.id)),
    previewUrl: sourcePreviewUrl(source, type),
    downloadUrl: source.file ? getSourceContentUrl(source.id) : undefined,
    status:
      source.status === "processing" || source.status === "failed" ? source.status : undefined,
    canRename: !isSynced,
    canDelete: !isSynced,
    canMoveToFolder: true,
  };
}

export function outputToFileItem(output: OutputSummary, basePath: string): FileItem {
  const mediaType = getSourceMediaType(output.file?.mimeType);

  return {
    key: `output:${output.id}`,
    origin: "output",
    id: output.id,
    title: output.title,
    type: output.kind === DISCOVER_EPISODE_KIND ? "video" : (mediaType ?? "result"),
    detail: humaniseIdentifier(output.capabilityId),
    updatedAt: output.updatedAt ?? output.createdAt,
    href: getFilesPath(basePath, "made", encodeURIComponent(output.id)),
    status:
      output.status === "pending"
        ? "processing"
        : output.status === "failed"
          ? "failed"
          : undefined,
    revision: output.revision,
    canRename: true,
    canDelete: true,
    canMoveToFolder: true,
  };
}

export function memoryToFileItem(document: MemoryDocumentSummary, basePath: string): FileItem {
  return {
    key: `memory:${document.id}`,
    origin: "memory",
    id: document.name,
    title: document.name,
    type: "memory",
    detail: `Memory · revision ${document.revision}`,
    updatedAt: document.updatedAt,
    href: getFilesPath(basePath, "memory", encodeURIComponent(document.name)),
    excerpt: document.excerpt,
    canRename: false,
    canDelete: true,
    canMoveToFolder: false,
  };
}

export function folderToFileItem(collection: SourceCollection, basePath: string): FileItem {
  const count = collection.sourceCount + collection.outputCount;

  return {
    key: `folder:${collection.id}`,
    origin: "folder",
    id: collection.id,
    title: collection.title,
    type: "folder",
    detail: `${count} ${count === 1 ? "item" : "items"}${collection.kind === "podcast" ? " · Podcast show" : ""}`,
    updatedAt: collection.updatedAt ?? collection.createdAt,
    href: getFilesPath(basePath, "folders", encodeURIComponent(collection.id)),
    canRename: false,
    canDelete: true,
    canMoveToFolder: false,
  };
}

export function arrangeFileItems(
  items: readonly FileItem[],
  { query, type, sort }: { query: string; type: FileType | null; sort: FilesSort },
): FileItem[] {
  const needle = normaliseComparableText(query);
  const visible = items.filter(
    (item) =>
      (!type || item.type === type) &&
      (!needle ||
        normaliseComparableText(`${item.title} ${item.detail} ${item.excerpt ?? ""}`).includes(
          needle,
        )),
  );

  return visible.sort((left, right) =>
    sort === "name"
      ? compareNaturalText(left.title, right.title)
      : parseTimestamp(right.updatedAt).getTime() - parseTimestamp(left.updatedAt).getTime(),
  );
}
