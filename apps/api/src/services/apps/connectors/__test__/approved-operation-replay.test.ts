import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { handleToolCalls } from "~/lib/chat/tools";

import { replayApprovedConnectorOperation } from "../approved-operation-replay";
import { getConnectorArgumentDigest } from "../operation-approvals";

const approvalMocks = vi.hoisted(() => ({
  getConnectorArgumentDigest: vi.fn().mockResolvedValue("approved-argument-digest"),
}));

vi.mock("~/lib/chat/tools", () => ({
  handleToolCalls: vi.fn(),
}));

vi.mock("../operation-approvals", () => ({
  getConnectorArgumentDigest: approvalMocks.getConnectorArgumentDigest,
}));

const toolCall = {
  id: "call-approved",
  type: "function",
  function: {
    name: "use_recipe_connector",
    arguments: JSON.stringify({
      provider: "gmail",
      operation: "GMAIL_CREATE_DRAFT",
      params: { subject: "Approved subject" },
      sessionId: "ccs_approved",
    }),
  },
};

const pendingResult = {
  id: "pending-result",
  role: "tool",
  name: "use_recipe_connector",
  tool_call_id: toolCall.id,
  tool_call_arguments: toolCall.function.arguments,
  status: "pending",
  content: "Approval required",
  data: {
    approvalRequired: true,
    approvalId: "coa_approved",
  },
};

const executedResult = {
  id: "executed-result",
  role: "tool",
  name: "use_recipe_connector",
  tool_call_id: toolCall.id,
  status: "success",
  content: "Draft created",
  data: { draftId: "draft-1" },
};

function createConversationManager(messages: unknown[]) {
  return {
    getAllMessages: vi.fn().mockResolvedValue(messages),
    add: vi.fn(),
    checkUsageLimits: vi.fn(),
    incrementFunctionUsage: vi.fn(),
  };
}

async function flushMicrotasks() {
  for (let index = 0; index < 20; index++) {
    await Promise.resolve();
  }
}

async function createFixture(state: "approved" | "consumed" = "approved") {
  const argumentDigest = await getConnectorArgumentDigest({
    provider: "gmail",
    operation: "GMAIL_CREATE_DRAFT",
    arguments: { subject: "Approved subject" },
  });
  const approval = {
    id: "coa_approved",
    userId: 42,
    runId: "connector_run_approved",
    completionId: "completion-approved",
    provider: "gmail",
    operation: "GMAIL_CREATE_DRAFT",
    connectedAccountId: "ca_approved",
    channel: "web",
    argumentDigest,
    state,
    createdAt: "2026-08-13T12:00:00.000Z",
    expiresAt: "2099-08-13T12:10:00.000Z",
    resolvedAt: "2026-08-13T12:01:00.000Z",
    consumedAt: state === "consumed" ? "2026-08-13T12:02:00.000Z" : null,
  } as const;
  const session = {
    id: "ccs_approved",
    remoteSessionId: "remote-session",
    kind: "tool",
    userId: 42,
    provider: "gmail",
    toolkitSlug: "gmail",
    authConfigId: "auth-gmail",
    connectedAccountId: "ca_approved",
    allowedOperationIds: ["GMAIL_CREATE_DRAFT"],
    runId: approval.runId,
    completionId: approval.completionId,
    recipeId: null,
    installationId: null,
    state: "active",
    createdAt: "2026-08-13T12:00:00.000Z",
    expiresAt: "2099-08-13T13:00:00.000Z",
    claimedAt: null,
    cleanupAttempts: 0,
    cleanupAfter: null,
  } as const;
  const getByIdForUser = vi.fn().mockResolvedValue(approval);
  const user = { id: 42, plan_id: "pro" } as any;
  const context = {
    env: { AI: {} },
    user,
    connectorRunId: "connector_run_new",
    requestCache: new Map(),
    repositories: {
      connectorOperationApprovals: { getByIdForUser },
      composioConnectorSessions: { getById: vi.fn().mockResolvedValue(session) },
      templates: { getTemplateById: vi.fn() },
    },
  } as any;

  return { approval, context, session, user };
}

