import { POLIS_ACTION_LABELS, POLIS_ACTIONS } from "@ngriffin_uk/polychat-schemas";
import { formatCompactCount, formatProbabilityPercent } from "@ngriffin_uk/polychat-utility-core";

import { POLIS_MODEL_BUDGETS, type PolisStatus } from "../engine/protocol.js";
import type { PolisEngine } from "../usePolisEngine.js";

const MODELS = [
  { value: "", label: "Automatic" },
  { value: "jev-latest", label: "Jev" },
  { value: "@cf/cloudflare/clef-flash", label: "Clef Flash" },
  { value: "@cf/cloudflare/clef", label: "Clef" },
];

function budgetLabel(budget: number): string {
  if (budget === 0) {
    return "Off";
  }

  return Number.isFinite(budget) ? formatCompactCount(budget) : "No limit";
}

export function MindsPanel({ engine, status }: { engine: PolisEngine; status: PolisStatus }) {
  const { modelSettings, setModelSettings } = engine;
  const { decisions, snapshot } = status;
  const totals = POLIS_ACTIONS.map((action) => ({
    action,
    count: snapshot.actionTotals[action] ?? 0,
  })).sort((first, second) => second.count - first.count);
  const largest = Math.max(1, ...totals.map((row) => row.count));

  return (
    <div className="space-y-5">
      <section className="space-y-1">
        <p className="text-sm">
          Daily life runs on simple rules. Big choices come from a decision model, asked once per
          kind of person, and everyone of that kind rolls against its answer.
        </p>
        <p className="font-mono text-xs text-muted-foreground tabular-nums">
          {formatProbabilityPercent(snapshot.decisions.modelShare)} of choices so far used the model
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-medium">Questions per simulated year</h3>
        <div role="group" aria-label="Question budget" className="grid grid-cols-5 gap-1">
          {POLIS_MODEL_BUDGETS.map((budget) => (
            <button
              key={budget}
              type="button"
              aria-pressed={modelSettings.callsPerYear === budget}
              onClick={() => setModelSettings({ ...modelSettings, callsPerYear: budget })}
              className={
                modelSettings.callsPerYear === budget
                  ? "rounded-md bg-foreground py-1.5 text-xs text-background"
                  : "rounded-md border border-border py-1.5 text-xs hover:border-foreground/50"
              }
            >
              {budgetLabel(budget)}
            </button>
          ))}
        </div>
        <label className="flex items-center justify-between gap-2 text-xs">
          <span>Model</span>
          <select
            value={modelSettings.model ?? ""}
            onChange={(event) =>
              setModelSettings({ ...modelSettings, model: event.target.value || undefined })
            }
            className="rounded-md border border-border bg-transparent px-2 py-1 text-xs"
          >
            {MODELS.map((model) => (
              <option key={model.value} value={model.value}>
                {model.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-start gap-2 text-xs">
          <input
            type="checkbox"
            checked={modelSettings.holdForAnswers}
            onChange={(event) =>
              setModelSettings({ ...modelSettings, holdForAnswers: event.target.checked })
            }
            className="mt-0.5 accent-foreground"
          />
          <span>Wait for the model each month, so no choice falls back to the simple rules</span>
        </label>
      </section>

      <section className="space-y-1">
        <h3 className="text-sm font-medium">So far</h3>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
          <dt className="text-muted-foreground">Answers</dt>
          <dd className="text-right font-mono tabular-nums">
            {decisions.calls.toLocaleString("en-GB")}
          </dd>
          <dt className="text-muted-foreground">Tokens read</dt>
          <dd className="text-right font-mono tabular-nums">
            {formatCompactCount(decisions.tokens)}
          </dd>
          <dt className="text-muted-foreground">Kinds of person known</dt>
          <dd className="text-right font-mono tabular-nums">{snapshot.decisions.modelBuckets}</dd>
          <dt className="text-muted-foreground">Waiting to ask</dt>
          <dd className="text-right font-mono tabular-nums">{snapshot.decisions.pending}</dd>
          <dt className="text-muted-foreground">Model</dt>
          <dd className="truncate text-right font-mono">{decisions.model ?? "None yet"}</dd>
        </dl>
        {decisions.error && (
          <p className="text-xs text-muted-foreground">
            The model is busy, so simple rules are filling in and it will be asked again shortly.
          </p>
        )}
      </section>

      {decisions.recent.length > 0 && (
        <section className="space-y-1">
          <h3 className="text-sm font-medium">What the model just said</h3>
          <ul className="space-y-1">
            {decisions.recent.map((row, index) => (
              <li key={`${row.label}-${index}`} className="text-xs">
                <span className="text-muted-foreground">{row.label}:</span>{" "}
                {row.action.toLowerCase()}{" "}
                <span className="font-mono tabular-nums">
                  {formatProbabilityPercent(row.probability)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-1">
        <h3 className="text-sm font-medium">What people have done</h3>
        {totals.map(({ action, count }) => (
          <div key={action} className="grid grid-cols-[6.5rem_1fr_3rem] items-center gap-2">
            <span className="text-xs text-muted-foreground">{POLIS_ACTION_LABELS[action]}</span>
            <span className="h-1.5 overflow-hidden rounded-sm bg-border">
              <span
                className="block h-full rounded-sm bg-[#2a78d6] dark:bg-[#3987e5]"
                style={{ width: `${(count / largest) * 100}%` }}
              />
            </span>
            <span className="text-right font-mono text-xs tabular-nums">
              {formatCompactCount(count)}
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}
