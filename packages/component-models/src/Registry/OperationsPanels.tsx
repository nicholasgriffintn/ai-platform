import { Badge } from "@ngriffin_uk/polychat-component-ui";
import type { ModelBuild, RouteHealth } from "@ngriffin_uk/polychat-schemas";
import { formatCompactCount } from "@ngriffin_uk/polychat-utility-core";
import { useId } from "react";

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-[11px] tracking-wider text-muted-foreground uppercase">{label}</div>
      <div className="text-xl font-semibold tabular-nums">{value}</div>
      {detail && <div className="text-xs text-muted-foreground">{detail}</div>}
    </div>
  );
}

function ReplaySparkline({ health }: { health: RouteHealth }) {
  const titleId = useId();
  const points = health.replayTrend;
  const width = 300;
  const height = 56;
  const scores = [...points.map((point) => point.score), health.baseline?.score ?? 0];
  const min = Math.min(...scores) - 0.02;
  const max = Math.max(...scores) + 0.02;
  const y = (score: number) => height - ((score - min) / Math.max(max - min, 0.01)) * height;
  const x = (index: number) => (points.length <= 1 ? width : (index / (points.length - 1)) * width);
  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${x(index)} ${y(point.score)}`)
    .join(" ");
  const last = points[points.length - 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="h-14 w-full"
      aria-labelledby={titleId}
    >
      <title id={titleId}>{`Replay score trend over ${points.length} runs`}</title>
      {health.baseline && (
        <line
          x1="0"
          x2={width}
          y1={y(health.baseline.score)}
          y2={y(health.baseline.score)}
          stroke="currentColor"
          strokeDasharray="3 3"
          className="text-muted-foreground"
        />
      )}
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-active-work"
      />
      {last && (
        <circle cx={x(points.length - 1)} cy={y(last.score)} r="3" className="fill-active-work" />
      )}
    </svg>
  );
}

export function RouteHealthPanel({ health }: { health: RouteHealth }) {
  const latest = health.replayTrend[health.replayTrend.length - 1];
  const drift = latest && health.baseline ? (latest.score - health.baseline.score) * 100 : null;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Requests" value={formatCompactCount(health.requests)} detail="last 14 days" />
        <Stat
          label="p95 latency"
          value={health.latencyP95Ms === null ? "—" : `${(health.latencyP95Ms / 1000).toFixed(1)}s`}
          detail="from the latest eval"
        />
        <Stat
          label="Spend"
          value={`$${health.costUsd.toFixed(2)}`}
          detail={`${formatCompactCount(health.inputTokens)} in · ${formatCompactCount(health.outputTokens)} out`}
        />
        <Stat
          label="Replay"
          value={latest ? `${(latest.score * 100).toFixed(1)}%` : "—"}
          detail={
            drift === null
              ? "no baseline yet"
              : `${drift >= 0 ? "+" : ""}${drift.toFixed(1)} pts vs approval`
          }
        />
      </div>
      {health.replayTrend.length > 0 && (
        <div className="rounded-lg border border-border p-3">
          <div className="mb-1 text-xs text-muted-foreground">
            Nightly replay of {health.baseline?.metric ?? "the primary metric"} against the approval
            baseline (dashed)
          </div>
          <ReplaySparkline health={health} />
        </div>
      )}
    </div>
  );
}

export function ComputeMeter({ compute }: { compute: NonNullable<ModelBuild["compute"]> }) {
  const logRatio = Math.log10(Math.max(compute.ratio, 1e-12));
  const position = Math.min(100, Math.max(2, ((logRatio + 12) / 12) * 100));

  return (
    <div className="space-y-1 text-xs text-muted-foreground">
      <div>
        ≈ {compute.modificationFlops.toExponential(1)} FLOPs against a threshold of ≈{" "}
        {compute.thresholdFlops.toExponential(1)} (
        {compute.basis === "fallback" ? "Commission fallback" : "reported base compute"}, log scale)
      </div>
      <div className="relative h-2 rounded bg-muted">
        <div
          className={`absolute inset-y-0 left-0 rounded ${compute.exceedsThreshold ? "bg-failure" : "bg-success"}`}
          style={{ width: `${position}%` }}
        />
      </div>
      <div>
        {compute.exceedsThreshold
          ? "Above one third of base compute: the workspace becomes a GPAI provider for this model."
          : "Well below one third of base compute, so the workspace remains a deployer."}
      </div>
    </div>
  );
}

export function BuildList({
  builds,
  names,
  onOpenVersion,
}: {
  builds: readonly ModelBuild[];
  names: Record<string, string>;
  onOpenVersion: (versionId: string) => void;
}) {
  if (builds.length === 0) {
    return <p className="text-sm text-muted-foreground">No fine-tunes yet.</p>;
  }

  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {builds.map((build) => (
        <li key={build.id} className="space-y-2 px-3 py-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <button
              type="button"
              className="font-medium text-foreground hover:underline"
              onClick={() => onOpenVersion(build.versionId)}
            >
              {build.jobName}
            </button>
            <Badge
              variant={
                build.status === "completed"
                  ? "success"
                  : build.status === "failed"
                    ? "destructive"
                    : "info"
              }
            >
              {build.status}
            </Badge>
            <Badge variant="outline">{build.recipe}</Badge>
            <span className="text-xs text-muted-foreground">
              from {names[build.baseVersionId] ?? "base"} on{" "}
              {names[build.datasetVersionId] ?? "dataset"}
            </span>
          </div>
          {build.failureReason && <p className="text-sm text-failure">{build.failureReason}</p>}
          {build.compute && <ComputeMeter compute={build.compute} />}
        </li>
      ))}
    </ul>
  );
}
