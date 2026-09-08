import { describe, expect, it } from "vitest";

import {
  codexApprovalDecision,
  codexThreadConfig,
  readCodexApproval,
  readCodexModels,
  readCodexNotification,
  stripControlCharacters,
} from "./codex-protocol.js";

describe("codexThreadConfig", () => {
  it("supervises with a read-only sandbox and a human reviewer", () => {
    expect(codexThreadConfig("supervised")).toEqual({
      approvalPolicy: "untrusted",
      sandbox: "read-only",
      approvalsReviewer: "user",
    });
  });

  it("separates auto from auto-accept by the reviewer, not the sandbox", () => {
    const auto = codexThreadConfig("auto");
    const acceptEdits = codexThreadConfig("auto_accept_edits");

    expect(auto.sandbox).toBe(acceptEdits.sandbox);
    expect(auto.approvalsReviewer).toBe("auto_review");
    expect(acceptEdits.approvalsReviewer).toBe("user");
  });

  it("only reaches a full-access sandbox when approvals are switched off", () => {
    expect(codexThreadConfig("full_access")).toEqual({
      approvalPolicy: "never",
      sandbox: "danger-full-access",
      approvalsReviewer: "user",
    });
  });
});

describe("readCodexModels", () => {
  it("reads the selector fields the protocol reports", () => {
    const models = readCodexModels({
      data: [
        {
          id: "gpt-6-astra",
          model: "gpt-6-astra",
          displayName: "GPT-6-Astra",
          description: "Our most capable model.",
          hidden: false,
          isDefault: true,
          defaultReasoningEffort: "medium",
          supportedReasoningEfforts: [
            { reasoningEffort: "low" },
            { reasoningEffort: "ultra" },
            { reasoningEffort: "not-an-effort" },
          ],
        },
      ],
    });

    expect(models).toEqual([
      {
        id: "gpt-6-astra",
        displayName: "GPT-6-Astra",
        description: "Our most capable model.",
        isDefault: true,
        legacy: false,
        reasoningEfforts: ["low", "ultra"],
        defaultReasoningEffort: "medium",
      },
    ]);
  });

  it("treats a hidden model as legacy rather than dropping it", () => {
    const [model] = readCodexModels({ data: [{ id: "gpt-5.5", hidden: true }] });

    expect(model?.legacy).toBe(true);
    expect(model?.displayName).toBe("gpt-5.5");
  });

  it("returns nothing when the response is not a model list", () => {
    expect(readCodexModels({ unexpected: true })).toEqual([]);
  });
});

