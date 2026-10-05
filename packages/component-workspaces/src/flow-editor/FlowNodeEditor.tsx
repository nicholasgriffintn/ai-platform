import { Button, FormInput, FormSelect, Textarea } from "@ngriffin_uk/polychat-component-ui";
import { projectFlowConditionSchema, type ProjectFlowNode } from "@ngriffin_uk/polychat-schemas";

import { FLOW_NODE_LABELS } from "../flow-node-presentation";
import { FlowAgentEditor } from "./FlowAgentEditor";
import { FlowFunctionEditor } from "./FlowFunctionEditor";
import { FlowNextStep } from "./FlowNextStep";
import { FlowReviewFields } from "./FlowReviewFields";
import { FlowValueInput } from "./FlowValueInput";
import type { FlowEditorResources } from "./types";

export function FlowNodeEditor({
  node,
  nodes,
  resources,
  canRemove,
  onChange,
  onRemove,
}: {
  node: ProjectFlowNode;
  nodes: ProjectFlowNode[];
  resources: FlowEditorResources;
  canRemove: boolean;
  onChange: (node: ProjectFlowNode) => void;
  onRemove: () => void;
}) {
  return (
    <section className="space-y-4 rounded-xl border border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">
          {FLOW_NODE_LABELS[node.type]} · {node.name}
        </p>
        <Button
          type="button"
          size="xs"
          variant="ghost"
          disabled={!canRemove}
          title={canRemove ? "Remove this step" : "Disconnect this step before removing it"}
          onClick={onRemove}
        >
          Remove
        </Button>
      </div>
      <FormInput
        label="Step name"
        value={node.name}
        required
        maxLength={120}
        onChange={(event) => onChange({ ...node, name: event.currentTarget.value })}
      />
      {node.type === "agent" && (
        <FlowAgentEditor node={node} resources={resources} onChange={onChange} />
      )}
      {node.type === "function" && (
        <FlowFunctionEditor
          operation={node.operation}
          resources={resources}
          onChange={(operation) => onChange({ ...node, operation })}
        />
      )}
      {node.type === "decision" && (
        <>
          <FormInput
            label="Flow value to check"
            value={node.condition.variable}
            pattern="[a-z][a-z0-9_]{0,39}"
            required
            onChange={(event) =>
              onChange({
                ...node,
                condition: { ...node.condition, variable: event.currentTarget.value },
              })
            }
          />
          <FormSelect
            label="Condition"
            value={node.condition.operator}
            options={[
              { value: "exists", label: "Has a value" },
              { value: "eq", label: "Equals" },
              { value: "ne", label: "Does not equal" },
              { value: "contains", label: "Contains" },
              { value: "gt", label: "Greater than" },
              { value: "gte", label: "At least" },
              { value: "lt", label: "Less than" },
              { value: "lte", label: "At most" },
            ]}
            onValueChange={(operator) => {
              const parsed = projectFlowConditionSchema.safeParse(
                operator === "exists"
                  ? { operator, variable: node.condition.variable }
                  : {
                      operator,
                      variable: node.condition.variable,
                      value: node.condition.operator === "exists" ? "" : node.condition.value,
                    },
              );

              if (parsed.success) {
                onChange({ ...node, condition: parsed.data });
              }
            }}
          />
          {node.condition.operator !== "exists" && (
            <FlowValueInput
              label="Compare with"
              allowVariable={false}
              value={node.condition.value}
              onChange={(value) => {
                if (
                  node.condition.operator !== "exists" &&
                  (value === null || typeof value !== "object")
                ) {
                  onChange({ ...node, condition: { ...node.condition, value } });
                }
              }}
            />
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <FlowNextStep
              label="If true"
              nodes={nodes}
              value={node.onTrue}
              onChange={(onTrue) => onChange({ ...node, onTrue })}
            />
            <FlowNextStep
              label="Otherwise"
              nodes={nodes}
              value={node.onFalse}
              onChange={(onFalse) => onChange({ ...node, onFalse })}
            />
          </div>
        </>
      )}
      {node.type === "loop" && (
        <>
          <FormInput
            label="Repeat at most"
            type="number"
            min={1}
            max={20}
            required
            value={node.maxIterations}
            onChange={(event) =>
              onChange({ ...node, maxIterations: event.currentTarget.valueAsNumber })
            }
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <FlowNextStep
              label="Start each repeat at"
              nodes={nodes}
              value={node.body}
              onChange={(body) => onChange({ ...node, body })}
            />
            <FlowNextStep
              label="After the repeats"
              nodes={nodes}
              value={node.exit}
              onChange={(exit) => onChange({ ...node, exit })}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Connect the final step in the repeated work back to this Repeat step.
          </p>
        </>
      )}
      {node.type === "human_wait" && (
        <>
          <label className="block space-y-1 text-sm">
            Review request
            <Textarea
              value={node.prompt}
              rows={3}
              required
              maxLength={2000}
              onChange={(event) => onChange({ ...node, prompt: event.currentTarget.value })}
            />
          </label>
          <FormSelect
            label="Reviewer"
            value={node.assigneeUserId?.toString() ?? ""}
            options={[
              { value: "", label: "Task owner or task creator" },
              ...resources.members.map((member) => ({
                value: String(member.userId),
                label: member.name ?? `Member ${member.userId}`,
              })),
            ]}
            onValueChange={(value) =>
              onChange({ ...node, assigneeUserId: value ? Number(value) : null })
            }
          />
          <FlowReviewFields
            fields={node.fields}
            onChange={(fields) => onChange({ ...node, fields })}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <FlowNextStep
              label="When accepted"
              nodes={nodes}
              value={node.onAccepted}
              onChange={(onAccepted) => onChange({ ...node, onAccepted })}
            />
            <FlowNextStep
              label="When rejected"
              nodes={nodes}
              value={node.onRejected}
              onChange={(onRejected) => onChange({ ...node, onRejected })}
            />
          </div>
        </>
      )}
      {node.type === "timer" && (
        <FormInput
          label="Wait for, in seconds"
          description="The task continues on the next scheduled check after this delay. Checks run every 15 minutes."
          type="number"
          min={1}
          max={604800}
          required
          value={node.seconds}
          onChange={(event) => onChange({ ...node, seconds: event.currentTarget.valueAsNumber })}
        />
      )}
      {node.type === "end" && (
        <FormSelect
          label="Finish the task as"
          value={node.status}
          options={[
            { value: "done", label: "Completed" },
            { value: "cancelled", label: "Cancelled" },
          ]}
          onValueChange={(status) => onChange({ ...node, status })}
        />
      )}
      {(node.type === "agent" || node.type === "function" || node.type === "timer") && (
        <FlowNextStep
          label="Next step"
          nodes={nodes}
          value={node.next}
          onChange={(next) => onChange({ ...node, next })}
        />
      )}
    </section>
  );
}
