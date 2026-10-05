import {
  Button,
  ButtonLink,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormInput,
  FormSelect,
} from "@ngriffin_uk/polychat-component-ui";
import {
  PROJECT_FLOW_MAX_NODES,
  PROJECT_WORKFLOWS,
  platformTeammateCategoryLabels,
  type ProjectFlow,
  type ProjectFlowNode,
  type ProjectFlowResponse,
} from "@ngriffin_uk/polychat-schemas";
import { useRef, useState } from "react";

import { FlowNextStep } from "./flow-editor/FlowNextStep";
import { FlowNodeEditor } from "./flow-editor/FlowNodeEditor";
import { FlowRecordTriggers } from "./flow-editor/FlowRecordTriggers";
import type { FlowEditorResources } from "./flow-editor/types";
import { useFlowEditor } from "./flow-editor/useFlowEditor";
import { FLOW_NODE_LABELS, flowNodeConnections } from "./flow-node-presentation";

export type { FlowRecordTableOption, FlowRecordTableDefinition } from "./flow-editor/types";

export interface FlowEditorDialogProps extends FlowEditorResources {
  open: boolean;
  flow: ProjectFlow | null;
  triggerStates: ProjectFlowResponse["triggerStates"];
  capabilitiesHref: string;
  createTeammateHref: string;
  hasMoreTables?: boolean;
  isLoadingTables?: boolean;
  onLoadMoreTables?: () => void;
  resourcesError?: string;
  isSaving?: boolean;
  errorMessage?: string;
  onOpenChange: (open: boolean) => void;
  onSave: (flow: ProjectFlow) => Promise<void>;
}

const NODE_TYPES: { value: ProjectFlowNode["type"]; label: string }[] = [
  { value: "agent", label: FLOW_NODE_LABELS.agent },
  { value: "function", label: FLOW_NODE_LABELS.function },
  { value: "decision", label: FLOW_NODE_LABELS.decision },
  { value: "loop", label: FLOW_NODE_LABELS.loop },
  { value: "human_wait", label: FLOW_NODE_LABELS.human_wait },
  { value: "timer", label: FLOW_NODE_LABELS.timer },
  { value: "end", label: FLOW_NODE_LABELS.end },
];

const WORKFLOWS = [
  { value: "", label: "Choose a starting point…" },
  { value: "__suggested", label: "Research → plan → build → review" },
  ...PROJECT_WORKFLOWS.map((workflow) => ({
    value: workflow.slug,
    label: `${platformTeammateCategoryLabels[workflow.category]} · ${workflow.name}`,
  })),
];

export function FlowEditorDialog(props: FlowEditorDialogProps) {
  const editor = useFlowEditor(props);
  const [newType, setNewType] = useState<ProjectFlowNode["type"]>("agent");
  const titleRef = useRef<HTMLHeadingElement>(null);
  const saving = Boolean(props.isSaving || editor.saving);
  const { draft } = editor;

  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => {
        if (!saving) {
          props.onOpenChange(open);
        }
      }}
    >
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-4xl"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          titleRef.current?.focus();
        }}
      >
        <form className="space-y-5" onSubmit={(event) => void editor.submit(event)}>
          <DialogHeader>
            <DialogTitle ref={titleRef} tabIndex={-1} className="outline-none">
              Configure the project flow
            </DialogTitle>
            <DialogDescription>
              Connect teammates, decisions, record actions and reviews. Each task keeps the flow it
              starts with.
            </DialogDescription>
          </DialogHeader>
          <fieldset disabled={saving} className="space-y-5">
            <div className="space-y-3 rounded-lg border border-border bg-surface-elevated p-4">
              <FormSelect
                label="Start from a workflow"
                description="Applying a starting point replaces this draft."
                value={editor.workflow}
                options={WORKFLOWS}
                onValueChange={editor.applyWorkflow}
              />
              <div className="flex flex-wrap gap-2">
                <ButtonLink href={props.createTeammateHref} variant="outline" size="sm">
                  New teammate
                </ButtonLink>
                <ButtonLink href={props.capabilitiesHref} variant="outline" size="sm">
                  Manage capabilities
                </ButtonLink>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <FlowNextStep
                label="Start tasks at"
                nodes={draft.nodes}
                value={draft.entryNodeId}
                onChange={(entryNodeId) =>
                  editor.setDraft((current) => ({ ...current, entryNodeId }))
                }
              />
              <FormInput
                label="Maximum steps per task"
                description="Includes branches, repeats, reviews and actions."
                type="number"
                min={1}
                max={1000}
                required
                value={draft.maxSteps}
                onChange={(event) => {
                  const maxSteps = event.currentTarget.valueAsNumber;

                  editor.setDraft((current) => ({ ...current, maxSteps }));
                }}
              />
            </div>
            {draft.nodes.map((node) => (
              <FlowNodeEditor
                key={node.id}
                node={node}
                nodes={draft.nodes}
                resources={props}
                canRemove={
                  draft.nodes.length > 1 &&
                  node.id !== draft.entryNodeId &&
                  !draft.nodes.some(
                    (other) =>
                      other.id !== node.id &&
                      flowNodeConnections(other).some((edge) => edge.target === node.id),
                  ) &&
                  !draft.recordTriggers.some((trigger) => trigger.entryNodeId === node.id)
                }
                onChange={editor.replaceNode}
                onRemove={() => editor.removeNode(node.id)}
              />
            ))}
            <div className="flex items-end gap-3">
              <FormSelect
                label="Add a step"
                value={newType}
                options={NODE_TYPES}
                onValueChange={setNewType}
              />
              <Button
                type="button"
                variant="outline"
                disabled={draft.nodes.length >= PROJECT_FLOW_MAX_NODES}
                onClick={() => editor.addNode(newType)}
              >
                Add step
              </Button>
            </div>
            <FlowRecordTriggers
              triggers={draft.recordTriggers}
              states={props.triggerStates}
              nodes={draft.nodes}
              entryNodeId={draft.entryNodeId}
              resources={props}
              onChange={(recordTriggers) =>
                editor.setDraft((current) => ({ ...current, recordTriggers }))
              }
            />
            {props.hasMoreTables && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                isLoading={props.isLoadingTables}
                onClick={props.onLoadMoreTables}
              >
                Load more project tables
              </Button>
            )}
          </fieldset>
          {props.resourcesError && (
            <p role="alert" className="text-sm text-failure">
              {props.resourcesError}
            </p>
          )}
          {!editor.validation.success && (
            <p role="alert" className="text-sm text-failure">
              {editor.validation.error.issues[0]?.message}
            </p>
          )}
          {(editor.error || props.errorMessage) && (
            <p role="alert" className="text-sm text-failure">
              {editor.error ?? props.errorMessage}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              disabled={saving}
              onClick={() => props.onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={saving} disabled={!editor.validation.success}>
              Save flow
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
