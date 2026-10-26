import {
  Badge,
  Button,
  cn,
  EmptyState,
  FormDialog,
  FormInput,
  FormSelect,
  FormTextarea,
  Link,
  Switch,
} from "@ngriffin_uk/polychat-component-ui";
import type {
  CreateInitiativeInput,
  Initiative,
  StandupSettings,
  WorkInboxItem,
} from "@ngriffin_uk/polychat-schemas";
import { SHORT_WEEKDAY_LABELS } from "@ngriffin_uk/polychat-utility-core";
import { Pencil, Target, Users } from "lucide-react";
import { useState } from "react";

const INBOX_LABELS: Record<WorkInboxItem["kind"], string> = {
  task: "Task",
  hire: "Hire",
  budget: "Budget",
  standup: "Standup",
  escalation: "Escalation",
  setup: "Setup plan",
  paused: "Paused",
};

export function WorkQuickAdd({
  placeholder = "Ask for something, or describe a task…",
  isSubmitting,
  onSubmit,
}: {
  placeholder?: string;
  isSubmitting: boolean;
  onSubmit: (text: string) => Promise<unknown>;
}) {
  const [text, setText] = useState("");

  return (
    <form
      className="flex items-center gap-2 rounded-lg border border-border bg-canvas px-3 py-2"
      onSubmit={(event) => {
        event.preventDefault();

        if (text.trim()) {
          void onSubmit(text.trim()).then(() => setText(""));
        }
      }}
    >
      <input
        aria-label="New task"
        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        placeholder={placeholder}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      <Button type="submit" size="xs" variant="primary" disabled={isSubmitting || !text.trim()}>
        Add
      </Button>
    </form>
  );
}

