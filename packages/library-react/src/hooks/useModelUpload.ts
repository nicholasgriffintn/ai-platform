import {
  abortModelUpload,
  type UploadProgress,
  type UploadSource,
  uploadModelFiles,
} from "@ngriffin_uk/polychat-library-client";
import type { UploadPurpose, UploadSession } from "@ngriffin_uk/polychat-schemas";
import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";

export interface ModelUploadInput {
  purpose: UploadPurpose;
  name: string;
  sources: UploadSource[];
  resumeUploadId?: string;
}

export function useModelUpload(workspaceId: string) {
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [session, setSession] = useState<UploadSession | null>(null);
  const controller = useRef<AbortController | null>(null);

  const upload = useMutation({
    mutationFn: (input: ModelUploadInput) => {
      controller.current = new AbortController();

      return uploadModelFiles({
        workspaceId,
        ...input,
        onProgress: setProgress,
        onSession: setSession,
        signal: controller.current.signal,
      });
    },
  });

  const abort = useMutation({
    mutationFn: async (id: string): Promise<UploadSession> => {
      controller.current?.abort();

      return abortModelUpload(workspaceId, id);
    },
  });

  return {
    start: upload.mutate,
    startAsync: upload.mutateAsync,
    abort: abort.mutate,
    reset: () => {
      upload.reset();
      setSession(null);
      setProgress(null);
    },
    progress,
    session: upload.data ?? session,
    error: upload.error ?? abort.error,
    isUploading: upload.isPending,
    isReady: (upload.data ?? session)?.status === "ready",
  };
}
