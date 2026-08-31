import { Badge, Card } from "@ngriffin_uk/polychat-component-ui";
import type { LeanProofResult } from "@ngriffin_uk/polychat-schemas";
import { AlertTriangle, Braces, Check, FileDiff, Gauge, ShieldCheck, X } from "lucide-react";

import { LeanProofOutcomeBadge } from "./LeanProofOutcomeBadge";
import { getLeanProofOutcomePresentation } from "./presentation";

export function LeanProofResultView({ result }: { result: LeanProofResult }) {
  const outcome = getLeanProofOutcomePresentation(result.outcome);

  return (
    <div className="space-y-5" data-lean-proof-outcome={result.outcome}>
      <section className={`rounded-xl border p-5 ${outcomeClassName(result.outcome)}`}>
        <div className="flex flex-wrap items-center gap-3">
          <LeanProofOutcomeBadge outcome={result.outcome} />
          <p className="text-sm text-zinc-700 dark:text-zinc-300">{outcome.description}</p>
        </div>
        <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-zinc-950 dark:text-zinc-100">
          {result.summary}
        </p>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric
          icon={<Gauge size={15} />}
          label="Model usage"
          value={`${result.usage.totalTokens.toLocaleString()} tokens`}
          detail={`${result.usage.iterations} iteration${result.usage.iterations === 1 ? "" : "s"}`}
        />
        <Metric
          icon={<Braces size={15} />}
          label="Declarations"
          value={String(result.declarations.length)}
          detail={result.outcome === "kernel_checked" ? "Kernel evidence recorded" : "Requested"}
        />
        <Metric
          icon={<FileDiff size={15} />}
          label="Files changed"
          value={String(result.changedPaths.length)}
          detail={`${result.targetPaths.length} target${result.targetPaths.length === 1 ? "" : "s"}`}
        />
      </div>

      <section className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5 shadow-none">
          <h3 className="text-sm font-semibold">Evidence</h3>
          {result.evidence.length ? (
            <ul className="mt-3 space-y-3">
              {result.evidence.map((item) => (
                <li
                  key={`${item.kind}:${item.declaration ?? item.path ?? item.summary}`}
                  className="flex gap-3"
                >
                  {item.status === "passed" ? (
                    <Check size={15} className="mt-0.5 shrink-0 text-emerald-600" />
                  ) : item.status === "failed" ? (
                    <X size={15} className="mt-0.5 shrink-0 text-red-600" />
                  ) : (
                    <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-600" />
                  )}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{item.kind.replace("_", " ")}</Badge>
                      {item.declaration ? (
                        <code className="break-all text-xs text-zinc-500">{item.declaration}</code>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{item.summary}</p>
                    {item.path ? (
                      <p className="mt-1 font-mono text-xs text-zinc-500">{item.path}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-zinc-500">No verification evidence was recorded.</p>
          )}
        </Card>

        <Card className="p-5 shadow-none">
          <h3 className="text-sm font-semibold">Diagnostics</h3>
          {result.diagnostics.length ? (
            <ul className="mt-3 space-y-3">
              {result.diagnostics.map((diagnostic) => (
                <li
                  key={`${diagnostic.path}:${diagnostic.line}:${diagnostic.column}:${diagnostic.code}:${diagnostic.message}`}
                  className="text-sm"
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle
                      size={14}
                      className={`mt-0.5 shrink-0 ${diagnosticClassName(diagnostic.severity)}`}
                    />
                    <div className="min-w-0">
                      <p className="text-zinc-800 dark:text-zinc-200">{diagnostic.message}</p>
                      {diagnostic.path ? (
                        <p className="mt-1 break-all font-mono text-xs text-zinc-500">
                          {diagnostic.path}
                          {diagnostic.line ? `:${diagnostic.line}` : ""}
                          {diagnostic.column ? `:${diagnostic.column}` : ""}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-3 flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
              <ShieldCheck size={15} /> No compiler diagnostics
            </div>
          )}
        </Card>
      </section>

      {result.changedPaths.length ? (
        <section>
          <h3 className="text-sm font-semibold">Changed files</h3>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {result.changedPaths.map((path) => (
              <li
                key={path}
                className="rounded-md bg-zinc-100 px-3 py-2 font-mono text-xs dark:bg-zinc-900"
              >
                {path}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function outcomeClassName(outcome: LeanProofResult["outcome"]): string {
  switch (outcome) {
    case "kernel_checked":
      return "border-emerald-300 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/20";
    case "compiled":
      return "border-blue-300 bg-blue-50/60 dark:border-blue-900 dark:bg-blue-950/20";
    case "incomplete":
      return "border-amber-300 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20";
    case "failed":
      return "border-red-300 bg-red-50/60 dark:border-red-900 dark:bg-red-950/20";
  }

  return "border-zinc-300 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950";
}

function diagnosticClassName(severity: LeanProofResult["diagnostics"][number]["severity"]): string {
  if (severity === "error") {
    return "text-red-600";
  }

  if (severity === "warning") {
    return "text-amber-600";
  }

  return "text-blue-600";
}

function Metric({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card className="gap-1 p-4 shadow-none">
      <p className="flex items-center gap-2 text-xs text-zinc-500">
        {icon} {label}
      </p>
      <p className="mt-1 font-mono text-lg font-semibold text-zinc-950 dark:text-white">{value}</p>
      <p className="text-[11px] text-zinc-500">{detail}</p>
    </Card>
  );
}
