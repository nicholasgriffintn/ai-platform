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
    <div className="relative aspect-video min-h-16 overflow-hidden rounded-md border border-border bg-surface">
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
      <div className="border-border bg-surface-elevated text-muted-foreground rounded-md border px-3 py-2 text-sm">
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
              ? "border-active-work/45 bg-active-work/12 text-active-work"
              : "border-border bg-surface text-foreground hover:bg-selection",
          )}
        >
          <span className="min-w-0 truncate">{device.label}</span>
          {device.deviceId === selectedCameraDeviceId && (
            <Check className="h-4 w-4 shrink-0 text-active-work" aria-hidden="true" />
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
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <LiveCameraPreview stream={videoPreviewStream} />
            {!videoPreviewStream && (
              <div className="flex aspect-video items-center justify-center text-sm text-muted-foreground">
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
