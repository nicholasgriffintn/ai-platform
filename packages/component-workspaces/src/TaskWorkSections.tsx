import {
  Button,
  cn,
  FormDialog,
  FormSelect,
  FormTextarea,
  Link,
} from "@ngriffin_uk/polychat-component-ui";
import {
  PROJECT_TASK_PRIORITIES,
  projectTaskPriorityLabels,
  type AnswerStandupInput,
  type ProjectTask,
  type ProjectTaskDetails,
  type ProjectTaskLinked,
  type ProjectTaskPriority,
  type ProjectTaskStandup,
  type ProjectTaskSummary,
  type ProjectTaskThreadPost,
  type WorkActor,
} from "@ngriffin_uk/polychat-schemas";
import { formatRelativeTime, initialsOf } from "@ngriffin_uk/polychat-utility-core";
import { AlertTriangle, Plus, X } from "lucide-react";
import { useState } from "react";

import {
  decodeWorkActor,
  describeWorkActor,
  encodeWorkActor,
  workActorOptions,
  type WorkDirectory,
} from "./work-actors";
import { WorkActorChip } from "./WorkTaskViews";

const LINK_LABELS: Record<ProjectTaskLinked["kind"], { outgoing: string; incoming: string }> = {
  raised_from: { outgoing: "Raised from", incoming: "Raised case" },
  resolved_by: { outgoing: "Resolved by", incoming: "Resolves" },
  duplicate_of: { outgoing: "Duplicate of", incoming: "Duplicated by" },
  relates_to: { outgoing: "Relates to", incoming: "Related" },
};

const inputClass =
  "min-w-0 flex-1 rounded-md border border-border bg-canvas px-3 py-1.5 text-sm placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

export function TaskSection({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {meta ? <span className="text-xs text-muted-foreground">{meta}</span> : null}
      </div>
      {children}
    </section>
  );
}

function resolveAuthorName(post: ProjectTaskThreadPost, directory: WorkDirectory): string {
  if (post.author.teammateId) {
    return describeWorkActor({ type: "teammate", id: post.author.teammateId }, directory);
  }

  if (post.author.userId) {
    return describeWorkActor({ type: "person", userId: post.author.userId }, directory);
  }

  return post.author.name;
}