describe("readCodexNotification", () => {
  it("reports the thread identifier a conversation resumes with", () => {
    expect(
      readCodexNotification("thread/started", {
        thread: { id: "01a0820e-78d3-7a03-a9e0-7a4ff95af529", model: "gpt-6-astra" },
      }),
    ).toEqual({
      type: "thread.started",
      threadId: "01a0820e-78d3-7a03-a9e0-7a4ff95af529",
      model: "gpt-6-astra",
    });
  });

  it("turns a failed turn into a failure rather than a completion", () => {
    expect(
      readCodexNotification("turn/completed", {
        threadId: "thread-1",
        turn: { id: "turn-1", status: "failed", error: { message: "sandbox denied" } },
      }),
    ).toEqual({ type: "turn.failed", message: "sandbox denied" });
  });

  it("reads token usage from the last turn breakdown", () => {
    expect(
      readCodexNotification("thread/tokenUsage/updated", {
        threadId: "thread-1",
        turnId: "turn-1",
        tokenUsage: {
          total: {},
          last: {
            inputTokens: 21_264,
            cachedInputTokens: 6528,
            cacheWriteInputTokens: 0,
            outputTokens: 26,
            reasoningOutputTokens: 4,
          },
          modelContextWindow: 272_000,
        },
      }),
    ).toEqual({
      type: "usage.updated",
      usage: {
        inputTokens: 21_264,
        cachedInputTokens: 6528,
        cacheWriteInputTokens: 0,
        outputTokens: 26,
        reasoningOutputTokens: 4,
      },
    });
  });

  it("builds a command item with its output and exit status", () => {
    expect(
      readCodexNotification("item/completed", {
        threadId: "thread-1",
        turnId: "turn-1",
        item: {
          type: "commandExecution",
          id: "item-1",
          command: "pnpm test",
          status: "completed",
          aggregatedOutput: "ok",
          exitCode: 0,
        },
      }),
    ).toEqual({
      type: "item.updated",
      item: {
        id: "item-1",
        status: "completed",
        body: { kind: "command", command: "pnpm test", output: "ok", exitCode: 0 },
      },
    });
  });

  it("joins per-file diffs into one patch for a file change", () => {
    expect(
      readCodexNotification("item/completed", {
        threadId: "thread-1",
        turnId: "turn-1",
        item: {
          type: "fileChange",
          id: "item-2",
          status: "inProgress",
          changes: [
            { path: "src/a.ts", diff: "@@ -1 +1 @@" },
            { path: "src/b.ts", diff: "@@ -2 +2 @@" },
          ],
        },
      }),
    ).toEqual({
      type: "item.updated",
      item: {
        id: "item-2",
        status: "running",
        body: {
          kind: "file_change",
          paths: ["src/a.ts", "src/b.ts"],
          diff: "@@ -1 +1 @@\n@@ -2 +2 @@",
        },
      },
    });
  });

  it("reports a declined item as failed", () => {
    const event = readCodexNotification("item/completed", {
      threadId: "thread-1",
      turnId: "turn-1",
      item: { type: "fileChange", id: "item-3", status: "declined", changes: [] },
    });

    expect(event).toMatchObject({ item: { status: "failed" } });
  });

  it("renders a plan as checkable steps", () => {
    expect(
      readCodexNotification("turn/plan/updated", {
        threadId: "thread-1",
        turnId: "turn-1",
        explanation: "Working through the fix.",
        plan: [
          { step: "Read the failing test", status: "completed" },
          { step: "Fix the mapping", status: "inProgress" },
          { step: "Re-run", status: "pending" },
        ],
      }),
    ).toEqual({
      type: "plan.updated",
      text: "Working through the fix.\n- [x] Read the failing test\n- [>] Fix the mapping\n- [ ] Re-run",
    });
  });

  it("ignores a notification it does not model", () => {
    expect(readCodexNotification("thread/realtime/started", { threadId: "t" })).toBeNull();
  });
});

describe("readCodexApproval", () => {
  it("reads a command approval and offers a session-wide accept when the agent does", () => {
    const approval = readCodexApproval(
      7,
      "item/commandExecution/requestApproval",
      {
        threadId: "thread-1",
        command: "rm -rf build",
        cwd: "/repo",
        reason: "outside the sandbox",
        availableDecisions: ["accept", "acceptForSession", "decline"],
      },
      "2026-09-08T10:00:00Z",
    );

    expect(approval).toEqual({
      requestId: "7",
      threadId: "thread-1",
      kind: "command_execution",
      title: "Run a command",
      detail: "outside the sandbox",
      command: "rm -rf build",
      cwd: "/repo",
      decisions: ["accept", "accept_for_session", "decline"],
      requestedAt: "2026-09-08T10:00:00Z",
    });
  });

  it("offers only accept and decline when the agent lists no session-wide option", () => {
    const approval = readCodexApproval(
      "8",
      "item/fileChange/requestApproval",
      { threadId: "thread-1" },
      "2026-09-08T10:00:00Z",
    );

    expect(approval?.kind).toBe("file_change");
    expect(approval?.decisions).toEqual(["accept", "decline"]);
  });
});

describe("stripControlCharacters", () => {
  it("removes the escape sequences an agent can put in its reason text", () => {
    expect(stripControlCharacters("\u001B[31mdenied\u001B[0m")).toBe("denied");
  });

  it("removes bare control bytes", () => {
    expect(stripControlCharacters("den\u0007ied")).toBe("denied");
  });

  it("reports nothing when the text was only escapes", () => {
    expect(stripControlCharacters("\u001B[2J")).toBeNull();
  });
});

describe("codexApprovalDecision", () => {
  it("names a session-wide acceptance the way the protocol does", () => {
    expect(codexApprovalDecision("accept_for_session")).toBe("acceptForSession");
    expect(codexApprovalDecision("decline")).toBe("decline");
  });
});
