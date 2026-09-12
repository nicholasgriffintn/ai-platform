import {
  Button,
  ConfirmationDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@ngriffin_uk/polychat-component-ui";
import { getErrorMessage, useTeammateComputer } from "@ngriffin_uk/polychat-library-react";
import { MonitorUp } from "lucide-react";
import { useState } from "react";

import { TeammateTeachingDraft } from "./TeammateTeachingDraft.js";

export function TeammateComputerPanel({ contextId }: { contextId: string }) {
  const { data: computer, error, action, takeover, release } = useTeammateComputer(contextId);
  const [screen, setScreen] = useState<{
    url: string;
    fence: number;
    recordingId?: string;
  } | null>(null);
  const [teaching, setTeaching] = useState(false);
  const [confirmDestroy, setConfirmDestroy] = useState(false);
  const busy = action.isPending || takeover.isPending || release.isPending;

  const takeControl = (teach = false) => {
    takeover.mutate(teach, {
      onSuccess: (connection) => {
        const fence = connection.computer.lease?.fence;

        if (fence && (!teach || connection.recordingId)) {
          setScreen({
            url: connection.screenUrl,
            fence,
            recordingId: connection.recordingId,
          });
          setTeaching(teach);
        }
      },
    });
  };

  const closeScreen = async () => {
    if (!screen) {
      return;
    }

    try {
      await release.mutateAsync(screen.fence);
      setScreen(null);
      setTeaching(false);
    } catch {
      return;
    }
  };

  return (
    <div className="space-y-3 border-t pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">Computer</p>
          <p className="text-xs text-muted-foreground">
            {computer?.status ?? "Loading"}
            {computer?.checkpointReference ? " · checkpoint saved" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(!computer || computer.status === "stopped" || computer.status === "error") && (
            <>
              {computer?.checkpointReference ? (
                <Button
                  size="sm"
                  variant="outline"
                  isLoading={action.isPending}
                  onClick={() => action.mutate({ action: "restore" })}
                >
                  Restore checkpoint
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="outline"
                isLoading={action.isPending}
                onClick={() => action.mutate({ action: "provision" })}
              >
                Start
              </Button>
            </>
          )}
          {computer?.status === "destroyed" && (
            <Button
              size="sm"
              variant="outline"
              isLoading={action.isPending}
              onClick={() => action.mutate({ action: "provision" })}
            >
              Start
            </Button>
          )}
          {computer?.status === "ready" && (
            <>
              <Button
                size="sm"
                variant="outline"
                isLoading={action.isPending}
                onClick={() => action.mutate({ action: "checkpoint" })}
              >
                Save checkpoint
              </Button>
              <Button
                size="sm"
                variant="primary"
                icon={<MonitorUp className="size-4" />}
                isLoading={takeover.isPending}
                onClick={() => takeControl(false)}
              >
                Take control
              </Button>
              <Button
                size="sm"
                variant="outline"
                isLoading={takeover.isPending}
                onClick={() => takeControl(true)}
              >
                Teach workflow
              </Button>
              <Button
                size="sm"
                variant="outline"
                isLoading={action.isPending}
                onClick={() => action.mutate({ action: "stop" })}
              >
                Stop
              </Button>
            </>
          )}
          {computer && computer.status !== "destroyed" ? (
            <Button
              size="sm"
              variant="destructive"
              disabled={busy}
              onClick={() => setConfirmDestroy(true)}
            >
              Destroy
            </Button>
          ) : null}
        </div>
      </div>

      {(error || action.error || takeover.error || release.error) && (
        <p className="text-sm text-destructive">
          {getErrorMessage(
            error ?? action.error ?? takeover.error ?? release.error,
            "The computer is unavailable.",
          )}
        </p>
      )}

      <Dialog
        open={Boolean(screen)}
        onOpenChange={(open) => {
          if (!open && !busy) {
            void closeScreen();
          }
        }}
        width="min(90rem, 98vw)"
      >
        <DialogContent className="h-[94dvh] overflow-hidden p-0">
          <DialogTitle className="sr-only">Teammate computer</DialogTitle>
          <DialogDescription className="sr-only">
            A temporary, authenticated control session for this teammate computer.
          </DialogDescription>
          {screen && (
            <div className="flex size-full min-h-0 flex-col lg:flex-row">
              <iframe
                title="Teammate computer"
                src={screen.url}
                className="min-h-0 flex-1 border-0 bg-black"
                sandbox="allow-forms allow-same-origin allow-scripts"
              />
              {teaching && screen.recordingId ? (
                <TeammateTeachingDraft
                  contextId={contextId}
                  recordingId={screen.recordingId}
                  computerFence={screen.fence}
                />
              ) : null}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        open={confirmDestroy}
        onOpenChange={setConfirmDestroy}
        title="Destroy teammate computer"
        description="Destroy this computer and its current workspace. Saved checkpoints remain available to a replacement computer."
        confirmText="Destroy"
        variant="destructive"
        isLoading={action.isPending}
        onConfirm={async () => {
          await action.mutateAsync({ action: "destroy" });
          setConfirmDestroy(false);
        }}
      />
    </div>
  );
}
