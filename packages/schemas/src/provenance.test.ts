import { describe, expect, it } from "vitest";

import { outputProvenanceSchema } from "./provenance";

describe("execution provenance contracts", () => {
  it("keeps output origin bounded to effective identities and safe references", () => {
    const provenance = {
      protocolVersion: 1,
      capturedAt: "2026-09-05T12:00:00.000Z",
      completeness: "complete",
      origin: "generated",
      run: { id: "run-1", attempt: 2 },
      model: { id: "model-1", provider: "provider-1" },
      skills: [{ id: "research", name: "Research", revisionId: "revision-3", revision: 3 }],
      sources: [{ id: "source-1", name: "Brief", state: "referenced" }],
      approvals: [{ id: "approval-1", type: "approval", status: "approved", toolName: "publish" }],
    } as const;

    expect(outputProvenanceSchema.parse(provenance)).toEqual(provenance);
    expect(
      outputProvenanceSchema.safeParse({ ...provenance, prompt: "private system instructions" })
        .success,
    ).toBe(false);
  });

  it("represents legacy provenance without fabricating a run or model", () => {
    expect(
      outputProvenanceSchema.parse({
        protocolVersion: 1,
        capturedAt: "2026-09-05T12:00:00.000Z",
        completeness: "legacy",
        origin: "legacy",
        run: null,
        model: null,
        skills: [],
        sources: [],
        approvals: [],
      }),
    ).toMatchObject({ completeness: "legacy", run: null, model: null });
  });

  it("bounds persisted references", () => {
    const approvals = Array.from({ length: 101 }, (_, index) => ({
      id: `approval-${index}`,
      type: "approval" as const,
      status: "approved" as const,
      toolName: null,
    }));

    expect(
      outputProvenanceSchema.safeParse({
        protocolVersion: 1,
        capturedAt: "2026-09-05T12:00:00.000Z",
        completeness: "complete",
        origin: "generated",
        run: null,
        model: { id: "model-1", provider: "provider-1" },
        skills: [],
        sources: [],
        approvals,
      }).success,
    ).toBe(false);
  });
});
