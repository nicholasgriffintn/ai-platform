import type { ToolInteractionHandler } from "@ngriffin_uk/polychat-component-content";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@ngriffin_uk/polychat-component-ui";
import { getErrorMessage, useTeammateComputer } from "@ngriffin_uk/polychat-library-react";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { MonitorUp } from "lucide-react";
import { useState } from "react";

function readTakeoverRequest(data: unknown): {
  contextId: string;
  interactionId: string;
  reason: string;
} | null {
  if (!isRecord(data) || !isRecord(data.humanInTheLoop)) {
    return null;
  }

  const interactionId = data.humanInTheLoop.interactionId;

  if (typeof data.contextId !== "string" || typeof interactionId !== "string") {
    return null;
  }

  return {
    contextId: data.contextId,
    interactionId,
    reason: typeof data.reason === "string" ? data.reason : "The teammate needs your help.",
  };
}

export function ComputerTakeoverView({
  data,
  onToolInteraction,
}: {
  data: unknown;
  onToolInteraction?: ToolInteractionHandler;
}) {
  const request = readTakeoverRequest(data);
  const computer = useTeammateComputer(request?.contextId);
  const [screen, setScreen] = useState<{
    url: string;
    fence: number;
    released: boolean;
  } | null>(null);
  const [isReturning, setIsReturning] = useState(false);

  if (!request) {
    return null;
  }

  const takeControl = () => {
    computer.takeover.mutate(undefined, {
      onSuccess: (connection) => {
        const fence = connection.computer.lease?.fence;

        if (fence) {
          setScreen({ url: connection.screenUrl, fence, released: false });
        }
      },
    });
  };

  const returnControl = async () => {
    if (!screen || isReturning) {
      return;
    }

    setIsReturning(true);

    try {
      if (!screen.released) {
        await computer.release.mutateAsync(screen.fence);
        setScreen((current) => (current ? { ...current, released: true } : current));
      }

      await onToolInteraction?.("use_computer", "submitPrompt", {
        input: "I finished using the hosted computer. Continue from its current state.",
        interactionId: request.interactionId,
        resolution: "completed",
      });
      setScreen(null);
    } finally {
      setIsReturning(false);
    }
  };

  const error = computer.error ?? computer.takeover.error ?? computer.release.error;

  return (
    <section className="space-y-3 rounded-lg border border-attention/45 bg-attention/10 p-3 text-sm">
      <div>
        <p className="font-medium text-foreground">Teammate needs computer control</p>
        <p className="text-muted-foreground">{request.reason}</p>
      </div>
      <Button
        size="sm"
        icon={<MonitorUp className="size-4" />}
        isLoading={computer.takeover.isPending}
        onClick={takeControl}
      >
        Take control
      </Button>
      {error && (
        <p className="text-sm text-destructive">
          {getErrorMessage(error, "Computer control could not be updated")}
        </p>
      )}

      <Dialog open={Boolean(screen)} onOpenChange={(open) => !open && void returnControl()}>
        <DialogContent className="h-[94dvh] overflow-hidden p-0">
          <DialogTitle className="sr-only">Teammate computer</DialogTitle>
          <DialogDescription className="sr-only">
            Temporary control of the teammate’s hosted computer.
          </DialogDescription>
          {screen && (
            <>
              <iframe
                title="Teammate computer"
                src={screen.url}
                className="size-full border-0 bg-black"
                sandbox="allow-forms allow-scripts"
              />
              <Button
                className="absolute right-4 bottom-4"
                isLoading={isReturning}
                onClick={() => void returnControl()}
              >
                Return control
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
