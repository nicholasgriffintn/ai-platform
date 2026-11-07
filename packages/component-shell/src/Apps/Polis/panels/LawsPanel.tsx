import { Button } from "@ngriffin_uk/polychat-component-ui";
import { polisService } from "@ngriffin_uk/polychat-library-client";
import { formatParameter } from "@ngriffin_uk/polychat-library-polis";
import {
  POLIS_ACTION_LABELS,
  POLIS_DRAFT_MAX_LENGTH,
  POLIS_PARAMETERS,
  POLIS_PARAMETER_IDS,
  type PolisLaw,
  type PolisParameterId,
  type PolisRule,
} from "@ngriffin_uk/polychat-schemas";
import { formatProbabilityPercent } from "@ngriffin_uk/polychat-utility-core";
import { Gavel, Scale, Vote, X } from "lucide-react";
import { type FormEvent, useState } from "react";

import type { PolisStatus } from "../engine/protocol.js";
import type { PolisEngine } from "../usePolisEngine.js";

const GROUPS = ["Tax", "Welfare", "Housing", "Work", "Society"] as const;

const EXAMPLES = [
  "Cap rents at 2% a year",
  "Tax the rich 3% of their wealth each year",
  "Pay every pensioner an extra £300 a month",
  "Ban buy-to-let landlords",
  "Raise the retirement age to 72",
];

