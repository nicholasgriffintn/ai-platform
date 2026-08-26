import {
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@ngriffin_uk/polychat-component-ui";
import { Check } from "lucide-react";
import { useEffect, useRef } from "react";

export interface LiveCameraDevice {
  deviceId: string;
  label: string;
}

function LiveCameraPreview({ stream }: { stream?: MediaStream | null }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!videoRef.current) {
      return;
    }

    videoRef.current.srcObject = stream ?? null;
  }, [stream]);

  if (!stream) {
    return null;
  }

  return (
    <div className="relative aspect-video min-h-16 overflow-hidden rounded-md border border-zinc-200 bg-zinc-950 dark:border-zinc-800">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        aria-label="Camera preview"
        className="h-full w-full object-cover"
      />
    </div>
  );
}

export function LiveCameraSelector({
  cameraDevices,
  onCameraDeviceChange,
  selectedCameraDeviceId,
}: {
  cameraDevices: LiveCameraDevice[];
  onCameraDeviceChange: (deviceId: string) => void;
  selectedCameraDeviceId: string;
}) {
  if (!cameraDevices.length) {
    return (
      <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400">
        No cameras found
      </div>
    );
  }

  return (
    <div role="radiogroup" aria-label="Camera" className="grid gap-2">
      {cameraDevices.map((device) => (
        <button
          key={device.deviceId}
          type="button"
          role="radio"
          aria-checked={device.deviceId === selectedCameraDeviceId}
          onClick={() => onCameraDeviceChange(device.deviceId)}
          className={cn(
            "flex min-h-10 w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors",
            device.deviceId === selectedCameraDeviceId
              ? "border-sky-300 bg-sky-50 text-sky-950 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-100"
              : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900",
          )}
        >
          <span className="min-w-0 truncate">{device.label}</span>
          {device.deviceId === selectedCameraDeviceId && (
            <Check className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-300" aria-hidden="true" />
          )}
        </button>
      ))}
    </div>
  );
}

export function LiveCameraDialog({
  cameraDevices,
  onCameraDeviceChange,
  onOpenChange,
  open,
  selectedCameraDeviceId,
  videoPreviewStream,
}: {
  cameraDevices: LiveCameraDevice[];
  onCameraDeviceChange: (deviceId: string) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  selectedCameraDeviceId: string;
  videoPreviewStream?: MediaStream | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Camera</DialogTitle>
          <DialogDescription>Choose the camera used for Gemini Live.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="overflow-hidden rounded-lg border border-zinc-200 bg-zinc-950 dark:border-zinc-800">
            <LiveCameraPreview stream={videoPreviewStream} />
            {!videoPreviewStream && (
              <div className="flex aspect-video items-center justify-center text-sm text-zinc-500 dark:text-zinc-400">
                Preview starting
              </div>
            )}
          </div>
          <LiveCameraSelector
            cameraDevices={cameraDevices}
            onCameraDeviceChange={onCameraDeviceChange}
            selectedCameraDeviceId={selectedCameraDeviceId}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
