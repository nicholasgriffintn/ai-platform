import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@ngriffin_uk/polychat-component-ui";
import { useState } from "react";

export interface BrowserModelDownloadProgress {
  progress: number;
  text?: string;
}

export interface BrowserModelConsentDialogProps {
  open: boolean;
  modelId: string;
  modelName: string;
  onDownload: (
    modelId: string,
    onProgress: (progress: BrowserModelDownloadProgress) => void,
  ) => Promise<void>;
  onConfirm: () => void;
  onCancel: () => void;
}

type DownloadPhase = "idle" | "downloading" | "error";

export function BrowserModelConsentDialog({
  open,
  modelId,
  modelName,
  onDownload,
  onConfirm,
  onCancel,
}: BrowserModelConsentDialogProps) {
  const [phase, setPhase] = useState<DownloadPhase>("idle");
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isDownloading = phase === "downloading";

  const startDownload = async () => {
    if (isDownloading) {
      return;
    }

    setPhase("downloading");
    setError(null);
    setProgress(0);
    setStatusText("Preparing download…");

    try {
      await onDownload(modelId, (update) => {
        setProgress(Math.round(update.progress * 100));
        setStatusText(update.text ?? null);
      });
      onConfirm();
    } catch (downloadError) {
      setPhase("error");
      setError(
        downloadError instanceof Error ? downloadError.message : "Download failed. Try again.",
      );
    }
  };

  const handleCancel = () => {
    if (isDownloading) {
      return;
    }

    onCancel();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          handleCancel();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Download local model?</DialogTitle>
          <DialogDescription>
            {modelName} runs directly in this browser. The download can be several gigabytes, and
            loading it on a low-memory device can crash this page.
          </DialogDescription>
        </DialogHeader>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
          <li>The download happens once, then the model is cached in this browser.</li>
          <li>Previously downloaded browser models are removed to free up space.</li>
          <li>You can switch back to hosted models at any time.</li>
        </ul>
        {isDownloading || phase === "error" ? (
          <div className="space-y-2" aria-live="polite">
            <progress
              className="h-2 w-full overflow-hidden rounded-full bg-muted"
              value={Math.min(100, Math.max(0, progress))}
              max={100}
            />
            <p className="text-sm text-muted-foreground">
              {phase === "error"
                ? (error ?? "Download failed.")
                : `${statusText ?? "Downloading…"}${progress > 0 ? ` (${progress}%)` : ""}`}
            </p>
          </div>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleCancel} disabled={isDownloading}>
            Stay on hosted
          </Button>
          <Button type="button" onClick={() => void startDownload()} disabled={isDownloading}>
            {phase === "error"
              ? "Retry download"
              : isDownloading
                ? `Downloading…${progress > 0 ? ` ${progress}%` : ""}`
                : "Download model"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