function describeCohort({ cohort }: PolisRule): string {
  const parts = [
    cohort.wealth,
    cohort.employment,
    cohort.tenure,
    cohort.minAge !== null ? `${cohort.minAge}+` : null,
    cohort.maxAge !== null ? `under ${cohort.maxAge}` : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ").replaceAll("_", " ") : "everyone";
}

function describeRule(rule: PolisRule): string {
  const { effect } = rule;
  const who = describeCohort(rule);

  switch (effect.kind) {
    case "payment":
      return `Pays ${who} £${effect.amountPerMonth} a month`;
    case "levy":
      return `Charges ${who} ${effect.percentOfWealthPerYear}% of wealth a year`;
    case "ban":
      return `Stops ${who} from: ${POLIS_ACTION_LABELS[effect.action].toLowerCase()}`;
    default:
      return `Makes ${who} ${effect.multiplier}× as likely to ${POLIS_ACTION_LABELS[effect.action].toLowerCase()}`;
  }
}

function LawEffects({ law }: { law: PolisLaw }) {
  return (
    <ul className="space-y-0.5 text-xs text-muted-foreground">
      {law.changes.map(({ parameter, value }) => (
        <li key={parameter}>
          {POLIS_PARAMETERS[parameter].label}: {formatParameter(parameter, value)}
        </li>
      ))}
      {law.rules.map((rule, index) => (
        <li key={index}>{describeRule(rule)}</li>
      ))}
    </ul>
  );
}

function PollResults({ engine }: { engine: PolisEngine }) {
  const { poll } = engine;

  if (poll.status === "idle") {
    return null;
  }

  if (poll.status === "asking") {
    return <p className="text-xs text-muted-foreground">Knocking on doors…</p>;
  }

  if (poll.status === "failed") {
    return <p className="text-xs text-failure">{poll.message}</p>;
  }

  const { result } = poll;

  return (
    <div className="space-y-1.5 rounded-md bg-muted/50 p-2.5">
      <p className="text-sm font-medium">
        {formatProbabilityPercent(result.support)} would vote for it
      </p>
      {result.groups.map((group) => (
        <div key={group.label} className="grid grid-cols-[5.5rem_1fr_2.5rem] items-center gap-2">
          <span className="text-xs text-muted-foreground">{group.label}</span>
          <span className="h-1.5 overflow-hidden rounded-sm bg-border">
            <span
              className="block h-full rounded-sm bg-[#2a78d6] dark:bg-[#3987e5]"
              style={{ width: `${group.support * 100}%` }}
            />
          </span>
          <span className="text-right font-mono text-xs tabular-nums">
            {formatProbabilityPercent(group.support)}
          </span>
        </div>
      ))}
    </div>
  );
}

function Proposal({
  engine,
  status,
  projectId,
}: {
  engine: PolisEngine;
  status: PolisStatus;
  projectId?: string;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [law, setLaw] = useState<PolisLaw | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);

  const draft = async (proposal: string) => {
    setBusy(true);
    setRefusal(null);
    setLaw(null);
    engine.clearPoll();

    try {
      const result = await polisService.draftLaw(
        { text: proposal, parameters: status.snapshot.parameters },
        projectId,
      );

      if (result.status === "enforceable") {
        setLaw(result.law);
      } else {
        setRefusal(result.reason);
      }
    } catch (caught) {
      setRefusal(caught instanceof Error ? caught.message : "The clerk could not draft that");
    } finally {
      setBusy(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();

    if (text.trim().length >= 3) {
      void draft(text.trim());
    }
  };

  const reset = () => {
    setLaw(null);
    setText("");
    engine.clearPoll();
  };

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-medium">Propose a law</h3>
      <form onSubmit={submit} className="space-y-2">
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={POLIS_DRAFT_MAX_LENGTH}
          rows={2}
          placeholder="Write it however you like"
          aria-label="Your proposal"
          className="w-full resize-none rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/60"
        />
        <Button
          type="submit"
          variant="primary"
          size="sm"
          isLoading={busy}
          disabled={text.trim().length < 3}
          icon={<Scale size={14} />}
        >
          Draft it
        </Button>
      </form>
      {!law && !busy && (
        <div className="flex flex-wrap gap-1">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => {
                setText(example);
                void draft(example);
              }}
              className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:border-foreground/50 hover:text-foreground"
            >
              {example}
            </button>
          ))}
        </div>
      )}
      {refusal && <p className="text-xs text-failure">{refusal}</p>}
      {law && (
        <div className="space-y-2 rounded-lg border-2 border-foreground/70 p-3">
          <p className="font-display text-lg leading-snug">{law.title}</p>
          <p className="text-xs">{law.summary}</p>
          <LawEffects law={law} />
          <PollResults engine={engine} />
          <div className="flex flex-wrap gap-1.5">
            <Button
              variant="primary"
              size="xs"
              icon={<Gavel size={12} />}
              onClick={() => {
                engine.send({ type: "law", law });
                reset();
              }}
            >
              Enact
            </Button>
            <Button
              variant="outline"
              size="xs"
              icon={<Vote size={12} />}
              disabled={engine.poll.status === "asking"}
              onClick={() => engine.askTown(`${law.title}: ${law.summary}`)}
            >
              Poll the town
            </Button>
            <Button variant="ghost" size="xs" onClick={reset}>
              Bin it
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function ParameterSlider({
  id,
  engine,
  status,
}: {
  id: PolisParameterId;
  engine: PolisEngine;
  status: PolisStatus;
}) {
  const definition = POLIS_PARAMETERS[id];
  const committed = status.snapshot.parameters[id];
  const [draft, setDraft] = useState<number | null>(null);
  const value = draft ?? committed;
  const overridden = status.snapshot.laws.some((law) =>
    law.changes.some((change) => change.parameter === id),
  );

  const commit = () => {
    if (draft !== null) {
      engine.send({ type: "parameters", values: { [id]: draft } });
      setDraft(null);
    }
  };

  return (
    <label className="block space-y-0.5">
      <span className="flex items-baseline justify-between gap-2 text-xs">
        <span>{definition.label}</span>
        <span className="font-mono text-muted-foreground tabular-nums">
          {formatParameter(id, value)}
        </span>
      </span>
      <input
        type="range"
        min={definition.min}
        max={definition.max}
        step={definition.step}
        value={value}
        disabled={overridden}
        title={overridden ? "Set by a law. Repeal it to change this." : definition.hint}
        aria-label={definition.label}
        onChange={(event) => setDraft(Number(event.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
        className="w-full accent-foreground disabled:opacity-40"
      />
    </label>
  );
}

export function LawsPanel({
  engine,
  status,
  projectId,
}: {
  engine: PolisEngine;
  status: PolisStatus;
  projectId?: string;
}) {
  return (
    <div className="space-y-5">
      <Proposal engine={engine} status={status} projectId={projectId} />

      {status.snapshot.laws.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-medium">On the books</h3>
          <ul className="space-y-2">
            {status.snapshot.laws.map((law) => (
              <li key={law.id} className="space-y-1 rounded-lg border border-border p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{law.title}</p>
                  <Button
                    variant="ghost"
                    size="xs"
                    icon={<X size={12} />}
                    onClick={() => engine.send({ type: "repeal", id: law.id })}
                  >
                    Repeal
                  </Button>
                </div>
                <LawEffects law={law} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {GROUPS.map((group) => (
        <section key={group} className="space-y-2">
          <h3 className="text-sm font-medium">{group}</h3>
          {POLIS_PARAMETER_IDS.filter((id) => POLIS_PARAMETERS[id].group === group).map((id) => (
            <ParameterSlider key={id} id={id} engine={engine} status={status} />
          ))}
        </section>
      ))}
    </div>
  );
}
