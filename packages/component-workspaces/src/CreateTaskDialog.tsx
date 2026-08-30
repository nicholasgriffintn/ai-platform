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
import {
  projectTaskDeliverableKindSchema,
  projectTaskPrioritySchema,
  TOOL_PERMISSIONS,
  type ProjectFlow,
  type ProjectTask,
  type ProjectTaskDeliverableKind,
  type ProjectTaskPriority,
  type ToolPermission,
} from "@ngriffin_uk/polychat-schemas";
import { Plus, X } from "lucide-react";
import { type FormEvent, useState } from "react";

export interface CreateTaskInput {
  objective: string;
  acceptanceCriteria: { text: string }[];
  deliverable: {
    kind: ProjectTaskDeliverableKind;
    description: string | null;
  } | null;
  context: {
    sourceIds: string[];
    links: { url: string; label: string | null }[];
    notes: string | null;
  } | null;
  constraints: { forbiddenTools: string[]; notes: string | null } | null;
  dependsOnTaskIds: string[];
  requireApprovalFor: ToolPermission[];
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
  tokenBudget: number | null;
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
      <legend className="sr-only">{title}</legend>
      <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">{title}</p>
      {children}
    </fieldset>
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
  const [criteria, setCriteria] = useState<string[]>([""]);
  const [deliverableKind, setDeliverableKind] = useState("");
  const [deliverableDescription, setDeliverableDescription] = useState("");
  const [contextNotes, setContextNotes] = useState("");
  const [constraintNotes, setConstraintNotes] = useState("");
  const [forbiddenTools, setForbiddenTools] = useState("");
  const [dependsOn, setDependsOn] = useState<string[]>([]);
  const [approvalFor, setApprovalFor] = useState<ToolPermission[]>([]);
  const [priority, setPriority] = useState<ProjectTaskPriority>("normal");
  const [dueAt, setDueAt] = useState("");
  const [assignee, setAssignee] = useState("");
  const [agentId, setAgentId] = useState("");
  const [stageId, setStageId] = useState("");
  const [tokenBudget, setTokenBudget] = useState("");

  const reset = () => {
    setObjective("");
    setCriteria([""]);
    setDeliverableKind("");
    setDeliverableDescription("");
    setContextNotes("");
    setConstraintNotes("");
    setForbiddenTools("");
    setDependsOn([]);
    setApprovalFor([]);
    setPriority("normal");
    setDueAt("");
    setAssignee("");
    setAgentId("");
    setStageId("");
    setTokenBudget("");
  };

  const filledCriteria = criteria.map((text) => text.trim()).filter(Boolean);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const forbidden = forbiddenTools
      .split(",")
      .map((tool) => tool.trim())
      .filter(Boolean);

