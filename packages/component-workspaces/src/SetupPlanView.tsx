import { Badge, Button } from "@ngriffin_uk/polychat-component-ui";
import {
  creditsFromCreditMicros,
  projectTaskPriorityLabels,
  type SetupPlan,
  type SetupPlanState,
} from "@ngriffin_uk/polychat-schemas";
import { formatCredits, SHORT_WEEKDAY_LABELS } from "@ngriffin_uk/polychat-utility-core";
import { AlertTriangle, Check, Plug } from "lucide-react";

import { initialsOf } from "./work-actors";

function formatCap(micros: number | null): string {
  return micros ? `${formatCredits(creditsFromCreditMicros(micros))} credits a month` : "No cap";
}

function formatWake(minutes: number | null): string {
  if (!minutes) {
    return "Wakes when work arrives";
  }

  return minutes % 60 === 0 ? `Checks in every ${minutes / 60}h` : `Checks in every ${minutes} min`;
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

function PlanEmpty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
      {children}
    </p>
  );
}

function PlanBody({ plan }: { plan: SetupPlan }) {
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
        <p className="mt-1 text-lg leading-7 text-balance">{plan.mission}</p>
      </section>

      <PlanSection title="Initiatives" count={plan.initiatives.length}>
        {plan.initiatives.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {plan.initiatives.map((initiative) => (
              <article
                key={initiative.key}
                className="space-y-1 rounded-lg border border-border bg-surface p-4"
              >
                <h3 className="text-sm font-semibold text-balance">{initiative.name}</h3>
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
                    <h3 className="text-sm font-semibold">{project.name}</h3>
                    {initiative ? (
                      <span className="text-xs text-muted-foreground">{initiative}</span>
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
                  <p className="text-sm">
                    <span className="font-semibold">{teammate.name}</span>
                    <span className="text-muted-foreground"> · {teammate.title}</span>
                  </p>
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
                <p className="line-clamp-3 text-sm">{task.objective}</p>
                <div className="flex flex-col items-end gap-1 text-xs whitespace-nowrap text-muted-foreground">
                  <span>{task.owner ? teammateName(task.owner) : "Unassigned"}</span>
                  {task.priority !== "none" ? (
                    <span>{projectTaskPriorityLabels[task.priority]}</span>
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
  onApprove,
  onArchive,
}: {
  setup: SetupPlanState | null;
  canApprove: boolean;
  isBusy: boolean;
  onApprove: (revision: number) => void;
  onArchive: () => void;
}) {
  if (!setup) {
    return (
      <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
        The lead is reading what you gave it and drafting the setup plan. It appears here, and in
        Inbox, when it is ready.
      </p>
    );
  }

  const { plan } = setup;

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
        <PlanBody plan={plan} />
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
            <dd className="text-right tabular-nums">{formatCap(plan.monthlyCreditCapMicros)}</dd>
            <dt className="text-muted-foreground">Projects</dt>
            <dd className="text-right tabular-nums">{plan.projects.length}</dd>
            <dt className="text-muted-foreground">Hires</dt>
            <dd className="text-right tabular-nums">{plan.teammates.length}</dd>
            <dt className="text-muted-foreground">First tasks</dt>
            <dd className="text-right tabular-nums">{plan.tasks.length}</dd>
          </dl>
          <div className="space-y-2 border-t border-border pt-4">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              You'll connect
            </p>
            {plan.connections.length ? (
              <ul className="space-y-1.5 text-sm">
                {plan.connections.map((connection) => (
                  <li key={connection} className="flex gap-2">
                    <Plug size={14} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden />
                    <span>{connection}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nothing yet</p>
            )}
            <p className="text-xs text-muted-foreground">
              Each one becomes a task for you. Teammates never connect accounts themselves.
            </p>
          </div>
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
            ) : canApprove ? (
              <>
                <Button
                  variant="primary"
                  className="w-full"
                  disabled={isBusy}
                  onClick={() => onApprove(setup.revision)}
                >
                  Approve and start
                </Button>
                <p className="text-xs text-muted-foreground">
                  To change the plan, reply on the setup task and the lead posts a new revision.
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
