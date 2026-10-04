import { Button } from "@ngriffin_uk/polychat-component-ui";
import { getIntegrationToolChanges, type IntegrationSnapshot } from "@ngriffin_uk/polychat-schemas";

import { IntegrationToolReview } from "./IntegrationToolReview.js";

export function IntegrationReviewPanel({
  current,
  reviewed,
  isSaving,
  onSave,
  onCancel,
}: {
  current: IntegrationSnapshot;
  reviewed: IntegrationSnapshot;
  isSaving: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  const changes = getIntegrationToolChanges(current, reviewed);

  return (
    <section
      className="space-y-3 rounded-lg border border-border p-3"
      aria-label="Review service changes"
    >
      <h3 className="text-sm font-medium">Review service changes</h3>
      <p className="text-xs text-muted-foreground">
        Projects keep their reviewed actions. New actions require an explicit project grant. Changed
        actions require review before they can run.
      </p>
      <ul className="space-y-1 text-sm">
        <li>Added: {changes.added.join(", ") || "None"}</li>
        <li>Removed: {changes.removed.join(", ") || "None"}</li>
        <li>Changed parameters, output or behaviour: {changes.changed.join(", ") || "None"}</li>
      </ul>
      {reviewed.tools
        .filter((tool) => changes.added.includes(tool.name) || changes.changed.includes(tool.name))
        .map((tool) => (
          <IntegrationToolReview
            key={tool.name}
            previous={current.tools.find((previous) => previous.name === tool.name)}
            reviewed={tool}
          />
        ))}
      <div className="flex gap-2">
        <Button type="button" disabled={isSaving} onClick={onSave}>
          {isSaving ? "Saving…" : "Save reviewed definition"}
        </Button>
        <Button type="button" variant="outline" disabled={isSaving} onClick={onCancel}>
          Cancel review
        </Button>
      </div>
    </section>
  );
}
