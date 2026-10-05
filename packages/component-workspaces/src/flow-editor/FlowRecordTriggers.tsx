import { Button, Checkbox, FormInput, Textarea } from "@ngriffin_uk/polychat-component-ui";
import { RecordFilterEditor } from "@ngriffin_uk/polychat-component-ui/records";
import type {
  ProjectFlowNode,
  ProjectFlowResponse,
  ProjectRecordTrigger,
} from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";

import { FlowFieldMapping } from "./FlowFieldMapping";
import { FlowNextStep } from "./FlowNextStep";
import { FlowTableSelect } from "./FlowTableSelect";
import type { FlowEditorResources } from "./types";

const OPERATIONS: { value: ProjectRecordTrigger["operations"][number]; label: string }[] = [
  { value: "created", label: "Created" },
  { value: "updated", label: "Updated" },
  { value: "deleted", label: "Deleted" },
];

export function FlowRecordTriggers({
  triggers,
  states,
  nodes,
  entryNodeId,
  resources,
  onChange,
}: {
  triggers: ProjectRecordTrigger[];
  states: ProjectFlowResponse["triggerStates"];
  nodes: ProjectFlowNode[];
  entryNodeId: string;
  resources: FlowEditorResources;
  onChange: (triggers: ProjectRecordTrigger[]) => void;
}) {
  const replace = (index: number, trigger: ProjectRecordTrigger) =>
    onChange(triggers.map((item, position) => (position === index ? trigger : item)));

  return (
    <section className="space-y-3 border-t border-border pt-4">
      <h3 className="text-sm font-semibold">Start tasks from record changes</h3>
      <p className="text-xs text-muted-foreground">
        Each matching change creates one task. Checks run every 15 minutes. Changes made by these
        tasks do not start further tasks. The source record is available as record_id and
        record_operation.
      </p>
      {triggers.map((trigger, index) => {
        const columns = resources.recordDefinitions.find(
          (table) => table.id === trigger.tableId,
        )?.columns;
        const state = states.find((item) => item.id === trigger.id);

        return (
          <fieldset key={trigger.id} className="space-y-3 rounded-lg border border-border p-4">
            <legend className="px-1 text-sm font-medium">{trigger.name}</legend>
            {state && !state.enabled && (
              <p role="alert" className="text-sm text-failure">
                Paused:{" "}
                {state.error ?? "Check the table and permissions, then save the flow to resume."}
              </p>
            )}
            <FormInput
              label="Trigger name"
              value={trigger.name}
              required
              maxLength={120}
              onChange={(event) => replace(index, { ...trigger, name: event.currentTarget.value })}
            />
            <FlowTableSelect
              value={trigger.tableId}
              resources={resources}
              onChange={(tableId) =>
                replace(index, { ...trigger, tableId, filters: [], saveFields: {} })
              }
            />
            <div className="flex flex-wrap gap-4">
              {OPERATIONS.map(({ value, label }) => (
                <label key={value} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={trigger.operations.includes(value)}
                    onCheckedChange={(checked) =>
                      replace(index, {
                        ...trigger,
                        operations:
                          checked === true
                            ? [...trigger.operations, value]
                            : trigger.operations.filter((operation) => operation !== value),
                      })
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
            <label className="block space-y-1 text-sm">
              Task objective
              <Textarea
                value={trigger.objective}
                rows={2}
                required
                maxLength={2000}
                onChange={(event) =>
                  replace(index, { ...trigger, objective: event.currentTarget.value })
                }
              />
            </label>
            <FlowNextStep
              label="Start at"
              nodes={nodes}
              value={trigger.entryNodeId}
              onChange={(next) => replace(index, { ...trigger, entryNodeId: next })}
            />
            {columns && (
              <>
                {trigger.filters.map((filter, filterIndex) => (
                  <RecordFilterEditor
                    key={filterIndex}
                    columns={columns}
                    filter={filter}
                    onChange={(next) =>
                      replace(index, {
                        ...trigger,
                        filters: trigger.filters.map((item, position) =>
                          position === filterIndex ? next : item,
                        ),
                      })
                    }
                    onRemove={() =>
                      replace(index, {
                        ...trigger,
                        filters: trigger.filters.filter(
                          (_item, position) => position !== filterIndex,
                        ),
                      })
                    }
                  />
                ))}
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  disabled={!columns.length || trigger.filters.length >= 10}
                  onClick={() => {
                    if (columns[0]) {
                      replace(index, {
                        ...trigger,
                        filters: [
                          ...trigger.filters,
                          { columnId: columns[0].id, operator: "is_empty" },
                        ],
                      });
                    }
                  }}
                >
                  Add a condition
                </Button>
                <FlowFieldMapping
                  columns={columns}
                  values={trigger.saveFields}
                  onChange={(saveFields) => replace(index, { ...trigger, saveFields })}
                />
              </>
            )}
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={() => onChange(triggers.filter((_item, position) => position !== index))}
            >
              Remove trigger
            </Button>
          </fieldset>
        );
      })}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={triggers.length >= 8}
        onClick={() =>
          onChange([
            ...triggers,
            {
              id: `trigger-${generateId().slice(0, 8)}`,
              name: "New record",
              tableId: "",
              operations: ["created"],
              filters: [],
              objective: "Process the new record",
              entryNodeId,
              saveFields: {},
            },
          ])
        }
      >
        Add a record trigger
      </Button>
    </section>
  );
}
