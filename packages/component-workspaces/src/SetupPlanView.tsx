import { Badge, Button, FormInput, FormTextarea, Link } from "@ngriffin_uk/polychat-component-ui";
import {
  creditMicrosFromCredits,
  creditsFromCreditMicros,
  projectTaskPriorityLabels,
  type SetupPlan,
  type SetupPlanState,
} from "@ngriffin_uk/polychat-schemas";
import {
  formatCredits,
  formatMinutesInterval,
  initialsOf,
  SHORT_WEEKDAY_LABELS,
} from "@ngriffin_uk/polychat-utility-core";
import { AlertTriangle, Check, Plug, X } from "lucide-react";
import { useState } from "react";

import {
  removeSetupConnector,
  removeSetupInitiative,
  removeSetupProject,
  removeSetupSuggestion,
  removeSetupTask,
  removeSetupTeammate,
} from "./setup-plan-edits";

function formatCap(micros: number | null): string {
  return micros ? `${formatCredits(creditsFromCreditMicros(micros))} credits a month` : "No cap";
}

function formatWake(minutes: number | null): string {
  if (!minutes) {
    return "Wakes when work arrives";
  }

  return `Checks in every ${formatMinutesInterval(minutes)}`;
}

function PlanSection({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-baseline gap-2 text-sm font-semibold">
        {title}
        {count !== undefined ? (
          <span className="text-xs font-normal text-muted-foreground tabular-nums">{count}</span>
        ) : null}
      </h2>
      {children}
    </section>
  );
}

function RemoveButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      <X size={14} />
    </Button>
  );
}

function PlanEmpty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
      {children}
    </p>
  );
}

