import { Button } from "@ngriffin_uk/polychat-component-ui";
import type { SiteRecord } from "@ngriffin_uk/polychat-schemas";

import { RecordViewBindingDialog } from "../../Files/RecordViewBindingDialog.js";
import { useSiteRecordBindings } from "./useSiteRecordBindings.js";

export function SiteRecordBindings({
  site,
  pageId,
  disabled,
  onSaved,
}: {
  site: SiteRecord;
  pageId: string | null;
  disabled: boolean;
  onSaved: (site: SiteRecord) => void;
}) {
  const work = useSiteRecordBindings(site, pageId, onSaved);
  const views = site.project.recordViews ?? [];

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
      <span className="text-xs text-muted-foreground">Live tables</span>
      {views.map((view) => (
        <div key={view.id} className="flex items-center gap-1">
          <Button
            size="xs"
            variant="outline"
            disabled={disabled || work.save.isPending}
            onClick={() => work.open(view)}
          >
            {view.title}
          </Button>
          <Button
            size="xs"
            variant="ghost"
            disabled={disabled || work.save.isPending}
            onClick={() => void work.remove(view.id)}
            aria-label={`Remove ${view.title}`}
          >
            Remove
          </Button>
        </div>
      ))}
      <Button
        size="xs"
        variant="outline"
        disabled={disabled || work.save.isPending || views.length >= 12}
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
        projectId={site.projectId ?? undefined}
        editor={work.editor}
        isSaving={work.save.isPending}
        errorMessage={work.save.error?.message}
        onClose={() => work.setEditor(null)}
        onTableChange={(tableId) =>
          work.setEditor((current) => (current ? { ...current, tableId } : null))
        }
        onSave={work.attach}
      />
    </div>
  );
}
