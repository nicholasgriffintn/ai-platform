import {
  Button,
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
import { type FormEvent, type ReactNode, useRef, useState } from "react";

export type CreateTaskInput = CreateProjectTaskInput;
export type CreateTaskIntent = "save" | "run";

interface CriterionDraft {
  id: number;
  text: string;
}

export interface CreateTaskDialogProps {
  open: boolean;
  flow: ProjectFlow | null;
  members: { userId: number; name: string | null }[];
  agents: { id: string; name: string }[];
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
  { permission: "delegate", label: "Delegation" },
];

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</p>
      {children}
      {hint ? <p className="text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}

export function CreateTaskDialog({
  open,
  flow,
  members,
  agents,
  boardTasks,
  isSubmitting = false,
  errorMessage,
  onOpenChange,
  onSubmit,
}: CreateTaskDialogProps) {
  const [objective, setObjective] = useState("");
  const nextCriterionId = useRef(2);
  const [criteria, setCriteria] = useState<CriterionDraft[]>([{ id: 1, text: "" }]);
  const [expectedOutput, setExpectedOutput] = useState("");
  const [contextNotes, setContextNotes] = useState("");
  const [assignee, setAssignee] = useState("");
  const [stageId, setStageId] = useState(flow?.stages[0]?.id ?? "");
  const [agentId, setAgentId] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [constraintNotes, setConstraintNotes] = useState("");
  const [dependsOn, setDependsOn] = useState<string[]>([]);
  const [requireApprovalFor, setRequireApprovalFor] = useState<ToolPermission[]>([]);
  const [tokenBudget, setTokenBudget] = useState("");

  const reset = () => {
    setObjective("");
    setCriteria([{ id: nextCriterionId.current++, text: "" }]);
    setExpectedOutput("");
    setContextNotes("");
    setAssignee("");
    setStageId(flow?.stages[0]?.id ?? "");
    setAgentId("");
    setShowAdvanced(false);
    setConstraintNotes("");
    setDependsOn([]);
    setRequireApprovalFor([]);
    setTokenBudget("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = event.nativeEvent instanceof SubmitEvent ? event.nativeEvent.submitter : null;
    const intent =
      submitter instanceof HTMLButtonElement && submitter.value === "run" ? "run" : "save";

    await onSubmit(
      {
        objective: objective.trim(),
        acceptanceCriteria: criteria
          .map((criterion) => criterion.text.trim())
          .filter(Boolean)
          .map((text) => ({ text })),
        expectedOutput: expectedOutput.trim() || null,
        context: contextNotes.trim() ? { links: [], notes: contextNotes.trim() } : null,
        constraints: constraintNotes.trim()
          ? { forbiddenTools: [], notes: constraintNotes.trim() }
          : null,
        dependsOnTaskIds: dependsOn,
        requireApprovalFor,
        assigneeUserId: assignee ? Number(assignee) : null,
        runner:
          !stageId && agentId ? { kind: "conversation", agentId, model: null, mode: null } : null,
        stageId: stageId || null,
        tokenBudget: tokenBudget ? Number(tokenBudget) : null,
      },
      intent,
    );
    reset();
  };

  const activeTasks = boardTasks.filter(
    (task) => task.status !== "done" && task.status !== "cancelled",
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5">
          <DialogHeader>
            <DialogTitle>Add work to the agent queue</DialogTitle>
            <DialogDescription>
              Define the outcome, choose its pipeline entry point, then save it or start the run.
            </DialogDescription>
          </DialogHeader>

          <FormInput
            label="Objective"
            value={objective}
            onChange={(event) => setObjective(event.target.value)}
            placeholder="Draft and validate the launch note for the pricing change"
            required
          />

          <Field
            label="Acceptance criteria"
            hint="The agent uses these to decide when its goal is complete."
          >
            <div className="space-y-2">
              {criteria.map((criterion, index) => (
                <div key={criterion.id} className="flex items-center gap-2">
                  <FormInput
                    aria-label={`Acceptance criterion ${index + 1}`}
                    value={criterion.text}
                    onChange={(event) =>
                      setCriteria((current) =>
                        current.map((value) =>
                          value.id === criterion.id
                            ? { ...value, text: event.target.value }
                            : value,
                        ),
                      )
                    }
                    placeholder="The final copy states the effective date"
                    className="flex-1"
                  />
                  {criteria.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove acceptance criterion ${index + 1}`}
                      onClick={() =>
                        setCriteria((current) => current.filter((item) => item.id !== criterion.id))
                      }
                    >
                      <X size={16} />
                    </Button>
                  ) : null}
                </div>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setCriteria((current) => [
                    ...current,
                    { id: nextCriterionId.current++, text: "" },
                  ])
                }
              >
                <Plus size={14} /> Add criterion
              </Button>
            </div>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            {flow ? (
              <FormSelect
                label="Start at stage"
                value={stageId}
                onChange={(event) => setStageId(event.target.value)}
              >
                {flow.stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
              </FormSelect>
            ) : (
              <FormSelect
                label="Agent"
                value={agentId}
                onChange={(event) => setAgentId(event.target.value)}
                required
              >
                <option value="">Choose an agent</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </FormSelect>
            )}
            <FormSelect
              label="Owner"
              value={assignee}
              onChange={(event) => setAssignee(event.target.value)}
            >
              <option value="">Unassigned</option>
              {members.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.name || `Member ${member.userId}`}
                </option>
              ))}
            </FormSelect>
          </div>

          <Field label="Expected output">
            <Textarea
              aria-label="Expected output"
              value={expectedOutput}
              onChange={(event) => setExpectedOutput(event.target.value)}
              placeholder="A reviewed launch note ready to publish"
              rows={2}
            />
          </Field>

          <Field label="Working context">
            <Textarea
              aria-label="Working context"
              value={contextNotes}
              onChange={(event) => setContextNotes(event.target.value)}
              placeholder="Relevant facts, decisions, source links, or boundaries"
              rows={3}
            />
          </Field>

          <button
            type="button"
            className="flex items-center gap-1 text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            onClick={() => setShowAdvanced((current) => !current)}
            aria-expanded={showAdvanced}
          >
            <ChevronDown
              size={15}
              className={showAdvanced ? "rotate-180 transition-transform" : "transition-transform"}
            />
            Run controls
          </button>

          {showAdvanced ? (
            <div className="space-y-4 rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
              <Field label="Additional approval gates">
                <div className="flex flex-wrap gap-2">
                  {APPROVAL_OPTIONS.map(({ permission, label }) => (
                    <label
                      key={permission}
                      className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-950"
                    >
                      <input
                        type="checkbox"
                        checked={requireApprovalFor.includes(permission)}
                        onChange={(event) =>
                          setRequireApprovalFor((current) =>
                            event.target.checked
                              ? [...current, permission]
                              : current.filter((value) => value !== permission),
                          )
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
                      <label key={task.id} className="flex items-start gap-2 py-1 text-sm">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={dependsOn.includes(task.id)}
                          onChange={(event) =>
                            setDependsOn((current) =>
                              event.target.checked
                                ? [...current, task.id]
                                : current.filter((id) => id !== task.id),
                            )
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
                  onChange={(event) => setConstraintNotes(event.target.value)}
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
                onChange={(event) => setTokenBudget(event.target.value)}
                placeholder="Use the project default"
              />
            </div>
          ) : null}

          {errorMessage ? (
            <p role="alert" className="text-sm text-red-600">
              {errorMessage}
            </p>
          ) : null}

          <DialogFooter className="gap-2 sm:justify-between">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <div className="flex gap-2">
              <Button type="submit" value="save" variant="outline" disabled={isSubmitting}>
                Save to backlog
              </Button>
              <Button type="submit" value="run" disabled={isSubmitting}>
                {isSubmitting ? "Adding…" : "Add and run"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
