import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  NativeRecordViewForm,
} from "@ngriffin_uk/polychat-component-ui";
import { useNativeRecordTable, useNativeRecordTables } from "@ngriffin_uk/polychat-library-react";
import type { NativeRecordView } from "@ngriffin_uk/polychat-schemas";

export function RecordViewBindingDialog({
  projectId,
  editor,
  isSaving,
  errorMessage,
  onTableChange,
  onSave,
  onClose,
}: {
  projectId?: string;
  editor: { tableId: string; initialView?: NativeRecordView } | null;
  isSaving: boolean;
  errorMessage?: string;
  onTableChange: (tableId: string) => void;
  onSave: (view: NativeRecordView) => Promise<boolean>;
  onClose: () => void;
}) {
  const catalogue = useNativeRecordTables(projectId, Boolean(editor));
  const selected = useNativeRecordTable(editor?.tableId || null);

  return (
    <Dialog
      open={Boolean(editor)}
      onOpenChange={(open) => {
        if (!open && !isSaving) {
          onClose();
        }
      }}
      width="min(48rem, 100%)"
    >
      <DialogContent>
        <DialogTitle>
          {editor?.initialView ? "Edit live table view" : "Add a live table"}
        </DialogTitle>
        <DialogDescription>
          Choose a table from this scope and configure its view.
        </DialogDescription>
        <label className="block space-y-1 text-sm">
          Table
          <select
            className="h-9 w-full rounded-md border border-input bg-surface px-2"
            value={editor?.tableId ?? ""}
            disabled={Boolean(editor?.initialView) || isSaving}
            onChange={(event) => onTableChange(event.currentTarget.value)}
          >
            <option value="">Choose a table…</option>
            {catalogue.data?.pages
              .flatMap((page) => page)
              .map((table) => (
                <option key={table.id} value={table.id}>
                  {table.title}
                </option>
              ))}
          </select>
        </label>
        {catalogue.hasNextPage ? (
          <Button
            size="xs"
            variant="ghost"
            isLoading={catalogue.isFetchingNextPage}
            onClick={() => void catalogue.fetchNextPage()}
          >
            Load more tables
          </Button>
        ) : null}
        {catalogue.error || selected.error ? (
          <p role="alert" className="text-sm text-failure">
            {catalogue.error?.message ?? selected.error?.message}
          </p>
        ) : null}
        {selected.data && !selected.isError ? (
          <NativeRecordViewForm
            key={`${selected.data.output.id}:${editor?.initialView?.id ?? "new"}`}
            table={selected.data}
            initialView={editor?.initialView}
            isSaving={isSaving}
            errorMessage={errorMessage}
            onSave={onSave}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
