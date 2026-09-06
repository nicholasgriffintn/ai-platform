import type { SandboxRunData } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import type { AgentTraceEntry } from "./agent-trace";
import { buildRunActivityEntries } from "./run-activity";

const traceEntries = [
  { id: "call", type: "tool_call", label: "run_sandbox_task" },
  { id: "event", type: "tool_result", label: "sandbox_event" },
  { id: "plan", type: "tool_result", label: "sandbox_plan" },
  { id: "result", type: "tool_result", label: "read_file" },
] satisfies AgentTraceEntry[];

const run = {
  runId: "run-1",
  installationId: 1,
  repo: "owner/repository",
  task: "Validate activity",
  model: "model",
  status: "running",
  startedAt: "2026-09-06T12:00:00.000Z",
  updatedAt: "2026-09-06T12:00:01.000Z",
  events: [
    {
      type: "run_queued",
      message: "Queued",
    },
    {
      type: "environment_setup_command_started",
      command: "node --version",
      commandIndex: 1,
      commandTotal: 1,
      timestamp: "2026-09-06T12:00:00.000Z",
    },
    {
      type: "environment_setup_command_completed",
      command: "node --version",
      commandIndex: 1,
      commandTotal: 1,
      timestamp: "2026-09-06T12:00:00.250Z",
    },
    {
      type: "planning_completed",
      plan: "Validate the implementation",
      timestamp: "2026-09-06T12:00:01.000Z",
    },
  ],
} satisfies SandboxRunData;

describe("buildRunActivityEntries", () => {
  it("removes conversation transport projections when authoritative run evidence exists", () => {
    const entries = buildRunActivityEntries({ run, traceEntries });

    expect(entries.map(({ title }) => title)).toEqual([
      "Tool called · run_sandbox_task",
      "Tool returned · read_file",
      "Run queued",
      "Setup 1/1 · node --version",
      "Plan created",
    ]);
    expect(entries.find(({ title }) => title.startsWith("Setup"))?.durationMs).toBe(250);
    expect(entries.find(({ title }) => title === "Run queued")?.durationMs).toBeUndefined();
  });

  it("retains transport tool entries when no run evidence is available", () => {
    expect(buildRunActivityEntries({ traceEntries }).map(({ title }) => title)).toEqual([
      "Tool called · run_sandbox_task",
      "Tool returned · sandbox_event",
      "Tool returned · sandbox_plan",
      "Tool returned · read_file",
    ]);
  });
});
