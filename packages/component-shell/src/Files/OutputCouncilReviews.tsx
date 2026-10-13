import { CouncilReviewCard } from "@ngriffin_uk/polychat-component-content";
import { Button } from "@ngriffin_uk/polychat-component-ui";
import { useOutputReviews, useRequestOutputReview } from "@ngriffin_uk/polychat-library-react";
import type { Output } from "@ngriffin_uk/polychat-schemas";
import { Scale } from "lucide-react";

export function OutputCouncilReviews({ output }: { output: Output }) {
  const { data: reviews, error } = useOutputReviews(output.id);
  const request = useRequestOutputReview();
  const latest = reviews?.[0];
  const isCurrent = latest?.outputRevision === output.revision;

  return (
    <section aria-label="Council review" className="space-y-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium">
            <Scale size={16} aria-hidden /> Council review
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {latest
              ? isCurrent
                ? "Reviewed at this revision."
                : `Last reviewed at revision ${latest.outputRevision}. It has changed since.`
              : "Four seats read it, argue it out and say whether it is ready to go."}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          isLoading={request.isPending}
          disabled={output.status !== "ready"}
          onClick={() => request.mutate(output.id)}
        >
          {latest ? "Review again" : "Ask the council"}
        </Button>
      </div>
      {request.error || error ? (
        <p role="alert" className="text-sm text-failure">
          {(request.error ?? error)?.message}
        </p>
      ) : null}
      {latest ? <CouncilReviewCard review={latest} /> : null}
    </section>
  );
}
