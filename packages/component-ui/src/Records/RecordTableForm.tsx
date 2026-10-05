import {
  nativeRecordDefinitionSchema,
  type NativeRecordDefinition,
} from "@ngriffin_uk/polychat-schemas";
import { useState } from "react";

import { Button } from "../Button";
import { Input } from "../input";
import { RecordColumnEditor } from "./RecordColumnEditor";
import { defaultRecordDefinition, useRecordDefinitionDraft } from "./useRecordDefinitionDraft";

export function RecordTableForm({
  initialTitle = "",
  initialDefinition = defaultRecordDefinition,
  isSaving,
  errorMessage,
  onSave,
}: {
  initialTitle?: string;
  initialDefinition?: NativeRecordDefinition;
  isSaving: boolean;
  errorMessage?: string;
  onSave: (title: string, definition: NativeRecordDefinition) => Promise<boolean>;
}) {
  const [title, setTitle] = useState(initialTitle);
  const draft = useRecordDefinitionDraft(initialDefinition);
  const validation = nativeRecordDefinitionSchema.safeParse(draft.definition);

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        if (validation.success) {
          await onSave(title, validation.data);
        }
      }}
    >
      <label className="block space-y-1 text-sm">
        Table name
        <Input
          value={title}
          onChange={(event) => setTitle(event.currentTarget.value)}
          required
          maxLength={200}
        />
      </label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          Who can see rows
          <select
            className="h-9 w-full rounded-md border border-input bg-surface px-2"
            value={draft.definition.visibility}
            onChange={(event) => {
              const visibility = event.currentTarget.value === "creator" ? "creator" : "shared";

              draft.setDefinition((current) => ({
                ...current,
                visibility,
                editing: visibility === "creator" ? "creator" : current.editing,
              }));
            }}
          >
            <option value="shared">Everyone in this project</option>
            <option value="creator">Row creator and table managers</option>
          </select>
        </label>
        <label className="space-y-1 text-sm">
          Who can edit rows
          <select
            className="h-9 w-full rounded-md border border-input bg-surface px-2"
            value={draft.definition.editing}
            disabled={draft.definition.visibility === "creator"}
            onChange={(event) => {
              const editing = event.currentTarget.value === "shared" ? "shared" : "creator";

              draft.setDefinition((current) => ({ ...current, editing }));
            }}
          >
            <option value="creator">Row creator and table managers</option>
            <option value="shared">Everyone in this project</option>
          </select>
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        Personal tables remain private. Column changes must keep existing rows valid.
      </p>
      <div className="space-y-3">
        {draft.definition.columns.map((column, index) => (
          <RecordColumnEditor
            key={column.id}
            column={column}
            canRemove={draft.definition.columns.length > 1}
            onChange={(next) => draft.replaceColumn(index, next)}
            onType={(type) => draft.changeType(index, type)}
            onRemove={() => draft.removeColumn(index)}
          />
        ))}
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={draft.definition.columns.length >= 64 || isSaving}
        onClick={draft.addColumn}
      >
        Add column
      </Button>
      {!validation.success ? (
        <p role="alert" className="text-sm text-failure">
          {validation.error.issues[0]?.message}
        </p>
      ) : null}
      {errorMessage ? (
        <p role="alert" className="text-sm text-failure">
          {errorMessage}
        </p>
      ) : null}
      <div>
        <Button type="submit" isLoading={isSaving} disabled={!validation.success || !title.trim()}>
          Save table
        </Button>
      </div>
    </form>
  );
}
