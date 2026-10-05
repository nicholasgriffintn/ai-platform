import { Button, FormInput, FormSelect } from "@ngriffin_uk/polychat-component-ui";
import type { NativeRecordColumn } from "@ngriffin_uk/polychat-schemas";
import { omitRecordProperty, renameRecordProperty } from "@ngriffin_uk/polychat-utility-core";

import { nextFlowBindingKey } from "./draft";

export function FlowFieldMapping({
  columns,
  values,
  onChange,
}: {
  columns: NativeRecordColumn[];
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">Save record fields as flow values</legend>
      {Object.entries(values).map(([key, field], index) => (
        <div key={index} className="flex flex-wrap items-end gap-2">
          <FormSelect
            label="Record field"
            value={field}
            options={[
              { value: "", label: "Choose a field…" },
              ...columns.map((column) => ({ value: column.id, label: column.name })),
            ]}
            onValueChange={(next) => onChange({ ...values, [key]: next })}
          />
          <FormInput
            label="Flow value name"
            pattern="[a-z][a-z0-9_]{0,39}"
            required
            value={key}
            onChange={(event) =>
              onChange(renameRecordProperty(values, key, event.currentTarget.value))
            }
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(omitRecordProperty(values, key))}
          >
            Remove
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!columns.length || Object.keys(values).length >= 62}
        onClick={() => onChange({ ...values, [nextFlowBindingKey(values)]: columns[0]?.id ?? "" })}
      >
        Save another field
      </Button>
    </fieldset>
  );
}
