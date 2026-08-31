import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { OutputContent } from "./OutputContent";

vi.mock("~/hooks/useRunnableTools", () => ({
  useRunnableTool: () => ({ data: undefined }),
}));

describe("OutputContent", () => {
  it("renders a Lean proof output with its dedicated verification semantics", () => {
    render(
      <OutputContent
        capabilityId="featured-lean-proofs"
        kind="lean.proof"
        content={{
          outcome: "kernel_checked",
          summary: "The theorem is complete.",
          targetPaths: ["Proof.lean"],
          declarations: ["Proof.main"],
          changedPaths: ["Proof.lean"],
          diagnostics: [],
          evidence: [
            {
              kind: "kernel",
              status: "passed",
              summary: "Lean kernel accepted Proof.main",
              path: "Proof.lean",
              declaration: "Proof.main",
            },
          ],
          usage: {
            inputTokens: 80,
            outputTokens: 20,
            totalTokens: 100,
            cachedInputTokens: 0,
            iterations: 1,
          },
        }}
      />,
    );

    expect(screen.getByText("Kernel checked")).toBeTruthy();
    expect(screen.getByText("The theorem is complete.")).toBeTruthy();
    expect(document.querySelector('[data-lean-proof-outcome="kernel_checked"]')).not.toBeNull();
  });

  it("fails closed for malformed proof output", () => {
    render(
      <OutputContent
        capabilityId="featured-lean-proofs"
        kind="lean.proof"
        content={{ outcome: "kernel_checked" }}
      />,
    );

    expect(screen.getByText("Proof result unavailable")).toBeTruthy();
  });
});
