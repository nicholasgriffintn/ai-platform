import {
  Button,
  cn,
  FormCheckbox,
  FormDialog,
  FormInput,
  FormSelect,
  FormTextarea,
  Link,
} from "@ngriffin_uk/polychat-component-ui";
import {
  creditMicrosFromCredits,
  creditsFromCreditMicros,
  WORK_BUDGET_WARNING_RATIO,
  type ProposeHireInput,
  type RunsOn,
  type UpdateWorkspaceTeammateInput,
  type WorkRailBeat,
  type WorkRailsResponse,
  type WorkspaceTeammate,
} from "@ngriffin_uk/polychat-schemas";
import { formatCredits, parseStoredTimestamp } from "@ngriffin_uk/polychat-utility-core";
import { useState } from "react";

import { initialsOf } from "./work-actors";

const RUNS_ON_LABELS: Record<RunsOn, string> = {
  hosted: "Hosted",
  sandbox: "Sandbox",
  machine: "Your machine",
  harness: "Agent harness",
};

const RUNS_ON_PHRASES: Record<RunsOn, string> = {
  hosted: "on Polychat",
  sandbox: "in a sandbox",
  machine: "on your machine",
  harness: "in an agent harness",
};

const HEARTBEAT_OPTIONS = [
  { value: "none", label: "Only when woken" },
  { value: "60", label: "Every hour" },
  { value: "120", label: "Every 2 hours" },
  { value: "240", label: "Every 4 hours" },
  { value: "480", label: "Every 8 hours" },
  { value: "720", label: "Every 12 hours" },
  { value: "1440", label: "Once a day" },
];

export function describeWakeRule(teammate: Pick<WorkspaceTeammate, "heartbeatMinutes">): string {
  if (!teammate.heartbeatMinutes) {
    return "on wake";
  }

  return teammate.heartbeatMinutes % 60 === 0
    ? `every ${teammate.heartbeatMinutes / 60}h`
    : `every ${teammate.heartbeatMinutes}m`;
}

function SpendMeter({ teammate }: { teammate: WorkspaceTeammate }) {
  if (!teammate.monthlyCreditCapMicros) {
    return (
      <p className="text-xs text-muted-foreground">
        {formatCredits(creditsFromCreditMicros(teammate.spentCreditMicros))} credits, no cap
      </p>
    );
  }

  const ratio = Math.min(1, teammate.spentCreditMicros / teammate.monthlyCreditCapMicros);

  return (
    <div className="space-y-1">
      <div className="h-1.5 overflow-hidden rounded-full bg-border">
        <span
          className={cn(
            "block h-full",
            ratio >= 1
              ? "bg-failure"
              : ratio >= WORK_BUDGET_WARNING_RATIO
                ? "bg-attention"
                : "bg-success",
          )}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {formatCredits(creditsFromCreditMicros(teammate.spentCreditMicros))} of{" "}
        {formatCredits(creditsFromCreditMicros(teammate.monthlyCreditCapMicros))} credits
      </p>
    </div>
  );
}

function TeammateCard({ teammate, href }: { teammate: WorkspaceTeammate; href: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "block w-52 space-y-2 rounded-lg border bg-surface p-3 text-left text-sm text-foreground no-underline shadow-sm transition-colors hover:border-border-strong hover:!no-underline",
        teammate.status === "proposed" ? "border-dashed border-border-strong" : "border-border",
        teammate.status === "paused" && "opacity-70",
      )}
    >
      <span className="flex items-center gap-2 font-medium">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-active-work/15 text-[10px] font-semibold text-active-work">
          {initialsOf(teammate.name)}
        </span>
        <span className="truncate">{teammate.name}</span>
      </span>
      <span className="block truncate text-xs text-muted-foreground">
        {teammate.title}
        {teammate.isLead ? " · Lead" : ""}
        {teammate.status === "proposed" ? " · proposed" : ""}
        {teammate.status === "paused"
          ? teammate.pausedReason === "budget"
            ? " · paused: budget"
            : " · paused"
          : ""}
      </span>
      <span className="block text-xs text-muted-foreground">
        {RUNS_ON_LABELS[teammate.runsOn]} · {describeWakeRule(teammate)}
      </span>
      {teammate.status !== "proposed" ? <SpendMeter teammate={teammate} /> : null}
    </Link>
  );
}

