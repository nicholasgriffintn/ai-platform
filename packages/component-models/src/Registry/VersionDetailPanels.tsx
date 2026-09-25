import { Badge, Button } from "@ngriffin_uk/polychat-component-ui";
import type { EvalRun, RouteSuggestion, VersionDetail } from "@ngriffin_uk/polychat-schemas";
import { formatBytes, formatParameterCount } from "@ngriffin_uk/polychat-utility-core";

import { RegistryPanel } from "./RegistryPanel";

export function VersionAttributes({ detail }: { detail: VersionDetail }) {
  const { attributes } = detail.version;
  const rows: Array<[string, string]> = [
    ["Source", `${detail.asset.source} · ${detail.asset.sourceRef}`],
    ["Revision", detail.version.revision],
    ["Licence", attributes.licence ?? "unknown"],
    [
      "Parameters",
      attributes.parameterCount ? formatParameterCount(attributes.parameterCount) : "unknown",
    ],
    ["Formats", attributes.formats.join(", ") || "none"],
    ["Size", formatBytes(attributes.totalBytes, 1)],
    ["Remote code", attributes.remoteCode ? "Required" : "Not required"],
  ];

  if (attributes.trainingComputeFlops !== null) {
    rows.push([
      "Modification compute",
      `${attributes.trainingComputeFlops.toExponential(1)} FLOPs`,
    ]);
  }

  return (
    <RegistryPanel>
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-mono text-xs break-all">{value}</dd>
          </div>
        ))}
      </dl>
    </RegistryPanel>
  );
}

function runVariant(status: EvalRun["status"]) {
  if (status === "completed") {
    return "success";
  }

  return status === "failed" ? "destructive" : "info";
}

export function VersionEvalRunList({ runs }: { runs: readonly EvalRun[] }) {
  if (runs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No runs yet. Register a route, then run a suite from the Evaluate tab.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border rounded-lg border border-border text-sm">
      {runs.map((run) => (
        <li key={run.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
          <Badge variant="outline">{run.trigger}</Badge>
          <Badge variant={runVariant(run.status)}>{run.status}</Badge>
          {Object.entries(run.scores).map(([metric, score]) => (
            <span key={metric} className="tabular-nums">
              {metric} {(score.mean * 100).toFixed(1)}% ({(score.low * 100).toFixed(1)}–
              {(score.high * 100).toFixed(1)})
            </span>
          ))}
          <span className="ml-auto text-xs text-muted-foreground">
            {new Date(run.createdAt).toLocaleString("en-GB")}
          </span>
        </li>
      ))}
    </ul>
  );
}

export interface RouteSuggestionListProps {
  suggestions: readonly RouteSuggestion[];
  isRegistering: boolean;
  onRegister: (suggestion: RouteSuggestion) => void;
}

export function RouteSuggestionList({
  suggestions,
  isRegistering,
  onRegister,
}: RouteSuggestionListProps) {
  if (suggestions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No catalogue provider serves this model.</p>
    );
  }

  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {suggestions.map((suggestion) => (
        <li
          key={`${suggestion.provider}:${suggestion.providerModelId}`}
          className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm"
        >
          <span className="font-medium">{suggestion.name}</span>
          <Badge variant="outline">{suggestion.provider}</Badge>
          <Badge variant="outline">{suggestion.region}</Badge>
          <Button
            size="sm"
            variant="secondary"
            className="ml-auto"
            disabled={suggestion.registered || isRegistering}
            onClick={() => onRegister(suggestion)}
          >
            {suggestion.registered ? "Registered" : "Register route"}
          </Button>
        </li>
      ))}
    </ul>
  );
}
