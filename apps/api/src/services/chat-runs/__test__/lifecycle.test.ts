import type { ChatRun, ChatRunCommandReceipt } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it, vi } from "vitest";

import type { AgentLoopExecutionResult } from "~/lib/chat/agent/agent-loop";
import type { ServiceContext } from "~/lib/context/serviceContext";
import type { ConversationRunRepository } from "~/repositories/ConversationRunRepository";
import type { CoreChatOptions } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

import { acceptChatRun, ChatRunLifecycle } from "../lifecycle";

const runningRun: ChatRun = {
  protocolVersion: 1,
  id: "run-1",
  conversationId: "conversation-1",
  projectId: null,
  projectTaskId: null,
  initiatorUserId: 7,
  status: "running",
  attempt: 1,
  createdAt: "2026-09-05T12:00:00.000Z",
  updatedAt: "2026-09-05T12:00:00.000Z",
  startedAt: "2026-09-05T12:00:00.000Z",
  completedAt: null,
  terminalReason: null,
  lastMessageId: null,
};

function receipt(): ChatRunCommandReceipt {
  return {
    protocolVersion: 1,
    commandId: "command-1",
    run: { ...runningRun },
    kind: "turn",
    acceptedAt: "2026-09-05T12:00:00.000Z",
    duplicate: false,
  };
}

function result(overrides: Partial<AgentLoopExecutionResult> = {}): AgentLoopExecutionResult {
  return {
    response: { response: "Done" },
    finalMessage: { id: "message-1", role: "assistant", content: "Done" },
    toolResponses: [],
    memoryMessages: [],
    guardrailsPassed: true,
    guardrailViolations: [],
    ...overrides,
  };
}

function createLifecycle() {
  const transition = vi.fn(async (params: { status: ChatRun["status"] }) => ({
    ...runningRun,
    status: params.status,
  }));
  const repository = { transition } as unknown as ConversationRunRepository;
  const commandReceipt = receipt();

  return {
    commandReceipt,
    lifecycle: new ChatRunLifecycle(repository, commandReceipt),
    transition,
  };
}

describe("ChatRunLifecycle", () => {
  it("enrols an authenticated stored turn and starts its accepted run", async () => {
    const acceptedRun = { ...runningRun, status: "accepted" as const, startedAt: null };
    const acceptCommand = vi.fn().mockResolvedValue({
      ...receipt(),
      run: acceptedRun,
    });
    const transition = vi.fn().mockResolvedValue(runningRun);
    const context = {
      user: { id: 7 },
      ensureDatabase: vi.fn(),
      repositories: {
        conversations: {
          getConversation: vi.fn().mockResolvedValue({
            id: "conversation-1",
            project_id: null,
            user_id: 7,
          }),
        },
        projectTasks: { getTaskByConversation: vi.fn().mockResolvedValue(null) },
        conversationRuns: {
          acceptCommand,
          getForInteraction: vi.fn(),
          transition,
        },
      },
    } as unknown as ServiceContext;
    const options = {
      completion_id: "conversation-1",
      command_id: "command-1",
      context,
      env: {},
      messages: [{ role: "user", content: "Continue" }],
      model: "gpt-6-astra",
      store: true,
    } as CoreChatOptions;

    const lifecycle = await acceptChatRun(options);

    expect(lifecycle?.run).toEqual(runningRun);
    expect(acceptCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        commandId: "command-1",
        conversationId: "conversation-1",
        kind: "turn",
        userId: 7,
      }),
    );
    expect(transition).toHaveBeenCalledWith({
      runId: "run-1",
      attempt: 1,
      status: "running",
    });
  });

  it("records waiting and terminal outcomes with the produced message identity", async () => {
    const waiting = createLifecycle();

    await waiting.lifecycle.complete(
      result({
        response: { status: "pending" },
        finalMessage: undefined,
        toolResponses: [{ id: "question-1", role: "tool", name: "ask_user", content: "Question" }],
      }),
    );

    expect(waiting.transition).toHaveBeenCalledWith(
      expect.objectContaining({ status: "awaiting_input", lastMessageId: "question-1" }),
    );

    const completed = createLifecycle();

    await completed.lifecycle.complete(result());

    expect(completed.transition).toHaveBeenCalledWith(
      expect.objectContaining({ status: "succeeded", lastMessageId: "message-1" }),
    );
    expect(completed.commandReceipt.run.status).toBe("succeeded");
  });

  it("binds a project task run to the exact executing stage", async () => {
    const acceptedRun = {
      ...runningRun,
      projectId: "project-1",
      projectTaskId: "task-1",
      stageId: "build",
      status: "accepted" as const,
      startedAt: null,
    };
    const acceptCommand = vi.fn().mockResolvedValue({ ...receipt(), run: acceptedRun });
    const context = {
      user: { id: 7 },
      requireUser: vi.fn().mockReturnValue({ id: 7, plan_id: "pro" }),
      ensureDatabase: vi.fn(),
      repositories: {
        conversations: {
          getConversation: vi.fn().mockResolvedValue({
            id: "conversation-1",
            project_id: "project-1",
            user_id: 7,
          }),
        },
        workspaces: {
          getProject: vi.fn().mockResolvedValue({ id: "project-1", workspace_id: "workspace-1" }),
          getWorkspace: vi.fn().mockResolvedValue({ id: "workspace-1" }),
          getMembership: vi.fn().mockResolvedValue({ role: "owner" }),
        },
        projectTasks: {
          getTaskByConversation: vi.fn().mockResolvedValue({
            id: "task-1",
            stageId: "plan",
            runId: null,
          }),
          updateTask: vi.fn().mockResolvedValue({ id: "task-1" }),
        },
        conversationRuns: {
          acceptCommand,
          getForInteraction: vi.fn(),
          transition: vi.fn().mockResolvedValue({ ...acceptedRun, status: "running" }),
        },
      },
    } as unknown as ServiceContext;

    await acceptChatRun({
      completion_id: "conversation-1",
      command_id: "dispatch-1",
      command_payload: { projectId: "project-1", taskId: "task-1", stageId: "build" },
      context,
      env: context.env,
      messages: [{ role: "user", content: "Build" }],
      metadata: { project_id: "project-1" },
      store: true,
    });

    expect(acceptCommand).toHaveBeenCalledWith(expect.objectContaining({ stageId: "build" }));
  });

  it("distinguishes ownership interruption from an ordinary failure", async () => {
    const interrupted = createLifecycle();
    const leaseError = new AssistantError("Lease lost", ErrorType.CONFLICT_ERROR, 409, {
      reason: "lease_ownership_lost",
    });

    await interrupted.lifecycle.fail(leaseError);

    expect(interrupted.transition).toHaveBeenCalledWith(
      expect.objectContaining({ status: "interrupted", terminalReason: "Lease lost" }),
    );

    const failed = createLifecycle();

    await failed.lifecycle.fail(new Error("Provider unavailable"));

    expect(failed.transition).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", terminalReason: "Provider unavailable" }),
    );
  });

  it("rejects a stale completion that cannot replace authoritative state", async () => {
    const { lifecycle, transition } = createLifecycle();

    transition.mockResolvedValueOnce(null);

    await expect(lifecycle.complete(result())).rejects.toMatchObject({ statusCode: 409 });
  });
});
