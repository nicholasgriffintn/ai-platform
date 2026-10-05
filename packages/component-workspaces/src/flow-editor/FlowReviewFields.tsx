import { Button, RecordColumnEditor } from "@ngriffin_uk/polychat-component-ui/records";
import { nativeRecordColumnSchema, type NativeRecordColumn } from "@ngriffin_uk/polychat-schemas";

import { nextFlowBindingKey } from "./draft";

export function FlowReviewFields({
  fields,
  onChange,
}: {
  fields: NativeRecordColumn[];
  onChange: (fields: NativeRecordColumn[]) => void;
}) {
  const replace = (index: number, column: NativeRecordColumn) =>
    onChange(fields.map((field, position) => (position === index ? column : field)));

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">Review form fields</legend>
      <p className="text-xs text-muted-foreground">
        Accepted answers become flow values for later steps.
      </p>
      {fields.map((field, index) => (
        <RecordColumnEditor
          key={index}
          column={field}
          canRemove
          onChange={(column) => replace(index, column)}
          onRemove={() => onChange(fields.filter((_column, position) => position !== index))}
          onType={(type) => {
            const parsed = nativeRecordColumnSchema.safeParse({
              id: field.id,
              name: field.name,
              required: field.required,
              type,
              ...(type === "select" ? { options: ["Yes", "No"] } : {}),
            });

            if (parsed.success) {
              replace(index, parsed.data);
            }
          }}
        />
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={fields.length >= 64}
        onClick={() =>
          onChange([
            ...fields,
            nativeRecordColumnSchema.parse({
              id: nextFlowBindingKey(Object.fromEntries(fields.map((field) => [field.id, field]))),
              name: "Answer",
              type: "text",
            }),
          ])
        }
      >
        Add a form field
      </Button>
    </fieldset>
  );
}
