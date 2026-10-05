import {
  Button,
  NativeRecordForm,
  NativeRecordView,
} from "@ngriffin_uk/polychat-component-ui/records";

import { useSiteRecordView } from "./useSiteRecordView.js";

export function Records({ viewId }: { viewId: string }) {
  const work = useSiteRecordView(viewId);
  const { data } = work;

  return (
    <section className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex items-center gap-2">
        <h3 className="flex-1 text-lg font-semibold">{data?.view.title ?? "Live records"}</h3>
        <Button
          variant="ghost"
          size="xs"
          disabled={work.saving || work.loading}
          onClick={() => void work.read()}
        >
          Refresh
        </Button>
        {data?.view.editable && data.table.permissions.canCreate ? (
          <Button size="xs" disabled={work.saving} onClick={() => work.open(null)}>
            Add record
          </Button>
        ) : null}
      </div>
      {work.error ? (
        <p role="alert" className="text-sm text-destructive">
          {work.error}
        </p>
      ) : null}
      {work.draft ? (
        <NativeRecordForm
          key={work.draft.requestId}
          definition={work.draft.definition}
          initialValues={work.draft.record?.values}
          isSaving={work.saving}
          errorMessage={work.error}
          onSave={work.save}
          onCancel={() => work.setDraft(null)}
        />
      ) : null}
      {work.deleting ? (
        <div className="flex items-center gap-2 text-sm">
          <span>Delete this record?</span>
          <Button
            size="xs"
            variant="destructive"
            isLoading={work.saving}
            onClick={() => void work.remove()}
          >
            Delete
          </Button>
          <Button
            size="xs"
            variant="ghost"
            disabled={work.saving}
            onClick={() => work.setDeleting(null)}
          >
            Cancel
          </Button>
        </div>
      ) : null}
      {data ? (
        <NativeRecordView
          table={data.table}
          records={work.records}
          view={data.view}
          readOnly={!data.view.editable}
          isSaving={work.saving}
          onEdit={work.open}
          onDelete={work.setDeleting}
          onChangeValue={(record, columnId, value) =>
            void work.changeValue(record, columnId, value)
          }
        />
      ) : null}
      {data?.result.hasMore ? (
        <Button
          size="xs"
          variant="outline"
          isLoading={work.loading}
          onClick={() => void work.read(work.records.length)}
        >
          Load more
        </Button>
      ) : null}
    </section>
  );
}
