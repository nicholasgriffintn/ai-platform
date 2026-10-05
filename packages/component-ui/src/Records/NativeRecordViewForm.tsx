import type { NativeRecordTable, NativeRecordView } from "@ngriffin_uk/polychat-schemas";

import { Button } from "../Button";
import { Input } from "../input";
import { RecordFilterEditor } from "./RecordFilterEditor";
import { useRecordViewForm } from "./useRecordViewForm";

export function NativeRecordViewForm({
  table,
  initialView,
  isSaving,
  errorMessage,
  onSave,
}: {
  table: NativeRecordTable;
  initialView?: NativeRecordView;
  isSaving: boolean;
  errorMessage?: string;
  onSave: (view: NativeRecordView) => Promise<boolean>;
}) {
  const form = useRecordViewForm(table, initialView);
  const choices = table.definition.columns.filter((column) => column.type === "select");
  const checkboxes = table.definition.columns.filter((column) => column.type === "boolean");

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        if (form.parsed.success) {
          await onSave(form.parsed.data);
        }
      }}
    >
      <label className="block space-y-1 text-sm">
        View name
        <Input
          value={form.title}
          onChange={(event) => form.setTitle(event.currentTarget.value)}
          required
          maxLength={120}
        />
      </label>
      <label className="block space-y-1 text-sm">
        Presentation
        <select
          className="h-9 w-full rounded-md border border-input bg-surface px-2"
          value={form.presentation}
          onChange={(event) => {
            const value = event.currentTarget.value;

            if (value === "table" || value === "board" || value === "checklist") {
              form.setPresentation(value);
            }
          }}
        >
          <option value="table">Table</option>
          <option value="board" disabled={!choices.length}>
            Board
          </option>
          <option value="checklist" disabled={!checkboxes.length}>
            Checklist
          </option>
        </select>
      </label>
      {form.presentation === "board" ? (
        <label className="block space-y-1 text-sm">
          Group by
          <select
            className="h-9 w-full rounded-md border border-input bg-surface px-2"
            value={form.groupColumnId}
            onChange={(event) => form.setGroupColumnId(event.currentTarget.value)}
          >
            {choices.map((column) => (
              <option key={column.id} value={column.id}>
                {column.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {form.presentation === "checklist" ? (
        <label className="block space-y-1 text-sm">
          Checkbox column
          <select
            className="h-9 w-full rounded-md border border-input bg-surface px-2"
            value={form.checkedColumnId}
            onChange={(event) => form.setCheckedColumnId(event.currentTarget.value)}
          >
            {checkboxes.map((column) => (
              <option key={column.id} value={column.id}>
                {column.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.editable}
          onChange={(event) => form.setEditable(event.currentTarget.checked)}
        />
        Allow readers to edit rows they have permission to change
      </label>
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">Visible columns</legend>
        <div className="flex flex-wrap gap-3">
          {table.definition.columns.map((column) => (
            <label key={column.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.columns.includes(column.id)}
                onChange={(event) => form.toggleColumn(column.id, event.currentTarget.checked)}
              />
              {column.name}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">Filters</legend>
        {form.filters.map((filter, index) => (
          <RecordFilterEditor
            key={index}
            columns={table.definition.columns}
            filter={filter}
            onChange={(next) => form.replaceFilter(index, next)}
            onRemove={() => form.removeFilter(index)}
          />
        ))}
        <Button
          type="button"
          size="xs"
          variant="outline"
          disabled={form.filters.length >= 10}
          onClick={form.addFilter}
        >
          Add filter
        </Button>
      </fieldset>
      <div className="flex flex-wrap gap-3">
        <label className="space-y-1 text-sm">
          Sort by
          <select
            className="h-9 w-full rounded-md border border-input bg-surface px-2"
            value={form.sortColumnId}
            onChange={(event) => form.setSortColumnId(event.currentTarget.value)}
          >
            <option value="">Creation date</option>
            {table.definition.columns.map((column) => (
              <option key={column.id} value={column.id}>
                {column.name}
              </option>
            ))}
          </select>
        </label>
        {form.sortColumnId ? (
          <label className="space-y-1 text-sm">
            Direction
            <select
              className="h-9 w-full rounded-md border border-input bg-surface px-2"
              value={form.direction}
              onChange={(event) =>
                form.setDirection(event.currentTarget.value === "desc" ? "desc" : "asc")
              }
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </label>
        ) : null}
      </div>
      {errorMessage || !form.parsed.success ? (
        <p role="alert" className="text-sm text-failure">
          {errorMessage ??
            (!form.parsed.success ? form.parsed.error.issues[0]?.message : undefined)}
        </p>
      ) : null}
      <Button type="submit" isLoading={isSaving} disabled={!form.parsed.success}>
        Save view
      </Button>
    </form>
  );
}
