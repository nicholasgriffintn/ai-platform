import { FormInput, FormSelect } from "@ngriffin_uk/polychat-component-ui";
import type { ProjectFlowFunction } from "@ngriffin_uk/polychat-schemas";

import { FlowBindingsEditor } from "./FlowBindingsEditor";
import { FlowFieldMapping } from "./FlowFieldMapping";
import { FlowTableSelect } from "./FlowTableSelect";
import { FlowValueInput } from "./FlowValueInput";
import type { FlowEditorResources } from "./types";

const OPERATIONS: { value: ProjectFlowFunction["kind"]; label: string }[] = [
  { value: "set_values", label: "Set flow values" },
  { value: "read_record", label: "Read a record" },
  { value: "create_record", label: "Create a record" },
];

export function FlowFunctionEditor({
  operation,
  resources,
  onChange,
}: {
  operation: ProjectFlowFunction;
  resources: FlowEditorResources;
  onChange: (operation: ProjectFlowFunction) => void;
}) {
  const columns =
    operation.kind === "set_values"
      ? undefined
      : resources.recordDefinitions.find((table) => table.id === operation.tableId)?.columns;

  return (
    <div className="space-y-4">
      <FormSelect
        label="Action"
        value={operation.kind}
        options={OPERATIONS}
        onValueChange={(kind) =>
          onChange(
            kind === "set_values"
              ? { kind, values: {} }
              : kind === "read_record"
                ? { kind, tableId: "", recordId: { variable: "record_id" }, saveFields: {} }
                : { kind, tableId: "", values: {} },
          )
        }
      />
      {operation.kind === "set_values" ? (
        <FlowBindingsEditor
          values={operation.values}
          onChange={(values) => onChange({ ...operation, values })}
        />
      ) : (
        <>
          <FlowTableSelect
            value={operation.tableId}
            resources={resources}
            onChange={(tableId) =>
              onChange(
                operation.kind === "read_record"
                  ? { ...operation, tableId, saveFields: {} }
                  : { ...operation, tableId, values: {} },
              )
            }
          />
          {operation.tableId && !columns ? (
            <p className="text-sm text-muted-foreground">Loading table fields…</p>
          ) : null}
          {operation.kind === "read_record" ? (
            <>
              <FlowValueInput
                label="Record ID"
                value={operation.recordId}
                onChange={(recordId) => onChange({ ...operation, recordId })}
              />
              {columns && (
                <FlowFieldMapping
                  columns={columns}
                  values={operation.saveFields}
                  onChange={(saveFields) => onChange({ ...operation, saveFields })}
                />
              )}
            </>
          ) : (
            <>
              {columns && (
                <FlowBindingsEditor
                  columns={columns}
                  values={operation.values}
                  onChange={(values) => onChange({ ...operation, values })}
                />
              )}
              <FormInput
                label="Save the created record ID as"
                value={operation.outputIdKey ?? ""}
                pattern="[a-z][a-z0-9_]{0,39}"
                onChange={(event) =>
                  onChange({ ...operation, outputIdKey: event.currentTarget.value || undefined })
                }
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
