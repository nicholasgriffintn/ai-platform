import { Checkbox, FormInput, FormSelect, Textarea } from "@ngriffin_uk/polychat-component-ui";
import {
  agentModeSchema,
  type ProjectFlowAgentNode,
  type ToolPermission,
} from "@ngriffin_uk/polychat-schemas";

import type { FlowEditorResources } from "./types";

const APPROVAL_OPTIONS: { permission: ToolPermission; label: string }[] = [
  { permission: "network", label: "Network" },
  { permission: "write", label: "Write" },
  { permission: "sandbox", label: "Sandbox" },
  { permission: "orchestration", label: "Orchestration" },
];

export function FlowAgentEditor({
  node,
  resources,
  onChange,
}: {
  node: ProjectFlowAgentNode;
  resources: FlowEditorResources;
  onChange: (node: ProjectFlowAgentNode) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <FormSelect
          label="Teammate"
          value={node.teammateId ?? ""}
          options={[
            { value: "", label: "Project default" },
            ...resources.teammates.map((item) => ({ value: item.id, label: item.name })),
          ]}
          onValueChange={(value) => onChange({ ...node, teammateId: value || null })}
        />
        <FormSelect
          label="Operating mode"
          value={node.mode ?? ""}
          options={[
            { value: "", label: "Teammate default" },
            { value: "explore", label: "Explore" },
            { value: "plan", label: "Plan" },
            { value: "build", label: "Build" },
            { value: "chat", label: "Chat" },
          ]}
          onValueChange={(value) => {
            const parsed = agentModeSchema.safeParse(value);

            onChange({ ...node, mode: parsed.success ? parsed.data : null });
          }}
        />
      </div>
      <label className="block space-y-1 text-sm">
        Instructions
        <Textarea
          value={node.instructions ?? ""}
          maxLength={2000}
          rows={3}
          onChange={(event) =>
            onChange({ ...node, instructions: event.currentTarget.value || null })
          }
        />
      </label>
      <FormInput
        label="Save the result as a flow value"
        description="Optional name to use in later decisions or record actions."
        value={node.outputKey ?? ""}
        pattern="[a-z][a-z0-9_]{0,39}"
        onChange={(event) =>
          onChange({ ...node, outputKey: event.currentTarget.value || undefined })
        }
      />
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Attached skills</legend>
        {resources.skills.length ? (
          resources.skills.map((skill) => (
            <label key={skill.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={node.skillIds.includes(skill.id)}
                onCheckedChange={(checked) =>
                  onChange({
                    ...node,
                    skillIds:
                      checked === true
                        ? [...node.skillIds, skill.id]
                        : node.skillIds.filter((id) => id !== skill.id),
                  })
                }
              />
              {skill.name}
            </label>
          ))
        ) : (
          <p className="text-xs text-muted-foreground">
            Attach skills through project Capabilities.
          </p>
        )}
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Require tool approval before</legend>
        <div className="flex flex-wrap gap-4">
          {APPROVAL_OPTIONS.map(({ permission, label }) => (
            <label key={permission} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={node.requiresApprovalFor.includes(permission)}
                onCheckedChange={(checked) =>
                  onChange({
                    ...node,
                    requiresApprovalFor:
                      checked === true
                        ? [...node.requiresApprovalFor, permission]
                        : node.requiresApprovalFor.filter((value) => value !== permission),
                  })
                }
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