export function TaskThread({
  thread,
  directory,
  isBusy,
  onComment,
  renderBody,
}: {
  thread: readonly ProjectTaskThreadPost[];
  directory: WorkDirectory;
  isBusy: boolean;
  onComment: (body: string) => Promise<unknown>;
  renderBody?: (body: string) => React.ReactNode;
}) {
  const [comment, setComment] = useState("");

  return (
    <TaskSection title="Thread" meta={thread.length ? `${thread.length} posts` : undefined}>
      {thread.length ? (
        <ol className="space-y-4">
          {thread.map((post) => {
            const name = resolveAuthorName(post, directory);

            return post.kind === "event" ? (
              <li key={post.id} className="flex gap-3 pl-1 text-xs text-muted-foreground">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-border-strong" />
                <span>
                  {post.body}
                  <span className="ml-2">{formatRelativeTime(post.createdAt)}</span>
                </span>
              </li>
            ) : (
              <li key={post.id} className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-3">
                <span
                  className={cn(
                    "grid h-7 w-7 place-items-center rounded-full text-[11px] font-semibold",
                    post.author.kind === "teammate"
                      ? "bg-active-work/15 text-active-work"
                      : "bg-selection text-foreground",
                  )}
                  aria-hidden
                >
                  {initialsOf(name)}
                </span>
                <div className="min-w-0 rounded-lg border border-border bg-surface px-3 py-2">
                  <p className="flex flex-wrap items-baseline gap-2 text-sm">
                    <span className="font-medium">{name}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeTime(post.createdAt)}
                    </span>
                  </p>
                  {renderBody ? (
                    <div className="mt-1 text-sm leading-6">{renderBody(post.body)}</div>
                  ) : (
                    <p className="mt-1 text-sm leading-6 whitespace-pre-wrap">{post.body}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="text-sm text-muted-foreground">
          No updates yet. Teammates post progress here as they work.
        </p>
      )}
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();

          if (comment.trim()) {
            void onComment(comment.trim()).then(() => setComment(""));
          }
        }}
      >
        <FormTextarea
          aria-label="Reply"
          rows={3}
          placeholder="Reply, or @name a teammate to wake it…"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
        />
        <div className="flex justify-end">
          <Button type="submit" size="sm" variant="primary" disabled={isBusy || !comment.trim()}>
            Post
          </Button>
        </div>
      </form>
    </TaskSection>
  );
}

export function TaskSubTasks({
  subTasks,
  directory,
  taskHref,
  canAdd,
  isBusy,
  onAdd,
}: {
  subTasks: readonly ProjectTaskSummary[];
  directory: WorkDirectory;
  taskHref: (task: Pick<ProjectTask, "id" | "projectId">) => string;
  canAdd: boolean;
  isBusy: boolean;
  onAdd: (objective: string) => Promise<unknown>;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [objective, setObjective] = useState("");
  const done = subTasks.filter((child) => child.status === "done").length;

  if (!subTasks.length && !canAdd) {
    return null;
  }

  return (
    <TaskSection
      title="Sub-tasks"
      meta={subTasks.length ? `${done} of ${subTasks.length} done` : undefined}
    >
      {subTasks.length ? (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
          {subTasks.map((child) => (
            <li key={child.id}>
              <Link
                href={taskHref(child)}
                className="flex items-center gap-3 px-3 py-2 text-sm no-underline hover:bg-selection/50 hover:!no-underline"
              >
                <span className="w-16 shrink-0 font-mono text-xs text-muted-foreground">
                  {child.key}
                </span>
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate",
                    child.status === "done" && "text-muted-foreground line-through",
                  )}
                >
                  {child.objective}
                </span>
                <WorkActorChip
                  name={describeWorkActor(child.owner, directory)}
                  isTeammate={child.owner?.type === "teammate"}
                />
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {canAdd ? (
        isAdding ? (
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();

              if (objective.trim()) {
                void onAdd(objective.trim()).then(() => setObjective(""));
              }
            }}
          >
            <input
              aria-label="New sub-task"
              className={inputClass}
              placeholder="What needs doing?"
              value={objective}
              onChange={(event) => setObjective(event.target.value)}
            />
            <Button
              type="submit"
              size="sm"
              variant="secondary"
              disabled={isBusy || !objective.trim()}
            >
              Add
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-label="Stop adding sub-tasks"
              icon={<X size={14} />}
              onClick={() => setIsAdding(false)}
            />
          </form>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            icon={<Plus size={14} />}
            onClick={() => setIsAdding(true)}
          >
            Add sub-task
          </Button>
        )
      ) : null}
    </TaskSection>
  );
}

export function TaskLinks({
  links,
  taskHref,
  onUnlink,
}: {
  links: readonly ProjectTaskLinked[];
  taskHref: (task: Pick<ProjectTask, "id" | "projectId">) => string;
  onUnlink: (linkId: string) => void;
}) {
  if (!links.length) {
    return null;
  }

  return (
    <TaskSection title="Linked">
      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
        {links.map((link) => (
          <li key={link.id} className="group flex items-center gap-3 px-3 py-2 text-sm">
            <span className="w-24 shrink-0 text-xs text-muted-foreground">
              {LINK_LABELS[link.kind][link.direction]}
            </span>
            <Link href={taskHref(link.task)} className="min-w-0 flex-1 truncate">
              <span className="mr-2 font-mono text-xs text-muted-foreground">{link.task.key}</span>
              {link.task.objective}
            </Link>
            <Button
              size="xs"
              variant="ghost"
              aria-label={`Unlink ${link.task.key ?? link.task.objective}`}
              className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
              icon={<X size={13} />}
              onClick={() => onUnlink(link.id)}
            />
          </li>
        ))}
      </ul>
    </TaskSection>
  );
}

const CASE_SOURCE_LABELS: Record<NonNullable<ProjectTaskDetails["case"]>["source"], string> = {
  person: "in Polychat",
  teammate: "by a teammate",
  channel: "over a channel",
  email: "by email",
  webhook: "by webhook",
  github: "from GitHub",
  integration: "from an integration",
};

function CaseReplyForm({
  caseDetail,
  directory,
  isBusy,
  onSend,
}: {
  caseDetail: NonNullable<ProjectTaskDetails["case"]>;
  directory: WorkDirectory;
  isBusy: boolean;
  onSend: (body: string) => Promise<unknown>;
}) {
  const [body, setBody] = useState(caseDetail.draftReply?.body ?? "");
  const draft = caseDetail.draftReply;

  return (
    <form
      className="space-y-2 border-t border-border pt-3"
      onSubmit={(event) => {
        event.preventDefault();

        if (body.trim()) {
          void onSend(body.trim()).then(() => setBody(""));
        }
      }}
    >
      <FormTextarea
        label={`Reply to ${caseDetail.requester.name}`}
        description={
          draft
            ? `Drafted by ${describeWorkActor(draft.draftedBy, directory)} ${formatRelativeTime(draft.at)}. Nothing is sent until you send it.`
            : "Sent on the thread the case arrived on."
        }
        rows={4}
        value={body}
        placeholder="Write a reply"
        onChange={(event) => setBody(event.target.value)}
      />
      <div className="flex justify-end">
        <Button type="submit" size="sm" variant="primary" disabled={isBusy || !body.trim()}>
          Send reply
        </Button>
      </div>
    </form>
  );
}

export function TaskCaseSection({
  caseDetail,
  directory,
  isBusy,
  onResolve,
  onSendReply,
}: {
  caseDetail: NonNullable<ProjectTaskDetails["case"]>;
  directory: WorkDirectory;
  isBusy: boolean;
  onResolve: (resolution: string) => void;
  onSendReply: (body: string) => Promise<unknown>;
}) {
  const [resolution, setResolution] = useState("");

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <div className="space-y-0.5">
        <p className="text-sm">
          Raised by <span className="font-medium">{caseDetail.requester.name}</span>{" "}
          {CASE_SOURCE_LABELS[caseDetail.source]}
          {caseDetail.requester.address ? (
            <span className="text-muted-foreground"> · {caseDetail.requester.address}</span>
          ) : null}
        </p>
        {caseDetail.channel?.subject ? (
          <p className="text-xs text-muted-foreground">Subject: {caseDetail.channel.subject}</p>
        ) : null}
      </div>
      {caseDetail.resolution ? (
        <p className="text-sm text-success">Resolved: {caseDetail.resolution}</p>
      ) : (
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();

            if (resolution.trim()) {
              onResolve(resolution.trim());
              setResolution("");
            }
          }}
        >
          <input
            aria-label="Resolution"
            className={inputClass}
            placeholder="How was this resolved?"
            value={resolution}
            onChange={(event) => setResolution(event.target.value)}
          />
          <Button
            type="submit"
            size="sm"
            variant="secondary"
            disabled={isBusy || !resolution.trim()}
          >
            Resolve case
          </Button>
        </form>
      )}
      {caseDetail.channel ? (
        <CaseReplyForm
          key={caseDetail.draftReply?.at ?? "none"}
          caseDetail={caseDetail}
          directory={directory}
          isBusy={isBusy}
          onSend={onSendReply}
        />
      ) : null}
    </div>
  );
}

function StandupAnswerForm({
  questions,
  draft,
  isBusy,
  onSubmit,
}: {
  questions: readonly string[];
  draft: AnswerStandupInput | null;
  isBusy: boolean;
  onSubmit: (input: AnswerStandupInput) => void;
}) {
  const [answers, setAnswers] = useState<string[]>(() =>
    questions.map((_question, index) => draft?.answers[index]?.answer ?? ""),
  );

  return (
    <form
      className="space-y-3 rounded-lg border border-active-work/30 bg-active-work/5 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({
          answers: questions.map((question, index) => ({ question, answer: answers[index] ?? "" })),
        });
      }}
    >
      <p className="text-sm font-semibold">Your answers</p>
      {draft ? (
        <p className="text-xs text-muted-foreground">
          Drafted from your task activity. Edit before sending.
        </p>
      ) : null}
      {questions.map((question, index) => (
        <FormTextarea
          key={question}
          label={question}
          rows={2}
          value={answers[index] ?? ""}
          onChange={(event) =>
            setAnswers((current) =>
              current.map((value, position) => (position === index ? event.target.value : value)),
            )
          }
        />
      ))}
      <Button type="submit" variant="primary" size="sm" disabled={isBusy}>
        Send answers
      </Button>
    </form>
  );
}

