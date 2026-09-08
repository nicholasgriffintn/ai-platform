import z from "zod/v4";

import type {
  AgentApproval,
  AgentApprovalDecision,
  AgentItem,
  AgentModel,
  AgentSessionEvent,
  AgentTokenUsage,
} from "./agent-sessions.js";
import type { PermissionMode } from "./providers.js";
import { reasoningEffortSchema } from "./reasoning.js";

export const CODEX_APPROVAL_METHODS = [
  "item/commandExecution/requestApproval",
  "item/fileChange/requestApproval",
  "item/permissions/requestApproval",
  "item/tool/requestUserInput",
  "execCommandApproval",
  "applyPatchApproval",
] as const;

const codexModelSchema = z.object({
  id: z.string().min(1),
  model: z.string().min(1).optional(),
  displayName: z.string().optional(),
  description: z.string().optional(),
  hidden: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  defaultReasoningEffort: z.string().optional().nullable(),
  supportedReasoningEfforts: z
    .array(z.object({ reasoningEffort: z.string() }))
    .optional()
    .nullable(),
});

export const codexModelListResponseSchema = z.object({
  data: z.array(codexModelSchema).default([]),
  nextCursor: z.string().nullable().optional(),
});

const codexUsageSchema = z.object({
  inputTokens: z.number().optional(),
  cachedInputTokens: z.number().optional(),
  cacheWriteInputTokens: z.number().optional(),
  outputTokens: z.number().optional(),
  reasoningOutputTokens: z.number().optional(),
});

export function readCodexModels(value: unknown): AgentModel[] {
  const parsed = codexModelListResponseSchema.safeParse(value);

  if (!parsed.success) {
    return [];
  }

  return parsed.data.data.map((entry) => {
    const efforts = (entry.supportedReasoningEfforts ?? [])
      .map((effort) => reasoningEffortSchema.safeParse(effort.reasoningEffort))
      .flatMap((result) => (result.success ? [result.data] : []));
    const fallback = reasoningEffortSchema.safeParse(entry.defaultReasoningEffort ?? "");

    return {
      id: entry.model ?? entry.id,
      displayName: entry.displayName ?? entry.model ?? entry.id,
      description: entry.description ?? null,
      isDefault: entry.isDefault ?? false,
      legacy: entry.hidden ?? false,
      reasoningEfforts: efforts,
      defaultReasoningEffort: fallback.success ? fallback.data : null,
    } satisfies AgentModel;
  });
}

export interface CodexThreadConfig {
  approvalPolicy: "untrusted" | "on-request" | "never";
  sandbox: "read-only" | "workspace-write" | "danger-full-access";
  approvalsReviewer: "user" | "auto_review";
}

export function codexThreadConfig(mode: PermissionMode): CodexThreadConfig {
  switch (mode) {
    case "supervised":
      return { approvalPolicy: "untrusted", sandbox: "read-only", approvalsReviewer: "user" };
    case "auto_accept_edits":
      return {
        approvalPolicy: "on-request",
        sandbox: "workspace-write",
        approvalsReviewer: "user",
      };
    case "auto":
      return {
        approvalPolicy: "on-request",
        sandbox: "workspace-write",
        approvalsReviewer: "auto_review",
      };
    case "full_access":
      return {
        approvalPolicy: "never",
        sandbox: "danger-full-access",
        approvalsReviewer: "user",
      };
  }
}

export function codexApprovalDecision(decision: AgentApprovalDecision): string {
  switch (decision) {
    case "accept":
      return "accept";
    case "accept_for_session":
      return "acceptForSession";
    case "decline":
      return "decline";
    case "cancel":
      return "cancel";
  }
}

function approvalKindFor(method: string): AgentApproval["kind"] {
  switch (method) {
    case "item/commandExecution/requestApproval":
    case "execCommandApproval":
      return "command_execution";
    case "item/fileChange/requestApproval":
    case "applyPatchApproval":
      return "file_change";
    case "item/permissions/requestApproval":
      return "permissions";
    case "item/tool/requestUserInput":
      return "tool_input";
    default:
      return "unknown";
  }
}

const approvalParamsSchema = z.object({
  threadId: z.string().optional(),
  command: z.string().optional(),
  cwd: z.string().optional(),
  reason: z.string().nullable().optional(),
  availableDecisions: z
    .array(z.union([z.string(), z.record(z.string(), z.unknown())]))
    .optional()
    .nullable(),
});

const CODEX_DECISION_NAMES: Record<string, AgentApprovalDecision> = {
  accept: "accept",
  acceptforsession: "accept_for_session",
  decline: "decline",
  cancel: "cancel",
};

