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
  const repository = new ConversationRunRepository({
    DB: { batch, prepare },
  } as any);

  return { all, batch, bind, first, prepare, repository, run };
}

describe("ConversationRunRepository", () => {
  it("only allows the run initiator to resume project and personal runs", async () => {
    const projectRepository = createRepository();

    projectRepository.first.mockResolvedValueOnce(null).mockResolvedValueOnce({
      ...runRow,
      project_id: "project-1",
      status: "awaiting_approval",
    });
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
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(projectRepository.batch).not.toHaveBeenCalled();

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

  it("rejects a new cancellation command after the run has reached a terminal state", async () => {
    const { batch, first, repository } = createRepository();

    first.mockResolvedValueOnce(null).mockResolvedValueOnce({ ...runRow, status: "succeeded" });

    await expect(
      repository.acceptCancellation({
        commandId: "cancel-terminal",
        digest: "cancel-digest",
        expectedAttempt: 1,
        runId: "run-1",
        userId: 42,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(batch).not.toHaveBeenCalled();
  });
});
