import { Button, cn } from "@ngriffin_uk/polychat-component-ui";
import { YEAR_DAYS } from "@ngriffin_uk/polychat-library-polis";
import { ChevronLeft, ChevronRight, CornerDownRight, Pause, Play, Radio } from "lucide-react";
import { useState } from "react";

import {
  POLIS_PLAYBACK_UNITS,
  type PolisPlaybackState,
  type PolisPlaybackUnit,
  type PolisStatus,
} from "./engine/protocol.js";
import type { PolisEngine } from "./usePolisEngine.js";

const UNIT_LABELS: Record<PolisPlaybackUnit, string> = {
  hours: "Hours",
  days: "Days",
  months: "Months",
  years: "Years",
};

const MARK_CLASSES = {
  law: "bg-[#2a78d6] dark:bg-[#3987e5]",
  scenario: "bg-[#eb6834] dark:bg-[#d95926]",
  parameters: "bg-muted-foreground",
};

export function formatMoment(day: number, hour?: number): string {
  const date = `Year ${Math.floor(day / YEAR_DAYS) + 1} · Day ${(day % YEAR_DAYS) + 1}`;

  return hour === undefined ? date : `${date} · ${String(hour).padStart(2, "0")}:00`;
}

function Timeline({
  engine,
  status,
  playback,
}: {
  engine: PolisEngine;
  status: PolisStatus;
  playback: PolisPlaybackState;
}) {
  const [draft, setDraft] = useState<number | null>(null);
  const end = Math.max(playback.endDay, 1);
  const value = draft ?? playback.day;

  const commit = () => {
    if (draft !== null) {
      engine.send({ type: "seek", day: draft, hour: playback.hour });
      setDraft(null);
    }
  };

  return (
    <div className="relative min-w-0 flex-1 pt-3">
      <div className="absolute inset-x-0 top-0 h-3">
        {status.marks.map((mark, index) => (
          <button
            key={`${mark.day}-${index}`}
            type="button"
            title={`${formatMoment(mark.day)}: ${mark.label}`}
            aria-label={`Jump to ${mark.label}`}
            onClick={() => engine.send({ type: "seek", day: mark.day })}
            style={{ left: `${(mark.day / end) * 100}%` }}
            className={cn(
              "absolute top-0 z-10 h-3 w-1.5 -translate-x-1/2 rounded-sm",
              MARK_CLASSES[mark.kind],
            )}
          />
        ))}
      </div>
      <input
        type="range"
        min={0}
        max={end}
        step={1}
        value={value}
        aria-label="Timeline"
        onChange={(event) => setDraft(Number(event.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        className="block w-full accent-foreground"
      />
    </div>
  );
}

export function PlaybackBar({
  engine,
  status,
  playback,
}: {
  engine: PolisEngine;
  status: PolisStatus;
  playback: PolisPlaybackState;
}) {
  const { send } = engine;
  const { unit } = playback;

  return (
    <div className="absolute inset-x-3 bottom-3 space-y-1.5 rounded-xl border border-border bg-card/95 p-2 shadow-lg">
      <div className="flex items-center gap-2">
        <Timeline engine={engine} status={status} playback={playback} />
        <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
          {playback.seeking ? "Rewinding…" : formatMoment(playback.day, playback.hour)}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <Button
          variant="primary"
          size="icon"
          aria-label={playback.playing ? "Pause playback" : "Play back"}
          onClick={() => send({ type: "playback", playing: !playback.playing, unit })}
        >
          {playback.playing ? <Pause size={16} /> : <Play size={16} />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Back one ${unit.slice(0, -1)}`}
          onClick={() => send({ type: "nudge", unit, direction: -1 })}
        >
          <ChevronLeft size={16} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Forward one ${unit.slice(0, -1)}`}
          onClick={() => send({ type: "nudge", unit, direction: 1 })}
        >
          <ChevronRight size={16} />
        </Button>
        <div role="group" aria-label="Playback steps" className="flex">
          {POLIS_PLAYBACK_UNITS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={unit === option}
              onClick={() => send({ type: "playback", playing: playback.playing, unit: option })}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                unit === option
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {UNIT_LABELS[option]}
            </button>
          ))}
        </div>
        <div className={cn("ml-auto flex gap-1", engine.viewOnly && "hidden")}>
          <Button
            variant="outline"
            size="xs"
            icon={<CornerDownRight size={12} />}
            disabled={playback.seeking}
            onClick={() => send({ type: "carryOn" })}
          >
            Carry on from here
          </Button>
          <Button
            variant="secondary"
            size="xs"
            icon={<Radio size={12} />}
            onClick={() => send({ type: "backToNow" })}
          >
            Back to now
          </Button>
        </div>
      </div>
    </div>
  );
}