export function TaskStandupSection({
  standup,
  awaitingMe,
  draft,
  isBusy,
  onAnswer,
}: {
  standup: ProjectTaskStandup;
  awaitingMe: boolean;
  draft: AnswerStandupInput | null;
  isBusy: boolean;
  onAnswer: (input: AnswerStandupInput) => void;
}) {
  return (
    <TaskSection
      title="Standup"
      meta={`${standup.answers.length} of ${standup.participants.length} answered`}
    >
      {standup.summary ? (
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Summary
          </p>
          <p className="text-sm leading-6 whitespace-pre-wrap">{standup.summary}</p>
        </div>
      ) : null}
      {awaitingMe ? (
        <StandupAnswerForm
          key={draft ? "drafted" : "blank"}
          questions={standup.questions}
          draft={draft}
          isBusy={isBusy}
          onSubmit={onAnswer}
        />
      ) : null}
      {standup.answers.length ? (
        <ul className="space-y-2">
          {standup.answers.map((answer) => (
            <li
              key={answer.answeredAt + answer.name}
              className="rounded-lg border border-border p-3 text-sm"
            >
              <p className="font-medium">{answer.name}</p>
              <dl className="mt-1 space-y-1">
                {answer.answers.map((entry) => (
                  <div key={entry.question}>
                    <dt className="text-xs text-muted-foreground">{entry.question}</dt>
                    <dd>{entry.answer || "—"}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      ) : null}
    </TaskSection>
  );
}

export function TaskEscalationBanner({
  escalation,
  directory,
  isBusy,
  onClear,
}: {
  escalation: NonNullable<ProjectTaskDetails["escalation"]>;
  directory: WorkDirectory;
  isBusy: boolean;
  onClear: () => void;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-failure/40 bg-failure/10 p-3 text-sm">
      <AlertTriangle size={16} className="mt-0.5 shrink-0 text-failure" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          Escalated to {describeWorkActor(escalation.to, directory)} by{" "}
          {describeWorkActor(escalation.by, directory)}
        </p>
        <p className="mt-0.5 text-foreground">{escalation.reason}</p>
      </div>
      <Button size="xs" variant="secondary" disabled={isBusy} onClick={onClear}>
        Mark handled
      </Button>
    </div>
  );
}

function PropertyRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-2 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function TaskPropertiesPanel({
  task,
  directory,
  isBusy,
  onAssign,
  onSetReviewer,
  onSetPriority,
  onSetDueAt,
  children,
}: {
  task: ProjectTask;
  directory: WorkDirectory;
  isBusy: boolean;
  onAssign: (owner: WorkActor | null) => void;
  onSetReviewer: (reviewer: WorkActor) => void;
  onSetPriority: (priority: ProjectTaskPriority) => void;
  onSetDueAt: (dueAt: string | null) => void;
  children?: React.ReactNode;
}) {
  const options = workActorOptions(directory);
  const isFinished = task.status === "done" || task.status === "cancelled";
  const isRunning = task.status === "running" || task.status === "queued";

  return (
    <div className="divide-y divide-border">
      <div className="pb-2">
        <PropertyRow label="Owner">
          <FormSelect
            aria-label="Owner"
            options={options}
            value={encodeWorkActor(task.owner)}
            disabled={isBusy || isRunning || isFinished}
            triggerClassName="w-full"
            onValueChange={(value) => onAssign(decodeWorkActor(value))}
          />
        </PropertyRow>
        <PropertyRow label="Reviewer">
          <FormSelect
            aria-label="Reviewer"
            options={options.filter((option) => option.value !== "none")}
            value={task.reviewer ? encodeWorkActor(task.reviewer) : ""}
            placeholder="Nobody yet"
            disabled={isBusy || isFinished}
            triggerClassName="w-full"
            onValueChange={(value) => {
              const reviewer = decodeWorkActor(value);

              if (reviewer) {
                onSetReviewer(reviewer);
              }
            }}
          />
        </PropertyRow>
        <PropertyRow label="Priority">
          <FormSelect
            aria-label="Priority"
            options={PROJECT_TASK_PRIORITIES.map((priority) => ({
              value: priority,
              label: projectTaskPriorityLabels[priority],
            }))}
            value={task.priority}
            disabled={isBusy}
            triggerClassName="w-full"
            onValueChange={onSetPriority}
          />
        </PropertyRow>
        <PropertyRow label="Due">
          <input
            aria-label="Due date"
            type="date"
            className="w-full rounded-md border border-border bg-canvas px-2 py-1.5 text-sm"
            value={task.dueAt ? task.dueAt.slice(0, 10) : ""}
            disabled={isBusy}
            onChange={(event) =>
              onSetDueAt(
                event.target.value
                  ? new Date(`${event.target.value}T17:00:00Z`).toISOString()
                  : null,
              )
            }
          />
        </PropertyRow>
        <PropertyRow label="Responsible">
          <span>
            {task.runnerIdentityUserId
              ? describeWorkActor({ type: "person", userId: task.runnerIdentityUserId }, directory)
              : "Whoever starts it"}
          </span>
        </PropertyRow>
      </div>
      {children}
    </div>
  );
}

export function TaskTextDialog({
  open,
  title,
  description,
  label,
  submitText,
  isBusy,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  title: string;
  description: string;
  label: string;
  submitText: string;
  isBusy: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (text: string) => Promise<unknown>;
}) {
  const [text, setText] = useState("");

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      submitText={submitText}
      isLoading={isBusy}
      submitDisabled={!text.trim()}
      onSubmit={async () => {
        await onSubmit(text.trim());
        setText("");
        onOpenChange(false);
      }}
    >
      <FormTextarea
        label={label}
        rows={3}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
    </FormDialog>
  );
}
