import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@ngriffin_uk/polychat-component-ui";
import type { AgentTraceEntry } from "@ngriffin_uk/polychat-library-chat/agent-trace";
import type { ChatContextSnapshot, ChatRunUsage } from "@ngriffin_uk/polychat-schemas";
import { ListTree } from "lucide-react";

import { AgentTracePanel } from "./AgentTracePanel.js";
import { ContextDetailsPanel } from "./ContextDetailsPanel.js";

export interface ConversationContextSummaryButtonProps {
  context?: ChatContextSnapshot | null;
  usage?: ChatRunUsage;
  entries: AgentTraceEntry[];
  compactOnMobile?: boolean;
  resolveReferenceHref?: (path: string) => string;
}

export function ConversationContextSummaryButton({
  context,
  usage,
  entries,
  compactOnMobile = false,
  resolveReferenceHref,
}: ConversationContextSummaryButtonProps) {
  const hasContext = Boolean(context || usage);

  if (!hasContext && entries.length === 0) {
    return null;
  }

  const contextUsagePercent = context
    ? Math.min(100, Math.round((context.usage.inputTokens / context.usage.contextWindow) * 100))
    : undefined;
  const summary = [
    contextUsagePercent === undefined ? undefined : `${contextUsagePercent}% context`,
    entries.length > 0
      ? `${entries.length.toLocaleString()} trace event${entries.length === 1 ? "" : "s"}`
      : undefined,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          collapseLabel={compactOnMobile ? "container" : false}
          className="shrink-0 text-muted-foreground hover:text-foreground"
          title="View context and trace summary"
          aria-label="Context and trace summary"
          icon={<ListTree className="size-3.5" />}
        >
          Summary
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        sideOffset={8}
        className="max-h-[min(42rem,78dvh)] w-[min(94vw,40rem)] overflow-y-auto rounded-xl p-0"
        aria-label="Context and trace summary"
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <ListTree className="size-4 text-muted-foreground" aria-hidden="true" />
          <span className="text-sm font-medium text-foreground">Context &amp; trace</span>
          {summary ? (
            <span className="ml-auto text-xs text-muted-foreground">{summary}</span>
          ) : null}
        </div>
        {hasContext ? (
          <ContextDetailsPanel
            context={context}
            usage={usage}
            resolveReferenceHref={resolveReferenceHref}
          />
        ) : null}
        {entries.length > 0 ? <AgentTracePanel entries={entries} /> : null}
      </PopoverContent>
    </Popover>
  );
}
