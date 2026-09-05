import type { OutputProvenance } from "@ngriffin_uk/polychat-schemas";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { OutputProvenanceSummary } from "./OutputProvenanceSummary";

const generated: OutputProvenance = {
  protocolVersion: 1,
  capturedAt: "2026-09-05T12:00:00.000Z",
  completeness: "complete",
  origin: "generated",
  run: { id: "run-1", attempt: 2 },
  model: { id: "model-1", provider: "provider-1" },
  skills: [{ id: "research", name: "Research", revision: 3 }],
  sources: [{ id: "source-1", name: "Brief", state: "referenced" }],
  approvals: [{ id: "approval-1", type: "approval", status: "approved", toolName: "publish" }],
};

afterEach(cleanup);

describe("OutputProvenanceSummary", () => {
  it("shows the immutable effective execution identity", () => {
    render(<OutputProvenanceSummary provenance={generated} />);

    expect(screen.getByText(/model-1 via provider-1/)).toBeTruthy();
    expect(screen.getByText(/run run-1, attempt 2/)).toBeTruthy();
    expect(screen.getByText(/1 source reference · 1 effective skill · 1 approval/)).toBeTruthy();
    expect(screen.getByText("Research · r3")).toBeTruthy();
    expect(screen.getByText("Brief · referenced")).toBeTruthy();
    expect(screen.getByText("publish · approved")).toBeTruthy();
    expect(
      screen.getByText("References remain subject to current access and retention."),
    ).toBeTruthy();
  });

  it("does not fabricate origin details for legacy output", () => {
    render(
      <OutputProvenanceSummary
        provenance={{
          ...generated,
          completeness: "legacy",
          origin: "legacy",
          run: null,
          model: null,
          skills: [],
          sources: [],
          approvals: [],
        }}
      />,
    );

    expect(screen.getByText("Origin details are unavailable for this legacy output.")).toBeTruthy();
    expect(screen.queryByText(/model-1/)).toBeNull();
  });
});
