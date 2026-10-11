import { Badge } from "@ngriffin_uk/polychat-component-ui";
import {
  councilMembers,
  councilReviewSchema,
  type CouncilMemberDefinition,
  type CouncilReview,
  type CouncilReviewVerdict,
} from "@ngriffin_uk/polychat-schemas";
import { formatDate } from "@ngriffin_uk/polychat-utility-core";

const verdictPresentation: Record<
  CouncilReviewVerdict,
  { label: string; variant: "success" | "warning" | "destructive" }
> = {
  ship: { label: "Ship", variant: "success" },
  revise: { label: "Revise", variant: "warning" },
  hold: { label: "Hold", variant: "destructive" },
};

const memberNames = new Map(
  (councilMembers as readonly CouncilMemberDefinition[]).map((member) => [member.id, member.name]),
);

export function CouncilReviewCard({ review }: { review: CouncilReview }) {
  const presentation = verdictPresentation[review.verdict];

  return (
    <section aria-label="Council review" className="space-y-3 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={presentation.variant}>{presentation.label}</Badge>
        <span className="text-xs text-muted-foreground">
          Council review of revision {review.outputRevision} · {formatDate(review.createdAt)}
        </span>
      </div>
      <p className="text-sm whitespace-pre-line text-foreground">{review.brief}</p>
      {review.dissent.length > 0 ? (
        <div>
          <p className="polychat-eyebrow text-muted-foreground">Still disputed</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-foreground">
            {review.dissent.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <details>
        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
          What each seat said
        </summary>
        <ul className="mt-2 space-y-3">
          {review.seats.map((seat) => (
            <li key={seat.memberId} className="space-y-1 text-sm">
              <p className="font-medium text-foreground">
                {memberNames.get(seat.memberId) ?? seat.memberId} ·{" "}
                {verdictPresentation[seat.vote].label}
              </p>
              <p className="whitespace-pre-line text-muted-foreground">{seat.critique}</p>
              {seat.rebuttal ? (
                <p className="whitespace-pre-line text-muted-foreground">{seat.rebuttal}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

export function CouncilReviewView({ data }: { data: unknown }) {
  const review =
    data && typeof data === "object" && "review" in data
      ? councilReviewSchema.safeParse(data.review)
      : null;

  if (!review?.success) {
    return <p className="text-sm text-muted-foreground">The council review could not be shown.</p>;
  }

  return <CouncilReviewCard review={review.data} />;
}
