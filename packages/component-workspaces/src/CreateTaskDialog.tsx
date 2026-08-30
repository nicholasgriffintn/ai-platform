import {
  Button,
  cn,
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
import {
  inferDeliverableKind,
  PROJECT_TASK_DEFAULT_CONSEQUENCES,
  projectTaskCapabilityLabels,
  projectTaskCapabilitySchema,
  projectTaskConsequenceLabels,
  projectTaskConsequenceSchema,
  projectTaskDeliverableKindSchema,
  projectTaskEffortLabels,
  projectTaskEffortSchema,
  projectTaskPrioritySchema,
  type ProjectFlow,
  type ProjectTask,
  type ProjectTaskCapability,
  type ProjectTaskConsequence,
  type ProjectTaskDeliverableKind,
  type ProjectTaskEffort,
  type ProjectTaskPriority,
} from "@ngriffin_uk/polychat-schemas";
import { ChevronDown, Plus, X } from "lucide-react";
import { type FormEvent, type ReactNode, useMemo, useState } from "react";

export interface CreateTaskInput {
  objective: string;
  acceptanceCriteria: { text: string }[];
  deliverable: {
    kind: ProjectTaskDeliverableKind;
    description: string | null;
  } | null;
  context: { links: { url: string; label: string | null }[]; notes: string | null } | null;
  constraints: { forbiddenTools: string[]; notes: string | null } | null;
  dependsOnTaskIds: string[];
  capabilities: ProjectTaskCapability[];
  approvalConsequences: ProjectTaskConsequence[];
  effort: ProjectTaskEffort;
  priority: ProjectTaskPriority;
  dueAt: string | null;
  assigneeUserId: number | null;
  runner: {
    kind: "conversation";
    agentId: string | null;
    model: null;
    mode: null;
  } | null;
  stageId: string | null;
}

export interface ProjectTaskDefaults {
  capabilities: ProjectTaskCapability[];
  agentId: string | null;
  effort: ProjectTaskEffort;
}

export interface CreateTaskDialogProps {
  open: boolean;
  flow: ProjectFlow | null;
  members: { userId: number; name: string | null }[];
  agents: { id: string; name: string }[];
  boardTasks: ProjectTask[];
  defaults: ProjectTaskDefaults;
  isSubmitting?: boolean;
  errorMessage?: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: CreateTaskInput) => Promise<void>;
}

const DELIVERABLE_LABELS: Record<ProjectTaskDeliverableKind, string> = {
  pull_request: "Pull request",
  document: "Document",
  analysis: "Analysis",
  message: "Message",
  data: "Data",
  other: "Something else",
};

const PRIORITY_LABELS: Record<ProjectTaskPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
};

const CONTEXT_MIN_ROWS = 3;
const CONTEXT_MAX_ROWS = 14;

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</p>
      {children}
      {hint && <p className="text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}

function ToggleChip({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: () => void;
  children: ReactNode;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
        checked
          ? "border-blue-500 bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200"
          : "border-zinc-200 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300",
      )}
    >
      <input type="checkbox" className="sr-only" checked={checked} onChange={onChange} />
      {children}
    </label>
  );
}

