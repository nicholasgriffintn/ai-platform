import { Button } from "@ngriffin_uk/polychat-component-ui";
import { MONTH_DAYS, YEAR_DAYS, type MonthlyMetrics } from "@ngriffin_uk/polychat-library-polis";
import { formatCompactCount } from "@ngriffin_uk/polychat-utility-core";
import { GitFork, Merge } from "lucide-react";

import type { PolisStatus } from "../engine/protocol.js";
import type { PolisEngine } from "../usePolisEngine.js";
import { SeriesLegend, TrendChart } from "./TrendChart.js";

function percent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function money(value: number): string {
  return `£${formatCompactCount(Math.round(value))}`;
}

function count(value: number): string {
  return formatCompactCount(Math.round(value));
}

const CHARTS: {
  title: string;
  metric: keyof MonthlyMetrics;
  format: (value: number) => string;
  zeroBased?: boolean;
}[] = [
  { title: "People", metric: "population", format: count },
  { title: "Unemployment", metric: "unemploymentPct", format: percent, zeroBased: true },
  { title: "Council approval", metric: "approvalPct", format: percent },
  { title: "Average rent", metric: "averageRent", format: money },
  { title: "House prices", metric: "housePrice", format: money },
  { title: "Homelessness", metric: "homelessPct", format: percent, zeroBased: true },
  { title: "Inequality (Gini)", metric: "gini", format: (value) => value.toFixed(2) },
  { title: "Inflation", metric: "inflationPct", format: percent },
];

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border p-2.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="font-mono text-lg leading-tight tabular-nums">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ForkControls({ engine, status }: { engine: PolisEngine; status: PolisStatus }) {
  if (status.branches.length < 2) {
    return (
      <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
        <p className="text-xs text-muted-foreground">
          Fork the town to run two futures side by side. Change one, leave the other, and compare.
        </p>
        <Button
          variant="outline"
          size="sm"
          icon={<GitFork size={14} />}
          onClick={() => engine.send({ type: "fork" })}
        >
          Fork the town
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <p className="text-xs font-medium">Two futures are running. You are watching:</p>
      <div className="flex gap-1">
        {status.branches.map((label, index) => (
          <Button
            key={label}
            variant={status.branch === index ? "primary" : "outline"}
            size="xs"
            onClick={() => engine.send({ type: "branch", index })}
          >
            {label}
          </Button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Laws and events apply to the future you are watching.
      </p>
      <Button
        variant="ghost"
        size="xs"
        icon={<Merge size={14} />}
        onClick={() => engine.send({ type: "keepBranch" })}
      >
        Keep this future
      </Button>
    </div>
  );
}

export function TownPanel({ engine, status }: { engine: PolisEngine; status: PolisStatus }) {
  const { latest } = status.snapshot;

  return (
    <div className="space-y-4">
      {latest ? (
        <div className="grid grid-cols-2 gap-2">
          <Tile label="People" value={count(latest.population)} hint={`${latest.firms} firms`} />
          <Tile label="Out of work" value={percent(latest.unemploymentPct)} />
          <Tile label="Mood" value={`${latest.mood.toFixed(0)}/100`} />
          <Tile label="Approval" value={percent(latest.approvalPct)} />
          <Tile label="Median savings" value={money(latest.medianWealth)} />
          <Tile
            label="Protesting"
            value={count(latest.protesters)}
            hint={`${count(latest.homeless)} homeless`}
          />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Figures arrive at the end of the first month.
        </p>
      )}

      {!engine.viewOnly && <ForkControls engine={engine} status={status} />}

      <Chronicle status={status} />
      <Moments status={status} />

      <div className="space-y-3">
        <SeriesLegend labels={status.series.map((line) => line.label)} />
        {CHARTS.map(({ title, metric, format, zeroBased }) => (
          <TrendChart
            key={metric}
            title={title}
            format={format}
            zeroBased={zeroBased}
            playhead={status.playback ? status.playback.day / MONTH_DAYS : undefined}
            series={status.series.map((line) => ({
              label: line.label,
              points: line.points.map((point) => ({
                month: point.month,
                value: point[metric],
              })),
            }))}
          />
        ))}
      </div>
    </div>
  );
}

function Moments({ status }: { status: PolisStatus }) {
  if (status.moments.length === 0) {
    return null;
  }

  return (
    <section aria-label="Recent lives" className="space-y-1">
      <h3 className="text-xs font-medium">Around town</h3>
      <ol className="space-y-1">
        {status.moments.slice(0, 8).map((moment, index) => (
          <li key={`${moment.day}-${moment.hour}-${index}`} className="flex gap-2 text-xs">
            <span className="shrink-0 font-mono text-muted-foreground tabular-nums">
              {String(moment.hour).padStart(2, "0")}:00
            </span>
            <span>
              {moment.name}: {moment.text.toLowerCase()}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Chronicle({ status }: { status: PolisStatus }) {
  const entries = status.snapshot.chronicle.slice(0, 6);

  if (entries.length === 0) {
    return null;
  }

  return (
    <section aria-label="Town news" className="space-y-1">
      <h3 className="text-xs font-medium">Town news</h3>
      <ol className="space-y-1">
        {entries.map((entry, index) => (
          <li key={`${entry.day}-${index}`} className="flex gap-2 text-xs">
            <span className="shrink-0 font-mono text-muted-foreground tabular-nums">
              Y{Math.floor(entry.day / YEAR_DAYS) + 1}
            </span>
            <span>{entry.text}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
