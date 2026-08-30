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
  agentModeSchema,
  type ProjectFlow,
  type ProjectFlowStage,
  type ToolPermission,
} from "@ngriffin_uk/polychat-schemas";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";

export interface FlowEditorDialogProps {
  open: boolean;
  flow: ProjectFlow | null;
  agents: { id: string; name: string }[];
  skills: { id: string; name: string }[];
  isSaving?: boolean;
  errorMessage?: string;
  onOpenChange: (open: boolean) => void;
  onSave: (flow: ProjectFlow) => Promise<void>;
}

const APPROVAL_OPTIONS: { permission: ToolPermission; label: string }[] = [
  { permission: "network", label: "Network" },
  { permission: "write", label: "Write" },
  { permission: "sandbox", label: "Sandbox" },
  { permission: "orchestration", label: "Orchestration" },
  { permission: "delegate", label: "Delegation" },
];

function newStage(): ProjectFlowStage {
  return {
    id: `stage-${crypto.randomUUID().slice(0, 8)}`,
    name: "",
    instructions: null,
    agentId: null,
    skillId: null,
    mode: "build",
    requiresApprovalFor: [],
    advance: "on_goal_complete",
  };
}

export function FlowEditorDialog({
  open,
  flow,
  agents,
  skills,
  isSaving = false,
  errorMessage,
  onOpenChange,
  onSave,
}: FlowEditorDialogProps) {
  const [stages, setStages] = useState<ProjectFlowStage[]>([]);

  useEffect(() => {
    if (open) {
      setStages(flow?.stages.map((stage) => ({ ...stage })) ?? [newStage()]);
    }
  }, [flow, open]);

  const updateStage = (index: number, update: Partial<ProjectFlowStage>) => {
    setStages((current) =>
      current.map((stage, stageIndex) => (stageIndex === index ? { ...stage, ...update } : stage)),
    );
  };

  const moveStage = (index: number, direction: -1 | 1) => {
    setStages((current) => {
      const destination = index + direction;

      if (destination < 0 || destination >= current.length) {
        return current;
      }

      const reordered = [...current];

      [reordered[index], reordered[destination]] = [reordered[destination], reordered[index]];

      return reordered;
    });
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSave({
      stages: stages.map((stage) => ({
        ...stage,
        name: stage.name.trim(),
        instructions: stage.instructions?.trim() || null,
      })),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <form onSubmit={(event) => void submit(event)} className="space-y-5">
          <DialogHeader>
            <DialogTitle>Configure the agent pipeline</DialogTitle>
            <DialogDescription>
              Assign an agent and operating mode to each stage, then choose automatic hand-off or
              human review.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {stages.map((stage, index) => (
              <section
                key={stage.id}
                className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/40"
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-950 text-xs font-semibold text-white dark:bg-white dark:text-zinc-950">
                      {index + 1}
                    </span>
                    <p className="text-sm font-semibold">{stage.name || "New stage"}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Move stage ${index + 1} up`}
                      disabled={index === 0}
                      onClick={() => moveStage(index, -1)}
                    >
                      <ArrowUp size={15} />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Move stage ${index + 1} down`}
                      disabled={index === stages.length - 1}
                      onClick={() => moveStage(index, 1)}
                    >
                      <ArrowDown size={15} />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove stage ${index + 1}`}
                      disabled={stages.length === 1}
                      onClick={() =>
                        setStages((current) =>
                          current.filter((_, stageIndex) => stageIndex !== index),
                        )
                      }
                    >
                      <Trash2 size={15} />
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <FormInput
                    label="Stage name"
                    value={stage.name}
                    onChange={(event) => updateStage(index, { name: event.target.value })}
                    placeholder="Research"
                    required
                  />
                  <FormSelect
                    label="Agent"
                    value={stage.agentId ?? ""}
                    onChange={(event) =>
                      updateStage(index, { agentId: event.target.value || null })
                    }
                  >
                    <option value="">Project default</option>
                    {agents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name}
                      </option>
                    ))}
                  </FormSelect>
                  <FormSelect
                    label="Skill"
                    value={stage.skillId ?? ""}
                    onChange={(event) =>
                      updateStage(index, { skillId: event.target.value || null })
                    }
                  >
                    <option value="">No required skill</option>
                    {skills.map((skill) => (
                      <option key={skill.id} value={skill.id}>
                        {skill.name}
                      </option>
                    ))}
                  </FormSelect>
                  <FormSelect
                    label="Mode"
                    value={stage.mode ?? ""}
                    onChange={(event) => {
                      const mode = agentModeSchema.safeParse(event.target.value);

                      updateStage(index, { mode: mode.success ? mode.data : null });
                    }}
                  >
                    <option value="">Agent default</option>
                    <option value="explore">Explore</option>
                    <option value="plan">Plan</option>
                    <option value="build">Build</option>
                    <option value="chat">Chat</option>
                  </FormSelect>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_240px]">
                  <div className="space-y-1.5">
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Stage instructions
                    </span>
                    <Textarea
                      aria-label={`Stage ${index + 1} instructions`}
                      value={stage.instructions ?? ""}
                      onChange={(event) =>
                        updateStage(index, { instructions: event.target.value || null })
                      }
                      placeholder="What this specialist owns and what it must hand off"
                      rows={3}
                    />
                  </div>
                  <FormSelect
                    label="When the goal completes"
                    value={stage.advance}
                    onChange={(event) =>
                      updateStage(index, {
                        advance:
                          event.target.value === "on_human_accept"
                            ? "on_human_accept"
                            : "on_goal_complete",
                      })
                    }
                  >
                    <option value="on_goal_complete">Hand off automatically</option>
                    <option value="on_human_accept">Stop for human review</option>
                  </FormSelect>
                </div>

                <div className="mt-4">
                  <p className="mb-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    Require approval before
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {APPROVAL_OPTIONS.map(({ permission, label }) => (
                      <label
                        key={permission}
                        className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-950"
                      >
                        <input
                          type="checkbox"
                          checked={stage.requiresApprovalFor.includes(permission)}
                          onChange={(event) =>
                            updateStage(index, {
                              requiresApprovalFor: event.target.checked
                                ? [...stage.requiresApprovalFor, permission]
                                : stage.requiresApprovalFor.filter((value) => value !== permission),
                            })
                          }
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              </section>
            ))}
          </div>

          <Button
            type="button"
            variant="secondary"
            disabled={stages.length >= 8}
            onClick={() => setStages((current) => [...current, newStage()])}
          >
            <Plus size={14} /> Add stage
          </Button>

          {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || stages.some((stage) => !stage.name.trim())}>
              {isSaving ? "Saving…" : "Save pipeline"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
