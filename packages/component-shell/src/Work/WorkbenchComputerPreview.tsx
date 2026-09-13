import { ComputerObservationView } from "@ngriffin_uk/polychat-component-conversation";
import { Button, COMPUTER_SCREEN_SANDBOX, cn } from "@ngriffin_uk/polychat-component-ui";
import type { ComputerObservation } from "@ngriffin_uk/polychat-library-chat/tool-results";
import { useTeammateComputer } from "@ngriffin_uk/polychat-library-react";
import { MonitorPlay, Square } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const VIEW_REMINT_LEAD_MS = 60_000;

interface LiveScreen {
  url: string;
  expiresAt: number;
}

export function WorkbenchComputerPreview({
  observations,
}: {
  observations: ComputerObservation[];
}) {
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [live, setLive] = useState<LiveScreen | null>(null);
  const liveExpiryRef = useRef<number | null>(null);
  const selected =
    observations.find((observation) => observation.id === selectedId) ??
    observations[observations.length - 1];
  const contextId = selected?.contextId;
  const computer = useTeammateComputer(contextId);
  const requestView = computer.view.mutate;

  const applyConnection = useCallback((connection: { screenUrl: string; expiresAt: string }) => {
    const expiresAt = Date.parse(connection.expiresAt);

    if (!Number.isFinite(expiresAt)) {
      return;
    }

    liveExpiryRef.current = expiresAt;
    setLive({ url: connection.screenUrl, expiresAt });
  }, []);

  const watch = useCallback(() => {
    if (!contextId) {
      return;
    }

    requestView(undefined, { onSuccess: applyConnection });
  }, [contextId, requestView, applyConnection]);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    if (live && contextId) {
      const delay = live.expiresAt - VIEW_REMINT_LEAD_MS - Date.now();

      if (delay > 0) {
        const timer = setTimeout(() => {
          if (liveExpiryRef.current !== live.expiresAt) {
            return;
          }

          requestView(undefined, { onSuccess: applyConnection });
        }, delay);

        cleanup = () => clearTimeout(timer);
      }
    }

    return cleanup;
  }, [live, contextId, requestView, applyConnection]);

  if (!selected) {
    return null;
  }

  return (
    <section aria-label="Hosted computer" className="flex min-h-full flex-col gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <MonitorPlay className="size-4 shrink-0 text-creative" aria-hidden="true" />
        <h2 className="truncate text-sm font-medium text-foreground">Hosted computer</h2>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {observations.length} {observations.length === 1 ? "capture" : "captures"}
        </span>
        {contextId && !live ? (
          <Button
            size="sm"
            variant="outline"
            className="ml-auto shrink-0"
            icon={<MonitorPlay className="size-3.5" />}
            isLoading={computer.view.isPending}
            onClick={watch}
          >
            Watch live
          </Button>
        ) : null}
      </div>

      {live ? (
        <div className="relative h-[min(72vh,42rem)] w-full overflow-hidden rounded-lg border border-border bg-black">
          <iframe
            title="Hosted computer live view"
            src={live.url}
            className="size-full border-0"
            sandbox={COMPUTER_SCREEN_SANDBOX}
          />
          <Button
            size="sm"
            variant="secondary"
            className="absolute right-3 bottom-3"
            icon={<Square className="size-3.5" />}
            onClick={() => setLive(null)}
          >
            Stop watching
          </Button>
        </div>
      ) : (
        <>
          <ComputerObservationView
            key={selected.id}
            data={{
              screenshot: selected.screenshot,
              title: selected.title,
              width: selected.width,
              height: selected.height,
            }}
          />
          {observations.length > 1 ? (
            <ul className="flex gap-1.5 overflow-x-auto pb-1" aria-label="Earlier captures">
              {observations.map((observation) => (
                <li key={observation.id} className="shrink-0">
                  <button
                    type="button"
                    title={observation.title}
                    aria-label={`Show capture: ${observation.title}`}
                    aria-pressed={observation.id === selected.id}
                    onClick={() => setSelectedId(observation.id)}
                    className={cn(
                      "block h-12 w-20 overflow-hidden rounded border bg-surface-elevated",
                      observation.id === selected.id
                        ? "border-active-work"
                        : "border-border opacity-70 hover:opacity-100",
                    )}
                  >
                    {observation.screenshot ? (
                      <img
                        src={observation.screenshot}
                        alt=""
                        className="size-full object-cover"
                        decoding="async"
                      />
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </section>
  );
}
