import { describe, expect, it } from "vitest";

import { leanProofRefetchInterval } from "./useLeanProofs";

describe("leanProofRefetchInterval", () => {
  it("polls while a sandbox proof is active", () => {
    expect(leanProofRefetchInterval({ status: "queued" })).toBe(2_000);
    expect(leanProofRefetchInterval({ status: "running" })).toBe(2_000);
  });

  it("stops polling after review or a terminal state", () => {
    expect(leanProofRefetchInterval({ status: "review" })).toBe(false);
    expect(leanProofRefetchInterval({ status: "done" })).toBe(false);
    expect(leanProofRefetchInterval({ status: "blocked" })).toBe(false);
  });
});
