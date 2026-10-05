import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormInput,
  FormSelect,
  Textarea,
} from "@ngriffin_uk/polychat-component-ui";
import type {
  CreateProjectTaskInput,
  ProjectFlow,
  ProjectTask,
  ToolPermission,
} from "@ngriffin_uk/polychat-schemas";
import { ChevronDown, Plus, X } from "lucide-react";
import type { ReactNode } from "react";

import { useCreateTaskForm } from "./useCreateTaskForm";

export type CreateTaskInput = CreateProjectTaskInput;
export type CreateTaskIntent = "save" | "run";

export interface CreateTaskDialogProps {
  open: boolean;
  flow: ProjectFlow | null;
  members: { userId: number; name: string | null }[];
  teammates: { id: string; name: string }[];
  boardTasks: ProjectTask[];
  isSubmitting?: boolean;
  errorMessage?: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: CreateTaskInput, intent: CreateTaskIntent) => Promise<void>;
}

const APPROVAL_OPTIONS: { permission: ToolPermission; label: string }[] = [
  { permission: "network", label: "External network" },
  { permission: "write", label: "Write actions" },
  { permission: "sandbox", label: "Sandbox execution" },
  { permission: "orchestration", label: "Orchestration" },
];

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-foreground">{label}</p>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function CreateTaskDialog({
  open,
  flow,
  members,
  teammates,
  boardTasks,
  isSubmitting = false,
  errorMessage,
  onOpenChange,
  onSubmit,
}: CreateTaskDialogProps) {
  const {
    draft,
    updateDraft,
    addCriterion,
    updateCriterion,
    removeCriterion,
    handleSubmit,
    submissionError,
    isPending,
  } = useCreateTaskForm({ flow, onSubmit, isSubmitting });
  const {
    objective,
    criteria,
    expectedOutput,
    contextNotes,
    assignee,
    nodeId,
    teammateId,
    showAdvanced,
    constraintNotes,
    dependsOn,
    requireApprovalFor,
    tokenBudget,
  } = draft;
  const displayedError = submissionError ?? errorMessage;

  const activeTasks = boardTasks.filter(
    (task) => task.status !== "done" && task.status !== "cancelled",
  );

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !isPending && onOpenChange(nextOpen)}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5">
          <DialogHeader>
            <DialogTitle>Add work to the teammate queue</DialogTitle>
            <DialogDescription>
              Define the outcome, choose its pipeline entry point, then save it or start the run.
            </DialogDescription>
          </DialogHeader>

          <FormInput
            label="Objective"
            value={objective}
            onChange={(event) => updateDraft({ objective: event.target.value })}
            placeholder="Draft and validate the launch note for the pricing change"
            required
          />

          <Field
            label="Acceptance criteria"
            hint="The teammate uses these to decide when its goal is complete."
          >
            <div className="space-y-2">
              {criteria.map((criterion, index) => (
                <div key={criterion.id} className="flex items-center gap-2">
                  <FormInput
                    aria-label={`Acceptance criterion ${index + 1}`}
                    value={criterion.text}
                    onChange={(event) => updateCriterion(criterion.id, event.target.value)}
                    placeholder="The final copy states the effective date"
                    className="flex-1"
                  />
                  {criteria.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove acceptance criterion ${index + 1}`}
                      onClick={() => removeCriterion(criterion.id)}
                    >
                      <X size={16} />
                    </Button>
                  ) : null}
                </div>
              ))}
              <Button type="button" variant="ghost" size="sm" onClick={addCriterion}>
                <Plus size={14} /> Add criterion
              </Button>
            </div>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            {flow ? (
              <FormSelect
                label="Start at step"
                value={nodeId}
                options={flow.nodes.map((stage) => ({ value: stage.id, label: stage.name }))}
                onValueChange={(value) => updateDraft({ nodeId: value })}
              />
            ) : (
              <FormSelect
                label="Teammate"
                value={teammateId}
                placeholder="Choose a teammate"
                options={teammates.map((teammate) => ({
                  value: teammate.id,
                  label: teammate.name,
                }))}
                onValueChange={(value) => updateDraft({ teammateId: value })}
              />
            )}
            <FormSelect
              label="Owner"
              value={assignee}
              options={[
                { value: "", label: "Unassigned" },
                ...members.map((member) => ({
                  value: String(member.userId),
                  label: member.name || `Member ${member.userId}`,
                })),
              ]}
              onValueChange={(value) => updateDraft({ assignee: value })}
            />
          </div>

          <Field label="Expected output">
            <Textarea
              aria-label="Expected output"
              value={expectedOutput}
              onChange={(event) => updateDraft({ expectedOutput: event.target.value })}
              placeholder="A reviewed launch note ready to publish"
              rows={2}
            />
          </Field>

          <Field label="Working context">
            <Textarea
              aria-label="Working context"
              value={contextNotes}
              onChange={(event) => updateDraft({ contextNotes: event.target.value })}
              placeholder="Relevant facts, decisions, source links, or boundaries"
              rows={3}
            />
          </Field>

          <button
            type="button"
            className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
            onClick={() => updateDraft({ showAdvanced: !showAdvanced })}
            aria-expanded={showAdvanced}
          >
            <ChevronDown
              size={15}
              className={showAdvanced ? "rotate-180 transition-transform" : "transition-transform"}
            />
            Run controls
          </button>

          {showAdvanced ? (
            <div className="space-y-4 rounded-xl border border-border bg-surface-elevated/70 p-4">
              <Field label="Additional approval gates">
                <div className="flex flex-wrap gap-2">
                  {APPROVAL_OPTIONS.map(({ permission, label }) => (
                    <label
                      key={permission}
                      htmlFor={`task-approval-${permission}`}
                      className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs"
                    >
                      <Checkbox
                        id={`task-approval-${permission}`}
                        checked={requireApprovalFor.includes(permission)}
                        onCheckedChange={(checked) =>
                          updateDraft({
                            requireApprovalFor:
                              checked === true
                                ? [...requireApprovalFor, permission]
                                : requireApprovalFor.filter((value) => value !== permission),
                          })
                        }
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </Field>

              {activeTasks.length ? (
                <Field label="Wait for tasks">
                  <div className="max-h-36 space-y-1 overflow-y-auto">
                    {activeTasks.map((task) => (
                      <label
                        key={task.id}
                        htmlFor={`task-depends-${task.id}`}
                        className="flex items-start gap-2 py-1 text-sm"
                      >
                        <Checkbox
                          id={`task-depends-${task.id}`}
                          className="mt-1"
                          checked={dependsOn.includes(task.id)}
                          onCheckedChange={(checked) =>
                            updateDraft({
                              dependsOn:
                                checked === true
                                  ? [...dependsOn, task.id]
                                  : dependsOn.filter((id) => id !== task.id),
                            })
                          }
                        />
                        <span className="line-clamp-2">{task.objective}</span>
                      </label>
                    ))}
                  </div>
                </Field>
              ) : null}

              <Field label="Constraints">
                <Textarea
                  aria-label="Constraints"
                  value={constraintNotes}
                  onChange={(event) => updateDraft({ constraintNotes: event.target.value })}
                  placeholder="Do not publish or contact anyone"
                  rows={2}
                />
              </Field>

              <FormInput
                label="Token budget"
                type="number"
                min={1}
                max={10_000_000}
                value={tokenBudget}
                onChange={(event) => updateDraft({ tokenBudget: event.target.value })}
                placeholder="Use the project default"
              />
            </div>
          ) : null}

          {displayedError ? (
            <p role="alert" className="text-sm text-failure">
              {displayedError}
            </p>
          ) : null}

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <div className="flex gap-2">
              <Button
                type="submit"
                value="save"
                variant="outline"
                disabled={isPending || !objective.trim()}
              >
                Save to backlog
              </Button>
              <Button type="submit" value="run" disabled={isPending || !objective.trim()}>
                {isPending ? "Adding…" : "Add and run"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