const FALLBACK_DECISIONS: AgentApprovalDecision[] = ["accept", "decline"];

export function readCodexDecisions(
  offered: ReadonlyArray<string | Record<string, unknown>> | null | undefined,
): AgentApprovalDecision[] {
  if (!offered?.length) {
    return [...FALLBACK_DECISIONS];
  }

  const decisions = offered.flatMap((entry) => {
    if (typeof entry !== "string") {
      return [];
    }

    const decision = CODEX_DECISION_NAMES[entry.toLowerCase()];

    return decision ? [decision] : [];
  });

  return decisions.length ? [...new Set(decisions)] : [...FALLBACK_DECISIONS];
}

const APPROVAL_TITLES: Record<AgentApproval["kind"], string> = {
  command_execution: "Run a command",
  file_change: "Change files",
  permissions: "Widen permissions",
  tool_input: "Answer a question",
  unknown: "Approve an action",
};

export function readCodexApproval(
  requestId: string | number,
  method: string,
  params: unknown,
  requestedAt: string,
): AgentApproval | null {
  const parsed = approvalParamsSchema.safeParse(params);

  if (!parsed.success) {
    return null;
  }

  const kind = approvalKindFor(method);
  const decisions = readCodexDecisions(parsed.data.availableDecisions);

  return {
    requestId: String(requestId),
    threadId: parsed.data.threadId ?? "",
    kind,
    title: APPROVAL_TITLES[kind],
    detail: stripControlCharacters(parsed.data.reason ?? null),
    command: stripControlCharacters(parsed.data.command ?? null),
    cwd: parsed.data.cwd ?? null,
    decisions,
    requestedAt,
  };
}

const ESCAPE = 0x1b;
const DELETE = 0x7f;
const CSI_FINAL_START = 0x40;
const CSI_FINAL_END = 0x7e;
const SPACE = 0x20;

function isControl(code: number): boolean {
  return (code < SPACE && code !== 0x09 && code !== 0x0a) || code === DELETE;
}

export function stripControlCharacters(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  let output = "";
  let index = 0;

  while (index < value.length) {
    const code = value.charCodeAt(index);

    if (code === ESCAPE) {
      index += 1;

      if (value[index] === "[") {
        index += 1;

        while (index < value.length) {
          const final = value.charCodeAt(index);

          index += 1;

          if (final >= CSI_FINAL_START && final <= CSI_FINAL_END) {
            break;
          }
        }
      }

      continue;
    }

    if (isControl(code)) {
      index += 1;

      continue;
    }

    output += value[index];
    index += 1;
  }

  const trimmed = output.trim();

  return trimmed.length ? trimmed : null;
}

function readUsage(value: unknown): AgentTokenUsage | null {
  const parsed = codexUsageSchema.safeParse(value);

  if (!parsed.success) {
    return null;
  }

  return {
    inputTokens: parsed.data.inputTokens ?? 0,
    cachedInputTokens: parsed.data.cachedInputTokens ?? 0,
    cacheWriteInputTokens: parsed.data.cacheWriteInputTokens ?? 0,
    outputTokens: parsed.data.outputTokens ?? 0,
    reasoningOutputTokens: parsed.data.reasoningOutputTokens ?? 0,
  };
}

const threadStartedSchema = z.object({
  thread: z.object({ id: z.string(), model: z.string().nullable().optional() }),
});
const turnStartedSchema = z.object({ turn: z.object({ id: z.string() }) });
const turnCompletedSchema = z.object({
  turn: z.object({
    id: z.string(),
    status: z.string().optional(),
    error: z.object({ message: z.string().optional() }).nullable().optional(),
  }),
});
const deltaSchema = z.object({ delta: z.string() });
const errorSchema = z.object({ message: z.string().optional() });
const diffSchema = z.object({ diff: z.string() });
const planSchema = z.object({
  explanation: z.string().nullable().optional(),
  plan: z.array(z.object({ step: z.string(), status: z.string() })).default([]),
});
const tokenUsageSchema = z.object({ tokenUsage: z.object({ last: z.unknown() }) });
const resolvedSchema = z.object({ requestId: z.union([z.string(), z.number()]) });

const itemSchema = z.object({
  item: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("commandExecution"),
      id: z.string(),
      command: z.string(),
      status: z.string(),
      aggregatedOutput: z.string().nullable().optional(),
      exitCode: z.number().nullable().optional(),
    }),
    z.object({
      type: z.literal("fileChange"),
      id: z.string(),
      status: z.string(),
      changes: z.array(z.object({ path: z.string(), diff: z.string().optional() })).default([]),
    }),
    z.object({
      type: z.literal("mcpToolCall"),
      id: z.string(),
      status: z.string(),
      server: z.string(),
      tool: z.string(),
    }),
  ]),
});

