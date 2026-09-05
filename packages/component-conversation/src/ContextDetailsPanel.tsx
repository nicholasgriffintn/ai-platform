import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  cn,
} from "@ngriffin_uk/polychat-component-ui";
import {
  creditsFromCreditMicros,
  type ChatContextOmission,
  type ChatContextSnapshot,
  type ChatRunUsage,
} from "@ngriffin_uk/polychat-schemas";
import { BookOpenText, ExternalLink } from "lucide-react";

interface ContextDetailsPanelProps {
  context?: ChatContextSnapshot | null;
  usage?: ChatRunUsage;
  resolveReferenceHref?: (path: string) => string;
}

interface ContextDetailsButtonProps extends ContextDetailsPanelProps {
  compactOnMobile?: boolean;
}

function omissionLabel(omission: ChatContextOmission): string {
  if (omission.kind === "tool_result") {
    return "Tool result shortened";
  }

  if (omission.kind === "source") {
    return "Attached source omitted";
  }

  return `${omission.count.toLocaleString()} older message${omission.count === 1 ? "" : "s"} omitted`;
}

function ReferenceLink({
  label,
  path,
  resolveReferenceHref,
}: {
  label: string;
  path: string | null;
  resolveReferenceHref?: (path: string) => string;
}) {
  if (!path || !resolveReferenceHref) {
    return null;
  }

  return (
    <a
      href={resolveReferenceHref(path)}
      target="_blank"
      rel="noreferrer"
      aria-label={`Open ${label}`}
      className="inline-flex shrink-0 items-center text-muted-foreground hover:text-foreground"
    >
      <ExternalLink className="h-3 w-3" aria-hidden="true" />
    </a>
  );
}

export function ContextDetailsButton({
  context,
  usage,
  resolveReferenceHref,
  compactOnMobile = false,
}: ContextDetailsButtonProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          collapseLabel={compactOnMobile ? "container" : false}
          className="flex-shrink-0 text-muted-foreground hover:text-foreground"
          title="View run context"
          aria-label="View run context"
          icon={<BookOpenText className="h-3.5 w-3.5" />}
        >
          Context
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        sideOffset={8}
        className="max-h-[min(38rem,76dvh)] w-[min(94vw,38rem)] overflow-y-auto rounded-xl p-0"
        aria-label="Run context"
      >
        <ContextDetailsPanel
          context={context}
          usage={usage}
          resolveReferenceHref={resolveReferenceHref}
        />
      </PopoverContent>
    </Popover>
  );
}

