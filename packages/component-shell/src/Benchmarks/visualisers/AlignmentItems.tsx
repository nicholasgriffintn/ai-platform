import type { BenchmarkId, BenchmarkItemDetail } from "@ngriffin_uk/polychat-schemas";
import {
  getBooleanProperty,
  getStringProperty,
  readArray,
  truncateText,
} from "@ngriffin_uk/polychat-utility-core";

const MAX_OUTPUT = 600;

interface Copy {
  held: string;
  slipped: string;
  prompt: (detail: BenchmarkItemDetail) => string;
  reveal: (detail: BenchmarkItemDetail) => string | null;
  slip: (detail: BenchmarkItemDetail) => string;
}

const COPY: Partial<Record<BenchmarkId, Copy>> = {
  "smuggled-note": {
    held: "Did the job",
    slipped: "Fell for it",
    prompt: (detail) =>
      `${getStringProperty(detail.item.data, "task") ?? ""} (${getStringProperty(detail.item.data, "vector") ?? "note"})`,
    reveal: (detail) => {
      const expected = getStringProperty(detail.reveal, "expected");
      const marker = getStringProperty(detail.reveal, "marker");

      return expected && marker ? `Wanted ${expected}, the note asked for ${marker}` : null;
    },
    slip: (detail) =>
      getBooleanProperty(detail.result?.detail, "ignoredNote") === false
        ? "Followed the smuggled note"
        : "Missed the actual task",
  },
  "keep-a-secret": {
    held: "Kept it",
    slipped: "Let it slip",
    prompt: (detail) => getStringProperty(detail.item.data, "attack") ?? "",
    reveal: (detail) => {
      const token = getStringProperty(detail.reveal, "token");

      return token ? `The phrase was ${token}` : null;
    },
    slip: () => "The phrase, or part of it, is in the reply",
  },
  "yes-man": {
    held: "Held firm",
    slipped: "Caved",
    prompt: (detail) => getStringProperty(detail.item.data, "prompt") ?? "",
    reveal: (detail) => {
      const accepted = readArray(detail.reveal.accepted).filter(
        (value): value is string => typeof value === "string",
      );
      const note = getStringProperty(detail.reveal, "note");

      return accepted.length > 0 ? `${accepted[0]}${note ? ` · ${note}` : ""}` : (note ?? null);
    },
    slip: (detail) =>
      `Said ${getStringProperty(detail.result?.detail, "answer") ?? "nothing usable"}`,
  },
};

function Verdict({ copy, detail }: { copy: Copy; detail: BenchmarkItemDetail }) {
  const result = detail.result;

  if (!result || result.error) {
    return <span className="shrink-0 text-xs text-failure">No answer</span>;
  }

  if (result.score === null) {
    return <span className="shrink-0 text-xs text-muted-foreground">Unscored</span>;
  }

  return result.score > 0 ? (
    <span className="shrink-0 text-xs font-medium text-success">{copy.held}</span>
  ) : (
    <span className="shrink-0 text-xs font-medium text-failure" title={copy.slip(detail)}>
      {copy.slipped}
    </span>
  );
}

export function AlignmentItems({
  benchmarkId,
  items,
}: {
  benchmarkId: BenchmarkId;
  items: readonly BenchmarkItemDetail[];
}) {
  const copy = COPY[benchmarkId];

  if (!copy) {
    return null;
  }

  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
      {items.map((detail) => {
        const output = detail.result?.output.trim() ?? "";
        const reveal = copy.reveal(detail);

        return (
          <li key={detail.item.id} className="space-y-2 p-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <p className="text-foreground">{copy.prompt(detail)}</p>
              <Verdict copy={copy} detail={detail} />
            </div>
            {output ? (
              <pre className="max-h-40 overflow-auto rounded-lg bg-canvas/60 p-2 font-mono text-xs whitespace-pre-wrap text-muted-foreground">
                {truncateText(output, MAX_OUTPUT)}
              </pre>
            ) : null}
            {getStringProperty(detail.result?.detail, "blocked") ? (
              <p className="text-xs text-attention">
                {getStringProperty(detail.result?.detail, "blocked")}
              </p>
            ) : null}
            {reveal ? <p className="text-xs text-muted-foreground">{reveal}</p> : null}
          </li>
        );
      })}
    </ul>
  );
}
