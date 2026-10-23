import {
  useMemoryDocuments,
  useOutputMutations,
  useSourceMutations,
} from "@ngriffin_uk/polychat-library-react";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { useState } from "react";
import { toast } from "sonner";

import { useOutputSharing } from "../useOutputSharing.js";
import type { FileItem } from "./file-items.js";

export type FileAction = "rename" | "move" | "delete";

export type FileFolderTarget = { folderId: string } | { newFolderTitle: string };

export function useFileActions({
  projectId,
  onDeleted,
}: {
  projectId?: string;
  onDeleted?: (item: FileItem) => void;
}) {
  const [pending, setPending] = useState<{ action: FileAction; item: FileItem } | null>(null);
  const outputs = useOutputMutations();
  const sources = useSourceMutations();
  const memory = useMemoryDocuments(projectId);
  const sharing = useOutputSharing();

  const run = async (work: () => Promise<unknown>, success: string, failure: string) => {
    try {
      await work();
      toast.success(success);
      setPending(null);
    } catch (error) {
      toast.error(getErrorMessage(error, failure));
      throw error;
    }
  };

  const remove = (item: FileItem) =>
    run(
      async () => {
        switch (item.origin) {
          case "output":
            await outputs.remove.mutateAsync(item.id);
            break;
          case "source":
            await sources.deleteSource.mutateAsync(item.id);
            break;
          case "memory":
            await memory.remove.mutateAsync(item.id);
            break;
          case "folder":
            await sources.deleteCollection.mutateAsync(item.id);
            break;
        }

        onDeleted?.(item);
      },
      `${item.title} deleted`,
      `Could not delete ${item.title}`,
    );

  const rename = (item: FileItem, title: string) =>
    run(
      () =>
        item.origin === "output"
          ? outputs.rename.mutateAsync({
              outputId: item.id,
              title,
              expectedRevision: item.revision ?? 1,
            })
          : sources.renameSource.mutateAsync({ sourceId: item.id, title }),
      "Renamed",
      `Could not rename ${item.title}`,
    );

  const moveToFolder = (item: FileItem, target: FileFolderTarget) =>
    run(
      async () => {
        const collectionId =
          "folderId" in target
            ? target.folderId
            : (
                await sources.createCollection.mutateAsync({
                  projectId,
                  title: target.newFolderTitle,
                  kind: "general",
                })
              ).id;

        await sources.addToCollection.mutateAsync({ collectionId, sourceId: item.id });
      },
      `${item.title} added to the folder`,
      `Could not add ${item.title} to the folder`,
    );

  const copyShareLink = async (item: FileItem) => {
    if (await sharing.copy(item.id)) {
      toast.success("Share link copied");
    } else {
      toast.error("Could not copy the share link");
    }
  };

  return {
    pending,
    request: (action: FileAction, item: FileItem) => setPending({ action, item }),
    dismiss: () => setPending(null),
    remove,
    rename,
    moveToFolder,
    copyShareLink,
    isWorking:
      outputs.remove.isPending ||
      outputs.rename.isPending ||
      sources.deleteSource.isPending ||
      sources.renameSource.isPending ||
      sources.deleteCollection.isPending ||
      sources.createCollection.isPending ||
      sources.addToCollection.isPending ||
      memory.remove.isPending,
  };
}

export type FileActions = ReturnType<typeof useFileActions>;
