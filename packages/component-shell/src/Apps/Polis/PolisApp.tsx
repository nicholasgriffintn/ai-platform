import { BackLink, Button, cn } from "@ngriffin_uk/polychat-component-ui";
import type { PolisRecording } from "@ngriffin_uk/polychat-schemas";
import { Download, History, Pause, Play, Save, SkipForward } from "lucide-react";
import { useState } from "react";

import { useAppChrome } from "../AppChrome.js";
import { POLIS_MAP_MODES, POLIS_SPEEDS, type PolisMapMode } from "./engine/protocol.js";
import { CitizenCard } from "./panels/CitizenCard.js";
import { EventsPanel } from "./panels/EventsPanel.js";
import { LawsPanel } from "./panels/LawsPanel.js";
import { MindsPanel } from "./panels/MindsPanel.js";
import { TownPanel } from "./panels/TownPanel.js";
import { formatMoment, PlaybackBar } from "./PlaybackBar.js";
import { SetupScreen } from "./SetupScreen.js";
import { ShareControl } from "./ShareControl.js";
import { usePolisEngine, type PolisEngine } from "./usePolisEngine.js";

const TABS = [
  { id: "town", label: "Town" },
  { id: "laws", label: "Laws" },
  { id: "events", label: "Events" },
  { id: "minds", label: "Minds" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const MAP_MODE_LABELS: Record<PolisMapMode, string> = {
  town: "Town",
  mood: "Mood",
  wealth: "Wealth",
  rent: "Rent",
};

function NamePlate({ engine }: { engine: PolisEngine }) {
  const snapshot = engine.status?.snapshot;
  const playback = engine.status?.playback;

  if (!snapshot) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute top-3 left-3 rounded-lg border-2 border-foreground/80 bg-card/95 px-4 py-2 shadow-lg">
      <p className="font-display text-2xl leading-tight">{snapshot.name}</p>
      <p className="font-mono text-xs tracking-wide text-muted-foreground uppercase tabular-nums">
        {playback
          ? formatMoment(playback.day, playback.hour)
          : formatMoment(snapshot.day, engine.status?.hour)}
      </p>
    </div>
  );
}

function MapModes({ engine }: { engine: PolisEngine }) {
  const [mode, setMode] = useState<PolisMapMode>("town");

  return (
    <div
      role="group"
      aria-label="Map view"
      className="absolute top-3 right-3 flex rounded-lg border border-border bg-card/95 p-0.5 shadow-lg"
    >
      {POLIS_MAP_MODES.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={mode === option}
          onClick={() => {
            setMode(option);
            engine.send({ type: "mapMode", mode: option });
          }}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            mode === option
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {MAP_MODE_LABELS[option]}
        </button>
      ))}
    </div>
  );
}

function Transport({ engine }: { engine: PolisEngine }) {
  const { status, send } = engine;

  if (!status) {
    return null;
  }

  return (
    <div className="absolute bottom-3 left-1/2 flex w-max max-w-[calc(100%-1.5rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-1 rounded-xl border border-border bg-card/95 p-1 shadow-lg">
      <Button
        variant={status.running ? "secondary" : "primary"}
        size="icon"
        aria-label={status.running ? "Pause" : "Play"}
        onClick={() => send({ type: "running", running: !status.running })}
      >
        {status.running ? <Pause size={16} /> : <Play size={16} />}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Skip a month"
        title="Skip a month"
        onClick={() => send({ type: "step", days: 30 })}
      >
        <SkipForward size={16} />
      </Button>
      <div role="group" aria-label="Speed" className="flex">
        {POLIS_SPEEDS.map((speed, index) => (
          <button
            key={speed.label}
            type="button"
            aria-pressed={status.speedIndex === index}
            onClick={() => send({ type: "speed", index })}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
              status.speedIndex === index
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {speed.label}
          </button>
        ))}
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Save the town"
        title="Save the town"
        onClick={() => send({ type: "save" })}
      >
        <Save size={16} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Download the recording"
        title="Download the recording"
        onClick={() => send({ type: "export", purpose: "download" })}
      >
        <Download size={16} />
      </Button>
      <ShareControl engine={engine} />
      <Button
        variant="outline"
        size="sm"
        icon={<History size={14} />}
        onClick={() => send({ type: "watch" })}
      >
        Rewind
      </Button>
    </div>
  );
}

function OpeningShare({ engine }: { engine: PolisEngine }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[#6e8f5f] p-4">
      <div className="w-full max-w-sm space-y-2 rounded-2xl border-2 border-foreground/80 bg-card p-6 shadow-xl">
        <p className="font-display text-2xl leading-tight">
          {engine.restoring ? `Rebuilding ${engine.restoring.name}` : "Opening the town"}
        </p>
        <p className="text-sm text-muted-foreground">
          Replaying everything that happened, exactly as it did.
        </p>
        <div className="h-1.5 overflow-hidden rounded-sm bg-border">
          <div
            className="h-full rounded-sm bg-foreground"
            style={{ width: `${(engine.restoring?.progress ?? 0) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function SidePanel({ engine, projectId }: { engine: PolisEngine; projectId?: string }) {
  const [tab, setTab] = useState<TabId>("town");
  const { status } = engine;

  if (!status) {
    return null;
  }

  const watching = status.playback !== null;

  return (
    <aside className="flex min-h-0 w-full flex-col border-t border-border bg-surface lg:w-[23rem] lg:border-t-0 lg:border-l">
      <div role="tablist" aria-label="Town controls" className="flex border-b border-border">
        {TABS.filter((item) => !engine.viewOnly || item.id === "town").map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={cn(
              "flex-1 border-b-2 py-2.5 text-sm font-medium transition-colors",
              tab === item.id
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {tab === "town" && <TownPanel engine={engine} status={status} />}
        {watching && (tab === "laws" || tab === "events") && (
          <p className="text-sm text-muted-foreground">
            You are watching history. Choose Carry on from here to change it, or Back to now.
          </p>
        )}
        {!watching && tab === "laws" && (
          <LawsPanel engine={engine} status={status} projectId={projectId} />
        )}
        {!watching && tab === "events" && (
          <EventsPanel engine={engine} status={status} projectId={projectId} />
        )}
        {tab === "minds" && <MindsPanel engine={engine} status={status} />}
      </div>
    </aside>
  );
}

export function PolisApp({
  projectId,
  recording,
}: {
  projectId?: string;
  recording?: PolisRecording;
}) {
  const engine = usePolisEngine({ projectId, recording });
  const chrome = useAppChrome();
  const started = engine.status !== null;

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-surface lg:flex-row">
      <div className="relative min-h-[50vh] min-w-0 flex-1 overflow-hidden bg-[#6e8f5f]">
        <div ref={engine.setContainer} className="absolute inset-0" />
        {started && (
          <>
            <NamePlate engine={engine} />
            <MapModes engine={engine} />
            {engine.status?.playback ? (
              <PlaybackBar
                engine={engine}
                status={engine.status}
                playback={engine.status.playback}
              />
            ) : (
              <Transport engine={engine} />
            )}
            <CitizenCard engine={engine} />
          </>
        )}
        {!started &&
          (engine.viewOnly ? <OpeningShare engine={engine} /> : <SetupScreen engine={engine} />)}
        {chrome?.backHref && !started && (
          <div className="absolute top-3 left-3">
            <BackLink href={chrome.backHref} label={chrome.backLabel ?? "Back"} />
          </div>
        )}
      </div>
      {started && <SidePanel engine={engine} projectId={projectId} />}
    </div>
  );
}
