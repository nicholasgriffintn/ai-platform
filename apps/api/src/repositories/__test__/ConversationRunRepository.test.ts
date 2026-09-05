import { describe, expect, it, vi } from "vitest";

import { ConversationRunRepository } from "../ConversationRunRepository";

const runRow = {
  id: "run-1",
  conversation_id: "conversation-1",
  project_id: null,
  project_task_id: null,
  stage_id: null,
  initiator_user_id: 42,
  status: "running",
  attempt: 1,
  event_sequence: 1,
  terminal_reason: null,
  last_message_id: null,
  created_at: "2026-09-05T01:00:00.000Z",
  updated_at: "2026-09-05T01:00:01.000Z",
  started_at: "2026-09-05T01:00:01.000Z",
  completed_at: null,
  context_json: null,
  retry_json: null,
} as const;

function createRepository() {
  const all = vi.fn().mockResolvedValue({ results: [] });
  const first = vi.fn().mockResolvedValue(null);
  const run = vi.fn().mockResolvedValue({ success: true, results: [] });
  const bind = vi.fn().mockReturnValue({ all, first, run });
  const prepare = vi.fn().mockReturnValue({ bind });
  const batch = vi.fn().mockResolvedValue([]);
  const repository = new ConversationRunRepository({ DB: { batch, prepare } } as any);

  return { all, batch, bind, first, prepare, repository, run };
}