    await onSubmit({
      objective: objective.trim(),
      acceptanceCriteria: filledCriteria.map((text) => ({ text })),
      deliverable: deliverableKind
        ? {
            kind: deliverableKind as ProjectTaskDeliverableKind,
            description: deliverableDescription.trim() || null,
          }
        : null,
      context:
        contextNotes.trim().length > 0
          ? { sourceIds: [], links: [], notes: contextNotes.trim() }
          : null,
      constraints:
        forbidden.length > 0 || constraintNotes.trim().length > 0
          ? { forbiddenTools: forbidden, notes: constraintNotes.trim() || null }
          : null,
      dependsOnTaskIds: dependsOn,
      requireApprovalFor: approvalFor,
      priority,
      dueAt: dueAt ? new Date(dueAt).toISOString() : null,
      assigneeUserId: assignee ? Number(assignee) : null,
      runner: agentId ? { kind: "conversation", agentId, model: null, mode: null } : null,
      stageId: stageId || null,
      tokenBudget: tokenBudget ? Number(tokenBudget) : null,
    });
    reset();
  };

  const togglePermission = (permission: ToolPermission) => {
    setApprovalFor((current) =>
      current.includes(permission)
        ? current.filter((entry) => entry !== permission)
        : [...current, permission],
    );
  };

  const openTasks = boardTasks.filter((task) => task.status !== "cancelled");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>Add a task</DialogTitle>
            <DialogDescription>
              Describe the outcome and how you would know it is finished. Nothing runs until you say
              so.
            </DialogDescription>
          </DialogHeader>

          <FormInput
            label="Objective"
            value={objective}
            onChange={(event) => setObjective(event.target.value)}
            placeholder="Draft the launch note for the pricing change"
            required
          />

          <Section title="Done when">
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
          </Section>

          <Section title="Deliverable">
            <FormSelect
              label="Expected artifact"
              value={deliverableKind}
              onChange={(event) => setDeliverableKind(event.target.value)}
              options={[
                { value: "", label: "Not specified" },
                ...projectTaskDeliverableKindSchema.options.map((kind) => ({
                  value: kind,
                  label: DELIVERABLE_LABELS[kind],
                })),
              ]}
            />
            {deliverableKind && (
              <FormInput
                label="Description"
                value={deliverableDescription}
                onChange={(event) => setDeliverableDescription(event.target.value)}
                placeholder="What should it contain?"
              />
            )}
          </Section>

          <Section title="Context">
            <Textarea
              aria-label="Context notes"
              value={contextNotes}
              onChange={(event) => setContextNotes(event.target.value)}
              placeholder="Background, links, prior decisions the assistant should read first"
              rows={3}
            />
          </Section>

          <Section title="Who works it">
            {members.length > 0 && (
              <FormSelect
                label="Assignee"
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
            )}
            <FormSelect
              label="Agent"
              description={
                agents.length === 0
                  ? "Attach an agent to this project to run tasks with a persona."
                  : undefined
              }
              value={agentId}
              onChange={(event) => setAgentId(event.target.value)}
              options={[
                { value: "", label: "Project default" },
                ...agents.map((agent) => ({
                  value: agent.id,
                  label: agent.name,
                })),
              ]}
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
          </Section>

          <Section title="Constraints and limits">
            <FormInput
              label="Tools it must not use"
              description="Comma separated. These are withheld from the run, not just discouraged."
              value={forbiddenTools}
              onChange={(event) => setForbiddenTools(event.target.value)}
              placeholder="run_sandbox_task, create_speech"
            />
            <FormInput
              label="Token budget"
              type="number"
              min={1000}
              value={tokenBudget}
              onChange={(event) => setTokenBudget(event.target.value)}
              placeholder="400000"
            />
            <Textarea
              aria-label="Constraint notes"
              value={constraintNotes}
              onChange={(event) => setConstraintNotes(event.target.value)}
              placeholder="Scope, style, anything it must not do"
              rows={2}
            />
          </Section>

          <Section title="Needs your approval for">
            <div className="flex flex-wrap gap-2">
              {TOOL_PERMISSIONS.map((permission) => (
                <label
                  key={permission}
                  className="flex cursor-pointer items-center gap-1.5 rounded-full border border-zinc-200 px-2.5 py-1 text-xs dark:border-zinc-700"
                >
                  <input
                    type="checkbox"
                    checked={approvalFor.includes(permission)}
                    onChange={() => togglePermission(permission)}
                  />
                  {permission}
                </label>
              ))}
            </div>
          </Section>

          <Section title="Scheduling">
            {openTasks.length > 0 && (
              <FormSelect
                label="Blocked by"
                description="This task will not start until the one you pick is done."
                value={dependsOn[0] ?? ""}
                onChange={(event) => setDependsOn(event.target.value ? [event.target.value] : [])}
                options={[
                  { value: "", label: "Nothing" },
                  ...openTasks.map((task) => ({
                    value: task.id,
                    label: task.objective,
                  })),
                ]}
              />
            )}
            <FormSelect
              label="Priority"
              value={priority}
              onChange={(event) => setPriority(event.target.value as ProjectTaskPriority)}
              options={projectTaskPrioritySchema.options.map((value) => ({
                value,
                label: PRIORITY_LABELS[value],
              }))}
            />
            <FormInput
              label="Due"
              type="datetime-local"
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
            />
          </Section>

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
