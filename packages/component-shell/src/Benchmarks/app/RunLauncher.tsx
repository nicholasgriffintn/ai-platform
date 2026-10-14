import { ModelIcon } from "@ngriffin_uk/polychat-component-models";
import { Badge, Button, SearchInput, cn } from "@ngriffin_uk/polychat-component-ui";
import {
  useBenchmarkEstimate,
  useBenchmarkIndex,
  useModels,
  useStartBenchmarkRuns,
} from "@ngriffin_uk/polychat-library-react";
import {
  getModelDisplayName,
  type BenchmarkId,
  type BenchmarkRun,
  type BenchmarkSummary,
} from "@ngriffin_uk/polychat-schemas";
import { formatUsd } from "@ngriffin_uk/polychat-utility-core";
import { Check, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";

import { CATEGORY_TONES } from "../benchmark-display.js";

const MAX_MODELS = 5;
const SHOWN_MODELS = 40;

function Step({
  number,
  title,
  aside,
  children,
}: {
  number: number;
  title: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2.5 text-sm font-medium text-foreground">
          <span className="flex size-6 items-center justify-center rounded-full bg-selection font-mono text-xs text-muted-foreground">
            {number}
          </span>
          {title}
        </p>
        {aside}
      </div>
      {children}
    </div>
  );
}

function BenchmarkOption({
  benchmark,
  selected,
  onSelect,
}: {
  benchmark: BenchmarkSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  const tone = CATEGORY_TONES[benchmark.category];

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "flex flex-col gap-1 rounded-xl border p-3 text-left transition-colors",
        selected
          ? "border-accent-amber bg-accent-amber/10"
          : "border-border bg-surface hover:border-border-strong",
      )}
    >
      <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
        <span aria-hidden className={cn("size-1.5 rounded-full", tone.dot)} />
        {benchmark.category}
      </span>
      <span className="font-display text-lg leading-tight text-foreground">{benchmark.name}</span>
      <span className="text-xs text-muted-foreground">{benchmark.tagline}</span>
    </button>
  );
}

