import { Badge, cn } from "@ngriffin_uk/polychat-component-ui";
import {
  decisionChoiceSelection,
  decisionNoulIsTrue,
  formatDecisionEntry,
  type SiteDecisionTraceEntry,
  type SiteDecisionTraceQuestion,
} from "@ngriffin_uk/polychat-schemas";
import { humaniseIdentifier } from "@ngriffin_uk/polychat-utility-core";
import { ChevronDown } from "lucide-react";

const STAGE_LABELS: Record<SiteDecisionTraceEntry["stage"], string> = {
  plan: "Brief plan",
  refinement: "Change routing",
  quality: "Quality review",
};

function sourceLabel(entry: SiteDecisionTraceEntry) {
  if (entry.source === "heuristic") {
    return "Heuristic";
  }

  if (entry.source === "unavailable") {
    return "Unavailable";
  }

  return entry.model?.toLowerCase().includes("jev") ||
    entry.provider?.toLowerCase().includes("typesafe")
    ? "Jev"
    : "Decision model";
}

function answerLabel({ answer }: SiteDecisionTraceQuestion) {
  if (!answer) {
    return "No answer";
  }

  if (answer.type === "choice") {
    const choice = decisionChoiceSelection(answer);
    const probability = answer.probabilities[choice] ?? answer.confidence;

    return `${humaniseIdentifier(choice)} · ${Math.round(probability * 100)}%`;
  }

  if (answer.type === "score") {
    const rounded = Math.round(answer.score);
    const probability = answer.probabilities[String(rounded)] ?? answer.confidence;

    return `Score ${rounded} · ${Math.round(probability * 100)}%`;
  }

  const isTrue = decisionNoulIsTrue(answer);
  const probability = isTrue ? answer.noul : 1 - answer.noul;

  return `${isTrue ? "Yes" : "No"} · ${Math.round(probability * 100)}%`;
}

function probabilityRows(question: SiteDecisionTraceQuestion): Array<{
  id: string;
  label: string;
  probability: number;
  selected: boolean;
}> {
  const answer = question.answer;

  if (!answer) {
    return [];
  }

  if (answer.type === "noul") {
    const selected = decisionNoulIsTrue(answer) ? "yes" : "no";

    return [
      { id: "yes", label: "Yes", probability: answer.noul, selected: selected === "yes" },
      { id: "no", label: "No", probability: 1 - answer.noul, selected: selected === "no" },
    ].sort((left, right) => right.probability - left.probability);
  }

  const selected =
    answer.type === "choice" ? decisionChoiceSelection(answer) : String(Math.round(answer.score));

  return Object.entries(answer.probabilities)
    .map(([id, probability]) => ({
      id,
      label:
        answer.type === "score"
          ? formatDecisionEntry(answer.legend[id] ?? id)
          : formatDecisionEntry(
              question.question.type === "choice" ? (question.question.criteria[id] ?? id) : id,
            ),
      probability,
      selected: id === selected,
    }))
    .sort((left, right) => right.probability - left.probability);
}

function QuestionResult({ result }: { result: SiteDecisionTraceQuestion }) {
  const rows = probabilityRows(result);
  const label = answerLabel(result);

  return (
    <div className="flex flex-col gap-2 border-t border-border/70 pt-3 first:border-t-0 first:pt-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
            {result.id.replaceAll("_", " ")}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-foreground">
            {formatDecisionEntry(result.question.instructions)}
          </p>
        </div>
        <Badge variant="secondary" className="max-w-40 shrink" title={label}>
          <span className="min-w-0 truncate">{label}</span>
        </Badge>
      </div>
      {rows.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {rows.map((row) => (
            <div
              key={row.id}
              data-selected={row.selected}
              className="grid grid-cols-[minmax(0,1fr)_3rem] items-center gap-2"
            >
              <div className="relative h-5 overflow-hidden rounded-sm bg-accent">
                <span
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-sm",
                    row.selected ? "bg-foreground/85" : "bg-foreground/15",
                  )}
                  style={{ width: `${Math.max(1, row.probability * 100)}%` }}
                />
                <span
                  className={cn(
                    "relative z-10 block truncate px-1.5 font-mono text-[10px] leading-5",
                    row.selected && row.probability >= 0.45
                      ? "text-background"
                      : "text-muted-foreground",
                  )}
                >
                  {row.label}
                </span>
              </div>
              <span className="text-right font-mono text-[10px] text-muted-foreground tabular-nums">
                {(row.probability * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function SiteDecisionCard({ entry }: { entry: SiteDecisionTraceEntry }) {
  const hasDetails = entry.questions.some((question) => question.answer);

  return (
    <details className="group rounded-lg border border-border bg-background shadow-xs">
      <summary className="flex cursor-pointer list-none items-start gap-2.5 px-3 py-3 [&::-webkit-details-marker]:hidden">
        <span
          className={cn(
            "mt-0.5 h-8 w-1 shrink-0 rounded-full",
            entry.source === "decision" ? "bg-primary" : "bg-muted-foreground/35",
          )}
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
              {STAGE_LABELS[entry.stage]}
            </span>
            <Badge variant={entry.source === "decision" ? "secondary" : "outline"}>
              {sourceLabel(entry)}
            </Badge>
          </span>
          <span className="mt-1 block text-sm font-medium text-foreground">{entry.summary}</span>
          <span className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] leading-relaxed text-muted-foreground">
            {entry.effects.map((effect) => (
              <span key={effect}>{effect}</span>
            ))}
          </span>
        </span>
        {hasDetails && (
          <ChevronDown
            size={14}
            className="mt-1 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          />
        )}
      </summary>
      {hasDetails && (
        <div className="flex flex-col gap-3 border-t border-border bg-surface/60 px-3 py-3">
          {entry.questions.map((question) => (
            <QuestionResult key={question.id} result={question} />
          ))}
          {(entry.model || entry.durationMs !== undefined) && (
            <div className="flex flex-wrap gap-x-2 border-t border-border/70 pt-2 font-mono text-[10px] text-muted-foreground">
              {entry.model && <span>{entry.model}</span>}
              {entry.durationMs !== undefined && <span>{entry.durationMs}ms</span>}
            </div>
          )}
        </div>
      )}
    </details>
  );
}
