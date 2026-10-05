import { Button, FormInput, FormSelect } from "@ngriffin_uk/polychat-component-ui";
import type { NativeRecordColumn, ProjectFlowValueBinding } from "@ngriffin_uk/polychat-schemas";
import { omitRecordProperty, renameRecordProperty } from "@ngriffin_uk/polychat-utility-core";

import { nextFlowBindingKey } from "./draft";
import { FlowValueInput } from "./FlowValueInput";

export function FlowBindingsEditor({
  values,
  columns,
  onChange,
}: {
  values: Record<string, ProjectFlowValueBinding>;
  columns?: NativeRecordColumn[];
  onChange: (values: Record<string, ProjectFlowValueBinding>) => void;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">Values</legend>
      {Object.entries(values).map(([key, value], index) => (
        <div key={index} className="space-y-2 rounded-md border border-border p-3">
          {columns ? (
            <FormSelect
              label="Record field"
              value={key}
              options={[
                { value: "", label: "Choose a field…" },
                ...columns.map((column) => ({ value: column.id, label: column.name })),
              ]}
              onValueChange={(name) => onChange(renameRecordProperty(values, key, name))}
            />
          ) : (
            <FormInput
              label="Flow value name"
              value={key}
              pattern="[a-z][a-z0-9_]{0,39}"
              required
              onChange={(event) =>
                onChange(renameRecordProperty(values, key, event.currentTarget.value))
              }
            />
          )}
          <FlowValueInput
            label="Value"
            value={value}
            onChange={(next) => onChange({ ...values, [key]: next })}
          />
          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={() => onChange(omitRecordProperty(values, key))}
          >
            Remove value
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={
          Object.keys(values).length >= 64 ||
          Boolean(columns && columns.every((column) => Object.hasOwn(values, column.id)))
        }
        onClick={() => {
          const key = columns
            ? columns.find((column) => !Object.hasOwn(values, column.id))?.id
            : nextFlowBindingKey(values);

          if (key) {
            onChange({ ...values, [key]: "" });
          }
        }}
      >
        Add value
      </Button>
    </fieldset>
  );
}