export function CreateTaskDialog({
  open,
  flow,
  members,
  agents,
  boardTasks,
  defaults,
  isSubmitting = false,
  errorMessage,
  onOpenChange,
  onSubmit,
}: CreateTaskDialogProps) {
  const [objective, setObjective] = useState("");
  const [criteria, setCriteria] = useState<string[]>([""]);
  const [contextNotes, setContextNotes] = useState("");
  const [assignee, setAssignee] = useState("");
  const [priority, setPriority] = useState<ProjectTaskPriority>("normal");

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [deliverableOverride, setDeliverableOverride] = useState("");
  const [agentId, setAgentId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [constraintNotes, setConstraintNotes] = useState("");
  const [capabilityOverride, setCapabilityOverride] = useState<ProjectTaskCapability[] | null>(
    null,
  );
  const [consequenceOverride, setConsequenceOverride] = useState<ProjectTaskConsequence[] | null>(
    null,
  );
  const [effortOverride, setEffortOverride] = useState<ProjectTaskEffort | null>(null);
  const [dependsOn, setDependsOn] = useState<string[]>([]);
  const [stageId, setStageId] = useState("");

  const inferredDeliverable = useMemo(() => inferDeliverableKind(objective), [objective]);
  const deliverableKind = deliverableOverride || inferredDeliverable;
  const capabilities = capabilityOverride ?? defaults.capabilities;
  const effort = effortOverride ?? defaults.effort;
  const consequences = consequenceOverride ?? [...PROJECT_TASK_DEFAULT_CONSEQUENCES];
  const resolvedAgentId = agentId || defaults.agentId || "";

  const reset = () => {
    setObjective("");
    setCriteria([""]);
    setContextNotes("");
    setAssignee("");
    setPriority("normal");
    setShowAdvanced(false);
    setDeliverableOverride("");
    setAgentId("");
    setDueAt("");
    setConstraintNotes("");
    setCapabilityOverride(null);
    setConsequenceOverride(null);
    setEffortOverride(null);
    setDependsOn([]);
    setStageId("");
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    await onSubmit({
      objective: objective.trim(),
      acceptanceCriteria: criteria
        .map((text) => text.trim())
        .filter(Boolean)
        .map((text) => ({ text })),
      deliverable: deliverableKind
        ? {
            kind: deliverableKind as ProjectTaskDeliverableKind,
            description: null,
          }
        : null,
      context: contextNotes.trim().length > 0 ? { links: [], notes: contextNotes.trim() } : null,
      constraints:
        constraintNotes.trim().length > 0
          ? { forbiddenTools: [], notes: constraintNotes.trim() }
          : null,
      dependsOnTaskIds: dependsOn,
      capabilities,
      approvalConsequences: consequences,
      effort,
      priority,
      dueAt: dueAt ? new Date(dueAt).toISOString() : null,
      assigneeUserId: assignee ? Number(assignee) : null,
      runner: resolvedAgentId
        ? {
            kind: "conversation",
            agentId: resolvedAgentId,
            model: null,
            mode: null,
          }
        : null,
      stageId: stageId || null,
    });
    reset();
  };

  const contextRows = Math.min(
    CONTEXT_MAX_ROWS,
    Math.max(CONTEXT_MIN_ROWS, contextNotes.split("\n").length + 1),
  );
  const linkableTasks = boardTasks.filter(
    (task) => task.status !== "cancelled" && task.status !== "done",
  );
  const capabilitySummary =
    capabilities.length > 0
      ? capabilities
          .map((capability) => projectTaskCapabilityLabels[capability].toLowerCase())
          .join(", ")
      : "no external capabilities";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>Add a task</DialogTitle>
            <DialogDescription>
              Say what you want and how you would know it is done. Nothing runs until you say so.
            </DialogDescription>
          </DialogHeader>

          <FormInput
            label="Objective"
            value={objective}
            onChange={(event) => setObjective(event.target.value)}
            placeholder="Draft the launch note for the pricing change"
            required
          />

          <Field label="Context" hint="Background the assistant should read first.">
            <Textarea
              aria-label="Context"
              value={contextNotes}
              onChange={(event) => setContextNotes(event.target.value)}
              placeholder="Links, prior decisions, anything it should not have to guess"
              rows={contextRows}
            />
          </Field>

          <Field label="Done when">
            <div className="space-y-2">
              {criteria.map((criterion, index) => (
                <div key={index} className="flex items-center gap-2">
                  <FormInput
                    aria-label={`Acceptance criterion ${index + 1}`}
                    value={criterion}
                    onChange={(event) =>
                      setCriteria((current) =>
                        current.map((entry, position) =>
                          position === index ? event.target.value : entry,
                        ),
                      )
                    }
                    placeholder="A checkable statement, not a feeling"
                  />
                  {criteria.length > 1 && (
                    <Button
                      type="button"
                      variant="icon"
                      aria-label={`Remove criterion ${index + 1}`}
                      onClick={() =>
                        setCriteria((current) =>
                          current.filter((_, position) => position !== index),
                        )
                      }
                    >
                      <X size={14} />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setCriteria((current) => [...current, ""])}
              >
                <Plus size={14} /> Add criterion
              </Button>
            </div>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormSelect
              label="Owner"
              value={assignee}
              onChange={(event) => setAssignee(event.target.value)}
              options={[
                { value: "", label: "Nobody yet" },
                ...members.map((member) => ({
                  value: String(member.userId),
                  label: member.name ?? `Member ${member.userId}`,
                })),
              ]}
            />
            <FormSelect
              label="Priority"
              value={priority}
              onChange={(event) => setPriority(event.target.value as ProjectTaskPriority)}
              options={projectTaskPrioritySchema.options.map((value) => ({
                value,
                label: PRIORITY_LABELS[value],
              }))}
            />
          </div>

          <div className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              aria-expanded={showAdvanced}
              onClick={() => setShowAdvanced((current) => !current)}
            >
              <ChevronDown
                size={14}
                className={cn("transition-transform", showAdvanced && "rotate-180")}
              />
              Advanced controls
            </Button>
            {!showAdvanced && (
              <p className="mt-2 text-xs text-zinc-500">
                Project defaults: {projectTaskEffortLabels[effort].toLowerCase()} effort,{" "}
                {capabilitySummary}, asking before {consequences.length} kinds of consequence
                {deliverableKind
                  ? `, expecting a ${DELIVERABLE_LABELS[
                      deliverableKind as ProjectTaskDeliverableKind
                    ].toLowerCase()}`
                  : ""}
                .
              </p>
            )}
          </div>

          {showAdvanced && (
            <div className="space-y-5">
              <Field
                label="Expected artifact"
                hint="Inferred from the objective; override if it guessed wrong."
              >
                <FormSelect
                  aria-label="Expected artifact"
                  value={deliverableKind}
                  onChange={(event) => setDeliverableOverride(event.target.value)}
                  options={[
                    { value: "", label: "Not specified" },
                    ...projectTaskDeliverableKindSchema.options.map((kind) => ({
                      value: kind,
                      label: DELIVERABLE_LABELS[kind],
                    })),
                  ]}
                />
              </Field>

              <Field
                label="Executing agent"
                hint={
                  agents.length === 0
                    ? "Attach an agent to this project to run tasks with a persona."
                    : "Which persona does the work."
                }
              >
                <FormSelect
                  aria-label="Executing agent"
                  value={resolvedAgentId}
                  onChange={(event) => setAgentId(event.target.value)}
                  options={[
                    { value: "", label: "Project default" },
                    ...agents.map((agent) => ({
                      value: agent.id,
                      label: agent.name,
                    })),
                  ]}
                />
              </Field>

              <Field label="What it may do" hint="Anything unticked is withheld from the run.">
                <div className="flex flex-wrap gap-2">
                  {projectTaskCapabilitySchema.options.map((capability) => (
                    <ToggleChip
                      key={capability}
                      checked={capabilities.includes(capability)}
                      onChange={() =>
                        setCapabilityOverride(
                          capabilities.includes(capability)
                            ? capabilities.filter((entry) => entry !== capability)
                            : [...capabilities, capability],
                        )
                      }
                    >
                      {projectTaskCapabilityLabels[capability]}
                    </ToggleChip>
                  ))}
                </div>
              </Field>

              <Field label="Ask me before it" hint="These stop the run and wait for you.">
                <div className="flex flex-wrap gap-2">
                  {projectTaskConsequenceSchema.options.map((consequence) => (
                    <ToggleChip
                      key={consequence}
                      checked={consequences.includes(consequence)}
                      onChange={() =>
                        setConsequenceOverride(
                          consequences.includes(consequence)
                            ? consequences.filter((entry) => entry !== consequence)
                            : [...consequences, consequence],
                        )
                      }
                    >
                      {projectTaskConsequenceLabels[consequence]}
                    </ToggleChip>
                  ))}
                </div>
              </Field>

              <Field label="Resource budget">
                <FormSelect
                  aria-label="Resource budget"
                  value={effort}
                  onChange={(event) => setEffortOverride(event.target.value as ProjectTaskEffort)}
                  options={projectTaskEffortSchema.options.map((value) => ({
                    value,
                    label: projectTaskEffortLabels[value],
                  }))}
                />
              </Field>

              {linkableTasks.length > 0 && (
                <Field label="Blocked by" hint="This will not start until these are done.">
                  <div className="space-y-1.5">
                    {linkableTasks.map((task) => (
                      <label key={task.id} className="flex items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={dependsOn.includes(task.id)}
                          onChange={() =>
                            setDependsOn((current) =>
                              current.includes(task.id)
                                ? current.filter((entry) => entry !== task.id)
                                : [...current, task.id],
                            )
                          }
                        />
                        <span className="min-w-0 flex-1 truncate">{task.objective}</span>
                      </label>
                    ))}
                  </div>
                </Field>
              )}

              <Field label="Constraints">
                <Textarea
                  aria-label="Constraints"
                  value={constraintNotes}
                  onChange={(event) => setConstraintNotes(event.target.value)}
                  placeholder="Scope, style, anything it must not do"
                  rows={2}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormInput
                  label="Due"
                  type="datetime-local"
                  value={dueAt}
                  onChange={(event) => setDueAt(event.target.value)}
                />
                {flow && flow.stages.length > 0 && (
                  <FormSelect
                    label="Stage"
                    value={stageId}
                    onChange={(event) => setStageId(event.target.value)}
                    options={flow.stages.map((stage) => ({
                      value: stage.id,
                      label: stage.name,
                    }))}
                  />
                )}
              </div>
            </div>
          )}

          {errorMessage && <p className="text-sm text-red-700">{errorMessage}</p>}

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting || objective.trim().length === 0}
              isLoading={isSubmitting}
            >
              Add task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
