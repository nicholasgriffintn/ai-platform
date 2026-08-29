import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  FormInput,
  FormSelect,
  Textarea,
} from "@ngriffin_uk/polychat-component-ui";
import type { ProjectFlow } from "@ngriffin_uk/polychat-schemas";
import { type FormEvent, useState } from "react";

export interface CreateTaskInput {
  objective: string;
  acceptance: string | null;
  assigneeUserId: number | null;
  stageId: string | null;
}

export interface CreateTaskDialogProps {
  open: boolean;
  flow: ProjectFlow | null;
  members: { userId: number; name: string | null }[];
  isSubmitting?: boolean;
  errorMessage?: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: CreateTaskInput) => Promise<void>;
}

export function CreateTaskDialog({
  open,
  flow,
  members,
  isSubmitting = false,
  errorMessage,
  onOpenChange,
  onSubmit,
}: CreateTaskDialogProps) {
  const [objective, setObjective] = useState("");
  const [acceptance, setAcceptance] = useState("");
  const [assignee, setAssignee] = useState("");
  const [stageId, setStageId] = useState("");

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await onSubmit({
      objective: objective.trim(),
      acceptance: acceptance.trim() || null,
      assigneeUserId: assignee ? Number(assignee) : null,
      stageId: stageId || null,
    });
    setObjective("");
    setAcceptance("");
    setAssignee("");
    setStageId("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>Add a task</DialogTitle>
            <DialogDescription>
              Tasks capture work this project needs done. Nothing runs until you say so.
            </DialogDescription>
          </DialogHeader>

          <FormInput
            label="Objective"
            value={objective}
            onChange={(event) => setObjective(event.target.value)}
            placeholder="Draft the launch note for the pricing change"
            required
          />

          <div className="space-y-1.5">
            <label
              htmlFor="task-acceptance"
              className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Done when
            </label>
            <Textarea
              id="task-acceptance"
              value={acceptance}
              onChange={(event) => setAcceptance(event.target.value)}
              placeholder="What would make you accept this as finished?"
              rows={3}
            />
          </div>

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
