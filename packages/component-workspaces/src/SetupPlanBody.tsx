import { cn, FormInput, FormTextarea } from "@ngriffin_uk/polychat-component-ui";
import { projectTaskPriorityLabels, type SetupPlan } from "@ngriffin_uk/polychat-schemas";
import { initialsOf, SHORT_WEEKDAY_LABELS } from "@ngriffin_uk/polychat-utility-core";

import {
  patchSetupInitiative,
  patchSetupProject,
  patchSetupTask,
  patchSetupTeammate,
  removeSetupInitiative,
  removeSetupProject,
  removeSetupTask,
  removeSetupTeammate,
} from "./setup-plan-edits";
import { formatCap, formatWake, PlanEmpty, PlanSection, RemoveButton } from "./SetupPlanParts";

export function SetupPlanBody({
  plan,
  onChange,
}: {
  plan: SetupPlan;
  onChange?: (plan: SetupPlan) => void;
}) {
  const initiativeName = (key: string | null) =>
    plan.initiatives.find((initiative) => initiative.key === key)?.name ?? null;
  const projectOf = (key: string) => plan.projects.find((project) => project.key === key) ?? null;
  const teammateName = (key: string | null) =>
    !key || key === "lead"
      ? "Lead"
      : (plan.teammates.find((teammate) => teammate.key === key)?.name ?? key);

  return (
    <div className="min-w-0 space-y-8">
      <section className="rounded-xl border border-border bg-surface p-5">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Mission
        </p>
        {onChange ? (
          <FormTextarea
            aria-label="Mission"
            className="mt-2"
            rows={2}
            value={plan.mission}
            onChange={(event) => onChange({ ...plan, mission: event.target.value })}
          />
        ) : (
          <p className="mt-1 text-lg leading-7 text-balance">{plan.mission}</p>
        )}
      </section>

      <PlanSection title="Initiatives" count={plan.initiatives.length}>
        {plan.initiatives.length ? (
          <div className={cn("grid gap-3", !onChange && "md:grid-cols-2")}>
            {plan.initiatives.map((initiative) => (
              <article
                key={initiative.key}
                className="space-y-1 rounded-lg border border-border bg-surface p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  {onChange ? (
                    <FormInput
                      aria-label="Initiative name"
                      value={initiative.name}
                      onChange={(event) =>
                        onChange(
                          patchSetupInitiative(plan, initiative.key, { name: event.target.value }),
                        )
                      }
                    />
                  ) : (
                    <h3 className="text-sm font-semibold text-balance">{initiative.name}</h3>
                  )}
                  {onChange ? (
                    <RemoveButton
                      label={`Remove ${initiative.name}`}
                      onClick={() => onChange(removeSetupInitiative(plan, initiative.key))}
                    />
                  ) : null}
                </div>
                {initiative.description ? (
                  <p className="line-clamp-4 text-sm text-muted-foreground">
                    {initiative.description}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <PlanEmpty>No initiatives. Projects will run without a stated outcome.</PlanEmpty>
        )}
      </PlanSection>

      <PlanSection title="Projects" count={plan.projects.length}>
        <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
          {plan.projects.map((project) => {
            const initiative = initiativeName(project.initiative);

            return (
              <li key={project.key} className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-3 p-4">
                <span className="mt-0.5 h-fit w-fit rounded border border-border px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                  {project.taskPrefix}
                </span>
                <div className="min-w-0 space-y-1">
                  {onChange ? (
                    <div className="flex items-center gap-2">
                      <FormInput
                        aria-label="Project name"
                        value={project.name}
                        onChange={(event) =>
                          onChange(
                            patchSetupProject(plan, project.key, { name: event.target.value }),
                          )
                        }
                      />
                      <RemoveButton
                        label={`Remove ${project.name}`}
                        disabled={plan.projects.length === 1}
                        onClick={() => onChange(removeSetupProject(plan, project.key))}
                      />
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <h3 className="text-sm font-semibold">{project.name}</h3>
                      {initiative ? (
                        <span className="text-xs text-muted-foreground">{initiative}</span>
                      ) : null}
                    </div>
                  )}
                  {onChange && initiative ? (
                    <p className="text-xs text-muted-foreground">{initiative}</p>
                  ) : null}
                  {project.description ? (
                    <p className="line-clamp-3 text-sm text-muted-foreground">
                      {project.description}
                    </p>
                  ) : null}
                  {project.standup?.enabled ? (
                    <p className="text-xs text-muted-foreground">
                      Standup at {project.standup.time} on{" "}
                      {project.standup.days.map((day) => SHORT_WEEKDAY_LABELS[day]).join(", ")}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </PlanSection>

      <PlanSection title="Team" count={plan.teammates.length}>
        {plan.teammates.length ? (
          <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
            {plan.teammates.map((teammate) => (
              <li key={teammate.key} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 p-4">
                <span
                  className="grid h-8 w-8 place-items-center rounded-full bg-active-work/15 text-[11px] font-semibold text-active-work"
                  aria-hidden
                >
                  {initialsOf(teammate.name)}
                </span>
                <div className="min-w-0 space-y-1">
                  {onChange ? (
                    <div className="flex items-center gap-2">
                      <FormInput
                        aria-label="Teammate name"
                        value={teammate.name}
                        onChange={(event) =>
                          onChange(
                            patchSetupTeammate(plan, teammate.key, { name: event.target.value }),
                          )
                        }
                      />
                      <FormInput
                        aria-label="Job title"
                        value={teammate.title}
                        onChange={(event) =>
                          onChange(
                            patchSetupTeammate(plan, teammate.key, { title: event.target.value }),
                          )
                        }
                      />
                      <RemoveButton
                        label={`Remove ${teammate.name}`}
                        onClick={() => onChange(removeSetupTeammate(plan, teammate.key))}
                      />
                    </div>
                  ) : (
                    <p className="text-sm">
                      <span className="font-semibold">{teammate.name}</span>
                      <span className="text-muted-foreground"> · {teammate.title}</span>
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Reports to {teammateName(teammate.reportsTo)} ·{" "}
                    {formatWake(teammate.heartbeatMinutes)} ·{" "}
                    {formatCap(teammate.monthlyCreditCapMicros)}
                  </p>
                  {teammate.projects.length ? (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {teammate.projects.map((key) => (
                        <span
                          key={key}
                          className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground"
                        >
                          {projectOf(key)?.name ?? key}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <PlanEmpty>No hires. The lead does the work itself.</PlanEmpty>
        )}
      </PlanSection>

      <PlanSection title="First tasks" count={plan.tasks.length}>
        {plan.tasks.length ? (
          <ol className="divide-y divide-border rounded-lg border border-border bg-surface">
            {plan.tasks.map((task, index) => (
              <li
                key={`${task.project}-${index}`}
                className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-start gap-3 p-4"
              >
                <span className="mt-0.5 h-fit w-fit rounded border border-border px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                  {projectOf(task.project)?.taskPrefix ?? task.project}
                </span>
                {onChange ? (
                  <FormTextarea
                    aria-label="Task objective"
                    rows={2}
                    value={task.objective}
                    onChange={(event) =>
                      onChange(patchSetupTask(plan, index, { objective: event.target.value }))
                    }
                  />
                ) : (
                  <p className="line-clamp-3 text-sm">{task.objective}</p>
                )}
                <div className="flex flex-col items-end gap-1 text-xs whitespace-nowrap text-muted-foreground">
                  <span>{task.owner ? teammateName(task.owner) : "Unassigned"}</span>
                  {task.priority !== "none" ? (
                    <span>{projectTaskPriorityLabels[task.priority]}</span>
                  ) : null}
                  {onChange ? (
                    <RemoveButton
                      label="Remove this task"
                      onClick={() => onChange(removeSetupTask(plan, index))}
                    />
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <PlanEmpty>No first tasks. Projects start empty.</PlanEmpty>
        )}
      </PlanSection>
    </div>
  );
}
