import type { SiteTraceEntry } from "@ngriffin_uk/polychat-schemas";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SiteTraceEntries } from "../SiteTraceEntries.js";

const entries: SiteTraceEntry[] = [
  {
    kind: "decision",
    version: 1,
    id: "site-1:plan",
    stage: "plan",
    source: "decision",
    summary: "Landing page, one page",
    effects: ["Use the low coding tier", "Write in a friendly voice"],
    questions: [
      {
        id: "kind",
        question: {
          type: "choice",
          instructions: "What kind of site is this?",
          criteria: { landing: "Landing page", dashboard: "Dashboard" },
        },
        answer: {
          type: "choice",
          choice: "landing",
          probabilities: { landing: 0.92, dashboard: 0.08 },
          confidence: 0.92,
        },
      },
    ],
    provider: "typesafe",
    model: "jev-latest",
    durationMs: 148,
    createdAt: "2026-09-19T12:00:00.000Z",
  },
  {
    kind: "generation",
    version: 1,
    id: "site-1:build",
    stage: "build",
    outcome: "applied",
    summary: "Built the site with 12 updates",
    provider: "openai",
    model: "gpt-test",
    patchCount: 12,
    rejectedPatchCount: 0,
    durationMs: 1200,
    createdAt: "2026-09-19T12:00:02.000Z",
  },
];

describe("SiteTraceEntries", () => {
  it("shows decision and generation steps with expandable probabilities", () => {
    render(<SiteTraceEntries entries={entries} />);

    expect(screen.getByText("Landing page, one page")).toBeInTheDocument();
    expect(screen.getByText("Built the site with 12 updates")).toBeInTheDocument();

    const details = screen.getByText("Landing page, one page").closest("details");

    expect(details?.hasAttribute("open")).toBe(false);
    fireEvent.click(screen.getByText("Landing page, one page").closest("summary") as HTMLElement);
    expect(details?.hasAttribute("open")).toBe(true);
    expect(screen.getByText("What kind of site is this?")).toBeInTheDocument();
    expect(screen.getByText("92.0%")).toBeInTheDocument();
  });

  it("renders nothing when a turn has no trace", () => {
    const { container } = render(<SiteTraceEntries entries={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