export function RunLauncher({ onStarted }: { onStarted: (runs: BenchmarkRun[]) => void }) {
  const index = useBenchmarkIndex();
  const models = useModels();
  const estimate = useBenchmarkEstimate();
  const start = useStartBenchmarkRuns();
  const [benchmarkId, setBenchmarkId] = useState<BenchmarkId>("countdown");
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  const executable = useMemo(
    () =>
      Object.entries(models.data ?? {})
        .filter(([, model]) => model.isExecutable !== false)
        .map(([id, model]) => ({ id, model, name: getModelDisplayName(model) }))
        .sort((left, right) => left.name.localeCompare(right.name)),
    [models.data],
  );
  const options = useMemo(
    () =>
      executable
        .filter(({ name }) => name.toLowerCase().includes(search.trim().toLowerCase()))
        .slice(0, SHOWN_MODELS),
    [executable, search],
  );
  const chosen = selected.flatMap((id) => executable.filter((option) => option.id === id));
  const benchmarks = index.data?.boards.map((board) => board.benchmark) ?? [];
  const benchmark = benchmarks.find((candidate) => candidate.id === benchmarkId);
  const request = { benchmarkId, modelIds: selected };
  const estimates = estimate.data?.estimates ?? [];
  const canStart =
    selected.length > 0 &&
    estimates.length === selected.length &&
    estimates.every((entry) => entry.eligible);
  const estimatedTotal = estimates.reduce((sum, entry) => sum + (entry.estimatedCostUsd ?? 0), 0);

  const toggle = (id: string) => {
    estimate.reset();
    setSelected((current) =>
      current.includes(id)
        ? current.filter((candidate) => candidate !== id)
        : current.length >= MAX_MODELS
          ? current
          : [...current, id],
    );
  };

  return (
    <div className="space-y-8 rounded-2xl border border-border bg-surface p-5">
      <Step number={1} title="Pick a benchmark">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {benchmarks.map((candidate) => (
            <BenchmarkOption
              key={candidate.id}
              benchmark={candidate}
              selected={candidate.id === benchmarkId}
              onSelect={() => {
                estimate.reset();
                setBenchmarkId(candidate.id);
              }}
            />
          ))}
        </div>
        {benchmark ? (
          <p className="text-xs text-muted-foreground">
            {benchmark.itemCount} items ·{" "}
            {benchmark.scoring === "votes"
              ? "scored by a judge model, since private runs never enter the vote"
              : "scored automatically"}
            {benchmark.input === "image" ? " · needs a model that can read images" : ""}
          </p>
        ) : null}
      </Step>

      <Step
        number={2}
        title={
          <>
            Pick up to {MAX_MODELS} models{" "}
            <span className="font-normal text-muted-foreground">
              ({selected.length} of {MAX_MODELS})
            </span>
          </>
        }
        aside={
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Find a model"
            className="max-w-xs"
          />
        }
      >
        {chosen.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {chosen.map(({ id, model, name }) => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => toggle(id)}
                  className="flex items-center gap-1.5 rounded-full border border-accent-amber/40 bg-accent-amber/10 py-1 pr-2 pl-1.5 text-xs text-foreground hover:bg-accent-amber/20"
                >
                  <ModelIcon
                    modelName={name}
                    provider={model.provider}
                    url={model.avatarUrl}
                    size={14}
                  />
                  {name}
                  <X size={12} aria-hidden />
                  <span className="sr-only">Remove</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <ul className="grid max-h-72 gap-1 overflow-y-auto rounded-xl border border-border bg-canvas/40 p-2 sm:grid-cols-2 lg:grid-cols-3">
          {options.map(({ id, model, name }) => {
            const isSelected = selected.includes(id);

            return (
              <li key={id}>
                <button
                  type="button"
                  aria-pressed={isSelected}
                  disabled={!isSelected && selected.length >= MAX_MODELS}
                  onClick={() => toggle(id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm disabled:opacity-50",
                    isSelected
                      ? "bg-selection text-foreground"
                      : "text-muted-foreground hover:bg-selection/60 hover:text-foreground",
                  )}
                >
                  <ModelIcon
                    modelName={name}
                    provider={model.provider}
                    url={model.avatarUrl}
                    size={16}
                  />
                  <span className="min-w-0 flex-1 truncate">{name}</span>
                  {isSelected ? (
                    <Check size={14} className="text-accent-amber" aria-hidden />
                  ) : null}
                </button>
              </li>
            );
          })}
          {options.length === 0 ? (
            <li className="col-span-full px-2 py-6 text-center text-sm text-muted-foreground">
              No models match that search.
            </li>
          ) : null}
        </ul>
      </Step>

      <Step number={3} title="Check and start">
        {estimates.length > 0 ? (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {estimates.map((entry) => (
              <li
                key={entry.modelId}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
              >
                <span className="text-foreground">{entry.name}</span>
                {entry.eligible ? (
                  <span className="text-muted-foreground tabular-nums">
                    {entry.estimatedCostUsd === null
                      ? "Cost unknown"
                      : `About ${formatUsd(entry.estimatedCostUsd)}`}
                    {entry.byok ? (
                      <Badge variant="success" className="ml-2">
                        On your keys
                      </Badge>
                    ) : (
                      " of credit"
                    )}
                  </span>
                ) : (
                  <span className="text-failure">{entry.reason ?? "Not eligible"}</span>
                )}
              </li>
            ))}
            {estimatedTotal > 0 ? (
              <li className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Estimated total</span>
                <span className="font-medium text-foreground tabular-nums">
                  About {formatUsd(estimatedTotal)}
                </span>
              </li>
            ) : null}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Checking confirms each model can enter and estimates the cost before anything runs.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={selected.length === 0 || estimate.isPending}
            isLoading={estimate.isPending}
            onClick={() => estimate.mutate(request)}
          >
            Check eligibility and cost
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={!canStart || start.isPending}
            isLoading={start.isPending}
            onClick={() =>
              start.mutate(request, {
                onSuccess: (response) => {
                  setSelected([]);
                  estimate.reset();
                  onStarted(response.runs);
                },
              })
            }
          >
            Start {selected.length > 1 ? `${selected.length} runs` : "run"}
          </Button>
        </div>
        {start.error || estimate.error ? (
          <p className="text-sm text-failure">{(start.error ?? estimate.error)?.message}</p>
        ) : null}
      </Step>
    </div>
  );
}
