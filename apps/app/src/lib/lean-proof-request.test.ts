import { describe, expect, it } from "vitest";

import { fingerprintLeanProofRequest } from "./lean-proof-request";

const request = {
  objective: "Prove the theorem",
  targetPaths: ["Proof.lean"],
  declarations: ["Proof.main"],
  acceptanceCriteria: ["No placeholders"],
  tokenBudget: 200_000,
};

describe("fingerprintLeanProofRequest", () => {
  it("is stable for an exact retry and changes with meaningful input", () => {
    expect(fingerprintLeanProofRequest({ ...request })).toBe(fingerprintLeanProofRequest(request));
    expect(fingerprintLeanProofRequest({ ...request, tokenBudget: 300_000 })).not.toBe(
      fingerprintLeanProofRequest(request),
    );
  });
});