export function WorkInboxDecisions({
  items,
  canDecideHire,
  isBusy,
  onDecideHire,
}: {
  items: readonly WorkInboxItem[];
  canDecideHire: (workspaceId: string) => boolean;
  isBusy: boolean;
  onDecideHire: (item: WorkInboxItem, decision: "approve" | "reject") => void;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section aria-label="Decisions" className="space-y-2">
      <h2 className="text-sm font-semibold">Waiting on you</h2>
      <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
        {items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <span
              className={cn(
                "rounded px-1.5 py-0.5 font-mono text-[10px]",
                item.kind === "escalation" || item.kind === "paused"
                  ? "bg-failure/10 text-failure"
                  : item.kind === "budget"
                    ? "bg-attention/10 text-attention"
                    : "bg-active-work/10 text-active-work",
              )}
            >
              {INBOX_LABELS[item.kind]}
            </span>
            <Link href={item.deepLink} className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{item.title}</span>
              {item.detail ? (
                <span className="block truncate text-xs text-muted-foreground">{item.detail}</span>
              ) : null}
            </Link>
            {item.kind === "hire" && item.teammateId && canDecideHire(item.workspaceId) ? (
              <span className="flex gap-2">
                <Button
                  size="xs"
                  variant="primary"
                  disabled={isBusy}
                  onClick={() => onDecideHire(item, "approve")}
                >
                  Approve
                </Button>
                <Button
                  size="xs"
                  variant="secondary"
                  disabled={isBusy}
                  onClick={() => onDecideHire(item, "reject")}
                >
                  Reject
                </Button>
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function InitiativeDialog({
  open,
  projects,
  isSaving,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  projects: readonly { id: string; name: string }[];
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: CreateInitiativeInput) => Promise<unknown>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [projectIds, setProjectIds] = useState<string[]>([]);

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="New initiative"
      description="An outcome the workspace is working towards. Projects linked to it roll their tasks up into its progress."
      submitText="Create initiative"
      isLoading={isSaving}
      submitDisabled={!name.trim()}
      onSubmit={async () => {
        await onSubmit({
          name: name.trim(),
          description: description.trim(),
          status: "active",
          targetDate: targetDate || null,
          ownerTeammateId: null,
          projectIds,
        });
        setName("");
        setDescription("");
        setTargetDate("");
        setProjectIds([]);
        onOpenChange(false);
      }}
    >
      <div className="space-y-4">
        <FormInput
          label="Name"
          placeholder="Close the books in two days"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <FormTextarea
          label="Why it matters"
          rows={2}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        <FormInput
          label="Target date"
          type="date"
          value={targetDate}
          onChange={(event) => setTargetDate(event.target.value)}
        />
        {projects.length ? (
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-medium">Projects</legend>
            <div className="flex flex-wrap gap-2">
              {projects.map((project) => {
                const selected = projectIds.includes(project.id);

                return (
                  <button
                    key={project.id}
                    type="button"
                    aria-pressed={selected}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs transition-colors",
                      selected
                        ? "border-active-work bg-active-work/10 text-active-work"
                        : "border-border text-muted-foreground hover:border-border-strong",
                    )}
                    onClick={() =>
                      setProjectIds((current) =>
                        selected
                          ? current.filter((projectId) => projectId !== project.id)
                          : [...current, project.id],
                      )
                    }
                  >
                    {project.name}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ) : null}
      </div>
    </FormDialog>
  );
}

function MissionStatement({
  mission,
  canManage,
  isSaving,
  onSave,
}: {
  mission: string;
  canManage: boolean;
  isSaving: boolean;
  onSave: (mission: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(mission);

  if (isEditing) {
    return (
      <form
        className="space-y-3 rounded-xl border border-border bg-surface p-5"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(draft.trim());
          setIsEditing(false);
        }}
      >
        <FormTextarea
          label="Mission"
          rows={2}
          value={draft}
          placeholder="What is this organisation for?"
          onChange={(event) => setDraft(event.target.value)}
        />
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setDraft(mission);
              setIsEditing(false);
            }}
          >
            Cancel
          </Button>
          <Button type="submit" size="sm" variant="primary" disabled={isSaving || !draft.trim()}>
            Save mission
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex items-start gap-4 rounded-xl border border-border bg-surface p-5">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Mission
        </p>
        <p className={cn("text-lg leading-7 text-balance", !mission && "text-muted-foreground")}>
          {mission || "No mission yet. Teammates read it to understand why their work matters."}
        </p>
      </div>
      {canManage ? (
        <Button
          size="sm"
          variant="ghost"
          icon={<Pencil size={14} />}
          onClick={() => {
            setDraft(mission);
            setIsEditing(true);
          }}
        >
          {mission ? "Edit" : "Write it"}
        </Button>
      ) : null}
    </div>
  );
}

export function InitiativesView({
  mission,
  initiatives,
  projects,
  unalignedProjectIds,
  canManage,
  isSaving,
  onSaveMission,
  onToggleProject,
  onComplete,
}: {
  mission: string;
  initiatives: readonly Initiative[];
  projects: readonly { id: string; name: string; href: string }[];
  unalignedProjectIds: readonly string[];
  canManage: boolean;
  isSaving: boolean;
  onSaveMission: (mission: string) => void;
  onToggleProject: (initiative: Initiative, projectId: string) => void;
  onComplete: (initiative: Initiative) => void;
}) {
  const unaligned = projects.filter((project) => unalignedProjectIds.includes(project.id));

  return (
    <div className="space-y-8">
      <MissionStatement
        key={mission}
        mission={mission}
        canManage={canManage}
        isSaving={isSaving}
        onSave={onSaveMission}
      />

      {initiatives.length === 0 ? (
        <EmptyState
          icon={<Target size={24} className="text-muted-foreground" />}
          title="No initiatives yet"
          message="Initiatives are the outcomes your projects work towards. Link projects to one and its progress adds up from their tasks."
          className="min-h-[220px]"
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {initiatives.map((initiative) => {
            const ratio = initiative.progress.total
              ? initiative.progress.done / initiative.progress.total
              : 0;

            return (
              <article
                key={initiative.id}
                className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5"
              >
                <header className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <h3 className="text-base font-semibold text-balance">{initiative.name}</h3>
                    {initiative.description ? (
                      <p className="text-sm text-muted-foreground">{initiative.description}</p>
                    ) : null}
                  </div>
                  {initiative.status === "active" ? (
                    canManage ? (
                      <Button size="xs" variant="ghost" onClick={() => onComplete(initiative)}>
                        Mark complete
                      </Button>
                    ) : null
                  ) : (
                    <Badge variant="success">Completed</Badge>
                  )}
                </header>
                <div className="space-y-1.5">
                  <div className="flex items-baseline justify-between text-xs text-muted-foreground tabular-nums">
                    <span>
                      {initiative.progress.done} of {initiative.progress.total} tasks done
                    </span>
                    <span>
                      {initiative.targetDate
                        ? `Target ${new Date(initiative.targetDate).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                          })}`
                        : `${Math.round(ratio * 100)}%`}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-selection">
                    <div
                      className="h-full rounded-full bg-success transition-[width] duration-500"
                      style={{ width: `${ratio * 100}%` }}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {projects.map((project) => {
                    const included = initiative.projectIds.includes(project.id);

                    if (!canManage) {
                      return included ? (
                        <Link
                          key={project.id}
                          href={project.href}
                          className="rounded-full border border-border px-3 py-1 text-xs text-foreground no-underline hover:border-border-strong hover:!no-underline"
                        >
                          {project.name}
                        </Link>
                      ) : null;
                    }

                    return (
                      <button
                        key={project.id}
                        type="button"
                        aria-pressed={included}
                        title={included ? `Unlink ${project.name}` : `Link ${project.name}`}
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs transition-colors",
                          included
                            ? "border-active-work bg-active-work/10 text-active-work"
                            : "border-dashed border-border text-muted-foreground hover:border-border-strong",
                        )}
                        onClick={() => onToggleProject(initiative, project.id)}
                      >
                        {project.name}
                      </button>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {unaligned.length ? (
        <section className="space-y-2 rounded-xl border border-attention/30 bg-attention/5 p-4">
          <h2 className="text-sm font-semibold">Projects with no initiative</h2>
          <p className="text-sm text-muted-foreground">
            Their teammates can't see why the work matters. Link each one to an initiative above.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {unaligned.map((project) => (
              <Link
                key={project.id}
                href={project.href}
                className="rounded-full border border-border bg-surface px-3 py-1 text-xs text-foreground no-underline hover:border-border-strong hover:!no-underline"
              >
                {project.name}
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export function StandupSettingsForm({
  settings,
  channels,
  canManage,
  isSaving,
  onSave,
}: {
  settings: StandupSettings;
  channels: readonly { id: string; label: string }[];
  canManage: boolean;
  isSaving: boolean;
  onSave: (settings: StandupSettings) => void;
}) {
  const [draft, setDraft] = useState(settings);
  const isDirty = JSON.stringify(draft) !== JSON.stringify(settings);

  return (
    <form
      className="space-y-4 border-t border-border p-5"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(draft);
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-active-work/12 p-2 text-active-work">
            <Users size={17} />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Standup</h2>
            <p className="mt-0.5 max-w-xl text-xs text-muted-foreground">
              Each standup is a task. People answer in Inbox from a draft of their own activity,
              teammates answer from their runs, and the lead posts a summary.
            </p>
          </div>
        </div>
        <Switch
          aria-label="Run a standup"
          checked={draft.enabled}
          disabled={!canManage}
          onChange={(event) =>
            setDraft((current) => ({ ...current, enabled: event.target.checked }))
          }
        />
      </div>
      {draft.enabled ? (
        <div className="space-y-4 pl-11">
          <div className="grid gap-3 sm:grid-cols-3">
            <FormInput
              label="Time"
              type="time"
              value={draft.time}
              disabled={!canManage}
              onChange={(event) =>
                setDraft((current) => ({ ...current, time: event.target.value }))
              }
            />
            <FormInput
              label="Time zone"
              value={draft.timeZone}
              disabled={!canManage}
              onChange={(event) =>
                setDraft((current) => ({ ...current, timeZone: event.target.value }))
              }
            />
            <FormInput
              label="Answers close after (minutes)"
              inputMode="numeric"
              value={String(draft.windowMinutes)}
              disabled={!canManage}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  windowMinutes: Number(event.target.value) || current.windowMinutes,
                }))
              }
            />
          </div>
          <fieldset className="flex flex-wrap gap-2">
            <legend className="mb-1 text-sm font-medium">Days</legend>
            {SHORT_WEEKDAY_LABELS.map((day, index) => {
              const active = draft.days.includes(index);

              return (
                <button
                  key={day}
                  type="button"
                  disabled={!canManage}
                  aria-pressed={active}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs",
                    active
                      ? "border-active-work bg-active-work/10 text-active-work"
                      : "border-border text-muted-foreground",
                  )}
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      days: active
                        ? current.days.filter((value) => value !== index)
                        : [...current.days, index].sort((left, right) => left - right),
                    }))
                  }
                >
                  {day}
                </button>
              );
            })}
          </fieldset>
          <FormSelect
            label="Who takes part"
            options={[
              { value: "everyone", label: "People and teammates" },
              { value: "people", label: "People only" },
              { value: "teammates", label: "Teammates only" },
            ]}
            value={draft.participants}
            disabled={!canManage}
            onValueChange={(participants) => setDraft((current) => ({ ...current, participants }))}
          />
          <FormSelect
            label="Share the summary to"
            description="Owners and admins choose this. Posting to a channel happens only when it is set here."
            options={[
              { value: "none", label: "Only the standup task" },
              ...channels.map((channel) => ({ value: channel.id, label: channel.label })),
            ]}
            value={draft.shareBindingId ?? "none"}
            disabled={!canManage}
            onValueChange={(value) =>
              setDraft((current) => ({
                ...current,
                shareBindingId: value === "none" ? null : value,
              }))
            }
          />
          <FormTextarea
            label="Questions, one per line"
            rows={3}
            value={draft.questions.join("\n")}
            disabled={!canManage}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                questions: event.target.value
                  .split("\n")
                  .map((line) => line.trim())
                  .filter(Boolean)
                  .slice(0, 6),
              }))
            }
          />
        </div>
      ) : null}
      {canManage && isDirty ? (
        <div className="flex justify-end gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={() => setDraft(settings)}>
            Discard
          </Button>
          <Button
            type="submit"
            size="sm"
            variant="primary"
            disabled={isSaving || draft.days.length === 0 || draft.questions.length === 0}
          >
            Save standup
          </Button>
        </div>
      ) : null}
    </form>
  );
}
