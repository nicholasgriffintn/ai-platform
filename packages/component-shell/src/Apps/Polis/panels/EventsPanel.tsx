import { Button } from "@ngriffin_uk/polychat-component-ui";
import { polisService } from "@ngriffin_uk/polychat-library-client";
import {
  POLIS_DRAFT_MAX_LENGTH,
  type PolisScenario,
  type PolisScenarioKind,
} from "@ngriffin_uk/polychat-schemas";
import {
  Baby,
  Biohazard,
  Factory,
  Home,
  PlaneLanding,
  TrendingDown,
  TrendingUp,
  Waves,
  Zap,
} from "lucide-react";
import { type FormEvent, useState } from "react";

import type { PolisStatus } from "../engine/protocol.js";
import type { PolisEngine } from "../usePolisEngine.js";

const PRESETS: {
  kind: PolisScenarioKind;
  title: string;
  summary: string;
  months: number;
  icon: typeof Zap;
}[] = [
  {
    kind: "recession",
    title: "A recession hits",
    summary: "Spending and exports fall away.",
    months: 24,
    icon: TrendingDown,
  },
  {
    kind: "boom",
    title: "A boom arrives",
    summary: "Confidence and orders surge.",
    months: 24,
    icon: TrendingUp,
  },
  {
    kind: "epidemic",
    title: "An epidemic spreads",
    summary: "Far more people die while it lasts.",
    months: 12,
    icon: Biohazard,
  },
  {
    kind: "factory_closures",
    title: "The big factories close",
    summary: "The largest exporters shut overnight.",
    months: 1,
    icon: Factory,
  },
  {
    kind: "flood",
    title: "The river floods",
    summary: "Homes near the water are destroyed.",
    months: 1,
    icon: Waves,
  },
  {
    kind: "housing_crash",
    title: "House prices crash",
    summary: "Prices drop and confidence goes with them.",
    months: 18,
    icon: Home,
  },
  {
    kind: "immigration_wave",
    title: "A wave of arrivals",
    summary: "Thousands move in looking for work and homes.",
    months: 12,
    icon: PlaneLanding,
  },
  {
    kind: "baby_boom",
    title: "A baby boom",
    summary: "Birth rates climb for years.",
    months: 48,
    icon: Baby,
  },
];

export function EventsPanel({
  engine,
  projectId,
}: {
  engine: PolisEngine;
  status: PolisStatus;
  projectId?: string;
}) {
  const [severity, setSeverity] = useState(0.6);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<PolisScenario | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);

  const stage = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setRefusal(null);
    setDraft(null);

    try {
      const result = await polisService.draftScenario({ text: text.trim() }, projectId);

      if (result.status === "possible") {
        setDraft(result.scenario);
      } else {
        setRefusal(result.reason);
      }
    } catch (caught) {
      setRefusal(caught instanceof Error ? caught.message : "That could not be staged");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <label className="block space-y-0.5">
          <span className="flex items-baseline justify-between text-xs">
            <span>How bad</span>
            <span className="font-mono text-muted-foreground tabular-nums">
              {Math.round(severity * 100)}%
            </span>
          </span>
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.05}
            value={severity}
            aria-label="How bad"
            onChange={(event) => setSeverity(Number(event.target.value))}
            className="w-full accent-foreground"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          {PRESETS.map(({ icon: Icon, ...preset }) => (
            <button
              key={preset.kind}
              type="button"
              onClick={() => engine.send({ type: "scenario", scenario: { ...preset, severity } })}
              className="space-y-1 rounded-lg border border-border p-2.5 text-left transition-colors hover:border-foreground/50"
            >
              <Icon size={16} className="text-muted-foreground" />
              <span className="block text-xs font-medium">{preset.title}</span>
              <span className="block text-[11px] leading-snug text-muted-foreground">
                {preset.summary}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-medium">Something else</h3>
        <form onSubmit={(event) => void stage(event)} className="space-y-2">
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={POLIS_DRAFT_MAX_LENGTH}
            rows={2}
            placeholder="A meteor lands on the shopping district"
            aria-label="Describe an event"
            className="w-full resize-none rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/60"
          />
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={busy}
            disabled={text.trim().length < 3}
            icon={<Zap size={14} />}
          >
            Stage it
          </Button>
        </form>
        {refusal && <p className="text-xs text-failure">{refusal}</p>}
        {draft && (
          <div className="space-y-2 rounded-lg border-2 border-foreground/70 p-3">
            <p className="font-display text-lg leading-snug">{draft.title}</p>
            <p className="text-xs">{draft.summary}</p>
            <p className="font-mono text-xs text-muted-foreground tabular-nums">
              {Math.round(draft.severity * 100)}% severity · {draft.months} months
            </p>
            <div className="flex gap-1.5">
              <Button
                variant="primary"
                size="xs"
                onClick={() => {
                  engine.send({ type: "scenario", scenario: draft });
                  setDraft(null);
                  setText("");
                }}
              >
                Let it happen
              </Button>
              <Button variant="ghost" size="xs" onClick={() => setDraft(null)}>
                Not today
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