describe("ConversationRunRepository", () => {
  it("returns the same receipt for a duplicate compatible command", async () => {
    const { batch, first, repository } = createRepository();

    first.mockResolvedValueOnce({
      ...runRow,
      command_id: "command-1",
      command_kind: "turn",
      input_digest: "digest-1",
      accepted_at: "2026-09-05T01:00:00.000Z",
    });

    const receipt = await repository.acceptCommand({
      commandId: "command-1",
      conversationId: "conversation-1",
      digest: "digest-1",
      kind: "turn",
      userId: 42,
    });

    expect(receipt.duplicate).toBe(true);
    expect(receipt.run.id).toBe("run-1");
    expect(batch).not.toHaveBeenCalled();
  });

  it("rejects command id reuse with incompatible input", async () => {
    const { first, repository } = createRepository();

    first.mockResolvedValueOnce({
      ...runRow,
      command_id: "command-1",
      command_kind: "turn",
      input_digest: "digest-1",
      accepted_at: "2026-09-05T01:00:00.000Z",
    });

    await expect(
      repository.acceptCommand({
        commandId: "command-1",
        conversationId: "conversation-1",
        digest: "different",
        kind: "turn",
        userId: 42,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("persists a new run and command receipt atomically", async () => {
    const { batch, bind, prepare, repository } = createRepository();

    batch.mockResolvedValueOnce([
      { results: [{ ...runRow, stage_id: "build", status: "accepted" }] },
      { results: [{ id: "receipt-1" }] },
    ]);

    const receipt = await repository.acceptCommand({
      commandId: "command-1",
      conversationId: "conversation-1",
      digest: "digest-1",
      kind: "turn",
      userId: 42,
      projectId: "project-1",
      projectTaskId: "task-1",
      stageId: "build",
    });

    expect(receipt.duplicate).toBe(false);
    expect(batch).toHaveBeenCalledTimes(1);
    expect(batch.mock.calls[0]?.[0]).toHaveLength(4);
    expect(prepare.mock.calls[1]?.[0]).toContain("INSERT INTO conversation_run");
    expect(prepare.mock.calls[2]?.[0]).toContain("INSERT INTO conversation_run_command");
    expect(prepare.mock.calls[3]?.[0]).toContain("INSERT INTO conversation_run_event");
    expect(bind.mock.calls[1]).toContain("build");
    expect(receipt.run.stageId).toBe("build");
  });

  it("only records a resume command while the expected waiting attempt still owns the run", async () => {
    const { batch, first, prepare, repository } = createRepository();

    first.mockResolvedValueOnce(null).mockResolvedValueOnce({
      ...runRow,
      status: "awaiting_input",
    });
    batch.mockResolvedValueOnce([
      { results: [{ id: "receipt-1" }] },
      { results: [{ ...runRow, attempt: 2 }] },
    ]);

    const receipt = await repository.acceptCommand({
      commandId: "command-2",
      conversationId: "conversation-1",
      digest: "digest-2",
      kind: "interaction_response",
      userId: 42,
      runId: "run-1",
    });

    expect(receipt.run.attempt).toBe(2);
    expect(prepare.mock.calls[2]?.[0]).toContain("FROM conversation_run");
    expect(prepare.mock.calls[2]?.[0]).toContain("attempt = ? AND status = ?");
    expect(prepare.mock.calls[3]?.[0]).toContain("attempt = attempt + 1");
    expect(prepare.mock.calls[3]?.[0]).toContain("retry_json = NULL");
    expect(batch.mock.calls[0]?.[0]).toHaveLength(4);
  });

  it("allows another authorised project member to resume but not another personal user", async () => {
    const projectRepository = createRepository();

    projectRepository.first.mockResolvedValueOnce(null).mockResolvedValueOnce({
      ...runRow,
      project_id: "project-1",
      status: "awaiting_approval",
    });
    projectRepository.batch.mockResolvedValueOnce([
      { results: [{ id: "receipt-1" }] },
      {
        results: [{ ...runRow, project_id: "project-1", status: "running", attempt: 2 }],
      },
    ]);

    await expect(
      projectRepository.repository.acceptCommand({
        commandId: "command-project",
        conversationId: "conversation-1",
        digest: "digest-project",
        kind: "interaction_response",
        userId: 43,
        projectId: "project-1",
        runId: "run-1",
      }),
    ).resolves.toMatchObject({ run: { attempt: 2 } });

    const personalRepository = createRepository();

    personalRepository.first.mockResolvedValueOnce(null).mockResolvedValueOnce({
      ...runRow,
      status: "awaiting_input",
    });

    await expect(
      personalRepository.repository.acceptCommand({
        commandId: "command-personal",
        conversationId: "conversation-1",
        digest: "digest-personal",
        kind: "interaction_response",
        userId: 43,
        runId: "run-1",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("does not transition a terminal run", async () => {
    const { batch, first, repository } = createRepository();

    first.mockResolvedValueOnce({ ...runRow, status: "succeeded" });

    const transitioned = await repository.transition({
      runId: "run-1",
      attempt: 1,
      status: "running",
    });

    expect(transitioned).toBeNull();
    expect(batch).not.toHaveBeenCalled();
  });

  it("accepts a cancellation command and fences it to the observed attempt", async () => {
    const { batch, first, repository } = createRepository();

    first
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(runRow)
      .mockResolvedValueOnce({ ...runRow, status: "cancelling" });
    batch.mockResolvedValueOnce([
      { results: [{ id: "receipt-1" }] },
      { results: [{ ...runRow, status: "cancelling" }] },
    ]);

    const receipt = await repository.acceptCancellation({
      commandId: "cancel-1",
      digest: "cancel-digest",
      expectedAttempt: 1,
      runId: "run-1",
      userId: 42,
    });

    expect(receipt.kind).toBe("cancel");
    expect(receipt.run.status).toBe("cancelling");
    expect(batch.mock.calls[0]?.[0]).toHaveLength(4);
  });

  it("persists a status transition and its ordered event atomically", async () => {
    const { batch, first, prepare, repository } = createRepository();

    first.mockResolvedValueOnce(runRow);
    batch.mockResolvedValueOnce([
      {
        results: [
          {
            ...runRow,
            status: "succeeded",
            event_sequence: 2,
            last_message_id: "assistant-1",
          },
        ],
      },
      { results: [{ id: "event-2" }] },
      { results: [] },
    ]);

    await expect(
      repository.transition({
        runId: "run-1",
        attempt: 1,
        status: "succeeded",
        lastMessageId: "assistant-1",
      }),
    ).resolves.toMatchObject({ status: "succeeded", lastMessageId: "assistant-1" });

    expect(batch.mock.calls[0]?.[0]).toHaveLength(3);
    expect(prepare.mock.calls.some(([query]) => query.includes("event_sequence + 1"))).toBe(true);
    expect(
      prepare.mock.calls.some(([query]) => query.includes("INSERT INTO conversation_run_event")),
    ).toBe(true);
  });

  it("lists retained events in ascending sequence order", async () => {
    const { all, prepare, repository } = createRepository();

    all.mockResolvedValueOnce({
      results: [
        {
          id: "event-8",
          run_id: "run-1",
          sequence: 8,
          protocol_version: 1,
          attempt: 2,
          type: "message.created",
          occurred_at: "2026-09-05T01:00:08.000Z",
          data: '{"messageId":"assistant-1"}',
        },
      ],
    });

    await expect(repository.listEvents("run-1", 7, 20)).resolves.toMatchObject([
      { id: "event-8", sequence: 8, data: { messageId: "assistant-1" } },
    ]);
    expect(prepare.mock.calls[0]?.[0]).toContain("ORDER BY sequence ASC");
  });

  it("lists task runs inside the exact project and task scope", async () => {
    const { all, bind, prepare, repository } = createRepository();

    all.mockResolvedValueOnce({
      results: [
        {
          ...runRow,
          project_id: "project-1",
          project_task_id: "task-1",
        },
      ],
    });

    await expect(repository.listForProjectTask("project-1", "task-1")).resolves.toMatchObject([
      { id: "run-1", projectId: "project-1", projectTaskId: "task-1" },
    ]);
    expect(prepare.mock.calls[0]?.[0]).toContain("project_id = ? AND project_task_id = ?");
    expect(bind).toHaveBeenCalledWith("project-1", "task-1");
  });

  it("records context only for the exact active run attempt", async () => {
    const { bind, first, prepare, repository } = createRepository();
    const context = {
      protocolVersion: 1 as const,
      runId: "run-1",
      conversationId: "conversation-1",
      attempt: 1,
      step: 2,
      model: "model-1",
      generatedAt: "2026-09-05T02:00:00.000Z",
      usage: { inputTokens: 120, contextWindow: 32000, source: "estimated" as const },
      messages: { included: 3, omitted: 0 },
      sources: [],
      skills: [],
      summary: null,
      omissions: [],
    };

    first.mockResolvedValueOnce({ ...runRow, context_json: JSON.stringify(context) });

    await expect(repository.updateContext("run-1", 1, context)).resolves.toMatchObject({
      context,
    });
    expect(prepare.mock.calls[0]?.[0]).toContain("attempt = ?");
    expect(prepare.mock.calls[0]?.[0]).toContain("status IN");
    expect(bind).toHaveBeenCalledWith(JSON.stringify(context), context.generatedAt, "run-1", 1);
  });

  it("records retry state and its ordered event only for a running attempt", async () => {
    const { batch, prepare, repository } = createRepository();
    const retry = {
      protocolVersion: 1 as const,
      step: 2,
      attempt: 2,
      maxAttempts: 2,
      runRetry: 1,
      maxRunRetries: 2,
      phase: "waiting" as const,
      classification: "timeout" as const,
      reason: "The model provider did not respond in time.",
      scheduledAt: "2026-09-05T02:00:00.000Z",
      retryAt: "2026-09-05T02:00:01.000Z",
    };

    batch.mockResolvedValueOnce([
      { results: [{ ...runRow, event_sequence: 2, retry_json: JSON.stringify(retry) }] },
      { results: [{ id: "event-2" }] },
      { results: [] },
    ]);

    await expect(repository.updateRetry("run-1", 1, retry)).resolves.toMatchObject({ retry });
    expect(prepare.mock.calls[0]?.[0]).toContain("status = 'running'");
    expect(prepare.mock.calls[1]?.[0]).toContain("INSERT INTO conversation_run_event");
    expect(prepare.mock.calls[1]?.[0]).toContain("retry_json IS ?");
    expect(batch.mock.calls[0]?.[0]).toHaveLength(3);
  });

  it("rejects a delayed cancellation after the run attempt changes", async () => {
    const { batch, first, repository } = createRepository();

    first.mockResolvedValueOnce(null).mockResolvedValueOnce({ ...runRow, attempt: 2 });

    await expect(
      repository.acceptCancellation({
        commandId: "cancel-late",
        digest: "cancel-digest",
        expectedAttempt: 1,
        runId: "run-1",
        userId: 42,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(batch).not.toHaveBeenCalled();
  });
});
