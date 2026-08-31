import { beforeEach, describe, expect, it, vi } from "vitest";

const insertEmbedding = vi.hoisted(() => vi.fn());

vi.mock("~/services/apps/embeddings/insert", () => ({ insertEmbedding }));

import { indexSandboxRunResult } from "../run-indexing";

describe("sandbox run indexing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertEmbedding.mockResolvedValue({ status: "success", data: { id: "sandbox-run-run-1" } });
  });

  it("delegates completed output to the scoped embedding insertion service", async () => {
    const user = { id: 42, email: "developer@example.com" };
    const serviceContext = {
      env: { AI: {}, VECTOR_DB: {} },
      repositories: {
        users: { getUserById: vi.fn().mockResolvedValue(user) },
      },
    } as any;

    await indexSandboxRunResult({
      serviceContext,
      userId: 42,
      run: {
        runId: "run-1",
        repo: "owner/repository",
        task: "Implement scoped retrieval",
        status: "completed",
        startedAt: "2026-08-31T12:00:00.000Z",
        completedAt: "2026-08-31T12:01:00.000Z",
        result: { summary: "Implemented safely", diff: "+ secure change" },
      } as any,
    });

    expect(insertEmbedding).toHaveBeenCalledWith({
      env: serviceContext.env,
      user,
      request: {
        id: "sandbox-run-run-1",
        type: "sandbox_run",
        title: "Sandbox run run-1",
        content: expect.stringContaining("Implemented safely"),
        metadata: {
          runId: "run-1",
          repo: "owner/repository",
          status: "completed",
          startedAt: "2026-08-31T12:00:00.000Z",
          completedAt: "2026-08-31T12:01:00.000Z",
        },
      },
    });
    expect(insertEmbedding.mock.calls[0]?.[0].request).not.toHaveProperty("namespace");
    expect(insertEmbedding.mock.calls[0]?.[0].request).not.toHaveProperty("userId");
  });
});
