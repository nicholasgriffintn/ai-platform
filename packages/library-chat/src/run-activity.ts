import type { SandboxRunData, SandboxRunEvent } from "@ngriffin_uk/polychat-schemas";

import type { AgentTraceEntry, AgentTraceUsage } from "./agent-trace";

export type RunActivityKind =
  | "approval"
  | "command"
  | "conversation"
  | "error"
  | "instruction"
  | "lifecycle"
  | "model"
  | "plan"
  | "service"
  | "tool"
  | "validation";

export type RunActivityStatus =
  | "cancelled"
  | "completed"
  | "failed"
  | "pending"
  | "running"
  | "waiting";

export interface RunActivityMetrics {
  costUsd?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  latencyMs?: number;
  model?: string;
  provider?: string;
}

export interface RunActivityEvidence {
  lines: string[];
  omitted: number;
}

export interface RunActivityEntry {
  id: string;
  source: "conversation" | "run";
  kind: RunActivityKind;
  title: string;
  detail?: string;
  status?: RunActivityStatus;
  occurredAt?: string;
  durationMs?: number;
  approvalState?: SandboxRunEvent["approvalStatus"];
  evidence?: RunActivityEvidence;
  metrics?: RunActivityMetrics;
}

interface OrderedActivityEntry {
  entry: RunActivityEntry;
  sortTime: number;
  sourceOrder: number;
}

const MAX_DETAIL_LENGTH = 6000;
const MAX_EVIDENCE_LINES = 24;
const MAX_EVIDENCE_LENGTH = 12000;

function readEventStrings(event: SandboxRunEvent, key: string): string[] {
  const value = event[key];

  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
    : [];
}

