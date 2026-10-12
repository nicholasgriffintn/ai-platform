import type { ContainerFileChange } from "@ngriffin_uk/polychat-library-sandbox";

import type { TaskEvent } from "../../../../types";

export interface FileWatcher {
  stop(): void;
}

interface WatchableWorkspace {
  watchFiles(
    path: string,
    onChange: (change: ContainerFileChange) => Promise<void> | void,
  ): Promise<void>;
  stopFileWatches(): Promise<void>;
}

export function startFileWatcher(params: {
  sandbox: WatchableWorkspace;
  watchPath: string;
  emit: (event: TaskEvent) => Promise<void>;
  abortSignal?: AbortSignal;
}): FileWatcher {
  const { sandbox, watchPath, emit, abortSignal } = params;
  const stop = () => {
    void sandbox.stopFileWatches().catch(() => undefined);
  };

  void sandbox
    .watchFiles(watchPath, async (change) => {
      await emit({
        type: "file_changed",
        path: change.path,
        changeType: change.changeType,
        isDirectory: change.isDirectory,
      });
    })
    .catch(() => undefined);

  abortSignal?.addEventListener("abort", stop, { once: true });

  return { stop };
}
