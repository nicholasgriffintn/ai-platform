import { ModelIcon } from "@ngriffin_uk/polychat-component-models";
import { Button, SearchInput, cn } from "@ngriffin_uk/polychat-component-ui";
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
} from "@ngriffin_uk/polychat-schemas";
import { formatUsd } from "@ngriffin_uk/polychat-utility-core";
import { useMemo, useState } from "react";

const MAX_MODELS = 5;
const SHOWN_MODELS = 40;

export function RunLauncher({ onStarted }: { onStarted: (runs: BenchmarkRun[]) => void }) {
  const index = useBenchmarkIndex();
  const models = useModels();
  const estimate = useBenchmarkEstimate();
  const start = useStartBenchmarkRuns();
  const [benchmarkId, setBenchmarkId] = useState<BenchmarkId>("countdown");
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  const options = useMemo(
    () =>
      Object.entries(models.data ?? {})
        .filter(([, model]) => model.isExecutable !== false)
        .map(([id, model]) => ({ id, model, name: getModelDisplayName(model) }))
        .filter(({ name }) => name.toLowerCase().includes(search.trim().toLowerCase()))
        .sort((left, right) => left.name.localeCompare(right.name))
        .slice(0, SHOWN_MODELS),
    [models.data, search],
  );
  const benchmarks = index.data?.boards.map((board) => board.benchmark) ?? [];
  const request = { benchmarkId, modelIds: selected };
  const estimates = estimate.data?.estimates ?? [];
  const canStart =
    selected.length > 0 &&
    estimates.length === selected.length &&
    estimates.every((entry) => entry.eligible);

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
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Benchmark</p>
        <div className="flex flex-wrap gap-2">
          {benchmarks.map((benchmark) => (
            <button
              key={benchmark.id}
              type="button"
              aria-pressed={benchmark.id === benchmarkId}
              onClick={() => {
                estimate.reset();
                setBenchmarkId(benchmark.id);
              }}
              className="rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground aria-pressed:border-accent-amber aria-pressed:bg-accent-amber/10 aria-pressed:text-foreground"
            >
              {benchmark.name}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-foreground">
            Models{" "}
            <span className="text-muted-foreground">
              ({selected.length} of {MAX_MODELS})
            </span>
          </p>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Find a model"
            className="max-w-xs"
          />
        </div>
        <ul className="grid max-h-80 gap-1 overflow-y-auto rounded-xl border border-border bg-surface p-2 sm:grid-cols-2">
          {options.map(({ id, model, name }) => (
            <li key={id}>
              <button
                type="button"
                aria-pressed={selected.includes(id)}
                onClick={() => toggle(id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm",
                  selected.includes(id)
                    ? "bg-selection text-foreground"
                    : "text-muted-foreground hover:bg-selection/60",
                )}
              >
                <ModelIcon
                  modelName={name}
                  provider={model.provider}
                  url={model.avatarUrl}
                  size={16}
                />
                <span className="min-w-0 flex-1 truncate">{name}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {estimates.length > 0 ? (
        <ul className="space-y-1 text-sm">
          {estimates.map((entry) => (
            <li key={entry.modelId} className="flex flex-wrap justify-between gap-2">
              <span className="text-foreground">{entry.name}</span>
              <span className={entry.eligible ? "text-muted-foreground" : "text-failure"}>
                {entry.reason ??
                  (entry.byok
                    ? "On your keys"
                    : entry.estimatedCostUsd === null
                      ? "Cost unknown"
                      : `About ${formatUsd(entry.estimatedCostUsd)} of credit`)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={selected.length === 0 || estimate.isPending}
          onClick={() => estimate.mutate(request)}
        >
          Check eligibility and cost
        </Button>
        <Button
          type="button"
          variant="primary"
          disabled={!canStart || start.isPending}
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
    </div>
  );
}
