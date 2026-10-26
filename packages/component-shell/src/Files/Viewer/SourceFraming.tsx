import { Button } from "@ngriffin_uk/polychat-component-ui";
import { useEnrichSource } from "@ngriffin_uk/polychat-library-react";
import { readSourceFraming, type Source } from "@ngriffin_uk/polychat-schemas";
import { formatRelativeTime, getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { Scale } from "lucide-react";

import { FramingDetail } from "../../Knowledge/FramingDetail.js";

export function SourceFraming({ source }: { source: Source }) {
  const enrich = useEnrichSource(source.id);
  const framing = readSourceFraming(source.metadata);

  return (
    <div className="flex flex-col gap-4 text-sm text-muted-foreground">
      {framing ? (
        <>
          <FramingDetail framing={framing} />
          <p className="text-xs">Read {formatRelativeTime(framing.generatedAt)}.</p>
        </>
      ) : (
        <p>
          Slant, tone, sourcing, loaded wording and what the piece leaves out, judged only from the
          text itself.
        </p>
      )}
      <div>
        <Button
          variant="outline"
          size="sm"
          icon={<Scale size={14} />}
          isLoading={enrich.isPending}
          disabled={!source.content?.trim()}
          onClick={() => enrich.mutate({ enricher: "framing" })}
        >
          {framing ? "Check again" : "Check the framing"}
        </Button>
      </div>
      {enrich.error ? (
        <p
          role="alert"
          className="rounded-md border border-failure/30 bg-failure/10 px-2.5 py-1.5 text-xs leading-relaxed [overflow-wrap:anywhere] text-foreground"
        >
          {getErrorMessage(enrich.error, "Poly couldn't read the framing")}
        </p>
      ) : null}
    </div>
  );
}