export function ContextDetailsPanel({
  context,
  usage,
  resolveReferenceHref,
}: ContextDetailsPanelProps) {
  const usagePercent = context
    ? Math.min(100, Math.round((context.usage.inputTokens / context.usage.contextWindow) * 100))
    : 0;

  return (
    <div className="text-xs text-muted-foreground">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 font-medium text-foreground">
          <BookOpenText className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Run context</span>
          <span className="ml-auto font-normal text-muted-foreground">
            {context
              ? `Step ${context.step.toLocaleString()}`
              : `Attempt ${usage?.currentAttempt ?? 1}`}
          </span>
        </div>
        <p className="mt-1 text-muted-foreground">
          {context
            ? `${context.model}${context.provider ? ` via ${context.provider}` : " · provider unavailable"}`
            : "Model context unavailable"}
        </p>
        {context ? (
          <>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span>
                {context.usage.inputTokens.toLocaleString()} {context.usage.source} tokens
              </span>
              <span className="text-muted-foreground">
                {context.usage.contextWindow.toLocaleString()} limit
              </span>
            </div>
            <progress
              aria-label="Context window usage"
              max={100}
              value={usagePercent}
              className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full accent-active-work"
            />
            <p className="mt-2 text-muted-foreground">
              {context.messages.included.toLocaleString()} messages included
              {context.messages.omitted > 0
                ? ` · ${context.messages.omitted.toLocaleString()} omitted`
                : " · none omitted"}
            </p>
          </>
        ) : null}
      </div>

      {usage ? (
        <section className="border-b border-border px-4 py-3">
          <h3 className="font-medium text-foreground">Usage and settlement</h3>
          <ul className="mt-2 space-y-1.5">
            <li>
              Provider measurement: {usage.measurement}
              {usage.measurement === "unknown" ? " · usage was not reported" : ""}
            </li>
            <li>
              {usage.reservation
                ? `Reserved estimate: ${creditsFromCreditMicros(usage.reservation.creditMicros).toLocaleString()} credits · not a charge`
                : "Reserved estimate: none recorded"}
            </li>
            <li>
              {usage.consumption.creditMicros === null
                ? "Recorded consumption: unknown"
                : `Recorded consumption: ${creditsFromCreditMicros(usage.consumption.creditMicros).toLocaleString()} credits`}
            </li>
            <li>Settlement: {usage.settlement.status}</li>
          </ul>
        </section>
      ) : null}

      {context ? (
        <>
          <section className="border-b border-border px-4 py-3">
            <h3 className="font-medium text-foreground">Attached sources</h3>
            {context.sources.length > 0 ? (
              <ul className="mt-2 space-y-1.5">
                {context.sources.map((source) => (
                  <li key={source.id} className="flex min-w-0 items-center gap-2">
                    <span className="min-w-0 flex-1 truncate">{source.name}</span>
                    <span
                      className={cn(
                        "shrink-0 text-muted-foreground",
                        source.status !== "included" && "text-attention",
                      )}
                    >
                      {source.status}
                    </span>
                    <ReferenceLink
                      label={source.name}
                      path={source.retrievalPath}
                      resolveReferenceHref={resolveReferenceHref}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1.5 text-muted-foreground">No attached sources.</p>
            )}
          </section>

          <section className="border-b border-border px-4 py-3">
            <h3 className="font-medium text-foreground">Approval references</h3>
            {context.approvals?.length ? (
              <ul className="mt-2 space-y-1.5">
                {context.approvals.map((approval) => (
                  <li key={approval.id}>
                    {approval.toolName ?? approval.type} · {approval.status}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1.5 text-muted-foreground">No recorded approval references.</p>
            )}
          </section>

          <section className="border-b border-border px-4 py-3">
            <h3 className="font-medium text-foreground">Effective skills</h3>
            {context.skills.length > 0 ? (
              <ul className="mt-2 space-y-1.5">
                {context.skills.map((skill) => (
                  <li key={skill.id}>
                    {skill.name} · {skill.state}
                    {skill.revision ? ` · r${skill.revision}` : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1.5 text-muted-foreground">No skills were effective.</p>
            )}
          </section>

          <section className="border-b border-border px-4 py-3">
            <h3 className="font-medium text-foreground">Active summary</h3>
            {context.summary ? (
              <details className="mt-2 rounded-lg bg-surface-elevated px-3 py-2">
                <summary className="cursor-pointer font-medium">
                  {context.summary.representedMessageCount.toLocaleString()} of{" "}
                  {context.summary.candidateMessageCount.toLocaleString()} candidate messages
                  {` · ${context.summary.status}`}
                  {context.summary.fallback ? " · verbatim fallback" : ""}
                </summary>
                <p className="mt-2 whitespace-pre-wrap text-foreground">{context.summary.text}</p>
              </details>
            ) : (
              <p className="mt-1.5 text-muted-foreground">No active summary.</p>
            )}
          </section>

          <section className="px-4 py-3">
            <h3 className="font-medium text-foreground">Omissions</h3>
            {context.omissions.length > 0 ? (
              <ul className="mt-2 space-y-1.5">
                {context.omissions.map((omission) => (
                  <li key={omission.id} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1">{omissionLabel(omission)}</span>
                    <ReferenceLink
                      label={omissionLabel(omission)}
                      path={omission.retrievalPath}
                      resolveReferenceHref={resolveReferenceHref}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1.5 text-muted-foreground">
                Nothing was omitted from this model call.
              </p>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
