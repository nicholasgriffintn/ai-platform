import type { LeanProofOutcome, LeanProofResult } from "@ngriffin_uk/polychat-schemas";
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LeanProofCreateForm, LeanProofResultView } from "./index";

afterEach(cleanup);

function result(outcome: LeanProofOutcome): LeanProofResult {
  return {
    outcome,
    summary: `Outcome: ${outcome}`,
    targetPaths: ["Proof.lean"],
    declarations: outcome === "kernel_checked" ? ["Proof.main"] : [],
    changedPaths: ["Proof.lean"],
    diagnostics: [],
    evidence:
      outcome === "kernel_checked" || outcome === "compiled"
        ? [
            {
              kind: outcome === "kernel_checked" ? "kernel" : "compiler",
              status: "passed",
              summary:
                outcome === "kernel_checked"
                  ? "Lean kernel accepted Proof.main"
                  : "Lean compiled Proof.lean",
              path: "Proof.lean",
              declaration: outcome === "kernel_checked" ? "Proof.main" : null,
            },
          ]
        : [],
    usage: {
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
      cachedInputTokens: 0,
      iterations: 2,
    },
  };
}

describe("LeanProofCreateForm", () => {
  it("blocks submission until a coding repository is configured", () => {
    render(
      <LeanProofCreateForm
        repository={null}
        repositorySettingsHref="/work/w1/projects/p1"
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText("Connect a coding repository first")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Start proof run" })).toBeNull();
    expect(screen.getByRole("link", { name: "Configure project" }).getAttribute("href")).toBe(
      "/work/w1/projects/p1",
    );
  });

  it("normalises one valid request into one host submit intent", async () => {
    const onSubmit = vi.fn(async () => undefined);

    render(
      <LeanProofCreateForm
        repository="owner/lean-project"
        repositorySettingsHref="/work/w1/projects/p1"
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByLabelText("Objective"), {
      target: { value: "Prove the main theorem" },
    });
    fireEvent.change(screen.getByLabelText("Target Lean files"), {
      target: { value: " Proof.lean \nHelper.lean\n" },
    });
    fireEvent.change(screen.getByLabelText("Declarations to verify"), {
      target: { value: "Proof.main\n" },
    });
    fireEvent.change(screen.getByLabelText("Acceptance criteria"), {
      target: { value: "No sorry placeholders\nBuild passes" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Start proof run" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit).toHaveBeenCalledWith({
      objective: "Prove the main theorem",
      targetPaths: ["Proof.lean", "Helper.lean"],
      declarations: ["Proof.main"],
      acceptanceCriteria: ["No sorry placeholders", "Build passes"],
      tokenBudget: 200_000,
    });
  });

  it("rejects repository traversal without invoking the host", () => {
    const onSubmit = vi.fn();

    render(
      <LeanProofCreateForm
        repository="owner/lean-project"
        repositorySettingsHref="/work/w1/projects/p1"
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByLabelText("Objective"), { target: { value: "Prove it" } });
    fireEvent.change(screen.getByLabelText("Target Lean files"), {
      target: { value: "../Secrets.lean" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Start proof run" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("repository-relative");
  });
});

describe("LeanProofResultView", () => {
  it.each([
    ["kernel_checked", "Kernel checked", "requested declarations passed"],
    ["compiled", "Compiled", "kernel evidence is not available"],
    ["incomplete", "Incomplete", "requested proof is not complete"],
    ["failed", "Failed", "without a compiling proof"],
  ] as const)("presents %s as a distinct outcome", (outcome, label, description) => {
    const { unmount } = render(<LeanProofResultView result={result(outcome)} />);

    expect(screen.getByText(label)).toBeTruthy();
    expect(screen.getByText(new RegExp(description, "i"))).toBeTruthy();
    expect(document.querySelector(`[data-lean-proof-outcome="${outcome}"]`)).not.toBeNull();
    unmount();
  });
});
