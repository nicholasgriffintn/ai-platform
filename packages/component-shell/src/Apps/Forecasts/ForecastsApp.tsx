import { ForecastChart } from "@ngriffin_uk/polychat-component-content";
import {
  Button,
  FormInput,
  FormSelect,
  FormTextarea,
  cn,
} from "@ngriffin_uk/polychat-component-ui";
import { FORECAST_MAX_HORIZON } from "@ngriffin_uk/polychat-schemas";
import { formatMilliseconds, parsePositiveInteger } from "@ngriffin_uk/polychat-utility-core";
import { FileUp, TrendingUp } from "lucide-react";
import type { ChangeEvent } from "react";

import { FORECAST_SAMPLES } from "./samples.js";
import { type ColumnRole, roleOf, useForecastStudio } from "./useForecastStudio.js";

const ROLES: { role: ColumnRole; label: string; hint: string }[] = [
  { role: "forecast", label: "Forecast", hint: "The numbers you want projected" },
  { role: "known", label: "Known ahead", hint: "Planned values that fill the future rows" },
  { role: "past", label: "History only", hint: "Related readings known only so far" },
  { role: "ignore", label: "Ignore", hint: "Leave this column out" },
];
const NO_TIME_COLUMN = "__none__";

export function ForecastsApp({ projectId }: { projectId?: string }) {
  const studio = useForecastStudio(projectId);
  const numericColumns = studio.table?.columns.filter((column) => column.kind === "numeric") ?? [];
  const timeColumns = studio.table?.columns.filter((column) => column.kind === "time") ?? [];
  const view = studio.view;

  const openFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (file) {
      studio.loadText(await file.text());
    }

    event.target.value = "";
  };

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
      <div className="space-y-8">
        <div className="space-y-2">
          <p className="font-display text-4xl leading-tight">Where is it heading?</p>
          <p className="text-sm text-muted-foreground">
            Paste a time series and Timestral, Mistral&apos;s forecasting model, projects it forward
            with ranges rather than false confidence. It runs on Polychat&apos;s own servers, so the
            numbers stay in the nest.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {FORECAST_SAMPLES.map((sample) => (
            <button
              key={sample.id}
              type="button"
              onClick={() => studio.loadSample(sample)}
              className={cn(
                "rounded-xl border bg-card p-3 text-left transition-[border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-accent-sky/60",
                studio.sampleId === sample.id ? "border-accent-sky" : "border-border",
              )}
            >
              <span className="block text-sm font-medium">{sample.name}</span>
              <span className="mt-1 block text-[11px] leading-snug text-muted-foreground">
                {sample.hint}
              </span>
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <FormTextarea
            label="Your data"
            description="A CSV with a header row, oldest first. Leave the forecast column blank in any future rows that carry known-ahead values."
            value={studio.text}
            onChange={(event) => studio.loadText(event.target.value)}
            placeholder={"date,visitors\n2026-04-01,912\n2026-04-02,1040"}
            spellCheck={false}
            className="min-h-40 font-mono text-xs"
          />
          <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <FileUp size={14} />
            Open a CSV file
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              className="sr-only"
              onChange={(event) => void openFile(event)}
            />
          </label>
        </div>

        {studio.table && (
          <div className="space-y-5">
            <p className="font-mono text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
              {studio.table.rowCount} rows · {studio.table.columns.length} columns
            </p>
            {timeColumns.length > 0 && (
              <FormSelect
                label="Time column"
                value={studio.selection.timeColumn ?? NO_TIME_COLUMN}
                onValueChange={(value) =>
                  studio.setTimeColumn(value === NO_TIME_COLUMN ? null : value)
                }
                options={[
                  ...timeColumns.map((column) => ({ value: column.name, label: column.name })),
                  { value: NO_TIME_COLUMN, label: "No dates, just steps" },
                ]}
                fullWidth
              />
            )}
            {numericColumns.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No numeric columns yet. Feathers, perhaps, but nothing to forecast.
              </p>
            ) : (
              <ul className="space-y-3">
                {numericColumns.map((column) => {
                  const current = roleOf(studio.selection, column.name);

                  return (
                    <li key={column.name} className="space-y-1.5">
                      <span className="block truncate font-mono text-xs">{column.name}</span>
                      <div className="grid grid-cols-4 gap-1 rounded-lg border border-border p-0.5">
                        {ROLES.map(({ role, label, hint }) => (
                          <button
                            key={role}
                            type="button"
                            title={hint}
                            aria-pressed={current === role}
                            onClick={() => studio.setRole(column.name, role)}
                            className={cn(
                              "rounded-md px-1.5 py-1 text-[11px] transition-colors",
                              current === role
                                ? "bg-accent-sky/15 text-foreground"
                                : "text-muted-foreground hover:text-foreground",
                            )}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <FormInput
              label="Steps ahead"
              type="number"
              min={1}
              max={FORECAST_MAX_HORIZON}
              value={studio.selection.horizon}
              onChange={(event) => {
                const horizon = parsePositiveInteger(event.target.value);

                if (horizon) {
                  studio.setHorizon(Math.min(horizon, FORECAST_MAX_HORIZON));
                }
              }}
            />
            <Button
              variant="primary"
              icon={<TrendingUp size={16} />}
              isLoading={studio.busy}
              disabled={studio.selection.targets.length === 0}
              onClick={() => void studio.run()}
              fullWidth
            >
              Forecast
            </Button>
          </div>
        )}
        {studio.error && <p className="text-sm text-failure">{studio.error}</p>}
      </div>

      <div className="space-y-6">
        {view ? (
          <div className="space-y-8 motion-safe:animate-in motion-safe:duration-500 motion-safe:fade-in-0">
            {view.series.map((series, index) => (
              <ForecastChart key={series.name} view={view} seriesIndex={index} />
            ))}
            <p className="font-mono text-[11px] text-muted-foreground">
              {view.model} · {view.horizon} steps · {formatMilliseconds(view.elapsedMs)} of thinking
            </p>
          </div>
        ) : (
          <div className="flex min-h-80 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border text-center">
            <TrendingUp size={28} className="text-accent-sky" />
            <p className="font-display text-2xl">
              {studio.busy ? "Consulting the tea leaves" : "Nothing forecast yet"}
            </p>
            <p className="max-w-xs text-sm text-muted-foreground">
              {studio.busy
                ? "The first forecast after a quiet spell takes a minute while the model wakes."
                : "Pick a sample or paste your own numbers. The median is a best guess, the shaded bands are how far to trust it."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
