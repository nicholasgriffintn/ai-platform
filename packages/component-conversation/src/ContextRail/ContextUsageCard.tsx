import { WorkbenchCard, cn } from "@ngriffin_uk/polychat-component-ui";
import { formatStatsTokens } from "@ngriffin_uk/polychat-library-chat/response-stats";
import type { ChatContextSnapshot } from "@ngriffin_uk/polychat-schemas";
import { formatRelativeTime } from "@ngriffin_uk/polychat-utility-core";
import { ChevronRight, ExternalLink, Gauge } from "lucide-react";
import type { ReactNode } from "react";

import {
  buildContextSegments,
  contextPressureTone,
  formatContextShare,
  omissionLabel,
} from "./labels.js";

export interface ContextUsageFallback {
  inputTokens?: number;
  contextWindow?: number;
}

interface ContextUsageCardProps {
  snapshot?: ChatContextSnapshot | null;
  fallback?: ContextUsageFallback;
  resolveReferenceHref?: (path: string) => string;
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
      className="inline-flex shrink-0 items-center hover:text-foreground"
    >
      <ExternalLink className="size-3" aria-hidden="true" />
    </a>
  );
}

function ContextDisclosure({
  label,
  count,
  tone,
  children,
}: {
  label: string;
  count: ReactNode;
  tone?: "attention";
  children: ReactNode;
}) {
  return (
    <details className="group">
      <summary className="polychat-motion-micro -mx-1 flex min-h-6 cursor-pointer list-none items-center gap-1.5 rounded-md px-1 hover:text-foreground [&::-webkit-details-marker]:hidden">
        <ChevronRight
          aria-hidden="true"
          className="polychat-motion-micro size-3 shrink-0 transition-transform group-open:rotate-90"
        />
        <span className="flex-1">{label}</span>
        <span
          className={cn(
            "font-mono text-[11px] tabular-nums",
            tone === "attention" && "text-attention",
          )}
        >
          {count}
        </span>
      </summary>
      <div className="mt-1 mb-1.5 ml-[18px]">{children}</div>
    </details>
  );
}

function SegmentBar({
  segments,
  contextWindow,
}: {
  segments: ReturnType<typeof buildContextSegments>;
  contextWindow: number;
}) {
  return (
    <div
      aria-hidden="true"
      className="flex h-2 w-full gap-px overflow-hidden rounded-full bg-selection"
    >
      {segments
        .filter((segment) => segment.key !== "free")
        .map((segment) => (
          <span
            key={segment.key}
            className={cn("polychat-motion-panel h-full", segment.swatch)}
            style={{ width: `${Math.max((segment.tokens / contextWindow) * 100, 0.6)}%` }}
          />
        ))}
    </div>
  );
}