describe("replayApprovedConnectorOperation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("replays the exact authoritative stored call once and replaces the pending result for summary", async () => {
    const { approval, context, user } = await createFixture();
    const conversationManager = createConversationManager([
      { role: "user", content: "Create the draft" },
      { role: "assistant", content: "", tool_calls: [toolCall], mode: "agent" },
      pendingResult,
    ]);

    vi.mocked(handleToolCalls).mockResolvedValue([executedResult as any]);

    const replay = await replayApprovedConnectorOperation({
      approval,
      context,
      conversationManager: conversationManager as any,
      user,
      model: "gpt-4",
    });

    expect(conversationManager.getAllMessages).toHaveBeenCalledWith(approval.completionId, {
      includeArchived: false,
    });
    expect(context.connectorRunId).toBe(approval.runId);
    expect(handleToolCalls).toHaveBeenCalledOnce();
    expect(handleToolCalls).toHaveBeenCalledWith(
      approval.completionId,
      { response: "", tool_calls: [toolCall] },
      conversationManager,
      expect.objectContaining({
        mode: "agent",
        request: expect.objectContaining({
          completion_id: approval.completionId,
          connector_approval_id: approval.id,
          approved_tools: ["use_recipe_connector"],
        }),
      }),
      {
        persistResults: "none",
        recoverUnknownToolCalls: false,
      },
    );
    expect(conversationManager.add).toHaveBeenCalledWith(approval.completionId, executedResult);
    expect(replay.toolCall).toEqual(toolCall);
    expect(replay.toolResult).toEqual(executedResult);
    expect(replay.summaryMessages).toEqual([
      { role: "user", content: "Create the draft" },
      { role: "assistant", content: "", tool_calls: [toolCall], mode: "agent" },
      executedResult,
    ]);
  });

  it("reuses the authoritative stored final result for a duplicate consumed continuation", async () => {
    const { approval, context, user } = await createFixture("consumed");
    const conversationManager = createConversationManager([
      { role: "assistant", content: "", tool_calls: [toolCall] },
      pendingResult,
      executedResult,
    ]);

    const replay = await replayApprovedConnectorOperation({
      approval,
      context,
      conversationManager: conversationManager as any,
      user,
      model: "gpt-4",
    });

    expect(handleToolCalls).not.toHaveBeenCalled();
    expect(replay.toolResult).toEqual(executedResult);
    expect(replay.summaryMessages).toEqual([
      { role: "assistant", content: "", tool_calls: [toolCall] },
      executedResult,
    ]);
  });

  it("uses the winner's stored result when concurrent replay loses the consume race", async () => {
    const { approval, context, user } = await createFixture();

    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const initialMessages = [
      { role: "assistant", content: "", tool_calls: [toolCall] },
      pendingResult,
    ];
    const conversationManager = createConversationManager(initialMessages);

    conversationManager.getAllMessages
      .mockResolvedValueOnce(initialMessages)
      .mockResolvedValueOnce(initialMessages)
      .mockResolvedValueOnce([...initialMessages, executedResult]);
    context.repositories.connectorOperationApprovals.getByIdForUser.mockResolvedValue({
      ...approval,
      state: "consumed",
      consumedAt: "2026-08-13T12:02:00.000Z",
    });
    vi.mocked(handleToolCalls).mockResolvedValue([
      {
        ...executedResult,
        id: "loser-result",
        status: "error",
        content:
          "Connector approval is invalid, expired, already used, or does not match this action",
      } as any,
    ]);

    const replayPromise = replayApprovedConnectorOperation({
      approval,
      context,
      conversationManager: conversationManager as any,
      user,
      model: "gpt-4",
    });

    await flushMicrotasks();
    await vi.runAllTimersAsync();
    const replay = await replayPromise;

    expect(replay.toolResult).toEqual(executedResult);
    expect(conversationManager.add).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("drops stale continuation attempts after the matched pending boundary", async () => {
    const { approval, context, user } = await createFixture();
    const staleCall = {
      ...toolCall,
      id: "call-stale",
      function: {
        ...toolCall.function,
        arguments: JSON.stringify({
          provider: "gmail",
          operation: "GMAIL_CREATE_DRAFT",
          argumentSummary: { subject: "Approved subject" },
        }),
      },
    };
    const conversationManager = createConversationManager([
      { role: "user", content: "Create the draft" },
      { role: "assistant", content: "", tool_calls: [toolCall] },
      pendingResult,
      { role: "developer", content: "Retry the approved action" },
      { role: "assistant", content: "", tool_calls: [staleCall] },
      {
        role: "tool",
        name: "use_recipe_connector",
        tool_call_id: staleCall.id,
        status: "error",
        content: "Connector approval does not match",
      },
    ]);

    vi.mocked(handleToolCalls).mockResolvedValue([executedResult as any]);

    const replay = await replayApprovedConnectorOperation({
      approval,
      context,
      conversationManager: conversationManager as any,
      user,
      model: "gpt-4",
    });

    expect(replay.summaryMessages).toEqual([
      { role: "user", content: "Create the draft" },
      { role: "assistant", content: "", tool_calls: [toolCall] },
      executedResult,
    ]);
  });

  it("fails closed when the paired tool result records different arguments", async () => {
    const { approval, context, user } = await createFixture();
    const conversationManager = createConversationManager([
      { role: "assistant", content: "", tool_calls: [toolCall] },
      {
        ...pendingResult,
        tool_call_arguments: JSON.stringify({
          provider: "gmail",
          operation: "GMAIL_CREATE_DRAFT",
          params: { subject: "Substituted subject" },
          sessionId: "ccs_approved",
        }),
      },
    ]);

    await expect(
      replayApprovedConnectorOperation({
        approval,
        context,
        conversationManager: conversationManager as any,
        user,
        model: "gpt-4",
      }),
    ).rejects.toThrow("stored connector arguments disagree");
    expect(handleToolCalls).not.toHaveBeenCalled();
  });

  it("fails indeterminate after bounded polling when a consumed result never appears", async () => {
    const { approval, context, user } = await createFixture("consumed");

    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const conversationManager = createConversationManager([
      { role: "assistant", content: "", tool_calls: [toolCall] },
      pendingResult,
    ]);

    const replayPromise = replayApprovedConnectorOperation({
      approval,
      context,
      conversationManager: conversationManager as any,
      user,
      model: "gpt-4",
    });
    const assertion = expect(replayPromise).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining("result is not available yet"),
    });

    await flushMicrotasks();
    await vi.runAllTimersAsync();
    await assertion;
    expect(handleToolCalls).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("stops polling when the continuation request is cancelled", async () => {
    const { approval, context, user } = await createFixture("consumed");

    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const controller = new AbortController();
    const conversationManager = createConversationManager([
      { role: "assistant", content: "", tool_calls: [toolCall] },
      pendingResult,
    ]);

    const replayPromise = replayApprovedConnectorOperation({
      approval,
      context,
      conversationManager: conversationManager as any,
      user,
      model: "gpt-4",
      signal: controller.signal,
    });
    const assertion = expect(replayPromise).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining("was cancelled"),
    });

    await flushMicrotasks();
    controller.abort();
    await assertion;
    expect(handleToolCalls).not.toHaveBeenCalled();
  });

  it("rejects a receipt bound to a different account than the stored session", async () => {
    const { approval, context, user } = await createFixture();

    context.repositories.composioConnectorSessions.getById.mockResolvedValue({
      ...(await context.repositories.composioConnectorSessions.getById()),
      connectedAccountId: "ca_substituted",
    });
    const conversationManager = createConversationManager([
      { role: "assistant", content: "", tool_calls: [toolCall] },
      pendingResult,
    ]);

    await expect(
      replayApprovedConnectorOperation({
        approval,
        context,
        conversationManager: conversationManager as any,
        user,
        model: "gpt-4",
      }),
    ).rejects.toThrow("does not match the approved connector action");
    expect(handleToolCalls).not.toHaveBeenCalled();
  });
});
