import {
  type FilesFilter,
  useCollectionOutputs,
  useMemoryDocuments,
  useOutputs,
  useSourceCollections,
  useSources,
} from "@ngriffin_uk/polychat-library-react";

import {
  folderToFileItem,
  memoryToFileItem,
  outputToFileItem,
  sourceToFileItem,
  type FileItem,
} from "./file-items.js";

export function useFilesLibrary({
  basePath,
  projectId,
  filter,
  folderId,
}: {
  basePath: string;
  projectId?: string;
  filter: FilesFilter;
  folderId?: string;
}) {
  const includes = (candidate: FilesFilter) =>
    !folderId && (filter === "all" || filter === candidate);
  const outputs = useOutputs(projectId, undefined, { enabled: includes("made") });
  const sources = useSources(
    { projectId, collectionId: folderId ?? null },
    { enabled: Boolean(folderId) || includes("sources") },
  );
  const folderOutputs = useCollectionOutputs(folderId);
  const memory = useMemoryDocuments(projectId);
  const collections = useSourceCollections(projectId);
  const folders = (collections.data ?? []).filter((collection) => collection.kind !== "context");

  const items: FileItem[] = [
    ...(includes("made")
      ? (outputs.data ?? []).map((item) => outputToFileItem(item, basePath))
      : []),
    ...(folderOutputs.data ?? []).map((item) => outputToFileItem(item, basePath)),
    ...(folderId || includes("sources")
      ? (sources.data ?? []).map((item) => sourceToFileItem(item, basePath))
      : []),
    ...(includes("memory") ? memory.documents.map((item) => memoryToFileItem(item, basePath)) : []),
  ];

  return {
    items,
    folders,
    areFoldersLoading: collections.isLoading,
    folderItems:
      folderId || filter === "made" || filter === "memory"
        ? []
        : folders.map((folder) => folderToFileItem(folder, basePath)),
    isLoading:
      (includes("made") && outputs.isLoading) ||
      ((Boolean(folderId) || includes("sources")) && sources.isLoading) ||
      folderOutputs.isLoading ||
      (includes("memory") && memory.isLoading),
    error:
      (includes("made") ? outputs.error : null) ??
      (folderId || includes("sources") ? sources.error : null) ??
      folderOutputs.error ??
      (includes("memory") ? memory.error : null),
  };
}
