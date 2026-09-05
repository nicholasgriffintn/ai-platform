import type { OutputHistoryResponse, OutputProvenance } from "@ngriffin_uk/polychat-schemas";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OutputRevisionReview } from "./OutputRevisionReview";

const provenance: OutputProvenance = {
  protocolVersion: 1,
  capturedAt: "2026-09-05T12:00:00.000Z",
  completeness: "complete",
  origin: "generated",
  run: { id: "run-1", attempt: 2 },
  model: { id: "model-1", provider: "provider-1" },
  skills: [],
  sources: [],
  approvals: [],
};

const history: OutputHistoryResponse = {
  current: {
    outputId: "output-1",
    revision: 3,
    parentRevision: 2,
    title: "Current title",
    status: "ready",
    sensitivity: "personal",
    content: { body: "Current text" },
    createdByUserId: 42,
    createdAt: "2026-09-05T13:00:00.000Z",
    operation: "updated",
    restoredFromRevision: null,
    provenance,
  },
  revisions: [
    {
      outputId: "output-1",
      revision: 2,
      parentRevision: 1,
      title: "Earlier title",
      status: "ready",
      sensitivity: "personal",
      content: { body: "Earlier text" },
      createdByUserId: 42,
      createdAt: "2026-09-05T12:30:00.000Z",
      operation: "updated",
      restoredFromRevision: null,
      provenance,
    },
  ],
  restore: { supported: true, reason: null, fields: ["title", "content"] },
};

afterEach(cleanup);

describe("OutputRevisionReview", () => {
  it("compares an earlier revision and appends restore from the current fence", () => {
    const onRestore = vi.fn();

    render(<OutputRevisionReview history={history} onRestore={onRestore} />);

    expect(screen.getByText("title changed")).toBeTruthy();
    expect(screen.getByText("content changed")).toBeTruthy();
    expect(screen.getByText(/Earlier text/)).toBeTruthy();
    expect(screen.getByText(/Current text/)).toBeTruthy();
    expect(screen.getByText(/model-1 via provider-1/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Restore revision 2" }));

    expect(onRestore).toHaveBeenCalledWith(2, 3);
  });

  it("explains why review-only output cannot be restored", () => {
    render(
      <OutputRevisionReview
        history={{
          ...history,
          restore: {
            supported: false,
            reason:
              "Sandbox diffs are review-only; a local output restore cannot reverse repository work.",
            fields: [],
          },
        }}
        onRestore={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Restore revision 2" }).getAttribute("disabled"),
    ).not.toBeNull();
    expect(screen.getByText(/cannot reverse repository work/)).toBeTruthy();
  });
});