function PlanBody({ plan, onChange }: { plan: SetupPlan; onChange?: (plan: SetupPlan) => void }) {
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
          <div className="grid gap-3 md:grid-cols-2">
            {plan.initiatives.map((initiative) => (
              <article
                key={initiative.key}
                className="space-y-1 rounded-lg border border-border bg-surface p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  {onChange ? (
                    <FormInput
                      aria-label="Initiative name"
                      value={initiative.name}
                      onChange={(event) =>
                        onChange({
                          ...plan,
                          initiatives: plan.initiatives.map((candidate) =>
                            candidate.key === initiative.key
                              ? { ...candidate, name: event.target.value }
                              : candidate,
                          ),
                        })
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
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    {onChange ? (
                      <FormInput
                        aria-label="Project name"
                        className="max-w-xs"
                        value={project.name}
                        onChange={(event) =>
                          onChange({
                            ...plan,
                            projects: plan.projects.map((candidate) =>
                              candidate.key === project.key
                                ? { ...candidate, name: event.target.value }
                                : candidate,
                            ),
                          })
                        }
                      />
                    ) : (
                      <h3 className="text-sm font-semibold">{project.name}</h3>
                    )}
                    {initiative ? (
                      <span className="text-xs text-muted-foreground">{initiative}</span>
                    ) : null}
                    {onChange ? (
                      <span className="ml-auto">
                        <RemoveButton
                          label={`Remove ${project.name}`}
                          disabled={plan.projects.length === 1}
                          onClick={() => onChange(removeSetupProject(plan, project.key))}
                        />
                      </span>
                    ) : null}
                  </div>
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
                          onChange({
                            ...plan,
                            teammates: plan.teammates.map((candidate) =>
                              candidate.key === teammate.key
                                ? { ...candidate, name: event.target.value }
                                : candidate,
                            ),
                          })
                        }
                      />
                      <FormInput
                        aria-label="Job title"
                        value={teammate.title}
                        onChange={(event) =>
                          onChange({
                            ...plan,
                            teammates: plan.teammates.map((candidate) =>
                              candidate.key === teammate.key
                                ? { ...candidate, title: event.target.value }
                                : candidate,
                            ),
                          })
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
                      onChange({
                        ...plan,
                        tasks: plan.tasks.map((candidate, position) =>
                          position === index
                            ? { ...candidate, objective: event.target.value }
                            : candidate,
                        ),
                      })
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

export function SetupPlanView({
  setup,
  canApprove,
  isBusy,
  connectorName,
  connectHref,
  onApprove,
  onArchive,
  onRevise,
}: {
  setup: SetupPlanState | null;
  canApprove: boolean;
  isBusy: boolean;
  connectorName: (provider: string) => string;
  connectHref: string;
  onApprove: (revision: number) => void;
  onArchive: () => void;
  onRevise: (plan: SetupPlan, expectedRevision: number) => Promise<unknown>;
}) {
  const [draft, setDraft] = useState<SetupPlan | null>(null);

  if (!setup) {
    return (
      <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
        The lead is reading what you gave it and drafting the setup plan. It appears here, and in
        Inbox, when it is ready.
      </p>
    );
  }

  const plan = draft ?? setup.plan;
  const editable = canApprove && !setup.appliedAt;

  return (
    <div className="space-y-6">
      {setup.failure && !setup.appliedAt ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-failure/30 bg-failure/5 p-4 text-sm"
        >
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-failure" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-medium">
              Revision {setup.failure.revision} stopped part way, so nothing it made was kept.
            </p>
            <p className="text-muted-foreground">{setup.failure.message}</p>
          </div>
        </div>
      ) : null}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <PlanBody plan={plan} onChange={draft ? setDraft : undefined} />
        <aside className="h-fit space-y-5 rounded-xl border border-border bg-surface p-5 lg:sticky lg:top-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Revision {setup.revision}</h2>
            {setup.appliedAt ? (
              <Badge variant="success">Started</Badge>
            ) : (
              <Badge variant="outline">Waiting for approval</Badge>
            )}
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Budget</dt>
            <dd className="text-right tabular-nums">
              {draft ? (
                <FormInput
                  aria-label="Monthly budget in credits"
                  type="number"
                  min={0}
                  className="text-right"
                  value={
                    draft.monthlyCreditCapMicros
                      ? creditsFromCreditMicros(draft.monthlyCreditCapMicros)
                      : ""
                  }
                  placeholder="No cap"
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      monthlyCreditCapMicros:
                        Number(event.target.value) > 0
                          ? creditMicrosFromCredits(Number(event.target.value))
                          : null,
                    })
                  }
                />
              ) : (
                formatCap(plan.monthlyCreditCapMicros)
              )}
            </dd>
            <dt className="text-muted-foreground">Projects</dt>
            <dd className="text-right tabular-nums">{plan.projects.length}</dd>
            <dt className="text-muted-foreground">Hires</dt>
            <dd className="text-right tabular-nums">{plan.teammates.length}</dd>
            <dt className="text-muted-foreground">First tasks</dt>
            <dd className="text-right tabular-nums">{plan.tasks.length}</dd>
          </dl>
          <div className="space-y-2 border-t border-border pt-4">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Uses
            </p>
            {plan.connectors.length ? (
              <ul className="space-y-1.5 text-sm">
                {plan.connectors.map((connector) => (
                  <li key={connector.provider} className="flex items-start gap-2">
                    <Plug size={14} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0">
                      {connectorName(connector.provider)}
                      <span className="text-muted-foreground">
                        {" "}
                        · {connector.access === "read" ? "read only" : "read and write"} in{" "}
                        {connector.projects
                          .map((key) => plan.projects.find((project) => project.key === key)?.name)
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    </span>
                    {draft ? (
                      <RemoveButton
                        label={`Stop using ${connectorName(connector.provider)}`}
                        onClick={() => setDraft(removeSetupConnector(draft, connector.provider))}
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No connected services</p>
            )}
          </div>
          {plan.suggestions.length ? (
            <div className="space-y-2 border-t border-border pt-4">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Worth connecting
              </p>
              <ul className="space-y-2 text-sm">
                {plan.suggestions.map((suggestion) => (
                  <li key={suggestion.provider} className="flex items-start gap-2">
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{connectorName(suggestion.provider)}</span>
                      <span className="block text-xs text-muted-foreground">
                        {suggestion.reason}
                      </span>
                    </span>
                    {draft ? (
                      <RemoveButton
                        label={`Drop the ${connectorName(suggestion.provider)} suggestion`}
                        onClick={() => setDraft(removeSetupSuggestion(draft, suggestion.provider))}
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                Only suggestions. Connect any of them in{" "}
                <Link href={connectHref} className="underline">
                  Plugins
                </Link>{" "}
                and the lead can use them from then on.
              </p>
            </div>
          ) : null}
          <div className="space-y-2 border-t border-border pt-4">
            {setup.appliedAt ? (
              <>
                <p className="flex items-center gap-1.5 text-sm text-success">
                  <Check size={14} aria-hidden />
                  Started {new Date(setup.appliedAt).toLocaleString("en-GB")}
                </p>
                {canApprove ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="w-full"
                    disabled={isBusy}
                    onClick={onArchive}
                  >
                    Undo what the plan created
                  </Button>
                ) : null}
              </>
            ) : draft ? (
              <>
                <Button
                  variant="primary"
                  className="w-full"
                  disabled={isBusy || !draft.mission.trim()}
                  onClick={() =>
                    void onRevise(draft, setup.revision).then(
                      () => setDraft(null),
                      () => undefined,
                    )
                  }
                >
                  Save as revision {setup.revision + 1}
                </Button>
                <Button
                  variant="ghost"
                  className="w-full"
                  disabled={isBusy}
                  onClick={() => setDraft(null)}
                >
                  Discard changes
                </Button>
                <p className="text-xs text-muted-foreground">
                  Saving makes a new revision, which then needs approving.
                </p>
              </>
            ) : editable ? (
              <>
                <Button
                  variant="primary"
                  className="w-full"
                  disabled={isBusy}
                  onClick={() => onApprove(setup.revision)}
                >
                  Approve and start
                </Button>
                <Button
                  variant="secondary"
                  className="w-full"
                  disabled={isBusy}
                  onClick={() => setDraft(setup.plan)}
                >
                  Edit plan
                </Button>
                <p className="text-xs text-muted-foreground">
                  Edit it yourself, or reply on the setup task and the lead posts a new revision.
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">An owner or admin approves the plan.</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
