import { Button, Textarea } from "@ngriffin_uk/polychat-component-ui";
import { DOCUMENT_MAX_BODY, type DocumentEditProposal } from "@ngriffin_uk/polychat-schemas";

interface DocumentEditReviewProps {
  proposal: DocumentEditProposal;
  stale: boolean;
  disabled: boolean;
  isApplying: boolean;
  onChange: (replacement: string) => void;
  onApply: () => void;
  onDismiss: () => void;
}

export function DocumentEditReview({
  proposal,
  stale,
  disabled,
  isApplying,
  onChange,
  onApply,
  onDismiss,
}: DocumentEditReviewProps) {
  return (
    <section
      aria-label="Review proposed edit"
      className="space-y-3 rounded-md border border-border p-3"
    >
      <h3 className="text-sm font-medium">Review selection edit</h3>
      <p className="text-xs text-muted-foreground">
        From revision {proposal.sourceRevision}. Applying creates a new revision.
      </p>
      <blockquote className="max-h-32 overflow-auto border-l-2 border-border pl-2 text-xs whitespace-pre-wrap text-muted-foreground">
        {proposal.anchor.quote}
      </blockquote>
      <Textarea
        aria-label="Proposed replacement"
        value={proposal.replacement}
        maxLength={DOCUMENT_MAX_BODY}
        disabled={isApplying}
        onChange={(event) => onChange(event.currentTarget.value)}
        rows={6}
      />
      {stale ? (
        <output className="block text-xs text-failure">
          The document has changed. Select the passage again to propose a fresh edit.
        </output>
      ) : null}
      <div className="flex gap-2">
        <Button size="xs" disabled={disabled || stale} isLoading={isApplying} onClick={onApply}>
          Apply edit
        </Button>
        <Button size="xs" variant="outline" disabled={isApplying} onClick={onDismiss}>
          Discard
        </Button>
      </div>
    </section>
  );
}
