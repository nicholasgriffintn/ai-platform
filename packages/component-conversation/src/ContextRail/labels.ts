import {
  creditsFromCreditMicros,
  totalChatRunCredits,
  type ChatContextBreakdownEntry,
  type ChatContextBreakdownKind,
  type ChatContextDocument,
  type ChatContextOmission,
  type ChatRunDelegatedUsage,
  type ChatRunUsage,
} from "@ngriffin_uk/polychat-schemas";
import { formatCredits } from "@ngriffin_uk/polychat-utility-core";

export type ContextSegmentKey = ChatContextBreakdownKind | "used" | "reserved" | "free";

export interface ContextSegment {
  key: ContextSegmentKey;
  label: string;
  tokens: number;
  swatch: string;
}

const SEGMENT_PRESENTATION: Record<ContextSegmentKey, { label: string; swatch: string }> = {
  instructions: { label: "Instructions", swatch: "bg-accent-blue" },
  memory: { label: "Memory and brief", swatch: "bg-accent-violet" },
  project: { label: "Project and goal", swatch: "bg-accent-teal" },
  tools: { label: "Tool definitions", swatch: "bg-accent-amber" },
  conversation: { label: "Messages", swatch: "bg-accent-emerald" },
  tool_results: { label: "Tool results", swatch: "bg-accent-orange" },
  summary: { label: "Summary", swatch: "bg-accent-pink" },
  subject: { label: "The file", swatch: "bg-accent-cyan" },
  notebook: { label: "Notebook sources", swatch: "bg-accent-indigo" },
  used: { label: "Last reply's input", swatch: "bg-accent-blue" },
  reserved: { label: "Reserved for the reply", swatch: "bg-border-strong" },
  free: { label: "Free space", swatch: "bg-selection" },
};

export const CONTEXT_DOCUMENT_LABELS: Record<ChatContextDocument["kind"], string> = {
  conversation_brief: "Conversation brief",
  memory: "Memory",
  subject: "The file this conversation is about",
};

function segment(key: ContextSegmentKey, tokens: number): ContextSegment {
  return { key, tokens, ...SEGMENT_PRESENTATION[key] };
}

export function buildContextSegments({
  inputTokens,
  contextWindow,
  reservedOutputTokens,
  breakdown,
}: {
  inputTokens: number;
  contextWindow: number;
  reservedOutputTokens?: number;
  breakdown?: readonly ChatContextBreakdownEntry[];
}): ContextSegment[] {
  const used = breakdown?.length
    ? breakdown.map((entry) => segment(entry.kind, entry.tokens))
    : [segment("used", inputTokens)];
  const usedTokens = used.reduce((sum, entry) => sum + entry.tokens, 0);
  const reserved = Math.min(reservedOutputTokens ?? 0, Math.max(0, contextWindow - usedTokens));
  const free = Math.max(0, contextWindow - usedTokens - reserved);

  return [
    ...used.filter((entry) => entry.tokens > 0),
    ...(reserved > 0 ? [segment("reserved", reserved)] : []),
    segment("free", free),
  ];
}

export function formatContextShare(tokens: number, contextWindow: number): string {
  if (contextWindow <= 0 || tokens <= 0) {
    return "0%";
  }

  const percent = (tokens / contextWindow) * 100;

  if (percent < 0.1) {
    return "<0.1%";
  }

  return percent < 10 ? `${percent.toFixed(1)}%` : `${Math.round(percent)}%`;
}

export function omissionLabel(omission: ChatContextOmission): string {
  if (omission.kind === "tool_result") {
    return "Tool result shortened";
  }

  if (omission.kind === "source") {
    return "Attached source left out";
  }

  return `${omission.count.toLocaleString()} older message${omission.count === 1 ? "" : "s"} left out`;
}

export function runTotalLabel(usage: ChatRunUsage): string {
  const total = totalChatRunCredits(usage);

  if (total.recordedCreditMicros === null) {
    return total.hasProcessingUsage ? "Still counting" : "Not reported";
  }

  const credits = `${formatCredits(creditsFromCreditMicros(total.recordedCreditMicros))} credits`;

  return total.complete ? credits : `At least ${credits}`;
}

export function delegatedUsageLabel(delegated: ChatRunDelegatedUsage): string {
  if (delegated.creditMicros === null) {
    return delegated.consumptionStatus === "processing" ? "still counting" : "not reported";
  }

  const credits = formatCredits(creditsFromCreditMicros(delegated.creditMicros));

  if (delegated.consumptionStatus === "recorded") {
    return `${credits} credits`;
  }

  return `at least ${credits} credits`;
}

export function contextPressureTone(percent: number): string {
  if (percent >= 85) {
    return "text-failure";
  }

  if (percent >= 60) {
    return "text-attention";
  }

  return "text-foreground";
}
