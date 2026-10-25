import { useSourceMutations } from "@ngriffin_uk/polychat-library-react";
import { getUploadFileType } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { useState } from "react";
import { toast } from "sonner";

export type CreateDialog = "note" | "memory" | "folder" | "podcast" | "follow";

export const UPLOAD_ACCEPT = "image/*,audio/*,video/*,.pdf,.md,.csv,.txt,.docx,.xlsx,.html,.json";

export function useFileCreation({
  projectId,
  folderId,
  onUploaded,
}: {
  projectId?: string;
  folderId?: string;
  onUploaded?: (sourceId: string) => Promise<unknown>;
}) {
  const [uploadInput, setUploadInput] = useState<HTMLInputElement | null>(null);
  const [dialog, setDialog] = useState<CreateDialog | null>(null);
  const [uploadingCount, setUploadingCount] = useState(0);
  const mutations = useSourceMutations();

  const uploadFiles = async (files: Iterable<File>) => {
    const queue = Array.from(files);

    setUploadingCount((current) => current + queue.length);

    for (const file of queue) {
      try {
        const uploaded = await mutations.uploadFile.mutateAsync({
          file,
          fileType: getUploadFileType(file.type),
          projectId,
        });

        if (folderId) {
          await mutations.addToCollection.mutateAsync({
            collectionId: folderId,
            sourceId: uploaded.sourceId,
          });
        }

        await onUploaded?.(uploaded.sourceId);

        toast.success(`${file.name} added`);
      } catch (error) {
        toast.error(getErrorMessage(error, `${file.name} could not be added`));
      } finally {
        setUploadingCount((current) => current - 1);
      }
    }
  };

  return {
    setUploadInput,
    openUploadPicker: () => uploadInput?.click(),
    uploadFiles,
    isUploading: uploadingCount > 0,
    dialog,
    openDialog: setDialog,
    closeDialog: () => setDialog(null),
  };
}

export type FileCreation = ReturnType<typeof useFileCreation>;