export function TeamOrgChart({
  boardName,
  teammates,
  teammateHref,
}: {
  boardName: string;
  teammates: readonly WorkspaceTeammate[];
  teammateHref: (teammate: WorkspaceTeammate) => string;
}) {
  const visible = teammates.filter((teammate) => teammate.status !== "archived");
  const known = new Set(visible.map((teammate) => teammate.teammateId));
  const reportsOf = (managerId: string | null) =>
    visible.filter((teammate) =>
      managerId === null
        ? !teammate.reportsToTeammateId || !known.has(teammate.reportsToTeammateId)
        : teammate.reportsToTeammateId === managerId,
    );
  const renderBranch = (teammate: WorkspaceTeammate): React.ReactNode => {
    const reports = reportsOf(teammate.teammateId);

    return (
      <li
        key={teammate.teammateId}
        className="relative flex flex-col items-center px-2 pt-6 before:absolute before:top-0 before:left-1/2 before:h-6 before:w-px before:bg-border-strong after:absolute after:top-0 after:right-0 after:left-0 after:h-px after:bg-border-strong first:after:left-1/2 last:after:right-1/2 only:after:hidden"
      >
        <TeammateCard teammate={teammate} href={teammateHref(teammate)} />
        {reports.length ? (
          <>
            <span aria-hidden className="h-6 w-px bg-border-strong" />
            <ul className="flex">{reports.map(renderBranch)}</ul>
          </>
        ) : null}
      </li>
    );
  };

  const roots = reportsOf(null);

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-canvas px-6 py-8">
      <div className="flex min-w-max flex-col items-center">
        <div className="rounded-lg border border-border bg-surface px-4 py-2.5 text-center text-sm shadow-sm">
          <p className="font-medium">{boardName}</p>
          <p className="text-xs text-muted-foreground">
            The board · approves hires, plans and spend
          </p>
        </div>
        {roots.length ? (
          <>
            <span aria-hidden className="h-6 w-px bg-border-strong" />
            <ul className="flex">{roots.map(renderBranch)}</ul>
          </>
        ) : (
          <p className="mt-6 text-sm text-muted-foreground">No teammates yet.</p>
        )}
      </div>
    </div>
  );
}

const RAIL_LEGEND = [
  { label: "Ran on schedule", className: "border-muted-foreground bg-muted-foreground" },
  {
    label: "Woken by an event",
    className: "border-dotted border-muted-foreground bg-muted-foreground/60",
  },
  { label: "Scheduled", className: "border-muted-foreground bg-surface" },
  { label: "Running now", className: "border-active-work bg-active-work" },
  { label: "Ended blocked", className: "border-failure bg-failure" },
];

function beatClass(beat: WorkRailBeat): string {
  switch (beat.kind) {
    case "running":
      return "border-active-work bg-active-work ring-4 ring-active-work/20";
    case "blocked":
      return "border-failure bg-failure";
    case "scheduled":
      return "border-muted-foreground bg-surface";
    default:
      return beat.trigger === "schedule"
        ? "border-muted-foreground bg-muted-foreground"
        : "border-muted-foreground border-dotted bg-muted-foreground/60";
  }
}