export function redactActivityText(value: string): string {
  return value
    .replace(/\bBearer\s+[^\s"']+/gi, "Bearer [redacted]")
    .replace(/\b(?:sk|gh[pousr])_[A-Za-z0-9_-]{12,}\b/g, "[redacted credential]")
    .replace(
      /\b((?:api[_-]?key|access[_-]?token|auth[_-]?token|password|passwd|private[_-]?key|secret)\s*[:=]\s*)(["']?)[^\s,"']+\2/gi,
      "$1[redacted]",
    )
    .replace(/:\/\/([^/@:\s]+):([^/@\s]+)@/g, "://[redacted]@");
}

export function formatRunActivityDuration(durationMs: number | undefined): string | undefined {
  if (durationMs === undefined) {
    return undefined;
  }

  return durationMs >= 1000 ? `${(durationMs / 1000).toFixed(1)}s` : `${durationMs}ms`;
}

export function formatRunActivityUsage(
  metrics: RunActivityMetrics | undefined,
): string | undefined {
  if (!metrics) {
    return undefined;
  }

  if (metrics.costUsd !== undefined) {
    return `$${metrics.costUsd.toFixed(4)}`;
  }

  if (metrics.totalTokens !== undefined) {
    return `${metrics.totalTokens.toLocaleString()} tokens`;
  }

  const parts = [
    metrics.inputTokens !== undefined ? `${metrics.inputTokens.toLocaleString()} in` : undefined,
    metrics.outputTokens !== undefined ? `${metrics.outputTokens.toLocaleString()} out` : undefined,
  ].filter(Boolean);

  return parts.length ? parts.join(" / ") : undefined;
}

function safeDetail(value: string | undefined): string | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  const redacted = redactActivityText(value.trim());

  return redacted.length > MAX_DETAIL_LENGTH
    ? `${redacted.slice(0, MAX_DETAIL_LENGTH - 1).trimEnd()}…`
    : redacted;
}

function isoTime(event: SandboxRunEvent): string | undefined {
  return event.timestamp ?? event.startedAt ?? event.completedAt;
}

function timeValue(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Date.parse(value);

  return Number.isFinite(parsed) ? parsed : undefined;
}

function insertOrdered(entries: OrderedActivityEntry[], candidate: OrderedActivityEntry): void {
  const index = entries.findIndex(
    (current) =>
      candidate.sortTime < current.sortTime ||
      (candidate.sortTime === current.sortTime && candidate.sourceOrder < current.sourceOrder),
  );

  if (index === -1) {
    entries.push(candidate);
  } else {
    entries.splice(index, 0, candidate);
  }
}

function traceMetrics(entry: AgentTraceEntry): RunActivityMetrics | undefined {
  const usage: AgentTraceUsage | undefined = entry.usage;

  if (!usage && !entry.latencyMs && !entry.model && !entry.provider) {
    return undefined;
  }

  return {
    ...usage,
    latencyMs: entry.latencyMs,
    model: entry.model,
    provider: entry.provider,
  };
}

function traceKind(type: AgentTraceEntry["type"]): RunActivityKind {
  switch (type) {
    case "user_turn":
      return "instruction";
    case "model_call":
      return "model";
    case "assistant_response":
      return "conversation";
    case "tool_call":
    case "tool_result":
      return "tool";
    case "approval":
      return "approval";
    case "retry":
    case "provider_error":
      return "error";
  }

  return "lifecycle";
}

function traceTitle(entry: AgentTraceEntry): string {
  switch (entry.type) {
    case "user_turn":
      return "User instruction";
    case "model_call":
      return `Model call · ${entry.label}`;
    case "assistant_response":
      return "Assistant response";
    case "tool_call":
      return `Tool called · ${entry.label}`;
    case "tool_result":
      return `Tool returned · ${entry.label}`;
    case "approval":
      return `Approval requested · ${entry.label}`;
    case "retry":
      return `Retry · ${entry.label}`;
    case "provider_error":
      return "Provider error";
  }

  return entry.label;
}

function traceStatus(entry: AgentTraceEntry): RunActivityStatus | undefined {
  if (entry.type === "provider_error") {
    return "failed";
  }

  if (entry.type === "approval") {
    return "waiting";
  }

  if (entry.status === "error" || entry.status === "failed") {
    return "failed";
  }

  if (entry.status === "pending") {
    return "pending";
  }

  return "completed";
}

function fromTrace(entry: AgentTraceEntry): RunActivityEntry {
  return {
    id: `trace:${entry.id}`,
    source: "conversation",
    kind: traceKind(entry.type),
    title: traceTitle(entry),
    detail: safeDetail(entry.label),
    status: traceStatus(entry),
    occurredAt: entry.occurredAt ? new Date(entry.occurredAt).toISOString() : undefined,
    metrics: traceMetrics(entry),
  };
}

function runKind(event: SandboxRunEvent): RunActivityKind {
  if (event.type.startsWith("service_")) {
    return "service";
  }

  if (event.type.includes("approval")) {
    return "approval";
  }

  if (event.type.includes("instruction")) {
    return "instruction";
  }

  if (event.type.startsWith("quality_gate")) {
    return "validation";
  }

  if (
    event.type.startsWith("command") ||
    event.type.startsWith("script") ||
    event.type.startsWith("environment_setup_command")
  ) {
    return "command";
  }

  if (event.type.includes("plan") || event.type === "planning_started") {
    return "plan";
  }

  if (event.type.startsWith("agent_")) {
    return event.type.includes("failed") ? "error" : "model";
  }

  if (event.type === "file_read" || event.type === "file_changed") {
    return "tool";
  }

  if (event.type.includes("failed") || event.type.includes("error")) {
    return "error";
  }

  return "lifecycle";
}

function runStatus(event: SandboxRunEvent): RunActivityStatus | undefined {
  if (event.type.startsWith("service_")) {
    if (
      event.serviceStatus === "failed" ||
      event.serviceStatus === "timed_out" ||
      event.serviceStatus === "unhealthy" ||
      event.type === "service_action_rejected"
    ) {
      return "failed";
    }

    if (
      event.serviceStatus === "starting" ||
      event.serviceStatus === "restarting" ||
      event.serviceStatus === "running" ||
      event.serviceStatus === "healthy"
    ) {
      return "running";
    }

    if (event.serviceStatus === "stopped" || event.type === "service_action_completed") {
      return "completed";
    }

    return undefined;
  }

  if (event.type.includes("failed") || event.type.includes("error")) {
    return "failed";
  }

  if (event.type.includes("cancelled")) {
    return "cancelled";
  }

  if (event.type === "run_resume_requested") {
    return "running";
  }

  if (event.type.includes("paused") || event.type.includes("requested")) {
    return "waiting";
  }

  if (event.type.includes("started")) {
    return "running";
  }

  if (event.type.includes("completed") || event.type.includes("passed")) {
    return "completed";
  }

  if (event.type === "environment_cache_created" || event.type === "environment_cache_restored") {
    return "completed";
  }

  if (event.type.includes("timed_out") || event.approvalStatus === "rejected") {
    return "failed";
  }

  if (event.approvalStatus === "pending" || event.approvalStatus === "escalated") {
    return "waiting";
  }

  return undefined;
}

function runTitle(event: SandboxRunEvent): string {
  const command = safeDetail(event.command);
  const index = event.commandIndex ? ` ${event.commandIndex}/${event.commandTotal ?? "?"}` : "";

  switch (event.type) {
    case "run_queued":
      return "Run queued";
    case "run_dispatched":
      return "Coding environment requested";
    case "run_started":
      return "Run started";
    case "run_completed":
      return "Run completed";
    case "run_failed":
      return "Run failed";
    case "run_cancelled":
      return "Run cancelled";
    case "run_paused":
      return "Run paused";
    case "run_resumed":
      return "Run resumed";
    case "run_pause_requested":
      return "Pause requested";
    case "run_resume_requested":
      return "Resume requested";
    case "run_cancel_requested":
      return "Cancellation requested";
    case "task_started":
      return "Task started";
    case "task_failed":
      return "Task failed";
    case "task_cancelled":
      return "Task cancelled";
    case "repo_clone_started":
      return "Repository clone started";
    case "repo_clone_completed":
      return "Repository cloned";
    case "environment_configuration_resolved":
      return "Environment configuration resolved";
    case "environment_cache_miss":
      return "Environment cache miss";
    case "environment_cache_restored":
      return "Environment snapshot restored";
    case "environment_cache_created":
      return "Environment snapshot created";
    case "environment_cache_key_failed":
      return "Environment cache key failed";
    case "environment_cache_restore_failed":
      return "Environment snapshot restore failed";
    case "environment_cache_creation_failed":
      return "Environment snapshot creation failed";
    case "environment_setup_started":
      return event.preparationMode === "resume"
        ? "Environment resume started"
        : "Environment setup started";
    case "environment_setup_command_started":
      return command ? `Setup${index} · ${command}` : `Setup command${index} started`;
    case "environment_setup_command_completed":
      return command ? `Setup${index} · ${command}` : `Setup command${index} completed`;
    case "environment_setup_failed":
      return event.preparationMode === "resume"
        ? "Environment resume failed"
        : "Environment setup failed";
    case "environment_setup_completed":
      return event.preparationMode === "resume" ? "Environment resumed" : "Environment prepared";
    case "service_manifest_validated":
      return "Project service manifest validated";
    case "service_declared":
      return `Service declared · ${event.serviceName ?? "unknown"}`;
    case "service_starting":
      return `Service starting · ${event.serviceName ?? "unknown"}`;
    case "service_running":
      return `Service running · ${event.serviceName ?? "unknown"}`;
    case "service_healthy":
      return `Service healthy · ${event.serviceName ?? "unknown"}`;
    case "service_unhealthy":
      return `Service unhealthy · ${event.serviceName ?? "unknown"}`;
    case "service_observation_failed":
      return `Service health check failed · ${event.serviceName ?? "unknown"}`;
    case "service_restarting":
      return `Service restarting · ${event.serviceName ?? "unknown"}`;
    case "service_start_timed_out":
      return `Service startup timed out · ${event.serviceName ?? "unknown"}`;
    case "service_failed":
      return `Service failed · ${event.serviceName ?? "unknown"}`;
    case "service_stopped":
      return `Service stopped · ${event.serviceName ?? "unknown"}`;
    case "service_action_received":
      return `Service action received · ${event.serviceAction ?? "update"} ${event.serviceName ?? "service"}`;
    case "service_action_completed":
      return `Service action completed · ${event.serviceAction ?? "update"} ${event.serviceName ?? "service"}`;
    case "service_action_rejected":
      return `Service action rejected · ${event.serviceAction ?? "update"} ${event.serviceName ?? "service"}`;
    case "repo_context_collected":
      return "Repository context collected";
    case "prompt_strategy_selected":
      return "Execution approach selected";
    case "planning_started":
      return "Planning started";
    case "planning_completed":
      return "Plan created";
    case "plan_updated":
      return "Plan updated";
    case "agent_step_started":
      return `Model step ${event.agentStep ?? "?"}`;
    case "agent_turn":
      return `Model chose ${readEventStrings(event, "toolNames").length} actions`;
    case "agent_turn_invalid":
      return "Model response could not be used";
    case "agent_turn_failed":
      return "Model request failed";
    case "agent_repetition_detected":
      return "Repeated action detected";
    case "agent_step_budget_extended":
      return "Run step budget extended";
    case "agent_step_budget_exhausted":
      return "Run step budget exhausted";
    case "agent_finished":
      return "Agent finished";
    case "run_goal_continued":
      return "Goal check continued the run";
    case "command_batch_ready":
      return "Command budget prepared";
    case "command_started":
      return command ? `Command${index} · ${command}` : `Command${index} started`;
    case "command_completed":
      return command ? `Command${index} · ${command}` : `Command${index} completed`;
    case "command_failed":
      return command ? `Command failed · ${command}` : "Command failed";
    case "script_started":
      return `${event.language ?? "Script"} execution started`;
    case "script_completed":
      return `${event.language ?? "Script"} execution completed`;
    case "script_failed":
      return `${event.language ?? "Script"} execution failed`;
    case "command_approval_requested":
      return "Command approval requested";
    case "command_approval_escalated":
      return "Command approval escalated";
    case "command_approval_resolved":
      return `Command approval ${event.approvalStatus ?? "resolved"}`;
    case "command_approval_timed_out":
      return "Command approval timed out";
    case "run_instruction_submitted":
      return "User instruction submitted";
    case "run_instruction_received":
      return "User instruction received";
    case "quality_gate_commands_selected":
      return "Validation commands selected";
    case "quality_gate_started":
      return "Validation started";
    case "quality_gate_check_started":
      return command ? `Validation${index} · ${command}` : `Validation${index} started`;
    case "quality_gate_check_passed":
      return command ? `Validation passed · ${command}` : "Validation passed";
    case "quality_gate_check_failed":
      return command ? `Validation failed · ${command}` : "Validation failed";
    case "quality_gate_completed":
      return "Quality gate completed";
    case "quality_gate_skipped":
      return "Quality gate skipped";
    case "file_read":
      return event.path ? `Read ${event.path}` : "File read";
    case "file_changed":
      return event.path ? `${event.changeType ?? "Changed"} ${event.path}` : "File changed";
    case "diff_generated":
      return "Change set generated";
    case "git_branch_created":
      return `Branch created${event.branchName ? ` · ${event.branchName}` : ""}`;
    case "commit_created":
      return `Commit created${event.commitSha ? ` · ${event.commitSha.slice(0, 8)}` : ""}`;
    case "commit_skipped":
      return "Commit skipped";
    case "delivery_started":
      return "GitHub delivery started";
    case "delivery_completed":
      return event.pullRequestUrl ? "Pull request created" : "GitHub delivery completed";
    case "delivery_failed":
      return "GitHub delivery failed";
    case "delivery_skipped":
      return "GitHub delivery skipped";
    default:
      return event.message?.trim() || event.type.replaceAll("_", " ");
  }
}

function runDetail(event: SandboxRunEvent): string | undefined {
  if (event.type === "planning_completed" || event.type === "plan_updated") {
    return safeDetail(event.plan);
  }

  if (event.type.includes("instruction")) {
    return safeDetail(event.instructionContent ?? event.message);
  }

  if (event.error) {
    return safeDetail(event.error);
  }

  if (event.type === "agent_turn") {
    const tools = readEventStrings(event, "toolNames");

    return tools.length ? tools.join(", ") : undefined;
  }

  return safeDetail(event.message);
}

function commandKey(event: SandboxRunEvent): string | undefined {
  if (
    !event.type.startsWith("command_") &&
    !event.type.startsWith("script_") &&
    !event.type.startsWith("environment_setup_command_")
  ) {
    return undefined;
  }

  return `${event.type.startsWith("environment_") ? "environment" : "command"}:${event.agentStep ?? "?"}:${event.commandIndex ?? "?"}`;
}

function validationKey(event: SandboxRunEvent): string | undefined {
  return event.type.startsWith("quality_gate_check") || event.type === "quality_gate_output"
    ? `validation:${event.commandIndex ?? "?"}`
    : undefined;
}

function appendEvidence(entry: RunActivityEntry, value: string | undefined): void {
  const detail = safeDetail(value);

  if (!detail) {
    return;
  }

  const evidence = entry.evidence ?? { lines: [], omitted: 0 };
  const length = evidence.lines.reduce((total, line) => total + line.length, 0);

  if (evidence.lines.length >= MAX_EVIDENCE_LINES || length + detail.length > MAX_EVIDENCE_LENGTH) {
    evidence.omitted += 1;
  } else {
    evidence.lines.push(detail);
  }

  entry.evidence = evidence;
}

function fromRun(run: SandboxRunData): RunActivityEntry[] {
  const entries: RunActivityEntry[] = [];
  const commandEntries = new Map<string, RunActivityEntry>();
  const validationEntries = new Map<string, RunActivityEntry>();
  const serviceEntries = new Map<string, RunActivityEntry>();
  const startedAtByKey = new Map<string, number>();

  for (const [index, event] of (run.events ?? []).entries()) {
    const commandIdentity = commandKey(event);
    const validationIdentity = validationKey(event);
    const lifecycleIdentity = commandIdentity ?? validationIdentity;
    const occurredAt = isoTime(event);
    const occurredAtMs = timeValue(occurredAt);
    const existing =
      (commandIdentity ? commandEntries.get(commandIdentity) : undefined) ??
      (validationIdentity ? validationEntries.get(validationIdentity) : undefined);

    if (event.type === "service_log" || event.type === "service_log_truncated") {
      const serviceEntry = event.serviceName ? serviceEntries.get(event.serviceName) : undefined;

      if (serviceEntry) {
        appendEvidence(serviceEntry, event.output ?? event.message);
      }

      continue;
    }

    if (
      event.type === "command_output" ||
      event.type === "environment_setup_command_output" ||
      event.type === "quality_gate_output"
    ) {
      if (existing) {
        appendEvidence(existing, event.output);
      }

      continue;
    }

    if (
      existing &&
      (event.type.endsWith("completed") ||
        event.type.endsWith("passed") ||
        event.type.endsWith("failed"))
    ) {
      existing.status = runStatus(event);
      existing.title = runTitle(event);
      existing.detail = runDetail(event) ?? existing.detail;
      const startedAt = lifecycleIdentity ? startedAtByKey.get(lifecycleIdentity) : undefined;

      if (startedAt !== undefined && occurredAtMs !== undefined && occurredAtMs >= startedAt) {
        existing.durationMs = occurredAtMs - startedAt;
      }

      continue;
    }

    const entry: RunActivityEntry = {
      id: `run:${index}:${event.type}:${event.instructionId ?? event.approvalId ?? lifecycleIdentity ?? "event"}`,
      source: "run",
      kind: runKind(event),
      title: runTitle(event),
      detail: runDetail(event),
      status: runStatus(event),
      occurredAt,
      approvalState: event.approvalStatus,
    };

    entries.push(entry);

    if (event.type.startsWith("service_") && event.serviceName) {
      serviceEntries.set(event.serviceName, entry);
    }

    if (lifecycleIdentity && occurredAtMs !== undefined && event.type.endsWith("started")) {
      startedAtByKey.set(lifecycleIdentity, occurredAtMs);
    }

    if (commandIdentity && event.type === "command_started") {
      commandEntries.set(commandIdentity, entry);
    }

    if (validationIdentity && event.type === "quality_gate_check_started") {
      validationEntries.set(validationIdentity, entry);
    }
  }

  return entries;
}

export function buildRunActivityEntries(params: {
  run?: SandboxRunData;
  traceEntries?: readonly AgentTraceEntry[];
}): RunActivityEntry[] {
  const { run, traceEntries = [] } = params;
  const ordered: OrderedActivityEntry[] = [];
  const runStartedAt = timeValue(run?.startedAt) ?? Number.MAX_SAFE_INTEGER - 1000;

  for (const [index, traceEntry] of traceEntries.entries()) {
    const entry = fromTrace(traceEntry);

    insertOrdered(ordered, {
      entry,
      sortTime: traceEntry.occurredAt ?? runStartedAt - traceEntries.length + index,
      sourceOrder: index,
    });
  }

  for (const [index, entry] of (run ? fromRun(run) : []).entries()) {
    insertOrdered(ordered, {
      entry,
      sortTime: timeValue(entry.occurredAt) ?? runStartedAt + index,
      sourceOrder: traceEntries.length + index,
    });
  }

  return ordered.map(({ entry }) => entry);
}
