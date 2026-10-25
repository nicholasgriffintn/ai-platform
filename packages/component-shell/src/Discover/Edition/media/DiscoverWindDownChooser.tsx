import { Button, FormInput, FormTextarea, Switch, cn } from "@ngriffin_uk/polychat-component-ui";
import {
  DISCOVER_WIND_DOWN_BEDS,
  DISCOVER_WIND_DOWN_KINDS,
  DISCOVER_WIND_DOWN_MINUTES,
  DISCOVER_WIND_DOWN_NOTES_MAX_LENGTH,
  type CreateDiscoverWindDown,
  type DiscoverWindDownBed,
  type DiscoverWindDownKind,
  type DiscoverWindDownTonight,
} from "@ngriffin_uk/polychat-schemas";
import { Play } from "lucide-react";
import { useState, type ReactNode } from "react";

import { WIND_DOWN_BED_LABELS, WIND_DOWN_KIND_LABELS } from "./wind-down-choices.js";
import { WindDownScene } from "./WindDownScene.js";

function OptionGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-xs font-medium text-muted-foreground">{label}</legend>
      {children}
    </fieldset>
  );
}

function Pill({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "rounded-full px-4 py-1.5 text-sm tabular-nums transition-colors",
        pressed ? "bg-foreground text-canvas" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function TonightPick({
  tonight,
  isStarting,
  onBegin,
}: {
  tonight: DiscoverWindDownTonight;
  isStarting: boolean;
  onBegin: () => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl">
      <WindDownScene bed={tonight.bed} seed={`tonight:${tonight.kind}`} moving={false} />
      <div className="relative flex flex-wrap items-end justify-between gap-3 bg-gradient-to-t from-black/70 to-black/10 p-4 text-white">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[0.65rem] font-semibold tracking-[0.08em] text-white/70 uppercase">
            Tonight
          </span>
          <span className="font-display text-lg leading-tight">
            {WIND_DOWN_KIND_LABELS[tonight.kind].label}, {tonight.minutes} min
          </span>
          <span className="text-sm text-white/80">{tonight.reason}</span>
        </div>
        <Button variant="primary" disabled={isStarting} onClick={onBegin}>
          <Play size={15} aria-hidden />
          Begin
        </Button>
      </div>
    </div>
  );
}

export function DiscoverWindDownChooser({
  initial,
  tonight,
  isStarting,
  onBegin,
  onCancel,
}: {
  initial: Pick<CreateDiscoverWindDown, "kind" | "minutes"> | null;
  tonight: DiscoverWindDownTonight | undefined;
  isStarting: boolean;
  onBegin: (input: CreateDiscoverWindDown) => void;
  onCancel?: () => void;
}) {
  const [kind, setKind] = useState<DiscoverWindDownKind>(initial?.kind ?? "breathing");
  const [minutes, setMinutes] = useState<CreateDiscoverWindDown["minutes"]>(initial?.minutes ?? 10);
  const [bed, setBed] = useState<DiscoverWindDownBed | null>(null);
  const [topic, setTopic] = useState("");
  const [notes, setNotes] = useState("");
  const [aboutToday, setAboutToday] = useState(true);
  const kinds = DISCOVER_WIND_DOWN_KINDS.filter(
    (option) => option !== "read_back" || tonight?.readBack,
  );

  const begin = () =>
    onBegin({
      kind,
      minutes,
      ...(bed ? { bed } : {}),
      ...(kind === "story" && topic.trim() ? { topic: topic.trim() } : {}),
      ...(kind === "park" && notes.trim() ? { notes: notes.trim() } : {}),
      ...(kind === "unwind" || kind === "park" ? { aboutToday } : {}),
    });

  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-border bg-surface p-4 sm:p-5">
      {tonight ? (
        <TonightPick
          tonight={tonight}
          isStarting={isStarting}
          onBegin={() =>
            onBegin({
              kind: tonight.kind,
              minutes: tonight.minutes,
              bed: tonight.bed,
              ...(tonight.topic ? { topic: tonight.topic } : {}),
            })
          }
        />
      ) : null}
      <OptionGroup label={tonight ? "Or choose" : "What kind"}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {kinds.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={kind === option}
              onClick={() => setKind(option)}
              className={cn(
                "flex flex-col gap-0.5 rounded-xl border px-3 py-2.5 text-left transition-colors",
                kind === option
                  ? "border-foreground bg-selection"
                  : "border-border hover:bg-selection",
              )}
            >
              <span className="text-sm font-medium text-foreground">
                {WIND_DOWN_KIND_LABELS[option].label}
              </span>
              <span className="text-xs text-muted-foreground">
                {WIND_DOWN_KIND_LABELS[option].detail}
              </span>
            </button>
          ))}
        </div>
      </OptionGroup>
      {kind === "story" ? (
        <FormInput
          label="What it wanders through"
          placeholder={tonight?.topic ?? "Leave empty and Poly picks from what you follow"}
          value={topic}
          maxLength={60}
          onChange={(event) => setTopic(event.currentTarget.value)}
        />
      ) : null}
      {kind === "park" ? (
        <FormTextarea
          label="What's on your mind"
          description="Each thing comes back as something worth doing in the morning edition."
          rows={4}
          value={notes}
          maxLength={DISCOVER_WIND_DOWN_NOTES_MAX_LENGTH}
          onChange={(event) => setNotes(event.currentTarget.value)}
        />
      ) : null}
      {kind === "unwind" || kind === "park" ? (
        <Switch
          label="Mention my day"
          description="Turn off when others can hear."
          checked={aboutToday}
          onChange={(event) => setAboutToday(event.currentTarget.checked)}
        />
      ) : null}
      <OptionGroup label="How long">
        <div className="inline-flex w-fit rounded-full border border-border p-0.5">
          {DISCOVER_WIND_DOWN_MINUTES.map((option) => (
            <Pill key={option} pressed={minutes === option} onClick={() => setMinutes(option)}>
              {option} min
            </Pill>
          ))}
        </div>
      </OptionGroup>
      <OptionGroup label="Sound">
        <div className="flex w-fit flex-wrap rounded-3xl border border-border p-0.5">
          <Pill pressed={bed === null} onClick={() => setBed(null)}>
            Poly's choice
          </Pill>
          {DISCOVER_WIND_DOWN_BEDS.map((option) => (
            <Pill key={option} pressed={bed === option} onClick={() => setBed(option)}>
              {WIND_DOWN_BED_LABELS[option]}
            </Pill>
          ))}
        </div>
      </OptionGroup>
      <div className="flex items-center gap-2">
        <Button variant="primary" disabled={isStarting} onClick={begin}>
          <Play size={15} aria-hidden />
          Begin {WIND_DOWN_KIND_LABELS[kind].label.toLowerCase()}, {minutes} min
        </Button>
        {onCancel ? (
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </section>
  );
}
