import { Button, cn } from "@ngriffin_uk/polychat-component-ui";
import { useEnrichSource } from "@ngriffin_uk/polychat-library-react";
import {
  READING_FORMS,
  readKnowledgeEnrichment,
  readSourceReadAs,
  readSourceReading,
  type ReadingFormId,
  type Source,
} from "@ngriffin_uk/polychat-schemas";
import { formatRelativeTime, getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { ScanText } from "lucide-react";
import { useState } from "react";

import { HighlightedText } from "./HighlightedText.js";
import { readSpans } from "./reading.js";
import { ReadingRows } from "./ReadingRows.js";

const FORMS = Object.values(READING_FORMS);

export function SourceReadingPanel({ source, canRead }: { source: Source; canRead: boolean }) {
  const enrich = useEnrichSource(source.id);
  const reading = readSourceReading(source.metadata);
  const state = readKnowledgeEnrichment(source.metadata, "reading");
  const [chosen, setChosen] = useState<ReadingFormId>(
    readSourceReadAs(source.metadata) ?? reading?.form ?? "receipt",
  );
  const form = READING_FORMS[chosen];
  const shown = reading?.form === chosen ? reading : null;
  const text = shown ? (shown.text ?? source.content) : null;
  const failure = enrich.error
    ? getErrorMessage(enrich.error, "Poly couldn't read this file")
    : state?.status === "failed" && !shown
      ? (state.error ?? "Poly couldn't read this file")
      : null;

  return (
    <div className="flex flex-col gap-4 text-sm">
      <fieldset className="flex flex-wrap gap-2">
        <legend className="mb-2 text-xs text-muted-foreground">Read it as</legend>
        {FORMS.map((candidate) => (
          <button
            key={candidate.id}
            type="button"
            aria-pressed={candidate.id === chosen}
            disabled={!canRead}
            onClick={() => setChosen(candidate.id)}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60",
              candidate.id === chosen
                ? "border-accent-sky bg-accent-sky/10 text-foreground"
                : "border-border text-muted-foreground hover:border-accent-sky/60",
            )}
          >
            {candidate.label}
          </button>
        ))}
      </fieldset>
      <p className="text-muted-foreground">{form.hint}</p>
      {canRead ? (
        <div>
          <Button
            variant="outline"
            size="sm"
            icon={<ScanText size={14} />}
            isLoading={enrich.isPending}
            onClick={() => enrich.mutate({ enricher: "reading", readAs: chosen })}
          >
            {shown ? "Read it again" : `Read as a ${form.singular}`}
          </Button>
        </div>
      ) : null}
      {failure ? (
        <p
          role="alert"
          className="rounded-md border border-failure/30 bg-failure/10 px-2.5 py-1.5 text-xs leading-relaxed [overflow-wrap:anywhere] text-foreground"
        >
          {failure}
        </p>
      ) : null}
      {shown ? (
        <>
          <ReadingRows form={form} reading={shown} />
          <p className="text-xs text-muted-foreground">
            Read {formatRelativeTime(shown.generatedAt)}. Figures under the usual confidence are
            flagged rather than guessed at.
          </p>
          {text ? <HighlightedText text={text} spans={readSpans(shown.answers)} /> : null}
        </>
      ) : reading ? (
        <p className="text-muted-foreground">
          Read as {READING_FORMS[reading.form].label.toLowerCase()} last time.
        </p>
      ) : null}
    </div>
  );
}