export function HeartbeatRails({
  rails,
  teammates,
  beatHref,
}: {
  rails: WorkRailsResponse;
  teammates: readonly WorkspaceTeammate[];
  beatHref: (beat: WorkRailBeat) => string | null;
}) {
  const from = parseStoredTimestamp(rails.from);
  const to = parseStoredTimestamp(rails.to);
  const span = Math.max(1, to - from);
  const position = (at: string) =>
    Math.min(100, Math.max(0, ((parseStoredTimestamp(at) - from) / span) * 100));
  const ticks = Array.from({ length: 7 }, (_, index) => from + (span / 6) * index);

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <div className="min-w-[44rem] px-5 py-3">
        <div className="grid grid-cols-[10rem_minmax(0,1fr)] gap-4 border-b border-border pb-2 font-mono text-[10px] text-muted-foreground">
          <span />
          <span className="relative h-4">
            {ticks.map((tick) => (
              <span
                key={tick}
                className="absolute -translate-x-1/2"
                style={{ left: `${((tick - from) / span) * 100}%` }}
              >
                {new Date(tick).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
              </span>
            ))}
          </span>
        </div>
        {rails.rails.map((rail) => {
          const teammate = teammates.find((candidate) => candidate.teammateId === rail.teammateId);

          if (!teammate) {
            return null;
          }

          return (
            <div
              key={rail.teammateId}
              className="grid grid-cols-[10rem_minmax(0,1fr)] items-center gap-4 border-b border-border py-5 last:border-b-0"
            >
              <span className="min-w-0">
                <span
                  className={cn(
                    "block truncate text-sm font-medium",
                    rail.beats.some((beat) => beat.kind === "running") && "text-active-work",
                  )}
                >
                  {teammate.name}
                </span>
                <span className="block font-mono text-[11px] text-muted-foreground">
                  {describeWakeRule(teammate)}
                </span>
              </span>
              <span className="relative h-6">
                <span className="absolute inset-x-0 top-[11px] h-0.5 bg-border" />
                {rail.beats.length === 0 ? (
                  <span className="absolute top-[-2px] left-3 bg-surface px-2 text-xs text-muted-foreground">
                    No runs in this window
                  </span>
                ) : null}
                {rail.beats.map((beat) => {
                  const href = beatHref(beat);
                  const marker = (
                    <span
                      title={`${beat.label ?? beat.trigger} · ${new Date(beat.at).toLocaleString("en-GB")}`}
                      className={cn(
                        "absolute top-[3px] -ml-[5px] h-[18px] w-[10px] rounded-[5px] border-2",
                        beatClass(beat),
                      )}
                      style={{ left: `${position(beat.at)}%` }}
                    >
                      {beat.label && (beat.kind === "running" || beat.kind === "blocked") ? (
                        <span
                          className={cn(
                            "absolute bottom-6 left-1/2 -translate-x-1/2 rounded-md px-2 py-0.5 text-[11px] whitespace-nowrap",
                            beat.kind === "blocked"
                              ? "bg-failure/10 text-failure"
                              : "bg-active-work/10 text-active-work",
                          )}
                        >
                          {beat.label}
                        </span>
                      ) : null}
                    </span>
                  );

                  return href ? (
                    <Link
                      key={`${beat.at}-${beat.runId ?? "scheduled"}`}
                      href={href}
                      aria-label={beat.label ?? "Run"}
                    >
                      {marker}
                    </Link>
                  ) : (
                    <span key={`${beat.at}-${beat.runId ?? "scheduled"}`}>{marker}</span>
                  );
                })}
              </span>
            </div>
          );
        })}
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-2 border-t border-border px-5 py-3 text-xs text-muted-foreground">
        {RAIL_LEGEND.map((entry) => (
          <li key={entry.label} className="inline-flex items-center gap-2">
            <span aria-hidden className={cn("h-3.5 w-2 rounded-[3px] border-2", entry.className)} />
            {entry.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TeamMemberEditor({
  teammate,
  teammates,
  projects,
  canManage,
  isSaving,
  onSave,
}: {
  teammate: WorkspaceTeammate;
  teammates: readonly WorkspaceTeammate[];
  projects: readonly { id: string; name: string }[];
  canManage: boolean;
  isSaving: boolean;
  onSave: (changes: UpdateWorkspaceTeammateInput) => void;
}) {
  const [title, setTitle] = useState(teammate.title);
  const [manager, setManager] = useState(teammate.reportsToTeammateId ?? "none");
  const [heartbeat, setHeartbeat] = useState(
    teammate.heartbeatMinutes ? String(teammate.heartbeatMinutes) : "none",
  );
  const [cap, setCap] = useState(
    teammate.monthlyCreditCapMicros
      ? String(creditsFromCreditMicros(teammate.monthlyCreditCapMicros))
      : "",
  );
  const [projectIds, setProjectIds] = useState<string[]>(teammate.projectIds);

  return (
    <form
      className="space-y-4 rounded-xl border border-border bg-surface p-5"
      onSubmit={(event) => {
        event.preventDefault();
        const credits = Number(cap);

        onSave({
          title: title.trim() || teammate.title,
          reportsToTeammateId: manager === "none" ? null : manager,
          heartbeatMinutes: heartbeat === "none" ? null : Number(heartbeat),
          monthlyCreditCapMicros: cap && credits > 0 ? creditMicrosFromCredits(credits) : null,
          projectIds,
        });
      }}
    >
      <FormInput
        label="Title"
        value={title}
        disabled={!canManage}
        onChange={(event) => setTitle(event.target.value)}
      />
      <FormSelect
        label="Reports to"
        options={[
          { value: "none", label: "The board" },
          ...teammates
            .filter(
              (candidate) =>
                candidate.teammateId !== teammate.teammateId && candidate.status !== "archived",
            )
            .map((candidate) => ({ value: candidate.teammateId, label: candidate.name })),
        ]}
        value={manager}
        disabled={!canManage}
        onValueChange={setManager}
      />
      <FormSelect
        label="Wakes"
        description="Teammates always wake when assigned, mentioned, unblocked or asked to review."
        options={HEARTBEAT_OPTIONS}
        value={heartbeat}
        disabled={!canManage}
        onValueChange={setHeartbeat}
      />
      <FormInput
        label="Monthly budget in credits"
        description="It warns at 80% and pauses at 100%. Leave empty for no cap."
        inputMode="decimal"
        value={cap}
        disabled={!canManage}
        onChange={(event) => setCap(event.target.value)}
      />
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium">Projects</legend>
        {projects.map((project) => (
          <FormCheckbox
            key={project.id}
            label={project.name}
            labelPosition="right"
            checked={projectIds.includes(project.id)}
            disabled={!canManage}
            onCheckedChange={(checked) =>
              setProjectIds((current) =>
                checked
                  ? [...current, project.id]
                  : current.filter((projectId) => projectId !== project.id),
              )
            }
          />
        ))}
      </fieldset>
      {canManage ? (
        <Button type="submit" variant="primary" size="sm" disabled={isSaving}>
          Save
        </Button>
      ) : null}
    </form>
  );
}

export function ProposeHireDialog({
  open,
  teammates,
  isSaving,
  errorMessage,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  teammates: readonly WorkspaceTeammate[];
  isSaving: boolean;
  errorMessage?: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: ProposeHireInput) => Promise<unknown>;
}) {
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [manager, setManager] = useState("none");
  const [cap, setCap] = useState("");
  const [reason, setReason] = useState("");

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Propose a hire"
      description="Owners and admins approve hires in Inbox before the teammate starts."
      submitText="Propose"
      isLoading={isSaving}
      submitDisabled={!name.trim() || !title.trim() || !jobDescription.trim() || !reason.trim()}
      onSubmit={async () => {
        const credits = Number(cap);

        await onSubmit({
          name: name.trim(),
          title: title.trim(),
          roleSlug: null,
          jobDescription: jobDescription.trim(),
          reportsToTeammateId: manager === "none" ? null : manager,
          monthlyCreditCapMicros: cap && credits > 0 ? creditMicrosFromCredits(credits) : null,
          heartbeatMinutes: null,
          projectIds: [],
          reason: reason.trim(),
        });
      }}
    >
      <div className="space-y-3">
        <FormInput label="Name" value={name} onChange={(event) => setName(event.target.value)} />
        <FormInput label="Title" value={title} onChange={(event) => setTitle(event.target.value)} />
        <FormTextarea
          label="The job"
          rows={3}
          value={jobDescription}
          onChange={(event) => setJobDescription(event.target.value)}
        />
        <FormSelect
          label="Reports to"
          options={[
            { value: "none", label: "The board" },
            ...teammates
              .filter((teammate) => teammate.status === "active")
              .map((teammate) => ({ value: teammate.teammateId, label: teammate.name })),
          ]}
          value={manager}
          onValueChange={setManager}
        />
        <FormInput
          label="Monthly budget in credits"
          inputMode="decimal"
          value={cap}
          onChange={(event) => setCap(event.target.value)}
        />
        <FormTextarea
          label="Why the team needs this hire"
          rows={2}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
        {errorMessage ? (
          <p role="alert" className="text-sm text-failure">
            {errorMessage}
          </p>
        ) : null}
      </div>
    </FormDialog>
  );
}

export function TeammateProfileHeader({
  teammate,
  managerName,
  actions,
}: {
  teammate: WorkspaceTeammate;
  managerName: string;
  actions?: React.ReactNode;
}) {
  const statusLabel =
    teammate.status === "paused"
      ? teammate.pausedReason === "budget"
        ? "Paused: budget used"
        : "Paused"
      : teammate.status === "proposed"
        ? "Proposed hire"
        : teammate.status === "archived"
          ? "Left the team"
          : "Active";

  return (
    <div className="flex flex-wrap items-start gap-5 rounded-xl border border-border bg-surface p-5">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-active-work/15 text-base font-semibold text-active-work">
        {initialsOf(teammate.name)}
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">{teammate.name}</h2>
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-[11px]",
              teammate.status === "active"
                ? "border-success/30 bg-success/10 text-success"
                : teammate.status === "paused"
                  ? "border-attention/30 bg-attention/10 text-attention"
                  : "border-border bg-selection text-muted-foreground",
            )}
          >
            {statusLabel}
          </span>
          {teammate.isLead ? (
            <span className="rounded-full border border-active-work/30 bg-active-work/10 px-2 py-0.5 text-[11px] text-active-work">
              Lead
            </span>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          {teammate.title} · reports to {managerName} · runs {RUNS_ON_PHRASES[teammate.runsOn]} ·
          wakes {describeWakeRule(teammate)}
        </p>
        {teammate.status !== "proposed" ? (
          <div className="max-w-sm">
            <SpendMeter teammate={teammate} />
          </div>
        ) : teammate.proposal ? (
          <p className="text-sm">{teammate.proposal.reason}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