function readItemStatus(status: string): AgentItem["status"] {
  switch (status) {
    case "completed":
      return "completed";
    case "failed":
    case "declined":
      return "failed";
    default:
      return "running";
  }
}

function readItem(value: unknown): AgentItem | null {
  const parsed = itemSchema.safeParse(value);

  if (!parsed.success) {
    return null;
  }

  const item = parsed.data.item;
  const status = readItemStatus(item.status);

  if (item.type === "commandExecution") {
    return {
      id: item.id,
      status,
      body: {
        kind: "command",
        command: item.command,
        output: item.aggregatedOutput ?? "",
        exitCode: item.exitCode ?? null,
      },
    };
  }

  if (item.type === "fileChange") {
    const diff = item.changes
      .map((change) => change.diff)
      .filter((change): change is string => Boolean(change))
      .join("\n");

    return {
      id: item.id,
      status,
      body: {
        kind: "file_change",
        paths: item.changes.map((change) => change.path),
        diff: diff.length ? diff : null,
      },
    };
  }

  return {
    id: item.id,
    status,
    body: { kind: "tool", name: `${item.server}/${item.tool}`, detail: null },
  };
}

function readPlanText(
  explanation: string | null | undefined,
  steps: ReadonlyArray<{ step: string; status: string }>,
): string {
  const lines = steps.map((entry) => {
    const marker = entry.status === "completed" ? "x" : entry.status === "inProgress" ? ">" : " ";

    return `- [${marker}] ${entry.step}`;
  });

  return [explanation ?? "", ...lines].filter(Boolean).join("\n");
}

export function readCodexNotification(method: string, params: unknown): AgentSessionEvent | null {
  switch (method) {
    case "thread/started": {
      const parsed = threadStartedSchema.safeParse(params);

      return parsed.success
        ? {
            type: "thread.started",
            threadId: parsed.data.thread.id,
            model: parsed.data.thread.model ?? null,
          }
        : null;
    }

    case "turn/started": {
      const parsed = turnStartedSchema.safeParse(params);

      return parsed.success ? { type: "turn.started", turnId: parsed.data.turn.id } : null;
    }

    case "turn/completed": {
      const parsed = turnCompletedSchema.safeParse(params);

      if (!parsed.success) {
        return null;
      }

      if (parsed.data.turn.status === "failed") {
        return {
          type: "turn.failed",
          message: parsed.data.turn.error?.message ?? "The agent could not complete this turn.",
        };
      }

      return { type: "turn.completed", turnId: parsed.data.turn.id, usage: null };
    }

    case "error": {
      const parsed = errorSchema.safeParse(params);

      return {
        type: "turn.failed",
        message:
          (parsed.success ? parsed.data.message : undefined) ??
          "The agent could not complete this turn.",
      };
    }

    case "item/agentMessage/delta": {
      const parsed = deltaSchema.safeParse(params);

      return parsed.success ? { type: "message.delta", delta: parsed.data.delta } : null;
    }

    case "item/reasoning/textDelta":
    case "item/reasoning/summaryTextDelta": {
      const parsed = deltaSchema.safeParse(params);

      return parsed.success ? { type: "reasoning.delta", delta: parsed.data.delta } : null;
    }

    case "turn/plan/updated": {
      const parsed = planSchema.safeParse(params);

      return parsed.success
        ? { type: "plan.updated", text: readPlanText(parsed.data.explanation, parsed.data.plan) }
        : null;
    }

    case "turn/diff/updated": {
      const parsed = diffSchema.safeParse(params);

      return parsed.success ? { type: "diff.updated", diff: parsed.data.diff } : null;
    }

    case "thread/tokenUsage/updated": {
      const parsed = tokenUsageSchema.safeParse(params);
      const usage = parsed.success ? readUsage(parsed.data.tokenUsage.last) : null;

      return usage ? { type: "usage.updated", usage } : null;
    }

    case "serverRequest/resolved": {
      const parsed = resolvedSchema.safeParse(params);

      return parsed.success
        ? { type: "approval.resolved", requestId: String(parsed.data.requestId) }
        : null;
    }

    case "item/started":
    case "item/completed": {
      const item = readItem(params);

      return item ? { type: "item.updated", item } : null;
    }

    default:
      return null;
  }
}
