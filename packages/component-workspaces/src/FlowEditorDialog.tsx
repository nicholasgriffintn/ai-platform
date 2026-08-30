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
  Textarea,
} from "@ngriffin_uk/polychat-component-ui";
import {
  agentModeSchema,
  type ProjectFlow,
  type ProjectFlowStage,
  type ToolPermission,
} from "@ngriffin_uk/polychat-schemas";
import { ArrowDown, ArrowUp, ExternalLink, Plus, Settings2, Trash2 } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";

export interface FlowEditorDialogProps {
  open: boolean;
  flow: ProjectFlow | null;
  agents: { id: string; name: string }[];
  skills: { id: string; name: string }[];
  capabilitiesHref: string;
  agentsHref: string;
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
    skillIds: [],
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
  capabilitiesHref,
  agentsHref,
  isSaving = false,
  errorMessage,
  onOpenChange,
  onSave,
}: FlowEditorDialogProps) {
  const [stages, setStages] = useState<ProjectFlowStage[]>([]);
  const titleRef = useRef<HTMLHeadingElement>(null);

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
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-5xl"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          titleRef.current?.focus();
        }}
      >
        <form onSubmit={(event) => void submit(event)} className="space-y-5">
          <DialogHeader>
            <DialogTitle ref={titleRef} tabIndex={-1} className="outline-none">
              Configure the agent pipeline
            </DialogTitle>
            <DialogDescription>
              Route each stage through an attached agent, the skills it needs, and a clear hand-off
              policy.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:bg-zinc-900/50">
            <div>
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {agents.length} attached agent{agents.length === 1 ? "" : "s"} · {skills.length}{" "}
                attached skill{skills.length === 1 ? "" : "s"}
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">
                Add agents and skills through project Capabilities. Create or edit personal agents
                in Account.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <ButtonLink
                href={agentsHref}
                variant="ghost"
                size="sm"
                icon={<ExternalLink size={13} />}
                className="no-underline hover:!no-underline"
              >
                Edit agents
              </ButtonLink>
              <ButtonLink
                href={capabilitiesHref}
                variant="outline"
                size="sm"
                icon={<Settings2 size={13} />}
                className="no-underline hover:!no-underline"
              >
                Manage capabilities
              </ButtonLink>
            </div>
          </div>

          <div className="space-y-3">
            {stages.map((stage, index) => (
              <section
                key={stage.id}
                className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800"
              >
                <div className="flex items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50/70 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/40">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-950 text-xs font-semibold text-white dark:bg-white dark:text-zinc-950">
                      {index + 1}
                    </span>
                    <p className="text-sm font-semibold">{stage.name || "New stage"}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="icon"
                      size="icon"
                      aria-label={`Move stage ${index + 1} up`}
                      disabled={index === 0}
                      onClick={() => moveStage(index, -1)}
                    >
                      <ArrowUp size={15} />
                    </Button>
                    <Button
                      type="button"
                      variant="icon"
                      size="icon"
                      aria-label={`Move stage ${index + 1} down`}
                      disabled={index === stages.length - 1}
                      onClick={() => moveStage(index, 1)}
                    >
                      <ArrowDown size={15} />
                    </Button>
                    <Button
                      type="button"
                      variant="icon"
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

                <div className="grid gap-5 p-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                  <div className="space-y-5">
                    <div className="grid gap-4 sm:grid-cols-2">
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
                    </div>

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

                    <fieldset>
                      <legend className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        Skills
                      </legend>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        Load any combination of attached skills for this stage.
                      </p>
                      {skills.length > 0 ? (
                        <div className="mt-2 grid max-h-44 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                          {skills.map((skill) => {
                            const checked = stage.skillIds.includes(skill.id);

                            return (
                              <label
                                key={skill.id}
                                className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/60"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(event) =>
                                    updateStage(index, {
                                      skillIds: event.target.checked
                                        ? [...stage.skillIds, skill.id]
                                        : stage.skillIds.filter((value) => value !== skill.id),
                                    })
                                  }
                                />
                                {skill.name}
                              </label>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="mt-2 rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-700">
                          No skills are attached to this project yet.
                        </p>
                      )}
                    </fieldset>
                  </div>

                  <div className="space-y-4 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900/60">
                    <FormSelect
                      label="Operating mode"
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

                    <fieldset>
                      <legend className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                        Require approval before
                      </legend>
                      <div className="mt-2 space-y-1.5">
                        {APPROVAL_OPTIONS.map(({ permission, label }) => (
                          <label
                            key={permission}
                            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-white dark:hover:bg-zinc-800"
                          >
                            <input
                              type="checkbox"
                              checked={stage.requiresApprovalFor.includes(permission)}
                              onChange={(event) =>
                                updateStage(index, {
                                  requiresApprovalFor: event.target.checked
                                    ? [...stage.requiresApprovalFor, permission]
                                    : stage.requiresApprovalFor.filter(
                                        (value) => value !== permission,
                                      ),
                                })
                              }
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  </div>
                </div>
              </section>
            ))}
          </div>

          <Button
            type="button"
            variant="secondary"
            icon={<Plus size={14} />}
            disabled={stages.length >= 8}
            onClick={() => setStages((current) => [...current, newStage()])}
          >
            Add stage
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