function SegmentLegend({
  segments,
  contextWindow,
}: {
  segments: ReturnType<typeof buildContextSegments>;
  contextWindow: number;
}) {
  return (
    <ul className="mt-3 space-y-1">
      {segments.map((segment) => (
        <li key={segment.key} className="flex min-h-5 items-center gap-2">
          <span
            aria-hidden="true"
            className={cn(
              "size-2 shrink-0 rounded-[3px]",
              segment.swatch,
              segment.key === "free" && "border border-border-strong",
            )}
          />
          <span
            className={cn(
              "min-w-0 flex-1 truncate",
              segment.key === "free" || segment.key === "reserved"
                ? "text-muted-foreground"
                : "text-foreground",
            )}
          >
            {segment.label}
          </span>
          <span className="shrink-0 font-mono text-[11px] tabular-nums">
            {formatStatsTokens(segment.tokens)}
          </span>
          <span className="w-11 shrink-0 text-right font-mono text-[11px] tabular-nums">
            {formatContextShare(segment.tokens, contextWindow)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function UsageHeadline({
  inputTokens,
  contextWindow,
}: {
  inputTokens: number;
  contextWindow: number;
}) {
  const percent = Math.min(100, Math.round((inputTokens / contextWindow) * 100));

  return (
    <>
      <meter
        className="sr-only"
        aria-label="Context window usage"
        min={0}
        max={100}
        value={percent}
      >
        {percent}%
      </meter>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className={cn("text-sm font-medium tabular-nums", contextPressureTone(percent))}>
          {percent}% used
        </span>
        <span className="font-mono text-[11px] tabular-nums">
          {formatStatsTokens(inputTokens)} / {formatStatsTokens(contextWindow)}
        </span>
      </div>
    </>
  );
}

function SnapshotDetails({
  snapshot,
  resolveReferenceHref,
}: {
  snapshot: ChatContextSnapshot;
  resolveReferenceHref?: (path: string) => string;
}) {
  const loadedSkills = snapshot.skills.filter((skill) => skill.state === "loaded");
  const includedSources = snapshot.sources.filter((source) => source.status === "included");
  const pendingApprovals = snapshot.approvals?.filter((approval) => approval.status === "pending");
  const leftOutCount =
    snapshot.messages.omitted +
    snapshot.omissions.filter((entry) => entry.kind !== "history").length;

  return (
    <div className="mt-3 space-y-0.5 border-t border-border pt-2">
      <div className="flex min-h-6 items-center gap-1.5 pl-[18px]">
        <span className="flex-1">History</span>
        <span className="font-mono text-[11px] tabular-nums">
          {snapshot.messages.included.toLocaleString()} messages
          {snapshot.messages.omitted > 0 ? (
            <span className="text-attention">
              {" "}
              · {snapshot.messages.omitted.toLocaleString()} left out
            </span>
          ) : null}
        </span>
      </div>
      {snapshot.skills.length > 0 ? (
        <ContextDisclosure
          label="Skills"
          count={`${loadedSkills.length}/${snapshot.skills.length}`}
        >
          <ul className="flex flex-wrap gap-1">
            {snapshot.skills.map((skill) => (
              <li
                key={skill.id}
                title={skill.state === "loaded" ? "Loaded into this call" : "Offered, not loaded"}
                className={cn(
                  "max-w-full truncate rounded-md border px-1.5 py-0.5",
                  skill.state === "loaded"
                    ? "border-accent-violet/40 bg-accent-violet/10 text-foreground"
                    : "border-border",
                )}
              >
                {skill.name}
              </li>
            ))}
          </ul>
        </ContextDisclosure>
      ) : null}
      {snapshot.sources.length > 0 ? (
        <ContextDisclosure
          label="Sources"
          count={`${includedSources.length}/${snapshot.sources.length}`}
          tone={includedSources.length < snapshot.sources.length ? "attention" : undefined}
        >
          <ul className="space-y-1">
            {snapshot.sources.map((source) => (
              <li key={source.id} className="flex min-w-0 items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-foreground" title={source.name}>
                  {source.name}
                </span>
                {source.status !== "included" ? (
                  <span className="shrink-0 text-attention">{source.status}</span>
                ) : null}
                <ReferenceLink
                  label={source.name}
                  path={source.retrievalPath}
                  resolveReferenceHref={resolveReferenceHref}
                />
              </li>
            ))}
          </ul>
        </ContextDisclosure>
      ) : null}
      {snapshot.documents?.length ? (
        <ContextDisclosure label="Memory documents" count={snapshot.documents.length}>
          <ul className="space-y-1">
            {snapshot.documents.map((document) => (
              <li key={document.id} className="flex items-center gap-2">
                <span className="flex-1 text-foreground">
                  {document.kind === "conversation_brief" ? "Conversation brief" : "Memory"}
                </span>
                <span className="font-mono text-[11px]">r{document.revision}</span>
                <span>{document.access === "read-write" ? "can edit" : "read only"}</span>
              </li>
            ))}
          </ul>
        </ContextDisclosure>
      ) : null}
      {snapshot.summary || leftOutCount > 0 ? (
        <ContextDisclosure
          label="Folded and left out"
          count={
            snapshot.summary ? `${snapshot.summary.representedMessageCount} folded` : leftOutCount
          }
          tone={leftOutCount > 0 ? "attention" : undefined}
        >
          {snapshot.summary ? (
            <details className="rounded-lg bg-surface-elevated px-2.5 py-2">
              <summary className="cursor-pointer text-foreground">
                {snapshot.summary.representedMessageCount.toLocaleString()} of{" "}
                {snapshot.summary.candidateMessageCount.toLocaleString()} earlier messages
                summarised
              </summary>
              <p className="mt-2 whitespace-pre-wrap text-foreground">{snapshot.summary.text}</p>
            </details>
          ) : null}
          {snapshot.omissions.length > 0 ? (
            <ul className={cn("space-y-1", snapshot.summary && "mt-2")}>
              {snapshot.omissions.map((omission) => (
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
          ) : null}
        </ContextDisclosure>
      ) : null}
      {snapshot.approvals?.length ? (
        <ContextDisclosure
          label="Approvals"
          count={
            pendingApprovals?.length
              ? `${pendingApprovals.length} waiting`
              : snapshot.approvals.length
          }
          tone={pendingApprovals?.length ? "attention" : undefined}
        >
          <ul className="space-y-1">
            {snapshot.approvals.map((approval) => (
              <li key={approval.id} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-foreground">
                  {approval.toolName ?? approval.type}
                </span>
                <span className={cn(approval.status === "pending" && "text-attention")}>
                  {approval.status}
                </span>
              </li>
            ))}
          </ul>
        </ContextDisclosure>
      ) : null}
    </div>
  );
}

export function ContextUsageCard({
  snapshot,
  fallback,
  resolveReferenceHref,
}: ContextUsageCardProps) {
  if (snapshot) {
    const segments = buildContextSegments({
      inputTokens: snapshot.usage.inputTokens,
      contextWindow: snapshot.usage.contextWindow,
      reservedOutputTokens: snapshot.usage.reservedOutputTokens,
      breakdown: snapshot.breakdown,
    });

    return (
      <WorkbenchCard title="Context" icon={Gauge}>
        <UsageHeadline
          inputTokens={snapshot.usage.inputTokens}
          contextWindow={snapshot.usage.contextWindow}
        />
        <SegmentBar segments={segments} contextWindow={snapshot.usage.contextWindow} />
        <SegmentLegend segments={segments} contextWindow={snapshot.usage.contextWindow} />
        <SnapshotDetails snapshot={snapshot} resolveReferenceHref={resolveReferenceHref} />
      </WorkbenchCard>
    );
  }

  if (fallback?.inputTokens && fallback.contextWindow) {
    const segments = buildContextSegments({
      inputTokens: fallback.inputTokens,
      contextWindow: fallback.contextWindow,
    });

    return (
      <WorkbenchCard title="Context" icon={Gauge}>
        <UsageHeadline inputTokens={fallback.inputTokens} contextWindow={fallback.contextWindow} />
        <SegmentBar segments={segments} contextWindow={fallback.contextWindow} />
        <SegmentLegend segments={segments} contextWindow={fallback.contextWindow} />
      </WorkbenchCard>
    );
  }

  return (
    <WorkbenchCard title="Context" icon={Gauge}>
      <div aria-hidden="true" className="h-2 w-full rounded-full bg-selection" />
    </WorkbenchCard>
  );
}
