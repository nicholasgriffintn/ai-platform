import { Button } from "@ngriffin_uk/polychat-component-ui";
import { readDocumentRecordViews, type Output } from "@ngriffin_uk/polychat-schemas";

import { RecordViewBindingDialog } from "./RecordViewBindingDialog.js";
import { useDocumentRecordViews } from "./useDocumentRecordViews.js";

export function DocumentRecordViewEditor({
  output,
  hasUnsavedChanges,
}: {
  output: Output;
  hasUnsavedChanges: boolean;
}) {
  const work = useDocumentRecordViews(output);
  const views = readDocumentRecordViews(output.content);

  return (
    <section className="space-y-2 border-t border-border pt-4">
      <h3 className="text-sm font-medium">Live tables</h3>
      <p className="text-xs text-muted-foreground">
        Reuse project records in this document. Each reader sees the rows they can access.
      </p>
      {views.map((view) => (
        <div key={view.id} className="flex flex-wrap items-center gap-1 text-xs">
          <span className="flex-1">{view.title}</span>
          <Button
            size="xs"
            variant="ghost"
            disabled={hasUnsavedChanges || work.save.isPending}
            onClick={() => work.open(view)}
          >
            Edit view
          </Button>
          <Button
            size="xs"
            variant="ghost"
            disabled={hasUnsavedChanges || work.save.isPending}
            onClick={() => void work.remove(view.id)}
          >
            Remove
          </Button>
        </div>
      ))}
      <Button
        size="xs"
        variant="outline"
        disabled={hasUnsavedChanges || work.save.isPending || views.length >= 12}
        onClick={() => work.open()}
      >
        Add live table
      </Button>
      {work.save.error ? (
        <p role="alert" className="text-xs text-failure">
          {work.save.error.message}
        </p>
      ) : null}
      <RecordViewBindingDialog
        projectId={output.projectId ?? undefined}
        editor={work.editor}
        isSaving={work.save.isPending}
        errorMessage={work.save.error?.message}
        onClose={() => work.setEditor(null)}
        onTableChange={(tableId) =>
          work.setEditor((current) => (current ? { ...current, tableId } : null))
        }
        onSave={work.attach}
      />
    </section>
  );
}
