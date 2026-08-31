import { beforeEach, describe, expect, it, vi } from "vitest";

import { createLeanProof, getLeanProof, listLeanProofs } from "./lean-proofs";

const mocks = vi.hoisted(() => ({
  fetchApiOrThrow: vi.fn(),
  getHeaders: vi.fn(),
}));

vi.mock("./api-service", () => ({
  apiService: { getHeaders: mocks.getHeaders },
}));

vi.mock("./fetch-wrapper", () => ({
  fetchApiOrThrow: mocks.fetchApiOrThrow,
}));

describe("Lean proof API", () => {
  beforeEach(() => {
    mocks.fetchApiOrThrow.mockReset();
    mocks.getHeaders.mockReset();
    mocks.getHeaders.mockResolvedValue({ Authorization: "Bearer token" });
    mocks.fetchApiOrThrow.mockImplementation(async () => Response.json({ tasks: [] }));
  });

  it("creates and starts a proof through one project-scoped request", async () => {
    mocks.fetchApiOrThrow.mockResolvedValue(Response.json({ task: { id: "task-1" } }));
    const input = {
      objective: "Prove the theorem",
      targetPaths: ["Proof.lean"],
      declarations: ["Proof.main"],
      acceptanceCriteria: ["No placeholders"],
      tokenBudget: 200_000,
    };

    await createLeanProof("project/with spaces", input, "proof-request-1");

    expect(mocks.fetchApiOrThrow).toHaveBeenCalledOnce();
    expect(mocks.fetchApiOrThrow).toHaveBeenCalledWith(
      "/projects/project%2Fwith%20spaces/lean-proofs",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer token",
          "Idempotency-Key": "proof-request-1",
        },
        body: input,
      },
    );
  });

  it("uses dedicated list and detail routes", async () => {
    await listLeanProofs("project-1");
    await getLeanProof("project-1", "task/1");

    expect(mocks.fetchApiOrThrow).toHaveBeenNthCalledWith(1, "/projects/project-1/lean-proofs", {
      method: "GET",
      headers: { Authorization: "Bearer token" },
    });
    expect(mocks.fetchApiOrThrow).toHaveBeenNthCalledWith(
      2,
      "/projects/project-1/lean-proofs/task%2F1",
      { method: "GET", headers: { Authorization: "Bearer token" } },
    );
  });
});
