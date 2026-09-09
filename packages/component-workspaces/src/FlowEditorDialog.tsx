import {
  Button,
  ButtonLink,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormInput,
  FormSelect,
  type FormSelectOption,
  Textarea,
} from "@ngriffin_uk/polychat-component-ui";
import {
  agentModeSchema,
  createSuggestedProjectFlow,
  type ProjectFlow,
  type ProjectFlowStage,
  type ToolPermission,
} from "@ngriffin_uk/polychat-schemas";
import { ArrowDown, ArrowUp, Plus, Settings2, Sparkles, Trash2 } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";

export interface FlowEditorDialogProps {
  open: boolean;
  flow: ProjectFlow | null;
  teammates: { id: string; name: string }[];
  skills: { id: string; name: string }[];
  capabilitiesHref: string;
  createTeammateHref: string;
  isSaving?: boolean;
  errorMessage?: string;
  onOpenChange: (open: boolean) => void;
  onSave: (flow: ProjectFlow) => Promise<void>;
}

const STAGE_MODE_OPTIONS: FormSelectOption[] = [
  { value: "", label: "Teammate default" },
  { value: "explore", label: "Explore" },
  { value: "plan", label: "Plan" },
  { value: "build", label: "Build" },
  { value: "chat", label: "Chat" },
];

const STAGE_ADVANCE_OPTIONS: FormSelectOption[] = [
  { value: "on_goal_complete", label: "Hand off automatically" },
  { value: "on_human_accept", label: "Stop for human review" },
];

const APPROVAL_OPTIONS: { permission: ToolPermission; label: string }[] = [
  { permission: "network", label: "Network" },
  { permission: "write", label: "Write" },
  { permission: "sandbox", label: "Sandbox" },
  { permission: "orchestration", label: "Orchestration" },
];

function newStage(): ProjectFlowStage {
  return {
    id: `stage-${crypto.randomUUID().slice(0, 8)}`,
    name: "",
    instructions: null,
    teammateId: null,
    skillIds: [],
    mode: "build",
    requiresApprovalFor: [],
    advance: "on_goal_complete",
  };
}

export function FlowEditorDialog({
  open,
  flow,
  teammates,
  skills,
  capabilitiesHref,
  createTeammateHref,
  isSaving = false,
  errorMessage,
  onOpenChange,
  onSave,
}: FlowEditorDialogProps) {
  const [stages, setStages] = useState<ProjectFlowStage[]>([]);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const isNewFlow = flow === null;

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
              Configure the teammate pipeline
            </DialogTitle>
            <DialogDescription>
              Route each stage through an attached teammate, the skills it needs, and a clear
              hand-off policy.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-elevated p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">
                {teammates.length} attached teammate{teammates.length === 1 ? "" : "s"} ·{" "}
                {skills.length} attached skill{skills.length === 1 ? "" : "s"}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Add teammates and skills through project Capabilities, where you can also build a
                new teammate for this project.
              </p>
              {isNewFlow ? (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Not sure where to start? The suggested pipeline runs research, plan, build and
                  review with the project default agent, pausing for you after plan and review.
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {isNewFlow ? (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  icon={<Sparkles size={13} />}
                  onClick={() => setStages(createSuggestedProjectFlow().stages)}
                >
                  Use suggested pipeline
                </Button>
              ) : null}
              <ButtonLink
                href={createTeammateHref}
                variant="ghost"
                size="sm"
                icon={<Plus size={13} />}
                className="no-underline hover:!no-underline"
              >
                New teammate
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
              <section key={stage.id} className="overflow-hidden rounded-xl border border-border">
                <div className="flex items-center justify-between gap-3 border-b border-border bg-surface-elevated/70 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">
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
                        label="Teammate"
                        value={stage.teammateId ?? ""}
                        options={[
                          { value: "", label: "Project default" },
                          ...teammates.map((teammate) => ({
                            value: teammate.id,
                            label: teammate.name,
                          })),
                        ]}
                        onValueChange={(teammateId) =>
                          updateStage(index, { teammateId: teammateId || null })
                        }
                      />
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-sm font-medium text-foreground">
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
                      <legend className="text-sm font-medium text-foreground">Skills</legend>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Load any combination of attached skills for this stage.
                      </p>
                      {skills.length > 0 ? (
                        <div className="mt-2 grid max-h-44 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                          {skills.map((skill) => {
                            const checked = stage.skillIds.includes(skill.id);

                            return (
                              <label
                                key={skill.id}
                                htmlFor={`stage-${index}-skill-${skill.id}`}
                                className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface-elevated"
                              >
                                <Checkbox
                                  id={`stage-${index}-skill-${skill.id}`}
                                  checked={checked}
                                  onCheckedChange={(isChecked) =>
                                    updateStage(index, {
                                      skillIds:
                                        isChecked === true
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
                        <p className="mt-2 rounded-lg border border-dashed border-border-strong px-3 py-2 text-xs text-muted-foreground">
                          No skills are attached to this project yet.
                        </p>
                      )}
                    </fieldset>
                  </div>

                  <div className="space-y-4 rounded-lg bg-surface-elevated p-3">
                    <FormSelect
                      label="Operating mode"
                      value={stage.mode ?? ""}
                      options={STAGE_MODE_OPTIONS}
                      onValueChange={(value) => {
                        const mode = agentModeSchema.safeParse(value);

                        updateStage(index, { mode: mode.success ? mode.data : null });
                      }}
                    />
                    <FormSelect
                      label="When the goal completes"
                      value={stage.advance}
                      options={STAGE_ADVANCE_OPTIONS}
                      onValueChange={(advance) =>
                        updateStage(index, {
                          advance:
                            advance === "on_human_accept" ? "on_human_accept" : "on_goal_complete",
                        })
                      }
                    />

                    <fieldset>
                      <legend className="text-xs font-medium text-muted-foreground">
                        Require approval before
                      </legend>
                      <div className="mt-2 space-y-1.5">
                        {APPROVAL_OPTIONS.map(({ permission, label }) => (
                          <label
                            key={permission}
                            htmlFor={`stage-${index}-approval-${permission}`}
                            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-surface"
                          >
                            <Checkbox
                              id={`stage-${index}-approval-${permission}`}
                              checked={stage.requiresApprovalFor.includes(permission)}
                              onCheckedChange={(isChecked) =>
                                updateStage(index, {
                                  requiresApprovalFor:
                                    isChecked === true
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

          {errorMessage ? (
            <p role="alert" className="text-sm text-failure">
              {errorMessage}
            </p>
          ) : null}

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
