import type { FileWithPreview } from "@ngriffin_uk/polychat-utility-react";
import { useMemo } from "react";

import { useTrackEvent } from "~/hooks/use-track-event";

/**
 * Binds the uploader's product intents to analytics. The render package stays host-neutral and the
 * reporting policy lives here, next to every other tracking decision.
 */
export function useFileUploadAnalytics(uploaderId: string) {
  const { trackFeatureUsage } = useTrackEvent();

  return useMemo(
    () => ({
      onFilesAdded: (files: FileWithPreview[]) => {
        trackFeatureUsage("file_added", {
          uploader_id: uploaderId,
          file_count: files.length,
          file_type: files[0]?.file.type || "unknown",
          file_size: files[0]?.file.size || 0,
          upload_method: "dialog",
        });
      },
      onFilesChange: (files: FileWithPreview[]) => {
        if (files.length === 0) {
          return;
        }

        trackFeatureUsage("file_upload_active", {
          uploader_id: uploaderId,
          file_count: files.length,
          file_type: files[0]?.file.type || "unknown",
          file_size: files[0]?.file.size || 0,
        });
      },
      onFilesDropped: (files: FileList) => {
        trackFeatureUsage("file_added", {
          uploader_id: uploaderId,
          file_count: files.length,
          file_type: files[0]?.type || "unknown",
          file_size: files[0]?.size || 0,
          upload_method: "drag_and_drop",
        });
      },
      onFileRemove: (files: FileWithPreview[]) => {
        trackFeatureUsage("file_removed", {
          uploader_id: uploaderId,
          file_type: files[0]?.file.type || "unknown",
          file_size: files[0]?.file.size || 0,
        });
      },
    }),
    [trackFeatureUsage, uploaderId],
  );
}
