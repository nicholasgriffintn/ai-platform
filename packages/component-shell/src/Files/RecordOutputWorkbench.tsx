import {
  NativeRecordForm,
  NativeRecordView,
  RecordTableForm,
  Button,
  ConfirmationDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  EmptyState,
} from "@ngriffin_uk/polychat-component-ui";
import {
  nativeRecordViewSchema,
  type NativeRecordView as RecordView,
} from "@ngriffin_uk/polychat-schemas";
import { useState } from "react";

import { useRecordWorkbench } from "./useRecordWorkbench.js";

export function RecordOutputWorkbench({
  tableId,
  view,
  readOnly = false,
}: {
  tableId: string;
  view?: RecordView;
  readOnly?: boolean;
}) {
  const work = useRecordWorkbench(tableId, view);
  const editingDisabled = readOnly || Boolean(view && !view.editable);
  const [presentation, setPresentation] = useState("table");
  const table = work.table.data;

  if (work.table.isError || work.rows.isError || work.changes.isError) {
    return (
      <EmptyState
        title="Table unavailable"
        message={
          work.table.error?.message ?? work.rows.error?.message ?? work.changes.error?.message
        }
      />
    );
  }

  if (!table) {
    return <p className="text-sm text-muted-foreground">Loading table…</p>;
  }

  const groupColumn = table.definition.columns.find((column) => column.type === "select");
  const checkedColumn = table.definition.columns.find((column) => column.type === "boolean");
  const usablePresentation =
    (presentation === "board" && !groupColumn) || (presentation === "checklist" && !checkedColumn)
      ? "table"
      : presentation;
  const localView = nativeRecordViewSchema.parse({
    id: "records",
    tableId,
    title: table.output.title,
    presentation: usablePresentation,
    groupColumnId: groupColumn?.id,
    checkedColumnId: checkedColumn?.id,
  });
  const activeView = view ?? localView;
  const errorMessage = work.errorMessage;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1">
          {!view ? (
            <>
              <Button
                size="sm"
                variant={presentation === "table" ? "secondary" : "ghost"}
                onClick={() => setPresentation("table")}
              >
                Table
              </Button>
              <Button
                size="sm"
                variant={presentation === "board" ? "secondary" : "ghost"}
                disabled={!groupColumn}
                onClick={() => setPresentation("board")}
              >
                Board
              </Button>
              <Button
                size="sm"
                variant={presentation === "checklist" ? "secondary" : "ghost"}
                disabled={!checkedColumn}
                onClick={() => setPresentation("checklist")}
              >
                Checklist
              </Button>
            </>
          ) : (
            <h3 className="text-sm font-medium">{view.title}</h3>
          )}
        </div>
        {!editingDisabled ? (
          <div className="flex gap-2">
            {table.permissions.canManage ? (
              <Button size="sm" variant="outline" onClick={work.openTableForm}>
                Edit columns
              </Button>
            ) : null}
            {table.permissions.canCreate ? (
              <Button size="sm" onClick={() => work.openForm(null)}>
                Add record
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      {errorMessage ? (
        <p role="alert" className="text-sm text-failure">
          {errorMessage}
        </p>
      ) : null}
      {work.rows.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading records…</p>
      ) : (
        <NativeRecordView
          table={table}
          records={work.rows.data?.pages.flatMap((page) => page.records) ?? []}
          view={activeView}
          isSaving={work.isSaving}
          readOnly={editingDisabled}
          onEdit={work.openForm}
          onDelete={work.setDeleting}
          onChangeValue={(record, columnId, value) =>
            void work.changeValue(record, columnId, value)
          }
        />
      )}
      {work.rows.hasNextPage ? (
        <Button
          size="sm"
          variant="outline"
          isLoading={work.rows.isFetchingNextPage}
          onClick={() => void work.rows.fetchNextPage()}
        >
          Load more records
        </Button>
      ) : null}
      <Dialog
        open={Boolean(work.form)}
        onOpenChange={(open) => {
          if (!open && !work.isSaving) {
            work.setForm(null);
          }
        }}
      >
        <DialogContent>
          <DialogTitle>{work.form?.record ? "Edit record" : "Add record"}</DialogTitle>
          <DialogDescription>
            Save changes to this record. If another person has edited it, refresh before trying
            again.
          </DialogDescription>
          {work.form ? (
            <NativeRecordForm
              key={work.form.requestId}
              definition={work.form.definition}
              initialValues={work.form.record?.values}
              isSaving={work.isSaving}
              errorMessage={work.errorMessage}
              onSave={work.save}
              onCancel={() => work.setForm(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(work.tableForm)}
        onOpenChange={(open) => {
          if (!open) {
            work.setTableForm(null);
          }
        }}
        width="min(48rem, 100%)"
      >
        <DialogContent>
          <DialogTitle>Edit table columns</DialogTitle>
          <DialogDescription>Keep existing rows valid when changing columns.</DialogDescription>
          {work.tableForm ? (
            <RecordTableForm
              key={work.tableForm.revision}
              initialTitle={work.tableForm.title}
              initialDefinition={work.tableForm.definition}
              isSaving={work.updateTable.isPending}
              errorMessage={work.updateTable.error?.message}
              onSave={async (title, definition) => {
                if (!work.tableForm) {
                  return false;
                }

                try {
                  await work.updateTable.mutateAsync({
                    title,
                    definition,
                    expectedRevision: work.tableForm.revision,
                  });
                  work.setTableForm(null);

                  return true;
                } catch {
                  return false;
                }
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
      <ConfirmationDialog
        open={Boolean(work.deleting)}
        onOpenChange={(open) => {
          if (!open) {
            work.setDeleting(null);
          }
        }}
        title="Delete this record?"
        description="The record will leave current views. Its revision history will remain available to authorised readers."
        confirmText="Delete record"
        variant="destructive"
        isLoading={work.remove.isPending}
        onConfirm={work.confirmRemove}
      />
    </div>
  );
}
